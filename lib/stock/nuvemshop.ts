import { query } from '@/lib/database'
import { getProductById, updateVariant, getLocalMapping } from '@/lib/nuvemshop-api'

export async function getNsLink(codigoInterno: string | number) {
  const res = await query(`SELECT product_id, variant_id, sku FROM produtos_nuvemshop WHERE codigo_interno = $1 LIMIT 1`, [codigoInterno])
  if (!res.rows?.length) return null
  const r = res.rows[0]
  return { product_id: r.product_id ? Number(r.product_id) : null, variant_id: r.variant_id ? Number(r.variant_id) : null, sku: r.sku || null }
}

export async function applyStockDeltaNuvemshop(codigoInterno: string | number, qtyDelta: number, barcode?: string | null) {
  const link = await getNsLink(codigoInterno)
  if (!link?.product_id) throw new Error('Produto não mapeado na Nuvemshop')

  // Se for PARENT, não ajustar estoque (pais não têm estoque).
  const localMap = await getLocalMapping(String(codigoInterno)).catch(()=>null)
  if (localMap?.tipo === 'PARENT') {
    throw new Error('Produto PARENT não possui estoque; ignorando ajuste')
  }

  const product = await getProductById(link.product_id)
  const variants = Array.isArray(product?.variants) ? product.variants : []
  let target = null as any

  // 1) Variantes: preferir encontrar pelo barcode informado (GTIN da venda)
  if (!target && barcode) target = variants.find((v: any) => (v?.barcode != null) && String(v.barcode) === String(barcode))
  // 2) Pelo variant_id mapeado localmente
  if (!target && link.variant_id) target = variants.find((v: any) => Number(v.id) === Number(link.variant_id))
  // 3) Pelo SKU mapeado localmente (para NORMAL)
  if (!target && link.sku) target = variants.find((v: any) => String(v.sku) === String(link.sku))
  // 4) Se só houver uma variante, usar ela (NORMAL)
  if (!target && variants.length === 1) target = variants[0]
  if (!target) throw new Error('Variação alvo não encontrada para atualizar estoque')

  const current = Number(target.stock ?? 0) || 0
  const next = Math.max(0, current + Number(qtyDelta))
  await updateVariant(link.product_id, target.id, { stock: next })
  return { product_id: link.product_id, variant_id: target.id, stock_from: current, stock_to: next }
}
