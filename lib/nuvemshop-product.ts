import { query } from '@/lib/database';

export interface DbProductRow {
  codigo_interno: string;
  descricao: string;
  descricao_detalhada?: string;
  preco_venda?: number; // convertido para number mesmo que origem seja texto
  quantidade?: number;  // convertido de qtde (texto)
  peso?: number;        // convertido de produtos_ou.peso (texto)
  comprimento?: number; // convertido
  largura?: number;
  altura?: number;
  codigo_gtin?: string;
  categoria?: string;
  grupo?: string;
  subgrupo?: string;
}

export interface NuvemShopVariant {
  sku: string;
  price: number;
  stock?: number;
  stock_management?: boolean;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  barcode?: string; // adicionado para mapear variante local
  values?: Array<{ pt: string }>; // usado para variações (ex: tamanho/cor)
}

export interface NuvemShopProduct {
  name: { pt: string };
  description: { pt: string };
  handle: { pt: string };
  published: boolean;
  variants: NuvemShopVariant[];
}

export function normalizeHandle(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

export function cleanHTML(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ValidationIssue { field: string; message: string }

export function validateProduct(row: DbProductRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!row.descricao || !row.descricao.trim()) issues.push({ field: 'descricao', message: 'Descrição obrigatória' });
  if (row.preco_venda === undefined || row.preco_venda === null || row.preco_venda <= 0) issues.push({ field: 'preco_venda', message: 'Preço deve ser > 0' });
  if (row.quantidade === undefined || row.quantidade === null) issues.push({ field: 'quantidade', message: 'Quantidade ausente' });
  return issues;
}

export function prepareNuvemShopProduct(row: DbProductRow): NuvemShopProduct {
  const description = cleanHTML(row.descricao_detalhada) || cleanHTML(row.descricao) || 'Produto sem descrição';
  const handle = normalizeHandle(row.descricao || row.codigo_interno);
  const variant: NuvemShopVariant = {
    sku: row.codigo_interno,
    price: row.preco_venda || 0,
    stock: row.quantidade || 0,
    stock_management: true,
    weight: row.peso || 0,
    width: row.largura || 0,
    height: row.altura || 0,
    depth: row.comprimento || 0,
  };
  return {
    name: { pt: row.descricao || 'Produto sem nome' },
    description: { pt: description },
    handle: { pt: handle },
    published: true,
    variants: [variant]
  };
}

// ---------------- VARIANTES / PRODUTO PAI -----------------
interface VariantRow extends DbProductRow { variacao?: string; caracteristica?: string; }

export async function fetchVariantsForParent(codigo_interno_pai: string): Promise<VariantRow[]> {
  try {
    const result = await query(
      `SELECT p.codigo_interno,
              p.descricao,
              pib.descricao_detalhada,
              pib.preco_venda,
              pou.qtde AS quantidade,
              pou.peso,
              pou.comprimento,
              pou.largura,
              pou.altura,
              p.codigo_gtin,
              gd.variacao,
              gd.caracteristica
       FROM produtos_gd gd
       JOIN produtos p ON gd.codigo_gtin = p.codigo_gtin
       LEFT JOIN produtos_ib  pib ON pib.codigo_interno = p.codigo_interno
       LEFT JOIN produtos_ou  pou ON pou.codigo_interno = p.codigo_interno
       WHERE gd.codigo_interno = $1 AND (gd.nome IS NULL OR gd.nome <> 'composicao')
       ORDER BY gd.codigo_gtin NULLS LAST, gd.variacao NULLS LAST, gd.caracteristica NULLS LAST`,
      [codigo_interno_pai]
    );
    const toNum = (val: any): number | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9,.-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };
    return result.rows.map((r: any) => ({
      codigo_interno: String(r.codigo_interno),
      descricao: r.descricao || '',
      descricao_detalhada: r.descricao_detalhada || undefined,
      preco_venda: toNum(r.preco_venda),
      quantidade: toNum(r.quantidade),
      peso: toNum(r.peso),
      comprimento: toNum(r.comprimento),
      largura: toNum(r.largura),
      altura: toNum(r.altura),
      codigo_gtin: r.codigo_gtin || undefined,
      variacao: r.variacao || undefined,
      caracteristica: r.caracteristica || undefined
    }));
  } catch (e) {
    console.error('[NUVEMSHOP_VARIANTS] Erro ao buscar variantes', e);
    return [];
  }
}

