import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { fetchProductForExport, fetchVariantsForParent, validateProduct, prepareParentProduct, prepareNuvemShopProduct, buildSkuAndBarcode, markProductSync } from '@/lib/nuvemshop-product';
import { ensureCategoryPathExists, CategoryLimitError } from '@/lib/nuvemshop-categories';
import { listLocalImages, ensureAbsoluteBaseUrl } from '@/lib/product-images';
import { getProductImages, createProductImage } from '@/lib/nuvemshop-api';
import { upsertProductWithMapping, getProductById, createVariant, updateVariant } from '@/lib/nuvemshop-api';
import { runWithContext, initTenantForRequest } from '@/lib/request-context'

async function exportSingle(codigo_interno: string, publishedOverride?: boolean, reqHeaders?: Headers) {
  // Verificar mapeamento local para decidir fluxo (VARIANTE vs PAI/NORMAL)
  const map = await query(`SELECT tipo, product_id, variant_id, parent_codigo_interno FROM produtos_nuvemshop WHERE codigo_interno = $1`, [codigo_interno]).catch(()=>({ rows: [] as any[] }));
  const mapping = map.rows?.[0];

  // Fluxo dedicado para VARIANTE: não criar NORMAL indevido
  if (mapping?.tipo === 'VARIANT' && mapping.product_id) {
    // Carregar dados locais da variante
    const varRow = await fetchProductForExport(codigo_interno);
    if (!varRow) return { codigo_interno, ok: false, error: 'nao_encontrado' };

    // Buscar dados mínimos do pai para compor SKU
    const parentCodigo = String(mapping.parent_codigo_interno || '');
    let parentRow: any = null;
    if (parentCodigo) parentRow = await fetchProductForExport(parentCodigo).catch(()=>null);
    const { sku: variantSku, barcode: variantBarcode } = buildSkuAndBarcode({ row: varRow as any, tipo: 'VARIANT', parent: { codigo_interno: parentCodigo || codigo_interno, codigo_gtin: parentRow?.codigo_gtin } });
    const payload = {
      sku: variantSku,
      price: varRow.preco_venda || 0,
      stock: varRow.quantidade || 0,
      stock_management: true,
      weight: varRow.peso || 0,
      width: varRow.largura || 0,
      height: varRow.altura || 0,
      depth: varRow.comprimento || 0,
      barcode: variantBarcode || undefined,
    } as any;

    const productId = Number(mapping.product_id);
    let variantId = mapping.variant_id ? Number(mapping.variant_id) : null;
    if (!variantId || !Number.isFinite(variantId)) {
      // Tentar reconciliar pela barcode
      const remote = await getProductById(productId).catch(()=>null);
      const found = (remote?.variants || []).find((rv: any) => String(rv?.barcode || '') === String(variantBarcode || ''));
      if (found?.id) variantId = Number(found.id);
    }

    if (variantId) {
      await updateVariant(productId, variantId, payload).catch(()=>{});
      await markProductSync(codigo_interno, { tipo: 'VARIANT', productId, variantId, parentCodigoInterno: parentCodigo || null, status:'ok', sku: variantSku, barcode: variantBarcode||null, payloadSnapshot: payload, estoqueEnviado: varRow.quantidade||0, precoEnviado: varRow.preco_venda||0, categoria: parentRow?.categoria||null, grupo: parentRow?.grupo||null, subgrupo: parentRow?.subgrupo||null, nome: parentRow?.descricao||null, altura: varRow.altura??null, largura: varRow.largura??null, comprimento: varRow.comprimento??null, peso: varRow.peso??null });
      // Evento: variante atualizada
      try { await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5,$6)`, ['local/variant_updated', productId, variantId, codigo_interno, true, { action: 'updated' }]); } catch {}
    } else {
      // Criar variante se não existir
      const created = await createVariant(productId, payload).catch((e:any)=>{ throw new Error(e?.message || 'erro criar variante'); });
      const newId = created?.id || (Array.isArray(created)?created[0]?.id:null);
      await markProductSync(codigo_interno, { tipo: 'VARIANT', productId, variantId: newId||null, parentCodigoInterno: parentCodigo || null, status:'ok', sku: variantSku, barcode: variantBarcode||null, payloadSnapshot: payload, estoqueEnviado: varRow.quantidade||0, precoEnviado: varRow.preco_venda||0, categoria: parentRow?.categoria||null, grupo: parentRow?.grupo||null, subgrupo: parentRow?.subgrupo||null, nome: parentRow?.descricao||null, altura: varRow.altura??null, largura: varRow.largura??null, comprimento: varRow.comprimento??null, peso: varRow.peso??null });
      // Evento: variante criada
      try { await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5,$6)`, ['local/variant_created', productId, newId, codigo_interno, true, { action: 'created' }]); } catch {}
    }
    return { codigo_interno, ok: true, action: 'variant_sync', product_id: productId };
  }
  const productRow = await fetchProductForExport(codigo_interno);
  if (!productRow) return { codigo_interno, ok: false, error: 'nao_encontrado' };
  const issues = validateProduct(productRow);
  if (issues.length) return { codigo_interno, ok: false, error: 'validacao', issues };
  // Garantir categorias (PT-BR, vincular somente folha)
  let categoriaIds: number[] | undefined = undefined;
  try {
    const names = [productRow.categoria, productRow.grupo, productRow.subgrupo]
      .filter((n): n is string => !!(n && String(n).trim()))
      .map(n => String(n).trim());
    if (names.length) {
      const ensured = await ensureCategoryPathExists(names, 'pt');
      if (ensured) categoriaIds = [ensured.leafId];
    }
  } catch (e: any) {
    if (e instanceof CategoryLimitError) {
      return { codigo_interno, ok: false, error: 'limite_categorias', message: 'Limite de categorias excedido na Nuvemshop (1000). Interrompido.' };
    }
    // outros erros seguem como genericos abaixo (deixar subir para try externo, onde é capturado)
  }
  const variantes = await fetchVariantsForParent(codigo_interno);
  if (variantes.length >= 1) {
    const parentPayload = prepareParentProduct(productRow, variantes);
    // anexar imagens
    try {
      const baseUrl = ensureAbsoluteBaseUrl(reqHeaders)
      const imgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
      if (imgs.length) (parentPayload as any).images = imgs.map(i => ({ src: i.url, position: i.pos }))
    } catch {}
    if (categoriaIds && categoriaIds.length) (parentPayload as any).categories = categoriaIds;
    if (publishedOverride !== undefined) (parentPayload as any).published = publishedOverride;
    const apiResult = await upsertProductWithMapping(productRow.codigo_interno, parentPayload);
    const productId = apiResult.id;
    // adicionar imagens locais extras se for update
    try {
      const baseUrl = ensureAbsoluteBaseUrl(reqHeaders)
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
    const { sku: parentSku } = buildSkuAndBarcode({ row: productRow, tipo: 'PARENT' });
    await markProductSync(productRow.codigo_interno, {
      tipo: 'PARENT', productId, status: 'ok', sku: parentSku, barcode: null, payloadSnapshot: parentPayload,
      categoria: productRow.categoria||null, grupo: productRow.grupo||null, subgrupo: productRow.subgrupo||null, nome: productRow.descricao||null,
      altura: productRow.altura??null, largura: productRow.largura??null, comprimento: productRow.comprimento??null, peso: productRow.peso??null
    });
    // reconcile variants minimal (no events here)
    const remote = await getProductById(productId);
    const remoteByBarcode: Record<string, any> = {}; (remote?.variants||[]).forEach((rv:any)=>{ if (rv?.barcode) remoteByBarcode[String(rv.barcode)] = rv; });
    for (const v of variantes) {
      const { sku: variantSku, barcode: variantBarcode } = buildSkuAndBarcode({ row: v, tipo: 'VARIANT', parent: { codigo_interno, codigo_gtin: productRow.codigo_gtin } });
      const payload = { sku: variantSku, price: v.preco_venda||0, stock: v.quantidade||0, stock_management: true, weight: v.peso||0, width: v.largura||0, height: v.altura||0, depth: v.comprimento||0, barcode: variantBarcode||undefined };
      const existing = variantBarcode ? remoteByBarcode[String(variantBarcode)] : null;
      if (existing?.id) {
        await updateVariant(productId, existing.id, payload).catch(()=>{});
        await markProductSync(v.codigo_interno, { tipo: 'VARIANT', productId, variantId: existing.id, parentCodigoInterno: codigo_interno, status:'ok', sku: variantSku, barcode: variantBarcode||null, payloadSnapshot: payload, estoqueEnviado: v.quantidade||0, precoEnviado: v.preco_venda||0, categoria: productRow.categoria||null, grupo: productRow.grupo||null, subgrupo: productRow.subgrupo||null, nome: productRow.descricao||null, altura: productRow.altura??null, largura: productRow.largura??null, comprimento: productRow.comprimento??null, peso: productRow.peso??null });
      } else {
        try {
          const createdVar = await createVariant(productId, payload);
          const newId = createdVar?.id || (Array.isArray(createdVar)?createdVar[0]?.id:null);
          await markProductSync(v.codigo_interno, { tipo: 'VARIANT', productId, variantId: newId||null, parentCodigoInterno: codigo_interno, status:'ok', sku: variantSku, barcode: variantBarcode||null, payloadSnapshot: payload, estoqueEnviado: v.quantidade||0, precoEnviado: v.preco_venda||0, categoria: productRow.categoria||null, grupo: productRow.grupo||null, subgrupo: productRow.subgrupo||null, nome: productRow.descricao||null, altura: productRow.altura??null, largura: productRow.largura??null, comprimento: productRow.comprimento??null, peso: productRow.peso??null });
        } catch(e:any) {
          await markProductSync(v.codigo_interno, { tipo: 'VARIANT', productId, status:'erro', errorMsg: e?.message||'erro variante' });
        }
      }
    }
    return { codigo_interno, ok: true, action: apiResult.action, product_id: productId };
  }
  // Normal
  const { sku, barcode } = buildSkuAndBarcode({ row: productRow, tipo: 'NORMAL' });
  const payload = prepareNuvemShopProduct(productRow);
  // anexar imagens
  try {
    const baseUrl = ensureAbsoluteBaseUrl(reqHeaders)
    const imgs = await listLocalImages(String(productRow.codigo_interno), baseUrl)
    if (imgs.length) (payload as any).images = imgs.map(i => ({ src: i.url, position: i.pos }))
  } catch {}
  if (publishedOverride !== undefined) (payload as any).published = publishedOverride;
  if (payload.variants?.[0]) payload.variants[0].sku = sku;
  if (categoriaIds && categoriaIds.length) (payload as any).categories = categoriaIds;
  const apiResult = await upsertProductWithMapping(productRow.codigo_interno, payload);
  // adicionar imagens locais extras se for update
  try {
    const baseUrl = ensureAbsoluteBaseUrl(reqHeaders)
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
  await markProductSync(productRow.codigo_interno, { tipo: 'NORMAL', productId: apiResult.id, status:'ok', sku, barcode, payloadSnapshot: payload, estoqueEnviado: productRow.quantidade||0, precoEnviado: productRow.preco_venda||0, categoria: productRow.categoria||null, grupo: productRow.grupo||null, subgrupo: productRow.subgrupo||null, nome: productRow.descricao||null, altura: productRow.altura??null, largura: productRow.largura??null, comprimento: productRow.comprimento??null, peso: productRow.peso??null });
  return { codigo_interno, ok: true, action: apiResult.action, product_id: apiResult.id };
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await initTenantForRequest(req)
    if (!ctx.tenantId || !ctx.dbUrl) return NextResponse.json({ success:false, error:'tenant_required' }, { status:400 })
    return await runWithContext(ctx, async () => {
  const body = await req.json().catch(()=>({}));
    const { codigo_interno, codigos, published } = body;
    const lista: string[] = [];
    if (codigo_interno) lista.push(String(codigo_interno));
    if (Array.isArray(codigos)) codigos.forEach((c:any)=>{ if (c!=null) lista.push(String(c)); });
    if (!lista.length) return NextResponse.json({ success:false, error:'Informe codigo_interno ou codigos[]' }, { status:400 });
    const resultados = [] as any[];
    for (const c of lista) {
      try { resultados.push(await exportSingle(c, published, req.headers)); } catch(e:any) { resultados.push({ codigo_interno:c, ok:false, error:e?.message||'erro' }); }
    }
    return NextResponse.json({ success:true, data: resultados });
    })
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e.message }, { status:500 });
  }
}
