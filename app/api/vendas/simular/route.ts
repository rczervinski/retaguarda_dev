import { NextRequest, NextResponse } from 'next/server'
import { query, transaction } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

type Body = {
  codigo_gtin: string
  qtde?: number
  preco?: number
  cancelado?: boolean
  pagamento?: { pix?: number; dinheiro?: number; cartao_credito?: number; cartao_debito?: number }
}

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = (await req.json()) as Body
    const gtin = String(body?.codigo_gtin || '').trim()
    if (!gtin) return NextResponse.json({ success: false, error: 'codigo_gtin é obrigatório' }, { status: 400 })
    const qtde = Number(body?.qtde ?? 1)
    const precoUnit = Number(body?.preco ?? 10)
    const cancelado = !!body?.cancelado

    // data/hora em formato compatível com schema (varchar)
    const now = new Date()
    const data = now.toISOString().slice(0,10) // YYYY-MM-DD
    const hora = now.toTimeString().slice(0,8) // HH:MM:SS

    const result = await transaction(async (client: any) => {
      // Criar venda base (autoincrement em codigo)
      const insBase = await client.query(
        `INSERT INTO vendas_base (data, hora, cancelado, coo, pdv) VALUES ($1,$2,$3,$4,$5) RETURNING codigo`,
        [data, hora, cancelado ? 1 : 0, 0, 1]
      )
      const vendaCodigo = insBase.rows[0].codigo

      // Inserir item
      const total = qtde * precoUnit
      await client.query(
        `INSERT INTO vendas_prod (venda, codigo_gtin, preco_venda, qtde, total, item, descricao) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [vendaCodigo, gtin, precoUnit, qtde, total, 1, `Item ${gtin}`]
      )

      // Inserir pagamento (chave é venda segundo schema)
      const pg = body?.pagamento || {}
      const dinheiro = Number(pg.dinheiro ?? 0)
      const pix = Number(pg.pix ?? total)
      const cartaoCredito = Number(pg.cartao_credito ?? 0)
      const cartaoDebito = Number(pg.cartao_debito ?? 0)
      await client.query(
        `INSERT INTO vendas_pag (venda, dinheiro, pix, cartao_credito, cartao_debito) VALUES ($1,$2,$3,$4,$5)`,
        [vendaCodigo, dinheiro, pix, cartaoCredito, cartaoDebito]
      )

      return { vendaCodigo, total }
    })

    return NextResponse.json({ success: true, venda_codigo: result.vendaCodigo, total: result.total })
  } catch (e: any) {
    console.error('[SIMULAR_VENDA] erro', { message: e?.message, code: e?.code, detail: e?.detail, constraint: e?.constraint })
    return NextResponse.json({ success: false, error: e?.message || 'erro ao simular venda', code: e?.code, detail: e?.detail, constraint: e?.constraint }, { status: 500 })
  }
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
