import { NextRequest, NextResponse } from 'next/server'

// Configurações da aplicação Nuvemshop
const NUVEMSHOP_CONFIG = {
  appId: '17589',
  clientSecret: '5173763ae2c4286107e02bfd22df1bb1a9c19898092eddf3',
  redirectUri: 'https://render-webhooks.onrender.com/auth/callback',
  scopes: ['read_products', 'write_products', 'read_orders', 'write_orders']
}

/**
 * GET /api/nuvemshop/auth/authorize
 * Inicia o fluxo OAuth redirecionando para a Nuvemshop
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store_url')

    if (!storeUrl) {
      return NextResponse.json(
        { success: false, error: 'URL da loja é obrigatória' },
        { status: 400 }
      )
    }

    // Validar formato da URL
    const urlPattern = /^https?:\/\/[^\/]+/
    if (!urlPattern.test(storeUrl)) {
      return NextResponse.json(
        { success: false, error: 'URL da loja inválida' },
        { status: 400 }
      )
    }

    // Extrair domínio base da loja
    const baseDomain = storeUrl.match(urlPattern)?.[0]
    if (!baseDomain) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível extrair o domínio da loja' },
        { status: 400 }
      )
    }

    // Gerar state para CSRF protection
    const state = generateSecureState()

    // URL de autorização da Nuvemshop
    const authUrl = new URL(`${baseDomain}/admin/apps/${NUVEMSHOP_CONFIG.appId}/authorize`)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', NUVEMSHOP_CONFIG.scopes.join(','))

    // Salvar state na sessão/cookies para validação posterior
    const response = NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state
    })

    // Salvar state em cookie seguro
    response.cookies.set('nuvemshop_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 600 // 10 minutos
    })

    return response

  } catch (error) {
    console.error('Erro ao gerar URL de autorização:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Gera um state seguro para proteção CSRF
 */
function generateSecureState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
