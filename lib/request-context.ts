import { AsyncLocalStorage } from 'async_hooks'
import { NextRequest } from 'next/server'
import { getTenantById, TenantRecord } from './tenants'
import { readAuthFromRequest } from './auth'

type Ctx = {
  tenantId?: string
  dbUrl?: string
  cnpj?: string
}

const als = new AsyncLocalStorage<Ctx>()

export function runWithContext<T>(ctx: Ctx, fn: () => T): T
export function runWithContext<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T>
export function runWithContext<T>(ctx: Ctx, fn: () => Promise<T> | T): Promise<T> | T {
  return (als as any).run(ctx, fn)
}

export function getContext(): Ctx {
  return als.getStore() || {}
}

export function getCurrentDbUrl(): string | undefined {
  return getContext().dbUrl
}

export function getCurrentTenant(): { id?: string; cnpj?: string } {
  const c = getContext()
  return { id: c.tenantId, cnpj: c.cnpj }
}

export async function initTenantForRequest(req: NextRequest): Promise<Ctx> {
  // prioridade: query ?tenant=... -> cookie JWT -> header x-tenant-id
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('tenant')
  let tenant: TenantRecord | null = null
  if (fromQuery) {
    tenant = getTenantById(fromQuery)
  }
  if (!tenant) {
    const payload = await readAuthFromRequest(req)
    if (payload?.tid) tenant = getTenantById(payload.tid)
  }
  if (!tenant) {
    const hdr = req.headers.get('x-tenant-id')
    if (hdr) tenant = getTenantById(hdr)
  }
  const ctx: Ctx = tenant ? { tenantId: tenant.id, dbUrl: tenant.dbUrl, cnpj: tenant.cnpj } : {}
  return ctx
}
