import { NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const GET = withTenant(async () => {
  try {
    const res = await query(`SELECT id, event, product_id, codigo_interno, received_at, hmac_valid, payload FROM produtos_nuvemshop_eventos ORDER BY id DESC LIMIT 50`, []);
    const norm = res.rows.map((r:any) => {
      let ev = String(r.event || '').toLowerCase();
      // Mapear para particípio passado em PT-BR
      // created -> criado, updated -> atualizado, deleted -> deletado, ignored -> ignorado
      let past = ev;
      if (ev.includes('created')) past = 'product/criado';
      else if (ev.includes('updated')) past = 'product/atualizado';
      else if (ev.includes('deleted')) past = 'product/deletado';
      else if (ev.includes('ignored')) past = 'product/ignorado';
      // variantes
      if (ev.includes('variant') && ev.includes('created')) past = 'variant/criada';
      else if (ev.includes('variant') && ev.includes('updated')) past = 'variant/atualizada';
      else if (ev.includes('variant') && ev.includes('deleted')) past = 'variant/deletada';
      return { ...r, event: past };
    });
    return NextResponse.json({ success: true, data: norm });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
