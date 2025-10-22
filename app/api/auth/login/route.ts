import { NextRequest, NextResponse } from 'next/server'
import { findTenantByLogin } from '@/lib/tenants'
import { signToken, attachAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const { nome, senha } = body || {}
  
  if (!nome || !senha) {
    return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 })
  }
  
  // Buscar tenant com nome e senha
  const tenant = findTenantByLogin(String(nome), String(senha))
  
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 })
  }
  
  console.log(`[auth] Login bem-sucedido para ${nome} (tenant=${tenant.id})`)
  
  // Criar token JWT diretamente (sem OTP)
  const token = await signToken({
    tid: tenant.id,
    cnpj: tenant.cnpj,
    nome: tenant.nome
  })
  
  console.log(`[auth] Token gerado (length=${token.length})`)
  
  // Criar resposta e anexar cookie
  const res = NextResponse.json({ ok: true, tenant: { id: tenant.id, nome: tenant.nome } })
  attachAuthCookie(res, token)
  
  console.log(`[auth] Cookie setado: AUTH_TOKEN`)
  
  return res
}
