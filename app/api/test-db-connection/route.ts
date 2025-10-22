import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    console.log('🔍 Testando conexão com banco...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const result = await pool.query('SELECT 1 as test');
    await pool.end();

    return NextResponse.json({ 
      success: true, 
      message: 'Conexão com banco OK',
      test: result.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Erro de conexão:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erro de conexão com banco',
      details: error.message
    }, { status: 500 });
  }
}
