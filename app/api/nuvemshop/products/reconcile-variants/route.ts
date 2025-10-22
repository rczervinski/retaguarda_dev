import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { getProductById } from '@/lib/nuvemshop-api';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

// Endpoint para reconciliar variantes removidas na NuvemShop marcando mappings órfãos
// Uso: POST /api/nuvemshop/products/reconcile-variants?product_id=123
export const POST = withTenant(async (req: NextRequest) => {
  try {
    const productId = req.nextUrl.searchParams.get('product_id');
    if (!productId) return NextResponse.json({ success: false, error: 'product_id obrigatório' }, { status: 400 });

    // Obter variantes remotas
    const remote = await getProductById(productId).catch(()=>null);
    if (!remote) return NextResponse.json({ success: false, error: 'Produto remoto não encontrado' }, { status: 404 });
    const remoteVariantIds = new Set<number>((remote.variants || []).map((v:any)=> Number(v.id)));

    // Buscar mappings locais
    const local = await query(`SELECT codigo_interno, variant_id FROM produtos_nuvemshop WHERE product_id = $1 AND variant_id IS NOT NULL`, [productId]);
    const orfaos: Array<{ codigo_interno: string; variant_id: number }> = [];
    for (const row of local.rows) {
      const vid = Number(row.variant_id);
      if (vid && !remoteVariantIds.has(vid)) {
        orfaos.push({ codigo_interno: String(row.codigo_interno), variant_id: vid });
      }
    }

    // Marcar órfãos limpando variant_id (mantém product_id para eventual recriação)
    if (orfaos.length) {
      await query(`UPDATE produtos_nuvemshop SET variant_id = NULL, last_error = 'Variante removida remotamente', updated_at = NOW() WHERE product_id = $1 AND variant_id = ANY($2::bigint[])`, [productId, orfaos.map(o=> o.variant_id)]);
    }

    return NextResponse.json({ success: true, removed: orfaos.length, orfaos });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
