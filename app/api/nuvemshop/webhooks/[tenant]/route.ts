import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getTenantById, isTenantsConfigured } from '@/lib/tenants'
import { runWithContext } from '@/lib/request-context'
import { ensureVendasOnlineTables } from '@/lib/stock/tables'
import { query } from '@/lib/database'
import { getOrderById } from '@/lib/nuvemshop-api'

export const runtime = 'nodejs'

// Mapeia GTIN -> codigo_interno
async function mapGtinToCodigoInterno(gtin: string | null): Promise<string | null> {
  if (!gtin) return null
  const res = await query(`SELECT codigo_interno FROM produtos WHERE codigo_gtin = $1 LIMIT 1`, [gtin]).catch(()=>({ rows: [] as any[] }))
  const id = (res as any)?.rows?.[0]?.codigo_interno
  return id != null ? String(id) : null
}

// Aplica delta no ESTOQUE LOCAL (produtos_ou.qtde), com clamp mínimo 0
let qtdeTypeCache: 'float' | 'numeric' | 'text' | null = null
async function detectQtdeType(): Promise<'float' | 'numeric' | 'text'> {
  if (qtdeTypeCache) return qtdeTypeCache
  try {
    const r = await query(
      `SELECT data_type FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'produtos_ou' AND column_name = 'qtde' LIMIT 1`
    )
    const t = String(r.rows?.[0]?.data_type || '').toLowerCase()
    if (['double precision','real'].includes(t)) { qtdeTypeCache = 'float' }
    else if (['numeric','decimal','integer','bigint','smallint'].includes(t)) { qtdeTypeCache = 'numeric' }
    else { qtdeTypeCache = 'text' }
  } catch {
    qtdeTypeCache = 'text'
  }
  return qtdeTypeCache
}

