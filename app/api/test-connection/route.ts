import { NextResponse } from 'next/server';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 [CONNECTION_TEST] Iniciando teste de conexão...')
    console.log('🔍 [CONNECTION_TEST] NODE_ENV:', process.env.NODE_ENV)
    console.log('🔍 [CONNECTION_TEST] DATABASE_URL existe:', !!process.env.DATABASE_URL)
    console.log('🔍 [CONNECTION_TEST] DB_SSL_MODE:', process.env.DB_SSL_MODE)
    
    // Testar conexão simples
    const { query } = await import('@/lib/database')
    
    const result = await query('SELECT NOW() as server_time, version() as pg_version')
    
    return NextResponse.json({
      success: true,
      message: 'Conexão com banco de dados estabelecida com sucesso',
      data: {
        server_time: result.rows[0]?.server_time,
        pg_version: result.rows[0]?.pg_version,
        node_env: process.env.NODE_ENV,
        ssl_mode: process.env.DB_SSL_MODE
      }
    })
  } catch (error: any) {
    console.error('❌ [CONNECTION_TEST] Erro:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao conectar com banco de dados',
      details: {
        message: error.message,
        code: error.code,
        name: error.name,
        node_env: process.env.NODE_ENV,
        ssl_mode: process.env.DB_SSL_MODE,
        has_database_url: !!process.env.DATABASE_URL
      }
    }, { status: 500 })
  }
}