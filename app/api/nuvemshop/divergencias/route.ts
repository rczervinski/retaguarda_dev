import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { detectarDivergencias, marcarNeedsUpdate } from '@/lib/nuvemshop-product';
import { withTenant } from '@/lib/with-tenant';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

// GET /api/nuvemshop/divergencias?codigo_interno=123  (um)
// GET /api/nuvemshop/divergencias                      (todos – limitado)
// POST body { codigo_interno }  recalcula e atualiza needs_update

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const codigo = searchParams.get('codigo_interno');
    if (codigo) {
      const rows = await query(`SELECT pn.*, p.descricao AS nome_local, pib.categoria AS categoria_local, pib.grupo AS grupo_local, pib.subgrupo AS subgrupo_local, pib.preco_venda AS preco_local, pou.qtde AS estoque_local, pou.altura AS altura_local, pou.largura AS largura_local, pou.comprimento AS comprimento_local, pou.peso AS peso_local
        FROM produtos_nuvemshop pn
        LEFT JOIN produtos p ON p.codigo_interno = pn.codigo_interno
        LEFT JOIN produtos_ib pib ON pib.codigo_interno = pn.codigo_interno
        LEFT JOIN produtos_ou pou ON pou.codigo_interno = pn.codigo_interno
        WHERE pn.codigo_interno = $1
        LIMIT 1`, [codigo]);
      if (!rows.rowCount) return NextResponse.json({ success: false, error: 'Nao encontrado' }, { status: 404 });
      const r = rows.rows[0];
      const diffs = detectarDivergencias({
        local: {
          categoria: r.categoria_local,
          grupo: r.grupo_local,
            subgrupo: r.subgrupo_local,
          preco: r.preco_local != null ? Number(r.preco_local) : null,
          estoque: r.estoque_local != null ? Number(r.estoque_local) : null,
          altura: r.altura_local != null ? Number(r.altura_local) : null,
          largura: r.largura_local != null ? Number(r.largura_local) : null,
          comprimento: r.comprimento_local != null ? Number(r.comprimento_local) : null,
          peso: r.peso_local != null ? Number(r.peso_local) : null
        },
        snapshot: {
          categoria: r.categoria,
          grupo: r.grupo,
          subgrupo: r.subgrupo,
          preco: r.preco_enviado != null ? Number(r.preco_enviado) : 0,
          estoque: r.estoque_enviado != null ? Number(r.estoque_enviado) : 0,
          altura: r.altura != null ? Number(r.altura) : 0,
          largura: r.largura != null ? Number(r.largura) : 0,
          comprimento: r.comprimento != null ? Number(r.comprimento) : 0,
          peso: r.peso != null ? Number(r.peso) : 0
        },
        tipo: (r.tipo as any) || 'NORMAL'
      });
      return NextResponse.json({ success: true, data: { codigo_interno: codigo, diffs } });
    }
    // Todos (limitado 200)
    const rows = await query(`SELECT pn.codigo_interno, pn.tipo,
      p.descricao AS nome_local, pn.nome,
      pib.categoria AS categoria_local, pn.categoria,
      pib.grupo AS grupo_local, pn.grupo,
      pib.subgrupo AS subgrupo_local, pn.subgrupo,
      pib.preco_venda AS preco_local, pn.preco_enviado,
      pou.qtde AS estoque_local, pn.estoque_enviado,
      pou.altura AS altura_local, pn.altura,
      pou.largura AS largura_local, pn.largura,
      pou.comprimento AS comprimento_local, pn.comprimento,
      pou.peso AS peso_local, pn.peso,
      pn.needs_update
      FROM produtos_nuvemshop pn
      LEFT JOIN produtos p ON p.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ib pib ON pib.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ou pou ON pou.codigo_interno = pn.codigo_interno
      ORDER BY pn.codigo_interno ASC
      LIMIT 200`, []);
    const lista = rows.rows.map((r: any) => {
      const diffs = detectarDivergencias({
        local: {
          categoria: r.categoria_local,
          grupo: r.grupo_local,
          subgrupo: r.subgrupo_local,
          preco: r.preco_local != null ? Number(r.preco_local) : null,
          estoque: r.estoque_local != null ? Number(r.estoque_local) : null,
          altura: r.altura_local != null ? Number(r.altura_local) : null,
          largura: r.largura_local != null ? Number(r.largura_local) : null,
          comprimento: r.comprimento_local != null ? Number(r.comprimento_local) : null,
          peso: r.peso_local != null ? Number(r.peso_local) : null
        },
        snapshot: {
          categoria: r.categoria,
          grupo: r.grupo,
          subgrupo: r.subgrupo,
          preco: r.preco_enviado != null ? Number(r.preco_enviado) : 0,
          estoque: r.estoque_enviado != null ? Number(r.estoque_enviado) : 0,
          altura: r.altura != null ? Number(r.altura) : 0,
          largura: r.largura != null ? Number(r.largura) : 0,
          comprimento: r.comprimento != null ? Number(r.comprimento) : 0,
          peso: r.peso != null ? Number(r.peso) : 0
        },
        tipo: (r.tipo as any) || 'NORMAL'
      });
      return { codigo_interno: r.codigo_interno, divergencias: diffs.length, needs_update: r.needs_update, diffs };
    });
    return NextResponse.json({ success: true, data: lista });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(()=>({}));
    const { codigo_interno } = body || {};
    if (!codigo_interno) return NextResponse.json({ success: false, error: 'codigo_interno requerido' }, { status: 400 });
    // Reusar GET unitário
    const url = new URL(req.url);
    url.searchParams.set('codigo_interno', String(codigo_interno));
    const fakeReq = new Request(url.toString());
    const resp = await GET(fakeReq as any) as any;
    const json = await resp.json();
    if (!json.success) return NextResponse.json(json, { status: 400 });
    const diffs = json.data.diffs || [];
    await marcarNeedsUpdate(String(codigo_interno), diffs.length > 0);
    return NextResponse.json({ success: true, codigo_interno, divergencias: diffs.length, needs_update: diffs.length > 0 });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
