import { query } from '@/lib/database'
import { getProductImages, createProductImage, deleteProductImage, getActiveNuvemshopCredentials } from '@/lib/nuvemshop-api'

export type ImageAction =
  | { type: 'add'; url: string; position?: number }
  | { type: 'delete'; position: number }
  | { type: 'reorder'; positions: number[] } // positions length = total images; desired order is 1..N by index

export interface SyncResult { platform: string; success: boolean; details?: any; error?: string }

async function isLinkedToNuvemshop(codigoInterno: string): Promise<boolean> {
  try {
    const res = await query(`SELECT 1 FROM produtos_nuvemshop WHERE codigo_interno = $1 AND product_id IS NOT NULL LIMIT 1`, [codigoInterno])
    return !!res.rows?.length
  } catch {
    return false
  }
}

async function getNuvemshopProductId(codigoInterno: string): Promise<number | null> {
  try {
    const res = await query(`SELECT product_id FROM produtos_nuvemshop WHERE codigo_interno = $1 LIMIT 1`, [codigoInterno])
    const id = res.rows?.[0]?.product_id
    return id != null ? Number(id) : null
  } catch {
    return null
  }
}

export async function getLinkedPlatforms(codigoInterno: string): Promise<string[]> {
  const platforms: string[] = []
  if (await isLinkedToNuvemshop(codigoInterno)) platforms.push('nuvemshop')
  // Futuro: if (await isLinkedToMercadoLivre(...)) platforms.push('mercado-livre')
  // Futuro: if (await isLinkedToShopee(...)) platforms.push('shopee')
  return platforms
}

export async function syncImageActionAcrossPlatforms(codigoInterno: string, action: ImageAction): Promise<SyncResult[]> {
  const platforms = await getLinkedPlatforms(codigoInterno)
  const results: SyncResult[] = []
  for (const p of platforms) {
    try {
      if (p === 'nuvemshop') {
        const r = await handleNuvemshop(codigoInterno, action)
        results.push({ platform: p, success: true, details: r })
      } else {
        results.push({ platform: p, success: false, error: 'Plataforma ainda não implementada' })
      }
    } catch (e: any) {
      results.push({ platform: p, success: false, error: e?.message || String(e) })
    }
  }
  return results
}

async function handleNuvemshop(codigoInterno: string, action: ImageAction) {
  const productId = await getNuvemshopProductId(codigoInterno)
  if (!productId) throw new Error('Produto sem mapeamento Nuvemshop')
  if (action.type === 'add') {
    const body: { src: string; position?: number } = { src: action.url }
    if (action.position && action.position > 0) body.position = action.position
    const created = await createProductImage(productId, body)
    return { created }
  }
  if (action.type === 'delete') {
    // Encontrar imagem pelo position atual remoto e deletar
    const list = await getProductImages(productId)
    const target = (Array.isArray(list) ? list : []).find((i: any) => Number(i.position) === Number(action.position))
    if (!target?.id) throw new Error(`Imagem na posição ${action.position} não encontrada no remoto`)
    await deleteProductImage(productId, target.id)
    return { deletedId: target.id }
  }
  if (action.type === 'reorder') {
    // Estratégia: carregar atual, ordenar por posição antiga, e aplicar novas posições sequencialmente
    const list = await getProductImages(productId)
    const current = (Array.isArray(list) ? list : []).slice().sort((a: any, b: any) => Number(a.position) - Number(b.position))
    const desired = action.positions
    if (!desired || !desired.length || desired.length !== current.length) {
      throw new Error('Lista de posições inválida para reorder')
    }
    // desired é um array com o novo order index → posição (1..N). Ex: [1,3,2] significa primeiro item vai para pos 1, segundo -> pos 3, terceiro -> pos 2
    // Para neutralizar ambiguidades, vamos setar posição incrementalmente por índice final: o item na nova ordem índice k recebe position k+1.
    // Como não temos mapping por ID no cliente, assumimos a ordem local e remota estão alinhadas após operações anteriores.
    // Então a nova ordem é dada pelo array de índices do current; mas recebemos apenas positions. Vamos interpretar 'positions' como nova ordem sequencial 1..N.
    const creds = await getActiveNuvemshopCredentials()
    for (let idx = 0; idx < current.length; idx++) {
      const img = current[idx]
      const newPos = desired[idx]
      if (Number(img.position) !== Number(newPos)) {
        const url = `https://api.tiendanube.com/v1/${creds.storeId}/products/${productId}/images/${img.id}`
        await fetch(url, {
          method: 'PUT',
          headers: {
            'Authentication': `bearer ${creds.accessToken}`,
            'User-Agent': creds.userAgent,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ position: Number(newPos) })
        }).then(async (res) => {
          if (!res.ok) {
            const t = await res.text().catch(()=> '')
            throw new Error(`PUT image ${img.id} -> ${res.status} ${res.statusText} ${t}`)
          }
        })
      }
    }
    return { reordered: true, count: current.length }
  }
}

export function describePlatforms(platforms: string[]): string {
  if (!platforms.length) return 'nenhuma plataforma vinculada'
  return platforms.join(', ')
}
