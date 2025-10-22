import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('🔍 Verificando estrutura da tabela produtos...');
    
    // Verificar estrutura da tabela
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'produtos' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Estrutura da tabela produtos:', tableInfo);
    
    return NextResponse.json({
      success: true,
      tableStructure: tableInfo
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
