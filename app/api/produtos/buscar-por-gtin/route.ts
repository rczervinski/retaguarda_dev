import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs';

export const GET = withTenant(async (request: NextRequest) => {
  try {
    console.log('🔍 API /api/produtos/buscar-por-gtin GET chamada');
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
    
    // Buscar produto pelo GTIN
    const sql = `
      SELECT 
        codigo_interno,
        codigo_gtin,
        descricao
      FROM produtos 
      WHERE codigo_gtin = $1
    `;
    
    console.log('🔍 Executando query de busca por GTIN...');
    const result = await query(sql, [gtin]);
    
    if (result.rows.length === 0) {
      console.log('❌ Produto não encontrado para GTIN:', gtin);
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }
    
    const produto = result.rows[0];
    console.log('✅ Produto encontrado:', produto.descricao);
    
    return NextResponse.json({
      success: true,
      data: {
        codigo_interno: produto.codigo_interno,
        codigo_gtin: produto.codigo_gtin,
        descricao: produto.descricao
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar produto por GTIN:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
