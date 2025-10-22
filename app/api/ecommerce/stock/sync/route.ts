import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { ensureProdutosEcommerceAttTable } from '@/lib/stock/tables'
import { applyStockDeltaNuvemshop } from '@/lib/stock/nuvemshop'
import { runWithContext, initTenantForRequest } from '@/lib/request-context'
import { getTenantById, isTenantsConfigured } from '@/lib/tenants'

type VendaItem = {
  venda_item_codigo: number
  venda_codigo: number
  codigo_gtin: string | null
  qtde: number
  occurred_ts: string
  cancelado: number
}

async function mapGtinToCodigoInterno(gtin: string | null): Promise<string | null> {
  if (!gtin) return null
  const res = await query(`SELECT codigo_interno FROM produtos WHERE codigo_gtin = $1 LIMIT 1`, [gtin])
  const id = res.rows?.[0]?.codigo_interno
  return id != null ? String(id) : null
}

async function isEcommerceProduct(codigoInterno: string): Promise<boolean> {
  // Considera produto de e-commerce se existir mapeamento na Nuvemshop
  const m = await query(`SELECT 1 FROM produtos_nuvemshop WHERE codigo_interno = $1 AND product_id IS NOT NULL LIMIT 1`, [codigoInterno])
  return !!m.rows?.length
}

