import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/produtos-new - Teste nova API produtos
export async function GET(request: NextRequest) {
  console.log('🔍 API /api/produtos-new GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const fornecedor = searchParams.get('fornecedor') || '';
    const ativo = searchParams.get('ativo');
    
    console.log('📊 Parâmetros:', { page, limit, search, fornecedor, ativo });
    
    const skip = (page - 1) * limit;
    
    // Construir filtros
    const where: any = {};
    
    if (search) {
      where.OR = [
        { codigo_interno: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
        { codigo_gtin: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (fornecedor) {
      where.FORNECEDOR = fornecedor;
    }
    
    if (ativo !== null && ativo !== undefined) {
      where.ATIVO = ativo === 'true';
    }
    
    console.log('🔍 Where clause:', JSON.stringify(where, null, 2));
    
    // Buscar produtos
    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo_interno: 'asc' },
        include: {
          produtoIb: true,
          produtoOu: true,
          produtoTb: true
        }
      }),
      prisma.produto.count({ where })
    ]);
    
    console.log(`📦 Produtos encontrados: ${produtos.length} de ${total} total`);
    
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      success: true,
      data: produtos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
    
    console.log('✅ Resposta formatada com sucesso');
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Erro na API produtos-new:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
