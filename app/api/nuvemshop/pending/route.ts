import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

// Registra alterações locais (preco, estoque, published) marcando needs_update sem exportar agora
export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(()=>({}));
    const { codigo_interno, preco, estoque, published } = body || {};
    if (!codigo_interno) return NextResponse.json({ success:false, error:'codigo_interno requerido' }, { status:400 });
    const updates: string[] = [];
    const params: any[] = []; let idx = 1;
    if (preco !== undefined) { updates.push(`preco_enviado = $${++idx}`); params.push(preco); }
    if (estoque !== undefined) { updates.push(`estoque_enviado = $${++idx}`); params.push(estoque); }
    if (published !== undefined) { updates.push(`published_pending = $${++idx}`); params.push(!!published); }
    params.unshift(codigo_interno);
    if (!updates.length) {
      // Permitir enfileirar apenas marcando needs_update
      await query(`UPDATE produtos_nuvemshop SET needs_update = TRUE, updated_at = NOW() WHERE codigo_interno = $1`, [codigo_interno]);
      return NextResponse.json({ success:true, queued:true });
    }
    await query(`UPDATE produtos_nuvemshop SET ${updates.join(', ')}, needs_update = TRUE, updated_at = NOW() WHERE codigo_interno = $1`, params);
    return NextResponse.json({ success:true });
  } catch (e:any) {
    return NextResponse.json({ success:false, error:e.message }, { status:500 });
  }
})