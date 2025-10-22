import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

interface Product {
  codigo_interno: string;
  descricao: string;
  descricao_detalhada?: string;
  preco_venda: number;
  quantidade: number;
  codigo_gtin?: string;
  status_nuvemshop?: string;
  produto_id_nuvemshop?: string;
  data_ultima_sincronizacao?: string;
}

export const GET = withTenant(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // 'synced', 'not_synced', 'pending'

    // Montar a query base
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Filtro de busca por nome ou código
    if (search) {
      whereConditions.push(`(
        UPPER(descricao) LIKE UPPER($${paramIndex}) OR 
        UPPER(codigo_interno) LIKE UPPER($${paramIndex + 1}) OR
        UPPER(codigo_gtin) LIKE UPPER($${paramIndex + 2})
      )`);
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramIndex += 3;
    }

    // Filtro por status de sincronização
    if (status === 'synced') {
      whereConditions.push(`status_nuvemshop = 'sincronizado'`);
    } else if (status === 'not_synced') {
      whereConditions.push(`(status_nuvemshop IS NULL OR status_nuvemshop != 'sincronizado')`);
    } else if (status === 'pending') {
      whereConditions.push(`status_nuvemshop = 'pendente'`);
    }

    // Construir WHERE clause
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM produtos 
      ${whereClause}
    `;

    // Query principal
    const mainQuery = `
      SELECT 
        codigo_interno,
        descricao,
        descricao_detalhada,
        preco_venda,
        quantidade,
        codigo_gtin,
        status_nuvemshop,
        produto_id_nuvemshop,
        data_ultima_sincronizacao
      FROM produtos 
      ${whereClause}
      ORDER BY descricao ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Executar queries
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const productsResult = await query(mainQuery, [...queryParams, limit, offset]);
    const products: Product[] = productsResult.rows;

    // Processar dados para incluir informações de status
    const processedProducts = products.map(product => ({
      ...product,
      sync_status: getSyncStatus(product),
      can_export: canExport(product)
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: processedProducts,
        pagination: {
          total,
          limit,
          offset,
          has_more: (offset + limit) < total,
          current_page: Math.floor(offset / limit) + 1,
          total_pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
})

// Função para determinar o status de sincronização
function getSyncStatus(product: Product): string {
  if (!product.status_nuvemshop) {
    return 'not_synced';
  }
  
  switch (product.status_nuvemshop) {
    case 'sincronizado':
      return 'synced';
    case 'pendente':
      return 'pending';
    case 'erro':
      return 'error';
    default:
      return 'unknown';
  }
}

// Função para verificar se o produto pode ser exportado
function canExport(product: Product): boolean {
  // Verificar se tem informações básicas necessárias
  if (!product.descricao || product.descricao.trim() === '') {
    return false;
  }
  
  if (!product.preco_venda || product.preco_venda <= 0) {
    return false;
  }
  
  // Produto pode ser exportado
  return true;
}
