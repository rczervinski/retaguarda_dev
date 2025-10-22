import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

export const GET = withTenant(async (_req: NextRequest) => {
  try {
  const res = await query(`SELECT codigo_interno, tipo, parent_codigo_interno, sku, barcode, product_id, variant_id, last_status, estoque_enviado, preco_enviado, needs_update FROM produtos_nuvemshop ORDER BY codigo_interno ASC`, []);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