export function prepareParentProduct(parent: DbProductRow, variants: VariantRow[]): NuvemShopProduct {
  // attributeLabel agora deriva de variacao; values derivam de caracteristica
  const description = cleanHTML(parent.descricao_detalhada) || cleanHTML(parent.descricao) || 'Produto sem descrição';
  const handle = normalizeHandle(parent.descricao || parent.codigo_interno);
  const { sku: parentSku } = buildSkuAndBarcode({ row: parent, tipo: 'PARENT' });

  // NOVO: construir matriz de atributos (fase 1: 1 atributo)
  const matrix = buildAttributeMatrix(variants);

  const vs: NuvemShopVariant[] = variants.map((v, idx) => {
    const valueLabel = matrix.valuesPerVariant[idx] || 'Variante';
    return {
      sku: parentSku, // regra: variantes herdam SKU do pai
      price: v.preco_venda || 0,
      stock: v.quantidade || 0,
      stock_management: true,
      weight: v.peso || 0,
      width: v.largura || 0,
      height: v.altura || 0,
      depth: v.comprimento || 0,
      barcode: v.codigo_gtin || undefined,
      values: [{ pt: valueLabel }]
    };
  });
  return {
    name: { pt: parent.descricao || 'Produto sem nome' },
    description: { pt: description },
    handle: { pt: handle },
    published: true,
    // Adiciona atributo (NuvemShop aceita campo attributes na criação)
    variants: vs,
    // @ts-ignore manter compat se consumer não espera attributes
    attributes: [{ pt: matrix.attributeLabel }]
  } as any;
}

// (removido version hash conforme simplificação solicitada)

export async function fetchProductForExport(codigo_interno: string): Promise<DbProductRow | null> {
  try {
    // Estrutura real: dados principais em produtos; descrição detalhada & preço em produtos_ib; estoque & dimensões em produtos_ou
    const result = await query(
  `SELECT p.codigo_interno,
      p.descricao,
      pib.descricao_detalhada,
      pib.preco_venda,
      pib.categoria,
      pib.grupo,
      pib.subgrupo,
      pou.qtde AS quantidade,
      pou.peso,
      pou.comprimento,
      pou.largura,
      pou.altura,
      p.codigo_gtin
       FROM produtos p
       LEFT JOIN produtos_ib  pib ON pib.codigo_interno = p.codigo_interno
       LEFT JOIN produtos_ou  pou ON pou.codigo_interno = p.codigo_interno
       WHERE p.codigo_interno = $1
       LIMIT 1`,
      [codigo_interno]
    );
    if (!result.rows?.length) return null;
    const row = result.rows[0];

    // Conversões numéricas seguras (valores podem vir como texto com vírgula)
    const toNum = (val: any): number | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9,.-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    return {
      codigo_interno: String(row.codigo_interno),
      descricao: row.descricao || '',
      descricao_detalhada: row.descricao_detalhada || undefined,
      preco_venda: toNum(row.preco_venda),
      quantidade: toNum(row.quantidade),
      peso: toNum(row.peso),
      comprimento: toNum(row.comprimento),
      largura: toNum(row.largura),
      altura: toNum(row.altura),
  codigo_gtin: row.codigo_gtin || undefined,
  categoria: row.categoria || undefined,
  grupo: row.grupo || undefined,
  subgrupo: row.subgrupo || undefined
    };
  } catch (e: any) {
    // Se erro de coluna inexistente (42703) tentar fallback sem campos opcionais
    if (e?.code === '42703') {
      try {
        const fallback = await query(
          `SELECT codigo_interno, descricao, codigo_gtin
           FROM produtos WHERE codigo_interno = $1 LIMIT 1`,
          [codigo_interno]
        );
        if (!fallback.rows?.length) return null; 
        const row = fallback.rows[0];
        return {
          codigo_interno: String(row.codigo_interno),
            descricao: row.descricao || '',
            codigo_gtin: row.codigo_gtin || undefined
        };
      } catch {
        throw e; // re-lançar se fallback também falhar
      }
    }
    throw e;
  }
}

export interface MarkSyncOptions {
  tipo: 'NORMAL' | 'PARENT' | 'VARIANT';
  productId?: string | number | null;
  variantId?: string | number | null;
  parentCodigoInterno?: string | number | null;
  sku?: string | null;
  barcode?: string | null;
  status: 'ok' | 'erro';
  payloadSnapshot?: any;
  estoqueEnviado?: number | null;
  precoEnviado?: number | null;
  errorMsg?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  subgrupo?: string | null;
  nome?: string | null;
  altura?: number | null;
  largura?: number | null;
  comprimento?: number | null;
  peso?: number | null;
  published?: boolean | null;
}

