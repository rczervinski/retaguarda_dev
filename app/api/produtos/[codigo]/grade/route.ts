import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

// Necessário para usar pg
export const runtime = 'nodejs';

async function getMeta(runner: { query: (sql: string, params?: any[]) => Promise<any> }, table: string) {
  const exists = await runner.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [table.toLowerCase()]
  );
  if (!exists.rowCount) return { exists: false, columns: [] as string[] };
  const cols = await runner.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table.toLowerCase()]
  );
  return { exists: true, columns: cols.rows.map((r: any) => r.column_name) as string[] };
}

export const GET = withTenant(async (
  _req: NextRequest,
  params?: { codigo?: string }
) => {
  const inicio = Date.now();
  const codigoInternoStr = params?.codigo;
  try {
    if (!codigoInternoStr) {
      return NextResponse.json({ success: false, error: 'Código do produto é obrigatório' }, { status: 400 });
    }
    const codigoInterno = parseInt(String(codigoInternoStr), 10);
    if (!Number.isFinite(codigoInterno)) {
      return NextResponse.json({ success: false, error: 'Código inválido' }, { status: 400 });
    }
    const table = 'produtos_gd';
    const meta = await getMeta({ query }, table);
    if (!meta.exists) {
      return NextResponse.json({ success: true, grade: [], count: 0, aviso: 'Tabela produtos_gd inexistente' });
    }

    const cols = meta.columns;
    const has = (c: string) => cols.includes(c);

    if (!has('codigo_interno')) {
      return NextResponse.json({ success: true, grade: [], count: 0, aviso: 'Sem coluna codigo_interno' });
    }

    // Query enriquecida reintroduzida
    const selectParts: string[] = [];
    selectParts.push('gd.codigo');
    if (has('codigo_interno')) selectParts.push('gd.codigo_interno');
    if (has('codigo_gtin')) selectParts.push('gd.codigo_gtin');
    if (has('nome')) selectParts.push('gd.nome');
    if (has('variacao')) selectParts.push('gd.variacao');
    if (has('caracteristica')) selectParts.push('gd.caracteristica');

    const sql = `
      SELECT 
        ${selectParts.join(', ')},
        COALESCE(pib.preco_venda, '0') AS preco_venda,
        COALESCE(pib.preco_compra, '0') AS preco_compra,
        COALESCE(pou.qtde, '0') AS estoque,
        COALESCE(pou.comprimento, '0') AS comprimento,
        COALESCE(pou.largura, '0') AS largura,
        COALESCE(pou.altura, '0') AS altura,
        COALESCE(pou.peso, '0') AS peso
      FROM ${table} gd
      LEFT JOIN produtos p ON gd.codigo_gtin = p.codigo_gtin
      LEFT JOIN produtos_ib pib ON p.codigo_interno = pib.codigo_interno
      LEFT JOIN produtos_ou pou ON p.codigo_interno = pou.codigo_interno
      WHERE gd.codigo_interno = $1
        AND (gd.nome IS NULL OR gd.nome <> 'composicao')
      ORDER BY gd.codigo ASC
    `;
    const result = await query(sql, [codigoInterno]);

    const grade = result.rows.map((r: any) => ({
      codigo: r.codigo,
      codigo_interno: r.codigo_interno,
      codigo_gtin: r.codigo_gtin || '',
      descricao: r.nome || '',
      variacao: r.variacao || '',
      caracteristica: r.caracteristica || '',
      preco_venda: parseFloat(r.preco_venda) || 0,
      estoque: parseInt(r.estoque) || 0,
      comprimento: parseFloat(r.comprimento) || 0,
      largura: parseFloat(r.largura) || 0,
      altura: parseFloat(r.altura) || 0,
      peso: parseFloat(r.peso) || 0
    }));

    return NextResponse.json({ success: true, grade, count: grade.length, meta_cols: cols, tempo_ms: Date.now() - inicio });
  } catch (e: any) {
    console.error('🔴 [GRADE GET] ERRO:', e);
    return NextResponse.json({
      success: false,
      error: 'Erro ao carregar grade',
      detalhe: e.message
    }, { status: 500 });
  }
});

