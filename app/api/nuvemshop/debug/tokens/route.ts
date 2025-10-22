import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * GET /api/nuvemshop/debug/tokens
 * Debug endpoint para verificar tokens salvos
 */
export async function GET() {
  try {
    const result = await query(
      `SELECT codigo, descricao, user_id, access_token, url_checkout, ativo
       FROM token_integracao 
       WHERE descricao = 'NUVEMSHOP'
       ORDER BY codigo DESC`
    )

    return NextResponse.json({
      success: true,
      count: result.rows?.length || 0,
      tokens: result.rows || []
    })

  } catch (error) {
    console.error('Erro ao buscar tokens:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar tokens do banco de dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
