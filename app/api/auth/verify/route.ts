import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/otp-store'
import { getTenantById } from '@/lib/tenants'
import { attachAuthCookie, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  console.log('[VERIFY API] Request received')
  const body = await req.json().catch(()=>({}))
  console.log('[VERIFY API] Body parsed', { body })
  const { nome, code } = body || {}
  
  // PRIORIZAR cookie PENDING_OTP sobre memória (fix hot reload perdendo Map)
  let n = nome, c = code, expectedTenantId = null
  const pending = req.cookies.get('PENDING_OTP')?.value
  console.log('[VERIFY API] Checking PENDING_OTP cookie', { hasCookie: !!pending })
  if (pending) {
    try {
      const parsed = JSON.parse(pending)
      console.log('[VERIFY API] PENDING_OTP parsed', { parsed })
      n = n || parsed?.nome
      c = c || parsed?.code
      expectedTenantId = parsed?.tenantId
    } catch {}
  }
  
  console.log('[VERIFY API] Final nome/code', { nome: n, code: c })
  if (!n || !c) return NextResponse.json({ ok:false, error:'missing' }, { status:400 })
  
  // Tentar verificar via store em memória primeiro
  let res = verifyOtp(String(n), String(c))
  console.log('[VERIFY API] verifyOtp result (memory)', { res })
  
  // Se falhou por no_otp MAS temos cookie válido, aceitar via cookie
  if (!res.ok && res.reason === 'no_otp' && pending && expectedTenantId && String(c) === String(code)) {
    console.log('[VERIFY API] Fallback to cookie validation')
    res = { ok: true, tenantId: expectedTenantId }
  }
  
  if (!res.ok || !res.tenantId) return NextResponse.json({ ok:false, error: res.reason || 'invalid' }, { status:401 })
  const t = getTenantById(res.tenantId)
  console.log('[VERIFY API] getTenantById result', { tenantId: res.tenantId, found: !!t })
  if (!t) return NextResponse.json({ ok:false, error:'tenant_missing' }, { status:400 })
  const token = await signToken({ tid: t.id, cnpj: t.cnpj, nome: t.nome })
  console.log('[VERIFY API] Token signed, setting cookie', { tid: t.id })
  const response = NextResponse.json({ ok:true, tenant: t.id })
  attachAuthCookie(response, token)
  // limpar cookie de OTP
  response.cookies.set({ name: 'PENDING_OTP', value: '', path: '/', maxAge: 0 })
  console.log('[VERIFY API] Response ready')
  return response
}
