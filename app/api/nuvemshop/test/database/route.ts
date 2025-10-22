import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

/**
 * GET /api/nuvemshop/test/database
 * Testa a estrutura da base de dados
 */
export async function GET() {
  try {
    // Verificar se a tabela token_integracao existe
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'token_integracao'
      )
    `)

    const tableExists = tableCheck.rows[0]?.exists

    if (!tableExists) {
      return NextResponse.json({
        success: false,
        error: 'Tabela token_integracao não existe',
        suggestion: 'Execute o SQL de criação da tabela primeiro'
      })
    }

    // Verificar estrutura da tabela
    const tableStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'token_integracao'
      ORDER BY ordinal_position
    `)

    // Verificar registros existentes
    const existingRecords = await query(`
      SELECT descricao, code as store_id, ativo, 
             CASE WHEN access_token IS NOT NULL THEN 'SIM' ELSE 'NÃO' END as tem_token
      FROM token_integracao
      WHERE descricao = 'NUVEMSHOP'
    `)

    return NextResponse.json({
      success: true,
      table_exists: tableExists,
      structure: tableStructure.rows,
      existing_records: existingRecords.rows,
      record_count: existingRecords.rows.length
    })

  } catch (error) {
    console.error('Erro ao verificar base de dados:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao acessar base de dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
