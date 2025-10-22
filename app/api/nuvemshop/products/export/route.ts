import { NextRequest, NextResponse } from 'next/server';
import { upsertProductWithMapping, getProductById, createVariant, updateVariant } from '@/lib/nuvemshop-api';
import { query } from '@/lib/database';
import { fetchProductForExport, validateProduct, prepareNuvemShopProduct, markProductSync, buildSkuAndBarcode, fetchVariantsForParent, prepareParentProduct, buildAttributeMatrix } from '@/lib/nuvemshop-product';
import { ensureCategoryPathExists, CategoryLimitError } from '@/lib/nuvemshop-categories';
import { listLocalImages, ensureAbsoluteBaseUrl } from '@/lib/product-images';
import { ensureProdutosEcommerceAttTable } from '@/lib/stock/tables';
import { runWithContext, initTenantForRequest } from '@/lib/request-context';
import { getProductImages, createProductImage } from '@/lib/nuvemshop-api';

// Define os tipos para a estrutura da NuvemShop
interface NuvemShopVariant {
  sku: string;
  price: number;
  stock?: number;
  stock_management?: boolean;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  values?: Array<{ pt: string }>;
}

interface NuvemShopProduct {
  name: { pt: string };
  description: { pt: string };
  handle: { pt: string };
  published: boolean;
  variants: NuvemShopVariant[];
  images?: Array<{ src: string; position: number }>;
  categories?: number[];
}

// ProductData substituído pelo DbProductRow centralizado em lib/nuvemshop-product

// (Preparação do produto reutilizada via helper importado)

// Função utilitária para extrair detalhes de erro de rede
function extractNetworkErrorDetails(err: unknown) {
  const anyErr = err as any;
  const details: Record<string, any> = {
    name: anyErr?.name,
    message: anyErr?.message,
  };
  if (anyErr?.cause) {
    const cause: any = anyErr.cause;
    details.cause = {
      name: cause?.name,
      message: cause?.message,
      code: cause?.code,
      errno: cause?.errno,
      address: cause?.address,
      port: cause?.port,
      stack: cause?.stack?.split('\n').slice(0, 3).join(' | ')
    };
  }
  details.stack = anyErr?.stack?.split('\n').slice(0, 5).join(' | ');
  return details;
}

// Lógica de upsert movida para helper (upsertProductSmart)