// Mapear status interno para códigos ns (sem gravar mais na tabela produtos)
function mapTipoToStatusCode(tipo: MarkSyncOptions['tipo']): string {
  switch (tipo) {
  case 'PARENT': return 'ENSP';
    case 'VARIANT': return 'ENSV';
    default: return 'ENS';
  }
}

export async function markProductSync(codigo_interno: string, opts: MarkSyncOptions) {
  try {
    await ensureProdutosNuvemshopTable();
    const last_status = opts.status === 'ok' ? mapTipoToStatusCode(opts.tipo) : undefined;

    if (opts.status === 'ok') {
      // Apenas em sucesso inserimos/updatamos mapeamento completo
      await query(
        `INSERT INTO produtos_nuvemshop (
           codigo_interno, tipo, parent_codigo_interno, sku, barcode, product_id, variant_id,
           last_status, last_sync_at, last_error, sync_attempts, payload_snapshot,
           estoque_enviado, preco_enviado,
           categoria, grupo, subgrupo, nome, altura, largura, comprimento, peso,
           created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,NOW(),NULL,0,$9,$10,$11,
           $12,$13,$14,$15,$16,$17,$18,$19,
           NOW(), NOW()
         )
         ON CONFLICT (codigo_interno) DO UPDATE SET
           tipo = EXCLUDED.tipo,
           parent_codigo_interno = EXCLUDED.parent_codigo_interno,
           sku = COALESCE(EXCLUDED.sku, produtos_nuvemshop.sku),
           barcode = COALESCE(EXCLUDED.barcode, produtos_nuvemshop.barcode),
           product_id = COALESCE(EXCLUDED.product_id, produtos_nuvemshop.product_id),
           variant_id = COALESCE(EXCLUDED.variant_id, produtos_nuvemshop.variant_id),
           last_status = COALESCE(EXCLUDED.last_status, produtos_nuvemshop.last_status),
           last_sync_at = EXCLUDED.last_sync_at,
           last_error = NULL,
           payload_snapshot = COALESCE(EXCLUDED.payload_snapshot, produtos_nuvemshop.payload_snapshot),
           estoque_enviado = COALESCE(EXCLUDED.estoque_enviado, produtos_nuvemshop.estoque_enviado),
           preco_enviado = COALESCE(EXCLUDED.preco_enviado, produtos_nuvemshop.preco_enviado),
           categoria = COALESCE(EXCLUDED.categoria, produtos_nuvemshop.categoria),
           grupo = COALESCE(EXCLUDED.grupo, produtos_nuvemshop.grupo),
           subgrupo = COALESCE(EXCLUDED.subgrupo, produtos_nuvemshop.subgrupo),
           nome = COALESCE(EXCLUDED.nome, produtos_nuvemshop.nome),
           altura = COALESCE(EXCLUDED.altura, produtos_nuvemshop.altura),
           largura = COALESCE(EXCLUDED.largura, produtos_nuvemshop.largura),
           comprimento = COALESCE(EXCLUDED.comprimento, produtos_nuvemshop.comprimento),
           peso = COALESCE(EXCLUDED.peso, produtos_nuvemshop.peso),
           needs_update = FALSE,
           published = COALESCE(EXCLUDED.published, produtos_nuvemshop.published),
           updated_at = NOW()
        `,
        [
          codigo_interno,
          opts.tipo,
          opts.parentCodigoInterno ? Number(opts.parentCodigoInterno) : null,
          opts.sku || null,
          opts.barcode || null,
          opts.productId ? Number(opts.productId) : null,
          opts.variantId ? Number(opts.variantId) : null,
          last_status || null,
          opts.payloadSnapshot ? JSON.stringify(opts.payloadSnapshot) : null,
          opts.estoqueEnviado ?? null,
          opts.precoEnviado ?? null,
          opts.categoria || null,
          opts.grupo || null,
          opts.subgrupo || null,
          opts.nome || null,
          opts.altura ?? null,
          opts.largura ?? null,
          opts.comprimento ?? null,
          opts.peso ?? null
        ]
      );
      // Sincronizar tag única em produtos.ns (ENS/ENSP/ENSV) como fonte de verdade da UI
      try {
        await query(`UPDATE produtos SET ns = $2 WHERE codigo_interno = $1`, [codigo_interno, last_status || null]);
      } catch (e) {
        console.warn('[NUVEMSHOP_SYNC] Falha ao atualizar produtos.ns', { codigo_interno, last_status, e });
      }
    } else {
      // Em erro, não inserir nova linha; se já existe, apenas registra erro e tentativas.
      const existing = await query(`SELECT 1 FROM produtos_nuvemshop WHERE codigo_interno = $1`, [codigo_interno]);
      if (existing.rows?.length) {
        await query(
          `UPDATE produtos_nuvemshop
             SET last_error = $2,
                 sync_attempts = sync_attempts + 1,
                 updated_at = NOW()
           WHERE codigo_interno = $1`,
          [codigo_interno, opts.errorMsg || null]
        );
      }
    }
    if (opts.errorMsg) console.warn('[NUVEMSHOP_SYNC] Produto marcado com erro', { codigo_interno, error: opts.errorMsg });
  } catch (e) {
    console.error('[NUVEMSHOP_SYNC] Falha ao registrar sincronização', { codigo_interno, e });
  }
}