async function applyLocalStockDelta(codigoInterno: string, qtyDelta: number) {
  const cod = Number(codigoInterno)
  const kind = await detectQtdeType()
  if (kind === 'float') {
    await query(
      `INSERT INTO produtos_ou (codigo_interno, qtde)
       VALUES ($1, GREATEST(0::double precision, $2::double precision))
       ON CONFLICT (codigo_interno) DO UPDATE SET
         qtde = GREATEST(0::double precision, COALESCE(produtos_ou.qtde, 0::double precision) + $2::double precision)`,
      [cod, qtyDelta]
    )
  } else if (kind === 'numeric') {
    await query(
      `INSERT INTO produtos_ou (codigo_interno, qtde)
       VALUES ($1, GREATEST(0::numeric, $2::numeric))
       ON CONFLICT (codigo_interno) DO UPDATE SET
         qtde = GREATEST(0::numeric, COALESCE(produtos_ou.qtde, 0::numeric) + $2::numeric)`,
      [cod, qtyDelta]
    )
  } else {
    // text/varchar
    await query(
      `INSERT INTO produtos_ou (codigo_interno, qtde)
       VALUES ($1, (GREATEST(0::numeric, $2::numeric))::text)
       ON CONFLICT (codigo_interno) DO UPDATE SET
         qtde = (GREATEST(0::numeric, COALESCE(NULLIF(produtos_ou.qtde,''),'0')::numeric + $2::numeric))::text`,
      [cod, qtyDelta]
    )
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params
  try {
    // Se não houver configuração de tenants, não processar nem validar — retornar erro explícito
    if (!isTenantsConfigured()) {
      return NextResponse.json({ ok: false, error: 'tenants_not_configured' }, { status: 503 })
    }
    const t = getTenantById(tenant)
    if (!t) return NextResponse.json({ ok: false, error: 'tenant_invalid' }, { status: 400 })

    // Validar HMAC do webhook (NUVEMSHOP_APP_SECRET)
  const topic = req.headers.get('x-topic') || req.headers.get('x-webhook-topic') || 'unknown'
  // Header oficial da Nuvemshop: X-Shop-Api-Hmac-Sha256
  const sigHeader = (
    req.headers.get('x-shop-api-hmac-sha256')
    || req.headers.get('x-linkedstore-hmac-sha256')
    || req.headers.get('x-hmac-sha256')
    || req.headers.get('x-webhook-signature')
    || ''
  ).trim()
    const raw = await req.text().catch(()=>'')
  const startedAt = Date.now()
  const skipHmac = String(process.env.NUVEMSHOP_WEBHOOK_SKIP_HMAC || '').toLowerCase() === 'true'

    const appSecret = (t as any)?.nuvemshopSecret || process.env.NUVEMSHOP_APP_SECRET || ''
    let hmacOk = false
    if (skipHmac) {
      hmacOk = true
      console.warn('[ns-webhook] HMAC BYPASS (DEV) ativo — valide a configuração e desative em produção')
    }
    if (appSecret && raw && !skipHmac) {
      try {
        const digest = createHmac('sha256', appSecret).update(raw).digest()
        // Tentar comparar com base64 e com hex
        const candidates: Buffer[] = []
        try { if (sigHeader) candidates.push(Buffer.from(sigHeader, 'base64')) } catch {}
        try { if (sigHeader) candidates.push(Buffer.from(sigHeader, 'hex')) } catch {}
        for (const cand of candidates) {
          if (cand.length === digest.length && timingSafeEqual(cand, digest)) { hmacOk = true; break }
        }
      } catch {}
    }
    if (!hmacOk) {
      let headersDump: Record<string,string> = {}
      try { headersDump = Object.fromEntries(Array.from(req.headers.entries())) as Record<string,string> } catch {}
      console.warn('[ns-webhook] assinatura inválida', { tenant, topic, sigPresent: !!sigHeader, rawLen: raw.length, url: req.url, headers: headersDump })
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
    }

    console.log('[ns-webhook] IN', { tenant, topic, sigPresent: !!sigHeader })

    const body = (()=>{ try { return JSON.parse(raw) } catch { return null } })()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    return await runWithContext({ tenantId: t.id, dbUrl: t.dbUrl, cnpj: t.cnpj }, async () => {
      await ensureVendasOnlineTables()

      // Buscar pedido completo na API — o webhook pode enviar payload reduzido
      const orderId = Number(body.id)
      if (!orderId) {
        return NextResponse.json({ ok: false, error: 'order_id_missing' }, { status: 400 })
      }
      const full = await getOrderById(orderId).catch((e:any)=>{ console.error('[ns-webhook] getOrderById failed', e?.message); return null })
      const src: any = full && typeof full === 'object' ? full : body

      const numero = String(src.number || src.token || '')
      // Normalização de status (o status do pedido manda). Se pedido cancelado, pagamento também vira cancelado.
      const raw_status_pagamento = String(src.payment_status || '')
      const raw_status_pedido = String(src.status || '')
      const status_pedido_norm = raw_status_pedido.toLowerCase()
      let status_pagamento_norm = raw_status_pagamento.toLowerCase()
      if (["cancelled","canceled","voided"].includes(status_pedido_norm)) {
        status_pagamento_norm = 'cancelled'
      }
      const cliente_nome = String(src.customer?.name || [src.customer?.firstname, src.customer?.lastname].filter(Boolean).join(' ') || '')
      const cliente_email = String(src.customer?.email || '')
      const total = Number(src.total || src.total_amount || src.total_price || 0)
      const currency = String(src.currency || 'BRL')
      const created_at = src.created_at ? new Date(src.created_at) : null
      const updated_at = src.updated_at ? new Date(src.updated_at) : null
      const pagamento = src.payment_details || src.payments || src.payment || null
      const shipping = src.shipping_address || src.shipping || null
      const cliente_json = src.customer || null

      // Upsert cabeçalho
      await query(`
        INSERT INTO vendas_online (plataforma, order_id, numero, status_pagamento, status_pedido, cliente_nome, cliente_email, total, currency, created_at, updated_at, pagamento, shipping, cliente_json)
        VALUES ('nuvemshop', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb)
        ON CONFLICT (plataforma, order_id)
        DO UPDATE SET numero=EXCLUDED.numero, status_pagamento=EXCLUDED.status_pagamento, status_pedido=EXCLUDED.status_pedido,
                      cliente_nome=EXCLUDED.cliente_nome, cliente_email=EXCLUDED.cliente_email,
                      total=EXCLUDED.total, currency=EXCLUDED.currency, updated_at=EXCLUDED.updated_at,
                      pagamento=EXCLUDED.pagamento, shipping=EXCLUDED.shipping, cliente_json=EXCLUDED.cliente_json
      `, [orderId, numero, status_pagamento_norm, status_pedido_norm, cliente_nome, cliente_email, total, currency, created_at, updated_at, pagamento ? JSON.stringify(pagamento) : null, shipping ? JSON.stringify(shipping) : null, cliente_json ? JSON.stringify(cliente_json) : null])

      const vres = await query(`SELECT id, processed_at FROM vendas_online WHERE plataforma='nuvemshop' AND order_id=$1 LIMIT 1`, [orderId])
      const vendaId = vres.rows?.[0]?.id as number
      const alreadyProcessed = !!vres.rows?.[0]?.processed_at

      // Upsert itens: estratégia simples => apaga e insere novamente
      await query(`DELETE FROM vendas_online_itens WHERE venda_online_id = $1`, [vendaId])
  const items = Array.isArray(src.products) ? src.products : Array.isArray(src.lines) ? src.lines : []
      let insertedItens = 0
      for (const it of items) {
        const gtin = it?.barcode != null ? String(it.barcode) : (it?.variant?.barcode != null ? String(it.variant.barcode) : null)
        const sku = it?.sku != null ? String(it.sku) : (it?.variant?.sku != null ? String(it.variant.sku) : null)
        const nome = it?.name != null ? String(it.name) : (it?.product?.name || '')
        const qty = Number(it?.quantity || it?.quantity_total || it?.quantity_ordered || it?.quantity || 0)
        const price = Number(it?.price || it?.price_final || it?.price_item || it?.price || 0)
        const product_id = it?.product_id != null ? Number(it.product_id) : (it?.product?.id != null ? Number(it.product.id) : null)
        const variant_id = it?.variant_id != null ? Number(it.variant_id) : (it?.variant?.id != null ? Number(it.variant.id) : null)
        // Regra: apenas GTIN (barcode) define a variante para efeitos de estoque local.
        // SKU é do PAI e não deve ser usado para estoque; variant_id também não será usado aqui.
        const codigo_interno = gtin ? await mapGtinToCodigoInterno(gtin) : null
        await query(`
          INSERT INTO vendas_online_itens (venda_online_id, codigo_interno, gtin, sku, produto_nome, quantidade, preco, variant_id, product_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [vendaId, codigo_interno ? Number(codigo_interno) : null, gtin, sku, nome, qty, price, variant_id, product_id])
        insertedItens++
      }
      // Regras de estoque (LOCAL somente)
      const isPaid = ['authorized', 'paid', 'authorized_payment', 'pagado'].includes(status_pagamento_norm)
      const isCancelledOrder = ['cancelled','canceled','voided'].includes(status_pedido_norm)
      let finalProcessed = alreadyProcessed

      if (isCancelledOrder && alreadyProcessed) {
        // Estornar: adicionar de volta o estoque se já havia sido debitado
        const ir = await query(`SELECT * FROM vendas_online_itens WHERE venda_online_id=$1`, [vendaId])
        let success = 0
        for (const it of ir.rows) {
          const qtde = Number(it.quantidade || 0)
          const delta = Math.abs(qtde) // devolve ao estoque
          try {
            // Apenas GTIN -> codigo_interno; não usar SKU nem variant_id para estoque.
            const codigo = it.codigo_interno != null ? String(it.codigo_interno) : (it.gtin ? await mapGtinToCodigoInterno(String(it.gtin)) : null)
            if (codigo) {
              await applyLocalStockDelta(codigo, delta)
              success++
            } else {
              console.warn('[ns-webhook] skip revert: sem mapeamento local (usar GTIN da variante).', { vendaId, item: it.id })
            }
          } catch (e: any) {
            console.error('[ns-webhook] stock revert failed', { vendaId, item: it.id, err: e?.message })
          }
        }
        if (success > 0) {
          await query(`UPDATE vendas_online SET processed_at = NULL WHERE id = $1`, [vendaId])
          finalProcessed = false
        } else {
          console.warn('[ns-webhook] revert sem sucesso; processed_at mantido', { vendaId })
        }
      } else if (isPaid && !alreadyProcessed) {
        // Debitar estoque apenas se pago/autorizado e ainda não processado
        const ir = await query(`SELECT * FROM vendas_online_itens WHERE venda_online_id=$1`, [vendaId])
        let success = 0
        for (const it of ir.rows) {
          const qtde = Number(it.quantidade || 0)
          const delta = -Math.abs(qtde)
          try {
            const codigo = it.codigo_interno != null ? String(it.codigo_interno) : (it.gtin ? await mapGtinToCodigoInterno(String(it.gtin)) : null)
            if (codigo) {
              await applyLocalStockDelta(codigo, delta)
              success++
            } else {
              console.warn('[ns-webhook] skip debit: sem mapeamento local (usar GTIN da variante).', { vendaId, item: it.id })
            }
          } catch (e: any) {
            console.error('[ns-webhook] stock delta failed', { vendaId, item: it.id, err: e?.message })
          }
        }
        if (success > 0) {
          await query(`UPDATE vendas_online SET processed_at = NOW() WHERE id = $1`, [vendaId])
          finalProcessed = true
        } else {
          console.warn('[ns-webhook] debito sem sucesso; processed_at mantido nulo', { vendaId })
        }
      }

      const tookMs = Date.now() - startedAt
  console.log('[ns-webhook] OK', { orderId, vendaId, status_pagamento: status_pagamento_norm, status_pedido: status_pedido_norm, isPaid, itens: insertedItens, processed: finalProcessed, tookMs })
      return NextResponse.json({ ok: true })
    })
  } catch (e: any) {
    console.error('[ns-webhook] ERROR', e?.message)
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0