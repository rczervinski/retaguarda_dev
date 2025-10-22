import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs';

// GET /api/produtos/buscar-gtin?gtin=12345 - Buscar produto por código GTIN
export const GET = withTenant(async (request: NextRequest) => {
  console.log('🔍 API /api/produtos/buscar-gtin GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const gtin = searchParams.get('gtin');
    
    if (!gtin) {
      console.log('❌ GTIN não fornecido');
      return NextResponse.json(
        { success: false, error: 'Código GTIN é obrigatório' },
        { status: 400 }
      );
    }
    if (gtin.length > 15) {
      return NextResponse.json({ success: false, error: 'GTIN muito longo' }, { status: 400 })
    }

    console.log('🔍 Buscando produto(s) com prefixo GTIN:', gtin);

    // Para 1 char: limitar resultados para evitar carga grande
    const limit = gtin.length <= 2 ? 5 : 10;

    const produtoQuery = `
      SELECT 
        p.codigo_interno,
        p.codigo_gtin, 
        p.descricao, 
        p.status,
        COALESCE(pib.preco_venda, '0') as preco_venda,
        COALESCE(pib.preco_compra, '0') as preco_compra,
        pib.unidade,
        COALESCE(pou.qtde, '0') as estoque,
        COALESCE(pou.comprimento, '0') as comprimento,
        COALESCE(pou.largura, '0') as largura,
        COALESCE(pou.altura, '0') as altura,
        COALESCE(pou.peso, '0') as peso
      FROM produtos p
      LEFT JOIN produtos_ib pib ON p.codigo_interno = pib.codigo_interno
      LEFT JOIN produtos_ou pou ON p.codigo_interno = pou.codigo_interno
      WHERE p.codigo_gtin ILIKE $1
      ORDER BY p.codigo_interno
      LIMIT ${limit}
    `;

  const result = await query(produtoQuery, [gtin + '%']);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'Nenhum produto' });
    }

    // Retornar primeiro como principal (compatível com fluxo anterior) + lista
    const principal = result.rows[0];
    const produtos = result.rows.map((r: any) => ({
      codigo_interno: r.codigo_interno.toString(),
      codigo_gtin: r.codigo_gtin,
      descricao: r.descricao,
      status: r.status,
      preco_venda: parseFloat(r.preco_venda) || 0,
      preco_compra: parseFloat(r.preco_compra) || 0,
      unidade: r.unidade,
      estoque: parseFloat(r.estoque) || 0,
      dimensoes: {
        comprimento: parseFloat(r.comprimento) || 0,
        largura: parseFloat(r.largura) || 0,
        altura: parseFloat(r.altura) || 0,
        peso: parseFloat(r.peso) || 0
      }
    }));

    return NextResponse.json({ success: true, data: produtos[0], lista: produtos });
    
  } catch (error) {
    console.error('❌ Erro na API buscar-gtin:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
