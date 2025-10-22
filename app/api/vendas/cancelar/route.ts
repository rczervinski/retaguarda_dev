import { NextRequest, NextResponse } from 'next/server'
import { query, transaction } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

type Body = {
  codigo_gtin?: string
  venda_codigo?: number
}

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as Body
    const gtin = body.codigo_gtin ? String(body.codigo_gtin).trim() : undefined
    const vendaCod = body.venda_codigo != null ? Number(body.venda_codigo) : undefined

    if (!gtin && !vendaCod) {
      return NextResponse.json({ success: false, error: 'Informe codigo_gtin ou venda_codigo' }, { status: 400 })
    }

    const result = await transaction(async (client: any) => {
      let vendaCodigo: number | null = vendaCod ?? null

      if (!vendaCodigo && gtin) {
        // Encontrar a venda mais recente que contenha esse GTIN e não esteja cancelada
        const sel = await client.query(
          `SELECT vb.codigo
             FROM vendas_base vb
             JOIN vendas_prod vp ON vb.codigo = vp.venda
            WHERE vp.codigo_gtin = $1 AND COALESCE(vb.cancelado,0) = 0
            ORDER BY vb.data::date DESC, vb.hora::time DESC, vp.codigo DESC
            LIMIT 1`,
          [gtin]
        )
        vendaCodigo = sel.rows?.[0]?.codigo ?? null
      }

      if (!vendaCodigo) {
        throw new Error('Nenhuma venda ativa encontrada para cancelar com os critérios informados')
      }

      // Atualizar cancelado=1 se ainda não cancelada
      const upd = await client.query(
        `UPDATE vendas_base SET cancelado = 1 WHERE codigo = $1 AND COALESCE(cancelado,0) = 0 RETURNING codigo`,
        [vendaCodigo]
      )

      if (!upd.rows?.length) {
        // Já estava cancelada ou não existe
        const chk = await client.query(`SELECT cancelado FROM vendas_base WHERE codigo = $1`, [vendaCodigo])
        const cur = chk.rows?.[0]?.cancelado
        if (cur === 1) return { venda_codigo: vendaCodigo, already: true }
        throw new Error('Venda não encontrada para cancelar')
      }

      return { venda_codigo: vendaCodigo, canceled: true }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erro ao cancelar venda' }, { status: 500 })
  }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
