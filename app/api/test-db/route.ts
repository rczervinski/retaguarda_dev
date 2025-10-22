import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  console.log('🔌 Testando conexão do banco...');
  
  try {
    // Testar conexão básica
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexão OK:', result);

    // Testar se tabela produtos existe
    const produtos = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM produtos LIMIT 1
    `;
    console.log('✅ Tabela produtos OK:', produtos);

    // Testar se há dados
    const amostra = await prisma.$queryRaw`
      SELECT codigo_interno, descricao, codigo_gtin 
      FROM produtos 
      LIMIT 5
    `;
    console.log('✅ Dados de exemplo:', amostra);

    return NextResponse.json({
      success: true,
      connection: result,
      produtos_count: produtos,
      sample_data: amostra
    });
  } catch (error: any) {
    console.error('❌ Erro de conexão:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}