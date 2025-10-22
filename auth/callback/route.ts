import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Configurações da aplicação Nuvemshop
const NUVEMSHOP_CONFIG = {
  appId: '17589',
  clientSecret: '5173763ae2c4286107e02bfd22df1bb1a9c19898092eddf3',
  redirectUri: 'https://render-webhooks.onrender.com/auth/callback',
  tokenUrl: 'https://www.tiendanube.com/apps/authorize/token'
}

/**
 * GET /auth/callback
 * Processa o callback do OAuth da Nuvemshop
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    console.log('Callback recebido:', { code: !!code, state })

    if (!code) {
      console.error('Código não recebido no callback')
      return NextResponse.redirect(
        new URL('/integracoes/nuvemshop?error=no_code', request.url)
      )
    }

    // Trocar código por access token
    console.log('Trocando código por token...')
    const tokenResponse = await exchangeCodeForToken(code)

    if (!tokenResponse.success) {
      console.error('Erro ao trocar token:', tokenResponse.error)
      return NextResponse.redirect(
        new URL(`/integracoes/nuvemshop?error=${encodeURIComponent(tokenResponse.error || 'token_error')}`, request.url)
      )
    }

    const { access_token, user_id } = tokenResponse.data
    console.log('Token obtido:', { user_id, tokenLength: access_token?.length })

    // Salvar token na base de dados
    const saveResult = await saveTokenToDatabase(access_token, user_id)

    if (!saveResult.success) {
      console.error('Erro ao salvar token:', saveResult.error)
      return NextResponse.redirect(
        new URL(`/integracoes/nuvemshop?error=${encodeURIComponent(saveResult.error || 'save_error')}`, request.url)
      )
    }

    // Buscar informações da loja para confirmar
    const storeInfo = await getStoreInfo(access_token, user_id)
    console.log('Informações da loja:', storeInfo.success ? 'OK' : storeInfo.error)

    // Redirecionar com sucesso
    return NextResponse.redirect(
      new URL('/integracoes/nuvemshop?success=true', request.url)
    )

  } catch (error) {
    console.error('Erro no callback OAuth:', error)
    return NextResponse.redirect(
      new URL('/integracoes/nuvemshop?error=internal_error', request.url)
    )
  }
}

/**
 * Troca o código de autorização por access token
 */
async function exchangeCodeForToken(code: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('Fazendo requisição para trocar token...')
    
    const requestBody = {
      client_id: NUVEMSHOP_CONFIG.appId,
      client_secret: NUVEMSHOP_CONFIG.clientSecret,
      grant_type: 'authorization_code',
      code: code
    }

    console.log('Dados da requisição:', { ...requestBody, client_secret: '[HIDDEN]' })

    const response = await fetch(NUVEMSHOP_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Resposta da Nuvemshop:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Erro ao trocar código por token:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      })
      return { success: false, error: `Erro ao obter access token: ${response.status} ${response.statusText}` }
    }

    const data = await response.json()
    console.log('Dados do token recebidos:', { ...data, access_token: data.access_token ? '[PRESENT]' : '[MISSING]' })
    
    if (!data.access_token || !data.user_id) {
      console.error('Resposta inválida da Nuvemshop:', data)
      return { success: false, error: 'Resposta inválida da Nuvemshop - faltam dados essenciais' }
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
    console.log('Salvando token na base de dados...', { storeId })

    // Verificar se já existe configuração para NUVEMSHOP
    const existingConfig = await query(
      `SELECT codigo FROM token_integracao WHERE descricao = 'NUVEMSHOP'`
    )

    console.log('Configuração existente:', existingConfig.rows?.length || 0, 'registros')

    if (existingConfig.rows && existingConfig.rows.length > 0) {
      // Atualizar configuração existente
      console.log('Atualizando configuração existente...')
      await query(
        `UPDATE token_integracao 
         SET access_token = $1, code = $2, ativo = 1
         WHERE descricao = 'NUVEMSHOP'`,
        [accessToken, storeId]
      )
    } else {
      // Inserir nova configuração
      console.log('Inserindo nova configuração...')
      await query(
        `INSERT INTO token_integracao (descricao, access_token, code, ativo)
         VALUES ('NUVEMSHOP', $1, $2, 1)`,
        [accessToken, storeId]
      )
    }

    console.log('Token salvo com sucesso!')
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
    console.log('Buscando informações da loja...')
    
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
    console.log('Informações da loja obtidas:', { name: data.name, id: data.id })
    return { success: true, data }

  } catch (error) {
    console.error('Erro ao buscar informações da loja:', error)
    return { success: false, error: 'Erro de conexão com a API da Nuvemshop' }
  }
}
