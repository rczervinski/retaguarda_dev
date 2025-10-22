import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { convertBigIntToString } from '@/lib/bigint-utils';

const prisma = new PrismaClient();

// GET /api/produtos - Listagem de produtos com SQL bruto para contornar problemas de schema
export async function GET(request: NextRequest) {
  console.log('🔍 API /api/produtos-sql GET chamada - SQL BRUTO');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    
    console.log('📊 Parâmetros:', { page, limit, search });
    
    const offset = (page - 1) * limit;
    
    // Query com SQL bruto para evitar problemas de schema
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE p.descricao ILIKE $1 OR p.codigo_gtin ILIKE $1';
      params.push(`%${search}%`);
    }
    
    // Query principal - apenas campos básicos para evitar conflitos
    const produtosQuery = `
      SELECT 
        p.codigo_interno::text as codigo_interno,
        p.codigo_gtin, 
        p.descricao, 
        p.status,
        p.ns,
        p.ml,
        p.shopee
      FROM produtos p 
      ${whereClause}
      ORDER BY p.descricao ASC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM produtos p 
      ${whereClause}
    `;
    
    console.log('🔍 Query produtos:', produtosQuery);
    console.log('📊 Query contagem:', countQuery);
    console.log('🎯 Parâmetros SQL:', [...params, limit, offset]);
    
    // Executar queries
    const [produtos, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe(produtosQuery, ...params, limit, offset),
      prisma.$queryRawUnsafe(countQuery, ...params)
    ]);
    
    const total = Number((totalResult as any)[0].count);
    
    console.log(`📦 Produtos encontrados: ${(produtos as any[]).length} de ${total} total`);
    
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      success: true,
      data: convertBigIntToString(produtos),
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
    console.error('❌ Erro na API produtos-sql:', error);
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
