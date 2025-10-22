import { NextRequest, NextResponse } from 'next/server'
import { initTenantForRequest, runWithContext } from '@/lib/request-context'
import { getTenantById } from '@/lib/tenants'
import { ensureAbsoluteBaseUrl } from '@/lib/product-images'
import { listWebhooks, createWebhook, deleteWebhook } from '@/lib/nuvemshop-api'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const ctx = await initTenantForRequest(req)
    if (!ctx?.tenantId) return NextResponse.json({ ok: false, error: 'tenant_required' }, { status: 400 })
    const tenant = getTenantById(ctx.tenantId)
    if (!tenant) return NextResponse.json({ ok: false, error: 'tenant_invalid' }, { status: 400 })

    return await runWithContext({ tenantId: tenant.id, dbUrl: tenant.dbUrl, cnpj: tenant.cnpj }, async () => {
      const list = await listWebhooks().catch((e:any)=>{ throw new Error(e?.message || 'list failed') })
      return NextResponse.json({ ok: true, tenant: tenant.id, webhooks: list })
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await initTenantForRequest(req)
    if (!ctx?.tenantId) return NextResponse.json({ ok: false, error: 'tenant_required' }, { status: 400 })
    const tenant = getTenantById(ctx.tenantId)
    if (!tenant) return NextResponse.json({ ok: false, error: 'tenant_invalid' }, { status: 400 })

    const body = await req.json().catch(()=>({})) as { topics?: string[]; baseUrl?: string }
    // Eventos válidos para pedidos segundo a Nuvemshop/Tiendanube
    const topics = Array.isArray(body?.topics) && body.topics.length
      ? body.topics
      : ['order/created', 'order/updated', 'order/paid']
    const base = body?.baseUrl || ensureAbsoluteBaseUrl(req.headers as any)
    const addressPrefix = `${String(base).replace(/\/$/, '')}/api/nuvemshop/webhooks/${tenant.id}`

    return await runWithContext({ tenantId: tenant.id, dbUrl: tenant.dbUrl, cnpj: tenant.cnpj }, async () => {
      const existing = await listWebhooks().catch(()=>[] as any[])
      const created: any[] = []
      const skipped: any[] = []
      for (const topic of topics) {
        // Nuvemshop responde com campos event/url. Manter fallback para topic/address se existir legado
        const already = existing.find((w:any) => String(w.event || w.topic) === String(topic) && String(w.url || w.address || '').startsWith(addressPrefix))
        if (already) { skipped.push({ topic, id: already.id }); continue }
        const address = addressPrefix
        const res = await createWebhook(address, topic)
        created.push({ topic, id: (res as any)?.id || null })
      }
      return NextResponse.json({ ok: true, tenant: tenant.id, created, skipped })
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await initTenantForRequest(req)
    if (!ctx?.tenantId) return NextResponse.json({ ok: false, error: 'tenant_required' }, { status: 400 })
    const tenant = getTenantById(ctx.tenantId)
    if (!tenant) return NextResponse.json({ ok: false, error: 'tenant_invalid' }, { status: 400 })

    const base = ensureAbsoluteBaseUrl(req.headers as any)
    const addressPrefix = `${String(base).replace(/\/$/, '')}/api/nuvemshop/webhooks/${tenant.id}`

    return await runWithContext({ tenantId: tenant.id, dbUrl: tenant.dbUrl, cnpj: tenant.cnpj }, async () => {
      const existing = await listWebhooks().catch(()=>[] as any[])
      let deleted = 0
      for (const w of existing) {
        const url = String((w as any).url || (w as any).address || '')
        if (!url) continue
        // Remover apenas os que pertencem a este tenant (mesmo prefixo)
        if (url.startsWith(addressPrefix)) {
          try { await deleteWebhook((w as any).id) ; deleted++ } catch {}
        }
      }
      return NextResponse.json({ ok: true, tenant: tenant.id, deleted })
    })
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0