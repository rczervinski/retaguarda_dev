import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs';

export const GET = withTenant(async (request: NextRequest) => {
  try {
    console.log('🔍 API /api/produtos/buscar-completo GET chamada');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const { searchParams } = new URL(request.url);
    const gtin = searchParams.get('gtin');
    
    if (!gtin) {
      console.log('❌ GTIN não fornecido');
      return NextResponse.json(
        { success: false, error: 'GTIN é obrigatório' },
        { status: 400 }
      );
    }
    
    console.log('📝 GTIN recebido:', gtin);
    
    // Consulta SQL unificada otimizada - busca produto com preço, estoque e dimensões
    const sql = `
      SELECT 
        p.codigo_interno,
        p.codigo_gtin,
        p.descricao,
        COALESCE(ib.preco_venda, '0') as preco_venda,
        COALESCE(ou.qtde, '0') as estoque,
        COALESCE(ou.comprimento, '0') as comprimento,
        COALESCE(ou.largura, '0') as largura, 
        COALESCE(ou.altura, '0') as altura,
        COALESCE(ou.peso, '0') as peso
      FROM produtos p
      LEFT JOIN produtos_ib ib ON p.codigo_interno = ib.codigo_interno  
      LEFT JOIN produtos_ou ou ON p.codigo_interno = ou.codigo_interno
      WHERE p.codigo_gtin = $1
    `;
    
    console.log('🔍 Executando consulta unificada...');
    const result = await query(sql, [gtin]);
    
    if (result.rows.length === 0) {
      console.log('❌ Produto não encontrado para GTIN:', gtin);
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }
    
    const produto = result.rows[0];
    console.log('✅ Produto completo encontrado:', produto.descricao);
    console.log('💰 Preço:', produto.preco_venda);
    console.log('📦 Estoque:', produto.estoque);
    console.log('📏 Dimensões:', {
      comprimento: produto.comprimento,
      largura: produto.largura,
      altura: produto.altura,
      peso: produto.peso
    });
    
    // Formatar resposta
    const response = {
      success: true,
      data: {
        codigo_interno: produto.codigo_interno.toString(),
        codigo_gtin: produto.codigo_gtin,
        descricao: produto.descricao,
        preco_venda: parseFloat(produto.preco_venda || '0'),
        estoque: parseInt(produto.estoque || '0'),
        dimensoes: {
          comprimento: parseFloat(produto.comprimento || '0'),
          largura: parseFloat(produto.largura || '0'),
          altura: parseFloat(produto.altura || '0'),
          peso: parseFloat(produto.peso || '0')
        }
      }
    };
    
    console.log('✅ Resposta formatada com sucesso');
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Erro ao buscar produto completo:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
