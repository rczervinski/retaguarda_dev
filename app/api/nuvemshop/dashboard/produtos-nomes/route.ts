import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(()=> ({}));
    const codigos: string[] = Array.isArray(body.codigos) ? body.codigos.map(String) : [];
    if (!codigos.length) return NextResponse.json({ success: true, nomes: {} });
    // Remover duplicados e limitar para segurança
    const uniq = Array.from(new Set(codigos)).slice(0, 2000);
    const placeholders = uniq.map((_,i)=> `$${i+1}`).join(',');
    const res = await query(`SELECT codigo_interno, descricao FROM produtos WHERE codigo_interno IN (${placeholders})`, uniq);
    const map: Record<string,string> = {};
    res.rows.forEach((r: any) => { if (r.codigo_interno) map[String(r.codigo_interno)] = r.descricao || ''; });
    return NextResponse.json({ success: true, nomes: map });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