// Utilitário para construir sku e barcode conforme regras informadas.
export interface BuildSkuParams { row: DbProductRow; tipo: 'NORMAL' | 'PARENT' | 'VARIANT'; parent?: { codigo_interno: string; codigo_gtin?: string | null }; }
export function buildSkuAndBarcode({ row, tipo, parent }: BuildSkuParams) {
  const fallbackSku = `INT-${row.codigo_interno}`;
  if (tipo === 'NORMAL') {
    const sku = row.codigo_gtin || fallbackSku;
    const barcode = row.codigo_gtin || null;
    return { sku, barcode };
  }
  if (tipo === 'PARENT') {
    const sku = row.codigo_gtin || fallbackSku; // produto pai usa seu gtin como sku
    return { sku, barcode: null };
  }
  // VARIANT
  const parentSku = parent?.codigo_gtin || (parent ? `INT-${parent.codigo_interno}` : fallbackSku);
  const sku = parentSku; // variante herda sku do pai
  const barcode = row.codigo_gtin || null; // barcode próprio
  return { sku, barcode };
}

// ---------------------------------------------------------------------------
// Infra: criação automática da tabela produtos_nuvemshop se não existir ainda.
// ---------------------------------------------------------------------------
let _checkedTable = false;
async function ensureProdutosNuvemshopTable() {
  if (_checkedTable) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS produtos_nuvemshop (
        codigo_interno BIGINT PRIMARY KEY REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
        parent_codigo_interno BIGINT REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
        sku VARCHAR(60),
        barcode VARCHAR(60),
        product_id BIGINT,
        variant_id BIGINT,
        last_status VARCHAR(10),
        last_sync_at TIMESTAMPTZ,
        last_error TEXT,
        sync_attempts INT DEFAULT 0,
        payload_snapshot JSONB,
        needs_update BOOLEAN DEFAULT FALSE,
        estoque_enviado INT,
        preco_enviado NUMERIC(14,2),
        categoria VARCHAR(100),
        grupo VARCHAR(100),
        subgrupo VARCHAR(100),
        nome VARCHAR(250),
        altura NUMERIC(14,2),
        largura NUMERIC(14,2),
        comprimento NUMERIC(14,2),
        peso NUMERIC(14,2),
        published BOOLEAN DEFAULT TRUE,
        published_pending BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Garantir colunas (idempotente)
      ALTER TABLE produtos_nuvemshop
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(100),
        ADD COLUMN IF NOT EXISTS grupo VARCHAR(100),
        ADD COLUMN IF NOT EXISTS subgrupo VARCHAR(100),
        ADD COLUMN IF NOT EXISTS nome VARCHAR(250),
        ADD COLUMN IF NOT EXISTS altura NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS largura NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS comprimento NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS peso NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS published_pending BOOLEAN;
      CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_sku ON produtos_nuvemshop(sku);
      CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_parent ON produtos_nuvemshop(parent_codigo_interno);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_nuvemshop_product_variant ON produtos_nuvemshop(product_id, variant_id) WHERE variant_id IS NOT NULL;
    `, []);
  } catch (err) {
    console.error('[NUVEMSHOP_SYNC] Falha ao criar/verificar tabela produtos_nuvemshop', err);
  } finally {
    _checkedTable = true;
  }
}

// ---------------------------------------------------------------------------
// Novos helpers para atributos de variantes
// ---------------------------------------------------------------------------

export interface AttributeMatrixResult {
  attributeLabel: string; // Ex: "Variação" ou CARACTERISTICA detectada
  valuesPerVariant: string[]; // Alinhado pelo índice de variants recebidos
  distinctValues: string[]; // Valores únicos normalizados
}

/**
 * Constrói matriz de atributos a partir das linhas de variants (produtos_gd)
 * Regras atuais (fase 1):
 * - Usamos somente 1 atributo (limitação atual do front/back)
 * - Nome do atributo: se houver pelo menos uma linha com caracteristica não vazia -> usar caracteristica (primeira distinta)
 *   caso contrário usar literal 'Variação'
 * - Valor de cada variante: preferir variacao; fallback: caracteristica; fallback: descricao; fallback: 'Variante'
 * - Normalização: trim, capitaliza primeira letra, remove espaços duplicados
 */
export function buildAttributeMatrix(variants: Array<{ variacao?: string; caracteristica?: string; descricao?: string }>): AttributeMatrixResult {
  const norm = (v?: string) => {
    if (!v) return '';
    const t = v.trim();
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  };
  // Agora: atributo = primeira variacao não vazia
  let attributeLabel = 'Variação';
  for (const v of variants) {
    if (v?.variacao && v.variacao.trim()) { attributeLabel = norm(v.variacao); break; }
  }
  const valuesPerVariant = variants.map(v => {
    // value = caracteristica; fallback variacao; fallback descricao; fallback 'Variante'
    return norm(v.caracteristica) || norm(v.variacao) || norm(v.descricao) || 'Variante';
  });
  const distinctValues = Array.from(new Set(valuesPerVariant.filter(Boolean)));
  if (!distinctValues.length) distinctValues.push('Variante');
  return { attributeLabel, valuesPerVariant, distinctValues };
}

// ---------------------------------------------------------------------------
// Detectar divergências entre dados locais e snapshot remoto
// ---------------------------------------------------------------------------

export interface DivergenciaResultado {
  campo: string;
  local?: any;
  remoto?: any; // snapshot/enviado
}

export function detectarDivergencias(base: {
  local: {
    // nome removido das comparações de divergência por irrelevância operacional
    categoria?: string; grupo?: string; subgrupo?: string;
    preco?: number | null; estoque?: number | null;
    altura?: number | null; largura?: number | null; comprimento?: number | null; peso?: number | null;
  };
  snapshot: {
    // idem acima
    categoria?: string; grupo?: string; subgrupo?: string;
    preco?: number | null; estoque?: number | null;
    altura?: number | null; largura?: number | null; comprimento?: number | null; peso?: number | null;
  };
  tipo?: 'NORMAL' | 'PARENT' | 'VARIANT';
}): DivergenciaResultado[] {
  const diffs: DivergenciaResultado[] = [];
  const tipo = base.tipo || 'NORMAL';
  // Tolerância para preço: diferenças pequenas (ex.: 99,90 vs 99.99 ≈ 0,09) não geram divergência
  const PRICE_EPS = 0.10;

  // Regras de comparação por tipo:
  // - PARENT: somente campos de identificação (nome/categoria/grupo/subgrupo)
  // - VARIANT: somente numéricos e operacionais (preco/estoque/altura/largura/comprimento/peso)
  // - NORMAL: compara todos
  const stringCampos: Array<[keyof typeof base.local, string]> = [
    ['categoria','categoria'], ['grupo','grupo'], ['subgrupo','subgrupo']
  ];
  const numericCampos: Array<[keyof typeof base.local, string]> = [
    ['preco','preco'], ['estoque','estoque'],
    ['altura','altura'], ['largura','largura'], ['comprimento','comprimento'], ['peso','peso']
  ];

  let campos: Array<[keyof typeof base.local, string]> = [];
  if (tipo === 'PARENT') campos = stringCampos;
  else if (tipo === 'VARIANT') campos = numericCampos;
  else campos = [...stringCampos, ...numericCampos];

  const normStr = (v:any) => (v === undefined || v === null) ? '' : String(v);
  const toNum = (v:any) => {
    if (v === undefined || v === null || v === '') return 0;
    const s = typeof v === 'string' ? v.replace(',', '.') : v;
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };

  for (const [k,label] of campos) {
    const l = (base.local as any)[k];
    const r = (base.snapshot as any)[k];
    const isNumeric = numericCampos.some(([nk]) => nk === k);
    if (isNumeric) {
      const nL = toNum(l);
      const nR = toNum(r);
      if (label === 'preco') {
        // aplicar tolerância de preço
        if (Math.abs(nL - nR) > PRICE_EPS) {
          diffs.push({ campo: label, local: l, remoto: r });
        }
      } else {
        if (nL !== nR) {
          diffs.push({ campo: label, local: l, remoto: r });
        }
      }
    } else {
      const sL = normStr(l);
      const sR = normStr(r);
      if (sL !== sR) {
        diffs.push({ campo: label, local: l, remoto: r });
      }
    }
  }
  return diffs;
}

export async function marcarNeedsUpdate(codigo_interno: string, flag: boolean) {
  await query(`UPDATE produtos_nuvemshop SET needs_update = $2, updated_at = NOW() WHERE codigo_interno = $1`, [codigo_interno, flag]);
}
