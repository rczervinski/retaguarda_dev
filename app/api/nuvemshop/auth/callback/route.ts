import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

// Configurações da aplicação Nuvemshop
const NUVEMSHOP_CONFIG = {
  appId: '17589',
  clientSecret: '5173763ae2c4286107e02bfd22df1bb1a9c19898092eddf3',
  redirectUri: 'https://render-webhooks.onrender.com/auth/callback',
  tokenUrl: 'https://www.tiendanube.com/apps/authorize/token'
}

/**
 * GET /api/nuvemshop/auth/callback
 * Processa o callback do OAuth e salva os tokens
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código de autorização não recebido' },
        { status: 400 }
      )
    }

    // Validar state para proteção CSRF
    const savedState = request.cookies.get('nuvemshop_state')?.value
    if (!state || !savedState || state !== savedState) {
      return NextResponse.json(
        { success: false, error: 'State inválido - possível ataque CSRF' },
        { status: 400 }
      )
    }

    // Trocar código por access token
    const tokenResponse = await exchangeCodeForToken(code)

    if (!tokenResponse.success) {
      return NextResponse.json(
        { success: false, error: tokenResponse.error },
        { status: 400 }
      )
    }

    const { access_token, user_id } = tokenResponse.data

    // Salvar/atualizar token na base de dados
    const saveResult = await saveTokenToDatabase(access_token, user_id)

    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: saveResult.error },
        { status: 500 }
      )
    }

    // Buscar informações da loja para confirmar conexão
    const storeInfo = await getStoreInfo(access_token, user_id)

    // Limpar cookie do state
    const response = NextResponse.redirect(new URL('/integracoes/nuvemshop?success=true', request.url))
    response.cookies.delete('nuvemshop_state')

    return response

  } catch (error) {
    console.error('Erro no callback OAuth:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Troca o código de autorização por access token
 */
async function exchangeCodeForToken(code: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(NUVEMSHOP_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: NUVEMSHOP_CONFIG.appId,
        client_secret: NUVEMSHOP_CONFIG.clientSecret,
        grant_type: 'authorization_code',
        code: code
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Erro ao trocar código por token:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      })
      return { success: false, error: 'Erro ao obter access token da Nuvemshop' }
    }

    const data = await response.json()
    
    if (!data.access_token || !data.user_id) {
      console.error('Resposta inválida da Nuvemshop:', data)
      return { success: false, error: 'Resposta inválida da Nuvemshop' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Erro na requisição de token:', error)
    return { success: false, error: 'Erro de conexão com a Nuvemshop' }
  }
}

/**
 * Salva ou atualiza o token na tabela token_integracao
 */
async function saveTokenToDatabase(accessToken: string, storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar se já existe configuração para NUVEMSHOP
    const existingConfig = await query(
      `SELECT codigo FROM token_integracao WHERE descricao = 'NUVEMSHOP'`
    )

    if (existingConfig.rows && existingConfig.rows.length > 0) {
      // Atualizar configuração existente
      await query(
        `UPDATE token_integracao 
         SET access_token = $1, code = $2, ativo = 1, data_atualizacao = NOW()
         WHERE descricao = 'NUVEMSHOP'`,
        [accessToken, storeId]
      )
    } else {
      // Inserir nova configuração
      await query(
        `INSERT INTO token_integracao (descricao, access_token, code, ativo, data_criacao)
         VALUES ('NUVEMSHOP', $1, $2, 1, NOW())`,
        [accessToken, storeId]
      )
    }

    return { success: true }

  } catch (error) {
    console.error('Erro ao salvar token na base de dados:', error)
    return { success: false, error: 'Erro ao salvar configuração na base de dados' }
  }
}

/**
 * Busca informações da loja para validar a conexão
 */
async function getStoreInfo(accessToken: string, storeId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'RetaguardaApp (renanczervinski@hotmail.com)',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Erro ao buscar info da loja:', {
        status: response.status,
        statusText: response.statusText
      })
      return { success: false, error: 'Erro ao validar conexão com a loja' }
    }

    const data = await response.json()
    return { success: true, data }

  } catch (error) {
    console.error('Erro ao buscar informações da loja:', error)
    return { success: false, error: 'Erro de conexão com a API da Nuvemshop' }
  }
}
