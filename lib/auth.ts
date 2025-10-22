import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { getTenantById, TenantRecord } from './tenants'

export const COOKIE_NAME = 'AUTH_TOKEN'
const JWT_SECRET = (process.env.AUTH_JWT_SECRET || 'dev-secret') as string
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET)

export type TokenPayload = {
  tid: string
  cnpj: string
  nome: string
}

export async function signToken(payload: TokenPayload, expiresInSeconds = 60 * 60 * 12) {
  const jwt = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds) // timestamp absoluto
    .sign(SECRET_KEY)
  return jwt
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as any
  } catch (err) {
    console.error('[AUTH] verifyToken failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

export function attachAuthCookie(res: NextResponse, token: string) {
  // secure: false mesmo em produção se não tiver HTTPS configurado
  // Mude para true quando configurar SSL/HTTPS no servidor
  const isSecure = process.env.FORCE_SECURE_COOKIE === 'true'
  
  console.log(`[auth] Setando cookie: secure=${isSecure}, httpOnly=true, sameSite=lax, maxAge=43200s`)
  
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure, // false por padrão, true se FORCE_SECURE_COOKIE=true no .env
    path: '/',
    maxAge: 60 * 60 * 12, // 12 horas
  })
}

export function clearAuthOnResponse(res: NextResponse) {
  res.cookies.set({ name: COOKIE_NAME, value: '', path: '/', maxAge: 0 })
}

export async function readAuthFromRequest(req: NextRequest): Promise<TokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifyToken(token)
}

export async function getCurrentTenantFromRequest(req: NextRequest): Promise<TenantRecord | null> {
  const payload = await readAuthFromRequest(req)
  if (!payload) return null
  return getTenantById(payload.tid)
}
