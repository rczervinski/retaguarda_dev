import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const runtime = 'nodejs'

/**
 * GET /api/nuvemshop/connection/test
 * Testa a conexão com a API da Nuvemshop
 * Pode receber um parâmetro 'codigo' para testar uma configuração específica
 */
export const GET = withTenant(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const codigo = searchParams.get('codigo')
    
    let configResult

    if (codigo) {
      // Testar configuração específica por código
      configResult = await query(
        `SELECT access_token, user_id as store_id 
         FROM token_integracao 
         WHERE codigo = $1 AND descricao = 'NUVEMSHOP'
         LIMIT 1`,
        [codigo]
      )
    } else {
      // Buscar configuração ativa da Nuvemshop (comportamento anterior)
      configResult = await query(
        `SELECT access_token, user_id as store_id 
         FROM token_integracao 
         WHERE descricao = 'NUVEMSHOP' AND ativo = 1
         LIMIT 1`
      )
    }

    if (!configResult.rows || configResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: codigo 
          ? `Configuração com código ${codigo} não encontrada` 
          : 'Nenhuma configuração ativa da Nuvemshop encontrada'
      }, { status: 404 })
    }

    const { access_token, store_id } = configResult.rows[0]

    if (!access_token || !store_id) {
      return NextResponse.json({
        success: false,
        error: 'Configuração incompleta - faltam access_token ou store_id'
      }, { status: 400 })
    }

    // Testar conexão com a API da Nuvemshop
    const testResult = await testNuvemshopConnection(access_token, store_id)

    if (!testResult.success) {
      return NextResponse.json({
        success: false,
        error: testResult.error,
        details: testResult.details
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      store_info: testResult.storeInfo
    })

  } catch (error) {
    console.error('Erro ao testar conexão:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
})

/**
 * Testa a conexão com a API da Nuvemshop
 */
async function testNuvemshopConnection(accessToken: string, storeId: string): Promise<{
  success: boolean
  error?: string
  details?: any
  storeInfo?: any
}> {
  try {
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
      method: 'GET',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'RetaguardaApp (renanczervinski@hotmail.com)',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Erro ao conectar com a API da Nuvemshop'
      
      switch (response.status) {
        case 401:
          errorMessage = 'Token de acesso inválido ou expirado'
          break
        case 403:
          errorMessage = 'Acesso negado - verifique as permissões do app'
          break
        case 404:
          errorMessage = 'Loja não encontrada'
          break
        case 429:
          errorMessage = 'Limite de requisições excedido'
          break
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        }
      }
    }

    const storeInfo = await response.json()

    return {
      success: true,
      storeInfo: {
        id: storeInfo.id,
        name: typeof storeInfo.name === 'object' && storeInfo.name.pt ? storeInfo.name.pt : storeInfo.name,
        url: storeInfo.url,
        domain: typeof storeInfo.domain === 'object' && storeInfo.domain.pt ? storeInfo.domain.pt : storeInfo.domain,
        email: storeInfo.email,
        created_at: storeInfo.created_at
      }
    }

  } catch (error) {
    console.error('Erro na requisição para Nuvemshop:', error)
    
    return {
      success: false,
      error: 'Erro de conexão com a API da Nuvemshop',
      details: {
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  }
}
