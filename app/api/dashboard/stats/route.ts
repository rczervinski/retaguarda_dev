import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

function monthWindow() {
  return {
    from: `date_trunc('month', CURRENT_DATE)`,
    to: `date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`
  }
}
// Coerce vendas_base.data (varchar) to DATE when possible
const COERCE_DATE = `CASE
  WHEN vb.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN vb.data::date
  WHEN vb.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(vb.data,'DD/MM/YYYY')
  ELSE NULL
END`

export const GET = withTenant(async (_req: NextRequest) => {
  try {
    const { from, to } = monthWindow()
    
    console.log('[DASHBOARD] Stats request - tenant context:', require('@/lib/request-context').getContext())

    // Total de produtos
    let produtosTotal = 0
    try {
      const r = await query(`SELECT COUNT(*)::int AS c FROM produtos`)
      produtosTotal = r.rows?.[0]?.c ?? 0
    } catch { produtosTotal = 0 }

    // Vendas do mês (não canceladas)
    let vendasMesTotal = 0
    try {
      const sql = `
        SELECT COALESCE(SUM(
                 COALESCE(NULLIF(vp.total::text,'')::numeric,
                          (COALESCE(NULLIF(vp.qtde::text,'')::numeric,0) * COALESCE(NULLIF(vp.preco_venda::text,'')::numeric,0))
                 )
               ),0) AS total
          FROM vendas_prod vp
          JOIN vendas_base vb ON vb.codigo = vp.venda
         WHERE ${COERCE_DATE} IS NOT NULL
           AND ${COERCE_DATE} >= ${from}
           AND ${COERCE_DATE} < ${to}
           AND COALESCE(vb.cancelado,0) = 0
      `
      const r = await query(sql)
      vendasMesTotal = Number(r.rows?.[0]?.total || 0)
    } catch { vendasMesTotal = 0 }

    // Produtos no e-commerce (tags ns/ml/shopee)
    let produtosEcom = 0
    try {
      const r = await query(`
        SELECT COUNT(*)::int AS c
          FROM produtos
         WHERE COALESCE(NULLIF(TRIM(COALESCE(ns,'')), ''), NULL) IS NOT NULL
            OR COALESCE(NULLIF(TRIM(COALESCE(ml,'')), ''), NULL) IS NOT NULL
            OR COALESCE(NULLIF(TRIM(COALESCE(shopee,'')), ''), NULL) IS NOT NULL
      `)
      produtosEcom = r.rows?.[0]?.c ?? 0
    } catch {
      // Fallback: contar mapeados na Nuvemshop
      try {
        const r2 = await query(`SELECT COUNT(DISTINCT codigo_interno)::int AS c FROM produtos_nuvemshop WHERE product_id IS NOT NULL`)
        produtosEcom = r2.rows?.[0]?.c ?? 0
      } catch { produtosEcom = 0 }
    }

    // Clientes ativos do mês (cliente != 0 e não cancelado), contar distintos
    let clientesAtivos = 0
    try {
      const r = await query(`
        SELECT COUNT(DISTINCT vb.cliente)::int AS c
          FROM vendas_base vb
         WHERE vb.cliente IS NOT NULL AND vb.cliente <> 0
           AND COALESCE(vb.cancelado,0) = 0
           AND ${COERCE_DATE} IS NOT NULL
           AND ${COERCE_DATE} >= ${from}
           AND ${COERCE_DATE} < ${to}
      `)
      clientesAtivos = r.rows?.[0]?.c ?? 0
    } catch { clientesAtivos = 0 }

    return NextResponse.json({
      success: true,
      stats: {
        produtosTotal,
        vendasMesTotal,
        produtosEcom,
        clientesAtivos
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erro' }, { status: 500 })
  }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
