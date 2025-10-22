import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from './lib/auth'
import { getTenantById } from './lib/tenants'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/verify',
  '/api/health',
  '/api/ecommerce/stock/sync',
  '/api/nuvemshop/webhooks',
]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) return true
  // upload público: apenas leitura por URL direta /upload/<file> — manter público
  if (pathname.startsWith('/upload')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  console.log(`[middleware] ${req.method} ${pathname}`)
  
  if (isPublicPath(pathname)) {
    // Se já autenticado e tentando acessar /login*, redireciona para home
    if (pathname.startsWith('/login')) {
      const token = req.cookies.get(COOKIE_NAME)?.value
      console.log(`[middleware] /login acessado, token presente: ${!!token}`)
      
      if (token) {
        const payload = await verifyToken(token)
        console.log(`[middleware] Token válido: ${!!payload}`)
        
        if (payload) {
          const url = req.nextUrl.clone(); url.pathname = '/'; url.search = ''
          console.log(`[middleware] Redirecionando para /`)
          return NextResponse.redirect(url)
        }
      }
    }
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  console.log(`[middleware] Rota protegida ${pathname}, token presente: ${!!token}`)
  
  if (!token) {
    console.log(`[middleware] Sem token, redirecionando para /login`)
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    console.log(`[middleware] Token inválido, redirecionando para /login`)
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  
  // opcional: validar tenant ainda existe
  const t = getTenantById(payload.tid)
  if (!t) {
    console.log(`[middleware] Tenant ${payload.tid} não encontrado, redirecionando para /login`)
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  
  console.log(`[middleware] Autenticado como tenant ${t.id}`)
  
  // Adicionar cabeçalhos de contexto para uso em handlers edge/server (sem ALS aqui)
  const res = NextResponse.next()
  res.headers.set('x-tenant-id', t.id)
  res.headers.set('x-tenant-cnpj', t.cnpj)
  return res
}

export const config = {
  matcher: ['/((?!_next|favicon|public).*)'],
}
