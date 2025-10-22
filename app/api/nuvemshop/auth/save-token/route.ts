import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * POST /api/nuvemshop/auth/save-token
 * Salva manualmente o token e user_id na tabela token_integracao
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, user_id, url_checkout } = body

    // Validar parâmetros obrigatórios
    if (!access_token || !user_id) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetros obrigatórios: access_token e user_id'
      }, { status: 400 })
    }

    console.log('Salvando token manualmente:', { user_id, url_checkout })

    // Verificar se já existe configuração para NUVEMSHOP
    const existingConfig = await query(
      `SELECT codigo FROM token_integracao WHERE descricao = 'NUVEMSHOP'`
    )

    if (existingConfig.rows && existingConfig.rows.length > 0) {
      // Atualizar configuração existente
      const codigo = existingConfig.rows[0].codigo
      
      await query(
        `UPDATE token_integracao 
         SET access_token = $1, user_id = $2, url_checkout = $3, ativo = 1
         WHERE codigo = $4`,
        [access_token, user_id, url_checkout || '', codigo]
      )

      console.log('Configuração atualizada com sucesso')
    } else {
      // Inserir nova configuração
      await query(
        `INSERT INTO token_integracao (descricao, access_token, user_id, url_checkout, ativo)
         VALUES ('NUVEMSHOP', $1, $2, $3, 1)`,
        [access_token, user_id, url_checkout || '']
      )

      console.log('Nova configuração inserida com sucesso')
    }

    return NextResponse.json({
      success: true,
      message: 'Token salvo com sucesso'
    })

  } catch (error) {
    console.error('Erro ao salvar token:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao salvar token na base de dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
