import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * GET /api/nuvemshop/config/list
 * Lista as configurações da Nuvemshop
 */
export async function GET() {
  try {
    // Buscar configurações da Nuvemshop
    const result = await query(
      `SELECT codigo, descricao, user_id as store_id, url_checkout, ativo,
              CASE WHEN access_token IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_token
       FROM token_integracao 
       WHERE descricao = 'NUVEMSHOP'
       ORDER BY codigo`
    )

    return NextResponse.json({
      success: true,
      configs: result.rows
    })

  } catch (error) {
    console.error('Erro ao buscar configurações:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar configurações'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/nuvemshop/config/list
 * Remove uma configuração específica
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codigo = searchParams.get('codigo')

    if (!codigo) {
      return NextResponse.json({
        success: false,
        error: 'Código da configuração é obrigatório'
      }, { status: 400 })
    }

    // Excluir a configuração
    await query(
      `DELETE FROM token_integracao WHERE codigo = $1`,
      [codigo]
    )

    return NextResponse.json({
      success: true,
      message: 'Configuração excluída com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir configuração:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao excluir configuração'
    }, { status: 500 })
  }
}

/**
 * PUT /api/nuvemshop/config/list
 * Atualiza o status de uma configuração
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { codigo, status } = body

    if (!codigo || status === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Código e status são obrigatórios'
      }, { status: 400 })
    }

    // Atualizar o status
    await query(
      `UPDATE token_integracao SET ativo = $1 WHERE codigo = $2`,
      [status ? 1 : 0, codigo]
    )

    return NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao atualizar status:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao atualizar status'
    }, { status: 500 })
  }
}