export async function POST(req: NextRequest) {
  try {
    console.log('[stock-sync] IN', { url: req.url })
    // Opcional: proteger com uma chave compartilhada para execução por CRON
    const expectedKey = process.env.STOCK_SYNC_KEY
    if (expectedKey) {
      const url = new URL(req.url)
      const qKey = url.searchParams.get('key')
      const hKey = req.headers.get('x-sync-key')
      if (qKey !== expectedKey && hKey !== expectedKey) {
        console.warn('[stock-sync] unauthorized: missing/invalid key')
        return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
      }
    }

    // Inicializar contexto de tenant (via header do middleware ou ?tenant=)
  const url = new URL(req.url)
  const qTenant = url.searchParams.get('tenant')
    const hTenant = req.headers.get('x-tenant-id')
    // Se não há tenants configurados, retornar erro explícito (sem fallback de rota fixa)
    if (!isTenantsConfigured()) {
      console.warn('[stock-sync] tenants_not_configured')
      return NextResponse.json({ success:false, error:'tenants_not_configured' }, { status:503 })
    }
    let tenant = getTenantById((qTenant || hTenant || '').toString())
    if (!tenant) {
      // Tentar resolver via sessão (JWT) automaticamente
      const ctx = await initTenantForRequest(req)
      if (ctx?.tenantId) tenant = getTenantById(ctx.tenantId)
    }
    if (!tenant) {
      console.warn('[stock-sync] tenant_required: informe ?tenant= ou header x-tenant-id')
      return NextResponse.json({ success:false, error:'tenant_required' }, { status:400 })
    }
    console.log('[stock-sync] tenant resolved', { tenant: tenant.id })

    return await runWithContext({ tenantId: tenant.id, dbUrl: tenant.dbUrl, cnpj: tenant.cnpj }, async () => {
      await ensureProdutosEcommerceAttTable()

  const body = await req.json().catch(()=>({}))
  const days = Number(body?.days ?? 1) // período padrão: 1 dia
  console.log('[stock-sync] params', { days })

    // Coerção segura de data/hora (varchar)
    const sql = `
      WITH dados AS (
        SELECT vp.codigo AS venda_item_codigo,
               vb.codigo AS venda_codigo,
               vp.codigo_gtin,
               COALESCE(vp.qtde, 0) AS qtde,
               CASE
                 WHEN vb.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN vb.data::date
                 WHEN vb.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(vb.data,'DD/MM/YYYY')
                 ELSE NULL
               END AS data_real,
               CASE
                 WHEN vb.hora ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' THEN vb.hora::time
                 ELSE NULL
               END AS hora_real,
               COALESCE(vb.cancelado, 0) AS cancelado
          FROM vendas_prod vp
          JOIN vendas_base vb ON vb.codigo = vp.venda
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
             codigo_gtin,
             qtde,
             to_char(COALESCE(data_real + hora_real, data_real::timestamp, NOW()), 'YYYY-MM-DD HH24:MI:SS') AS occurred_ts,
             cancelado
        FROM dados
       ORDER BY data_real ASC NULLS LAST, hora_real ASC NULLS LAST, venda_item_codigo ASC
    `
  const { rows } = await query(sql, [days])
      console.log('[stock-sync] fetched rows', { count: rows.length })

  const processed: any[] = []
  for (const r of rows as any[]) {
      const codigoInterno = await mapGtinToCodigoInterno(r.codigo_gtin)
      if (!codigoInterno) continue
      if (!(await isEcommerceProduct(codigoInterno))) continue

      // Definir movimento/delta
      const movimento = r.cancelado ? 'CANCEL' : 'VENDA'
      const qtyDelta = r.cancelado ? Math.abs(Number(r.qtde || 0)) : -Math.abs(Number(r.qtde || 0))
      const occurredAt = r.occurred_ts

      // Já processado? (idempotência) — por plataforma; por ora só nuvemshop
      const exists = await query(
        `SELECT 1 FROM produtos_ecommerce_att WHERE plataforma = 'nuvemshop' AND venda_item_codigo = $1 AND movimento = $2 LIMIT 1`,
        [r.venda_item_codigo, movimento]
      )
      if (exists.rows?.length) {
        processed.push({ venda_item: r.venda_item_codigo, skip: true, reason: 'already-processed' })
        continue
      }

  // Aplicar na Nuvemshop
  try {
        const nsRes = await applyStockDeltaNuvemshop(codigoInterno, qtyDelta, r.codigo_gtin)
        await query(
          `INSERT INTO produtos_ecommerce_att (
             codigo_interno, plataforma, venda_codigo, venda_item_codigo, movimento,
             qty_delta, occurred_at, ns_tag, remote_product_id, remote_variant_id, sku, status, error
           ) VALUES ($1,'nuvemshop',$2,$3,$4,$5,$6,$7,$8,$9,$10,'succeeded', NULL)
           ON CONFLICT ON CONSTRAINT uq_prod_ecom_att DO UPDATE
             SET status = EXCLUDED.status,
                 error = EXCLUDED.error,
                 processed_at = NOW(),
                 remote_product_id = EXCLUDED.remote_product_id,
                 remote_variant_id = EXCLUDED.remote_variant_id,
                 sku = EXCLUDED.sku`,
          [
            codigoInterno,
            r.venda_codigo,
            r.venda_item_codigo,
            movimento,
            qtyDelta,
            occurredAt,
            null, // ns_tag opcional
            nsRes.product_id || null,
            nsRes.variant_id || null,
            null
          ]
        )
        processed.push({ venda_item: r.venda_item_codigo, ok: true, delta: qtyDelta })
      } catch (e: any) {
        const msg = e?.message || String(e)
        await query(
          `INSERT INTO produtos_ecommerce_att (
             codigo_interno, plataforma, venda_codigo, venda_item_codigo, movimento,
             qty_delta, occurred_at, ns_tag, remote_product_id, remote_variant_id, sku, status, error
           ) VALUES ($1,'nuvemshop',$2,$3,$4,$5,$6,NULL,NULL,NULL,NULL,'failed',$7)
           ON CONFLICT ON CONSTRAINT uq_prod_ecom_att DO UPDATE
             SET status = EXCLUDED.status,
                 error = EXCLUDED.error,
                 processed_at = NOW()`,
          [
            codigoInterno,
            r.venda_codigo,
            r.venda_item_codigo,
            movimento,
            qtyDelta,
            occurredAt,
            msg
          ]
        )
        processed.push({ venda_item: r.venda_item_codigo, ok: false, error: msg })
      }
      }
      const summary = {
        ok: processed.filter(p => p.ok).length,
        failed: processed.filter(p => p.ok === false).length,
        skipped: processed.filter(p => p.skip).length
      }
      console.log('[stock-sync] DONE', summary)
      return NextResponse.json({ success: true, summary, processed })
    })
  } catch (e: any) {
    console.error('[stock-sync] ERROR', e?.message)
    return NextResponse.json({ success: false, error: e?.message || 'sync error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
