import { NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { detectarDivergencias, marcarNeedsUpdate } from '@/lib/nuvemshop-product';

export async function POST() {
  try {
    const rows = await query(`SELECT pn.codigo_interno,
      p.descricao AS nome_local, pn.nome,
      pib.categoria AS categoria_local, pn.categoria,
      pib.grupo AS grupo_local, pn.grupo,
      pib.subgrupo AS subgrupo_local, pn.subgrupo,
      pib.preco_venda AS preco_local, pn.preco_enviado,
      pou.qtde AS estoque_local, pn.estoque_enviado,
      pou.altura AS altura_local, pn.altura,
      pou.largura AS largura_local, pn.largura,
      pou.comprimento AS comprimento_local, pn.comprimento,
      pou.peso AS peso_local, pn.peso
      FROM produtos_nuvemshop pn
      LEFT JOIN produtos p ON p.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ib pib ON pib.codigo_interno = pn.codigo_interno
      LEFT JOIN produtos_ou pou ON pou.codigo_interno = pn.codigo_interno`, []);
    let marcados = 0; let limpos = 0; const detalhes:any[] = [];
    for (const r of rows.rows) {
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
          preco: r.preco_enviado != null ? Number(r.preco_enviado) : null,
          estoque: r.estoque_enviado != null ? Number(r.estoque_enviado) : null,
          altura: r.altura != null ? Number(r.altura) : null,
          largura: r.largura != null ? Number(r.largura) : null,
          comprimento: r.comprimento != null ? Number(r.comprimento) : null,
          peso: r.peso != null ? Number(r.peso) : null
        }
      });
      const flag = diffs.length > 0;
      await marcarNeedsUpdate(String(r.codigo_interno), flag);
      if (flag) marcados++; else limpos++;
      detalhes.push({ codigo_interno: r.codigo_interno, divergencias: diffs.length });
    }
    return NextResponse.json({ success:true, marcados, limpos, total: rows.rowCount, detalhes });
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e.message }, { status:500 });
  }
}
