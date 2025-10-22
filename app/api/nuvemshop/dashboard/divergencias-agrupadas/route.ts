import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/database';
import { detectarDivergencias } from '@/lib/nuvemshop-product';
import { withTenant } from '@/lib/with-tenant';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

export const GET = withTenant(async (_req: NextRequest) => {
  try {
    // Unifica com a mesma lógica do endpoint /api/nuvemshop/divergencias (GET all)
  const rows = await query(`SELECT pn.codigo_interno, pn.tipo,
    pn.product_id, pn.variant_id, pn.sku, pn.barcode,
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
    pn.parent_codigo_interno,
    pnp.nome AS parent_nome
      FROM produtos_nuvemshop pn
      LEFT JOIN produtos p ON p.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ib pib ON pib.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ou pou ON pou.codigo_interno = pn.codigo_interno
    LEFT JOIN produtos_nuvemshop pnp ON pnp.codigo_interno = pn.parent_codigo_interno
      ORDER BY pn.codigo_interno ASC`, []);

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
      const displayName = r.tipo === 'VARIANT' ? (r.nome || r.nome_local || r.parent_nome) : (r.nome || r.nome_local);
      return { 
        codigo_interno: r.codigo_interno,
        tipo: r.tipo,
        product_id: r.product_id,
        variant_id: r.variant_id,
        sku: r.sku,
        barcode: r.barcode,
        nome: displayName,
        divergencias: diffs 
      };
    }).filter((item: any) => item.divergencias.length > 0);

    return NextResponse.json({ success:true, data: lista, total: lista.length });
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e.message }, { status:500 });
  }
})