export async function POST(request: NextRequest) {
  try {
    const ctx = await initTenantForRequest(request)
    if (!ctx.tenantId || !ctx.dbUrl) return NextResponse.json({ success:false, error:'tenant_required' }, { status:400 })
    return await runWithContext(ctx, async () => {
    // Garantir tabela de eventos junto com primeira exportação
    try {
      // Tabelas auxiliares para dashboards e auditorias
      await ensureProdutosEcommerceAttTable().catch(()=>{})
      await query(`
        CREATE TABLE IF NOT EXISTS produtos_nuvemshop_eventos (
          id BIGSERIAL PRIMARY KEY,
          received_at TIMESTAMPTZ DEFAULT NOW(),
          event VARCHAR(60) NOT NULL,
          product_id BIGINT,
          variant_id BIGINT,
          codigo_interno BIGINT,
          hmac_valid BOOLEAN,
          payload JSONB
        );
        CREATE INDEX IF NOT EXISTS idx_pn_eventos_product ON produtos_nuvemshop_eventos(product_id);
        CREATE INDEX IF NOT EXISTS idx_pn_eventos_event ON produtos_nuvemshop_eventos(event);
      `, []);
    } catch {}
  const body = await request.json();
    const { codigo_interno } = body;

    if (!codigo_interno) {
      return NextResponse.json(
        { error: 'Código interno do produto é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar produto com campos completos
    const productRow = await fetchProductForExport(codigo_interno);
    if (!productRow) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    // Validar
    const issues = validateProduct(productRow);
    if (issues.length) {
      return NextResponse.json({ success: false, error: 'Falha de validação', issues }, { status: 400 });
    }

    // Preparar categorias (PT-BR, sem persistência)
    let categoriaIds: number[] | undefined = undefined;
    try {
      const names = [productRow.categoria, productRow.grupo, productRow.subgrupo].filter((n): n is string => !!(n && String(n).trim()))
        .map(n => String(n).trim());
      if (names.length) {
        const ensured = await ensureCategoryPathExists(names, 'pt');
        if (ensured) categoriaIds = [ensured.leafId]; // vincular apenas à folha
      }
    } catch (e: any) {
      if (e instanceof CategoryLimitError) {
        return NextResponse.json({ success: false, error: 'Limite de categorias excedido na Nuvemshop (1000). Interrompendo exportação.' }, { status: 422 });
      }
      // Outros erros: deixe falhar para diagnóstico geral mais abaixo
      throw e;
    }

    // Verificar grade (variantes)
    const variantes = await fetchVariantsForParent(codigo_interno);
    if (variantes.length >= 1) {
      // Produto PARENT com VARIANTS (mesmo que haja apenas 1 variante)
      const parentPayload = prepareParentProduct(productRow, variantes);
      // Anexar imagens apenas na criação (o helper upsert decide), mas já incluir no payload
      try {
        const baseUrl = ensureAbsoluteBaseUrl(request.headers as any)
        const imgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
        if (imgs.length) (parentPayload as any).images = imgs.map(i => ({ src: i.url, position: i.pos }))
      } catch {}
      if (categoriaIds && categoriaIds.length) (parentPayload as any).categories = categoriaIds;
      const apiResult = await upsertProductWithMapping(productRow.codigo_interno, parentPayload);
      const productId = apiResult.id;
      // Se foi atualização, adicionar imagens locais extras além do que já existe remotamente
      try {
        const baseUrl = ensureAbsoluteBaseUrl(request.headers as any)
        const localImgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
        if (localImgs.length) {
          const remoteImgs: any[] = await getProductImages(productId).catch(()=>[])
          if (Array.isArray(remoteImgs) && remoteImgs.length < localImgs.length) {
            for (let i = remoteImgs.length; i < localImgs.length; i++) {
              const li = localImgs[i]
              await createProductImage(productId, { src: li.url, position: li.pos }).catch(()=>{})
            }
          }
        }
      } catch {}
      // Registrar PARENT
      const { sku: parentSku } = buildSkuAndBarcode({ row: productRow, tipo: 'PARENT' });
      try {
        await markProductSync(productRow.codigo_interno, {
          tipo: 'PARENT',
          productId,
          status: 'ok',
          sku: parentSku,
          barcode: null,
          payloadSnapshot: parentPayload,
          categoria: productRow.categoria || null,
          grupo: productRow.grupo || null,
          subgrupo: productRow.subgrupo || null,
          nome: productRow.descricao || null,
          altura: productRow.altura ?? null,
          largura: productRow.largura ?? null,
          comprimento: productRow.comprimento ?? null,
          peso: productRow.peso ?? null
        });
      } catch {}

      // Reconciliar variantes (create/update) e mapear variant_id
      const remote = await getProductById(productId);
      const remoteByBarcode: Record<string, any> = {};
      (remote?.variants || []).forEach((rv: any) => { if (rv?.barcode) remoteByBarcode[String(rv.barcode)] = rv; });

      // NOVO: gerar matriz para garantir mesmos labels usados no parentPayload
      const matrix = buildAttributeMatrix(variantes);

      let created = 0, updated = 0;
      variantes.forEach((_v, idx) => {}); // no-op para manter idx em escopo se necessário
  for (let idx = 0; idx < variantes.length; idx++) {
        const v = variantes[idx];
        const { sku: variantSku, barcode: variantBarcode } = buildSkuAndBarcode({ row: v, tipo: 'VARIANT', parent: { codigo_interno, codigo_gtin: productRow.codigo_gtin } });
        const valueLabel = matrix.valuesPerVariant[idx] || 'Variante';
        const payload = {
          sku: variantSku,
          price: v.preco_venda || 0,
          stock: v.quantidade || 0,
            stock_management: true,
          weight: v.peso || 0,
          width: v.largura || 0,
          height: v.altura || 0,
          depth: v.comprimento || 0,
          barcode: variantBarcode || undefined,
          values: [ { pt: valueLabel } ]
        };
        const rv = variantBarcode ? remoteByBarcode[String(variantBarcode)] : null;
        if (rv?.id) {
          await updateVariant(productId, rv.id, payload).catch(() => {});
          updated++;
          try {
            await markProductSync(v.codigo_interno, {
              tipo: 'VARIANT',
              productId,
              variantId: rv.id,
              parentCodigoInterno: codigo_interno,
              status: 'ok',
              sku: variantSku,
              barcode: variantBarcode || null,
              payloadSnapshot: payload,
              estoqueEnviado: v.quantidade || 0,
              precoEnviado: v.preco_venda || 0,
              categoria: productRow.categoria || null,
              grupo: productRow.grupo || null,
              subgrupo: productRow.subgrupo || null,
              nome: productRow.descricao || null,
              altura: productRow.altura ?? null,
              largura: productRow.largura ?? null,
              comprimento: productRow.comprimento ?? null,
              peso: productRow.peso ?? null
            });
          } catch {}
          // Evento individual variante atualizada
          try {
            await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5,$6)` , ['local/variant_updated', productId, rv.id, v.codigo_interno, true, { action: 'updated', value: valueLabel }]);
          } catch {}
        } else {
          // Criar variante
          try {
            const createdVar = await createVariant(productId, payload);
            const newId = createdVar?.id || (Array.isArray(createdVar) ? createdVar[0]?.id : null);
            created++;
            await markProductSync(v.codigo_interno, {
              tipo: 'VARIANT',
              productId,
              variantId: newId || null,
              parentCodigoInterno: codigo_interno,
              status: 'ok',
              sku: variantSku,
              barcode: variantBarcode || null,
              payloadSnapshot: payload,
              estoqueEnviado: v.quantidade || 0,
              precoEnviado: v.preco_venda || 0,
              categoria: productRow.categoria || null,
              grupo: productRow.grupo || null,
              subgrupo: productRow.subgrupo || null,
              nome: productRow.descricao || null,
              altura: productRow.altura ?? null,
              largura: productRow.largura ?? null,
              comprimento: productRow.comprimento ?? null,
              peso: productRow.peso ?? null
            });
            // Evento individual variante criada
            try {
              await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5,$6)` , ['local/variant_created', productId, newId, v.codigo_interno, true, { action: 'created', value: valueLabel }]);
            } catch {}
          } catch (e) {
            // Se falhar criar uma variante, seguir com as demais
            await markProductSync(v.codigo_interno, { tipo: 'VARIANT', productId, status: 'erro', errorMsg: (e as any)?.message || 'erro ao criar variante' });
          }
        }
      }

      // Evento local
      try {
        const ev = apiResult.action === 'created' ? 'local/product_created' : 'local/product_updated';
        await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5)` , [ev, productId, productRow.codigo_interno, true, { action: apiResult.action, variants: { created, updated } }]);
      } catch {}
    return NextResponse.json({ success: true, action: apiResult.action, product_id: productId, variants: { created, updated } });
    }

  // Sem nenhuma variante: exportar como NORMAL
    const tipo: 'NORMAL' = 'NORMAL';
    const { sku, barcode } = buildSkuAndBarcode({ row: productRow, tipo });
    const nuvemshopProduct = prepareNuvemShopProduct(productRow);
    // Anexar imagens
    try {
      const baseUrl = ensureAbsoluteBaseUrl(request.headers as any)
      const imgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
      if (imgs.length) (nuvemshopProduct as any).images = imgs.map(i => ({ src: i.url, position: i.pos }))
    } catch {}
    if (nuvemshopProduct.variants?.[0]) nuvemshopProduct.variants[0].sku = sku;
    if (categoriaIds && categoriaIds.length) (nuvemshopProduct as any).categories = categoriaIds;
    const apiResult = await upsertProductWithMapping(productRow.codigo_interno, nuvemshopProduct);
      // Se foi atualização, adicionar imagens locais extras além do que já existe remotamente
      try {
        const baseUrl = ensureAbsoluteBaseUrl(request.headers as any)
        const localImgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
        if (localImgs.length) {
          const remoteImgs: any[] = await getProductImages(apiResult.id).catch(()=>[])
          if (Array.isArray(remoteImgs) && remoteImgs.length < localImgs.length) {
            for (let i = remoteImgs.length; i < localImgs.length; i++) {
              const li = localImgs[i]
              await createProductImage(apiResult.id, { src: li.url, position: li.pos }).catch(()=>{})
            }
          }
        }
      } catch {}
    try {
      await markProductSync(productRow.codigo_interno, {
        tipo,
        productId: apiResult.id,
        status: 'ok',
        sku,
        barcode,
        payloadSnapshot: nuvemshopProduct,
        estoqueEnviado: productRow.quantidade || 0,
        precoEnviado: productRow.preco_venda || 0,
        categoria: productRow.categoria || null,
        grupo: productRow.grupo || null,
        subgrupo: productRow.subgrupo || null,
        nome: productRow.descricao || null,
        altura: productRow.altura ?? null,
        largura: productRow.largura ?? null,
        comprimento: productRow.comprimento ?? null,
        peso: productRow.peso ?? null
      });
    } catch {}
  try {
      const ev = apiResult.action === 'created' ? 'local/product_created' : 'local/product_updated';
      await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5)` , [ev, apiResult.id, productRow.codigo_interno, true, { action: apiResult.action }]);
    } catch {}
  return NextResponse.json({ success: true, action: apiResult.action, product_id: apiResult.id, data: apiResult.data });
    })
  } catch (error) {
  // Tornar a resposta mais diagnóstica para o front (temporário)
    const details = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao exportar produto:', details);
    // Tentar marcar erro (best-effort)
    try {
      const body = await request.json().catch(()=>null);
      const codigo_interno = body?.codigo_interno;
  if (codigo_interno) await markProductSync(codigo_interno, { tipo: 'NORMAL', status: 'erro', errorMsg: details });
    } catch {}
    return NextResponse.json({ success: false, error: 'Erro interno do servidor', details }, { status: 500 });
  }
}
