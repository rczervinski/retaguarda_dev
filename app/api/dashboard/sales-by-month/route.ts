import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

// Coerces varchar date (YYYY-MM-DD or DD/MM/YYYY) to a DATE, otherwise NULL
const COERCE_DATE = `CASE
  WHEN vb.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN vb.data::date
  WHEN vb.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(vb.data,'DD/MM/YYYY')
  ELSE NULL
END`

// Coerces varchar time (HH:MM[:SS]) to a TIME, otherwise NULL
const COERCE_TIME = `CASE
  WHEN vb.hora ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' THEN vb.hora::time
  ELSE NULL
END`

export const GET = withTenant(async (_req: NextRequest) => {
  try {
    // Build a series from January of current year up to the current month inclusive
    const sql = `
      WITH meses AS (
        SELECT date_trunc('month', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)) + (n || ' months')::interval AS mes
        FROM generate_series(0, EXTRACT(MONTH FROM CURRENT_DATE)::int - 1) n
      ),
      vendas AS (
        SELECT date_trunc('month', ${COERCE_DATE}) AS mes,
               COALESCE(
                 NULLIF(vp.total::text,'')::numeric,
                 (COALESCE(NULLIF(vp.qtde::text,'')::numeric,0) * COALESCE(NULLIF(vp.preco_venda::text,'')::numeric,0))
               ) AS valor
          FROM vendas_prod vp
          JOIN vendas_base vb ON vb.codigo = vp.venda
         WHERE ${COERCE_DATE} IS NOT NULL
           AND COALESCE(vb.cancelado,0) = 0
      ),
      agg AS (
        SELECT mes, COALESCE(SUM(valor),0) AS total
          FROM vendas
         GROUP BY mes
      )
      SELECT to_char(m.mes, 'Mon') AS label,
             EXTRACT(MONTH FROM m.mes)::int AS month_num,
             EXTRACT(YEAR FROM m.mes)::int AS year_num,
             COALESCE(a.total,0) AS total
        FROM meses m
        LEFT JOIN agg a ON a.mes = m.mes
       ORDER BY m.mes ASC;
    `
    const { rows } = await query(sql)

    // Normalize labels to PT-BR and ensure two-digit month if needed on client
    const data = rows.map((r: any) => ({
      name: r.label, // e.g., "Jan"
      vendas: Number(r.total) || 0,
      month: r.month_num,
      year: r.year_num
    }))

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 })
  }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