export const POST = withTenant(async (
  request: NextRequest,
  params?: { codigo?: string }
) => {
  const inicio = Date.now();
  const codigoInternoStr = params?.codigo;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const variantes = Array.isArray(body?.variantes) ? body.variantes : [];
  // Se nenhuma variante for enviada, interpretamos como "limpar grade".
  // Prosseguimos com a deleção e commit sem inserir registros.

  try {
    if (!codigoInternoStr) {
      return NextResponse.json({ success: false, error: 'Código do produto é obrigatório' }, { status: 400 });
    }
    const codigoInterno = parseInt(String(codigoInternoStr), 10);
    if (!Number.isFinite(codigoInterno)) {
      return NextResponse.json({ success: false, error: 'Código inválido' }, { status: 400 });
    }
    const table = 'produtos_gd';
    const meta = await getMeta({ query }, table);
    if (!meta.exists) {
      return NextResponse.json({ success: false, error: `Tabela ${table} não encontrada` }, { status: 500 });
    }
    const cols = meta.columns;
    const has = (c: string) => cols.includes(c);

    if (!has('codigo_interno')) {
      return NextResponse.json({ success: false, error: 'Tabela sem coluna codigo_interno' }, { status: 500 });
    }
    if (!has('codigo')) {
      return NextResponse.json({ success: false, error: 'Tabela sem coluna codigo (PK)' }, { status: 500 });
    }
    if (!has('nome')) {
      return NextResponse.json({ success: false, error: 'Tabela sem coluna nome (descrição)' }, { status: 500 });
    }

    let inseridos = 0;
    // Detectar se a coluna 'codigo' possui DEFAULT (sequence/nextval)
    const defRes = await query(
      `SELECT column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = 'codigo'`,
      [table.toLowerCase()]
    );
    const hasCodigoDefault = Boolean(defRes.rows?.[0]?.column_default);

    // Caso não tenha default, calculamos manualmente de forma consistente
    let baseCodigoText: string = '0';
    let offset: number = 1; // incremento por linha, calculado em SQL (base + offset)

    // Inserções dentro de uma transação
    await transaction(async (client) => {
      // Remover linhas anteriores da grade (preserva composicao)
      await client.query(
        `DELETE FROM ${table}
         WHERE codigo_interno = $1
           AND (nome IS NULL OR nome <> 'composicao')`,
        [codigoInterno]
      );

      if (!hasCodigoDefault) {
        // Descobrir MAX(codigo) uma única vez; manter como texto para usar no SQL
        const maxRes = await client.query(`SELECT COALESCE(MAX(codigo), 0) AS max FROM ${table}`);
        baseCodigoText = String(maxRes.rows?.[0]?.max ?? '0');
        offset = 1;
      }

      const hasGtin = has('codigo_gtin');
      const hasVariacao = has('variacao');
      const hasCaracteristica = has('caracteristica');

      for (const raw of variantes) {
        // Normalização
        const codigo_gtin = (raw.codigo_gtin || '').toString().trim();
        const nome = (raw.descricao || raw.nome || '').toString().trim();
  const variacao = (raw.variacao || '').toString().trim();
  const caracteristica = (raw.caracteristica || '').toString().trim().toUpperCase();

        if (!nome && !codigo_gtin) {
          continue; // nada útil
        }

        let campos: string[];
        let valores: any[];
        let placeholders: string[];
        let idx: number;

        if (hasCodigoDefault) {
          // Deixe o banco gerar 'codigo'
          campos = ['codigo_interno', 'nome'];
          valores = [codigoInterno, nome];
          placeholders = ['$1', '$2'];
          idx = 2;
        } else {
          // Gerar manualmente baseado em MAX(codigo) + offset
          campos = ['codigo', 'codigo_interno', 'nome'];
          valores = [baseCodigoText, offset, codigoInterno, nome];
          placeholders = ['(CAST($1 AS BIGINT) + $2)', '$3', '$4'];
          idx = 4;
        }

        if (hasGtin && codigo_gtin) {
          campos.push('codigo_gtin');
          valores.push(codigo_gtin);
          placeholders.push(`$${++idx}`);
        }
        if (hasVariacao && variacao) {
          campos.push('variacao');
          valores.push(variacao);
          placeholders.push(`$${++idx}`);
        }
        if (hasCaracteristica && caracteristica) {
          campos.push('caracteristica');
          valores.push(caracteristica);
          placeholders.push(`$${++idx}`);
        }

        const sql = `
          INSERT INTO ${table} (${campos.join(', ')})
          VALUES (${placeholders.join(', ')})
        `;
        try {
          await client.query(sql, valores);
          inseridos++;
          if (!hasCodigoDefault) offset = offset + 1;
        } catch (e: any) {
          console.error('❌ Erro inserindo variante:', e.message, { sql, valores });
          throw e;
        }
      }
    });

    // Persistência de preço / estoque / dimensões (se existirem registros)
    // produtos_ib (preço)
    // produtos_ou (qtde + dimensões)
    // Aqui faremos UPSERT simples (delete + insert) para simplificar
    const variantesValidas = variantes.filter((v: any) => v.codigo_gtin);
    if (variantesValidas.length) {
      // Carrega mapa GTIN -> codigo_interno variante
      const gtins = variantesValidas.map((v: any) => v.codigo_gtin);
      const mapVar = await query(
        `SELECT codigo_interno, codigo_gtin FROM produtos WHERE codigo_gtin = ANY($1::text[])`,
        [gtins]
      );
      const gtinToCodigoInterno: Record<string,string> = {};
      mapVar.rows.forEach((r: any) => { if (r.codigo_gtin) gtinToCodigoInterno[r.codigo_gtin] = r.codigo_interno; });

      // Preços
      try {
        await transaction(async (client) => {
          for (const v of variantesValidas) {
            const gtin = (v.codigo_gtin || '').toString();
            const codVar = gtinToCodigoInterno[gtin];
            if (!codVar) continue;
            const preco = parseFloat(v.preco_venda) || 0;
            await client.query(
              `INSERT INTO produtos_ib (codigo_interno, preco_venda)
               VALUES ($1,$2)
               ON CONFLICT (codigo_interno) DO UPDATE SET preco_venda = EXCLUDED.preco_venda`,
              [codVar, preco]
            );
          }
        });
      } catch (e: any) {
        console.warn('⚠️ Falha ao sincronizar preços (prossegue mesmo assim):', e.message);
      }

      // Estoque e dimensões
      try {
        await transaction(async (client) => {
          for (const v of variantesValidas) {
            const gtin = (v.codigo_gtin || '').toString();
            const codVar = gtinToCodigoInterno[gtin];
            if (!codVar) continue;
            await client.query(
              `INSERT INTO produtos_ou (codigo_interno, qtde, comprimento, largura, altura, peso)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (codigo_interno) DO UPDATE SET
                 qtde = EXCLUDED.qtde,
                 comprimento = EXCLUDED.comprimento,
                 largura = EXCLUDED.largura,
                 altura = EXCLUDED.altura,
                 peso = EXCLUDED.peso`,
              [
                codVar,
                parseInt(v.estoque) || 0,
                parseFloat(v?.dimensoes?.comprimento) || 0,
                parseFloat(v?.dimensoes?.largura) || 0,
                parseFloat(v?.dimensoes?.altura) || 0,
                parseFloat(v?.dimensoes?.peso) || 0
              ]
            );
          }
        });
      } catch (e: any) {
        console.warn('⚠️ Falha ao sincronizar estoque/dimensões (prossegue):', e.message);
      }
    }

    // Conferência
    const confer = await query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE codigo_interno = $1 AND (nome IS NULL OR nome <> 'composicao')`,
      [parseInt(String(codigoInternoStr), 10)]
    );

    return NextResponse.json({
      success: true,
      message: 'Grade salva',
      inseridos,
      conferido_total: confer.rows[0].c,
      tempo_ms: Date.now() - inicio
    });
  } catch (e: any) {
    console.error('🔴 [GRADE POST] ERRO:', e);
    return NextResponse.json({
      success: false,
      error: 'Erro ao salvar grade',
      detalhe: e.message
    }, { status: 500 });
  }
});