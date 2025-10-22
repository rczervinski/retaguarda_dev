import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') ?? 50)))
    const status = searchParams.get('status') // 'succeeded' | 'failed' | null
    const plataforma = searchParams.get('plataforma') // e.g. 'nuvemshop'
    const sinceDays = Number(searchParams.get('sinceDays') ?? 7)

    const where: string[] = []
    const params: any[] = []
    where.push(`processed_at >= (NOW() - ($${params.push(sinceDays)}::int || ' days')::interval)`) // sinceDays
    if (status) { where.push(`status = $${params.push(status)}`) }
    if (plataforma) { where.push(`plataforma = $${params.push(plataforma)}`) }

    const sql = `
      SELECT id, codigo_interno, plataforma, venda_codigo, venda_item_codigo,
             movimento, qty_delta, occurred_at, processed_at, ns_tag,
             remote_product_id, remote_variant_id, sku, status, error
        FROM produtos_ecommerce_att
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY processed_at DESC
       LIMIT $${params.push(limit)}
    `
    const { rows } = await query(sql, params)
    return NextResponse.json({ items: rows, count: rows.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'logs error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
