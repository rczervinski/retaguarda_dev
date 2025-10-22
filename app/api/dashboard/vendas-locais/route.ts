import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.max(1, Math.min(30, Number(searchParams.get('days') ?? 7)))
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') ?? 50)))
    const sql = `
      WITH dados AS (
        SELECT vp.codigo AS venda_item_codigo,
               vb.codigo AS venda_codigo,
               -- Coerção segura de data/hora armazenadas como varchar
               CASE
                 WHEN vb.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN vb.data::date
                 WHEN vb.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(vb.data,'DD/MM/YYYY')
                 ELSE NULL
               END AS data_real,
               CASE
                 WHEN vb.hora ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' THEN vb.hora::time
                 ELSE NULL
               END AS hora_real,
               vp.codigo_gtin,
               vp.descricao AS item_descricao,
               COALESCE(vp.qtde,0) AS qtde,
               COALESCE(vp.preco_venda,0) AS preco_unit,
               COALESCE(vb.cancelado,0) AS cancelado,
               p.descricao AS produto_nome
          FROM vendas_prod vp
          JOIN vendas_base vb ON vb.codigo = vp.venda
          LEFT JOIN produtos p ON (p.codigo_gtin = vp.codigo_gtin)
         WHERE (
           CASE
             WHEN vb.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN vb.data::date
             WHEN vb.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(vb.data,'DD/MM/YYYY')
             ELSE NULL
           END
         ) >= (CURRENT_DATE - $1::int)
      )
      SELECT venda_item_codigo,
             venda_codigo,
             to_char(data_real, 'YYYY-MM-DD') AS data,
             to_char(hora_real, 'HH24:MI:SS') AS hora,
             codigo_gtin,
             COALESCE(produto_nome, item_descricao) AS nome,
             qtde,
             preco_unit,
             cancelado
        FROM dados
       ORDER BY data_real DESC NULLS LAST, hora_real DESC NULLS LAST, venda_item_codigo DESC
       LIMIT $2
    `
    const { rows } = await query(sql, [days, limit])
    return NextResponse.json({ success: true, items: rows })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 })
  }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
