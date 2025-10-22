import { NextRequest, NextResponse } from 'next/server'
import { initTenantForRequest, runWithContext } from './request-context'
import { isTenantsConfigured } from './tenants'

/**
 * Wrapper para route handlers que automaticamente inicializa o contexto do tenant
 * baseado no JWT do cookie AUTH_TOKEN (ou query/header).
 * 
 * Uso:
 * export const GET = withTenant(async (req) => {
 *   const data = await query('SELECT * FROM produtos')
 *   return NextResponse.json({ data })
 * })
 */
export function withTenant(
  handler: (req: NextRequest, params?: any) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, context: any = {}) => {
    // Bloqueia se TENANTS_JSON não estiver configurado (sem fallback/rota fixa)
    if (!isTenantsConfigured()) {
      return NextResponse.json(
        { success: false, error: 'tenants_not_configured' },
        { status: 503 }
      )
    }
    const ctx = await initTenantForRequest(req)
    
    if (!ctx.tenantId || !ctx.dbUrl) {
      return NextResponse.json(
        { success: false, error: 'tenant_not_found' },
        { status: 401 }
      )
    }
    
    // Resolver params se for Promise (Next.js 15+)
    const params = context?.params 
      ? (context.params instanceof Promise ? await context.params : context.params)
      : undefined
    
    return runWithContext(ctx, () => handler(req, params))
  }
}
