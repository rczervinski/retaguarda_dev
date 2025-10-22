import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs';

export const GET = withTenant(async () => {
  console.log('🏭 API /api/fornecedores GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    // Buscar todos os fornecedores ativos
    const sql = `
      SELECT 
        codigo,
        fantasia
      FROM fornecedores 
      WHERE inativo = 0 OR inativo IS NULL
      ORDER BY fantasia ASC
    `;

    console.log('🔍 Executando query para buscar fornecedores...');
    const result = await query(sql);

    console.log(`📦 Fornecedores encontrados: ${result.rows.length}`);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar fornecedores:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
});

// POST /api/fornecedores - Criar novo fornecedor
export const POST = withTenant(async (request: NextRequest) => {
  console.log('🏭 API /api/fornecedores POST chamada - NOVO FORNECEDOR');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    const fornecedorData = await request.json();
    console.log('📦 Dados do fornecedor recebidos:', Object.keys(fornecedorData));

    if (!fornecedorData.fantasia) {
      return NextResponse.json({
        success: false,
        error: 'Nome fantasia é obrigatório'
      }, { status: 400 });
    }

    // Converter fantasia para uppercase conforme regras
    const fantasiaUpper = fornecedorData.fantasia.toUpperCase();

    // Inserir novo fornecedor
    const insertQuery = `
      INSERT INTO fornecedores (
        fantasia,
        razao_social,
        cpf_cnpj,
        inscricao_rg,
        comprador,
        vendedor,
        cep,
        logradouro,
        complemento,
        bairro,
        fone,
        fax,
        celular,
        operadora,
        email,
        inativo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0
      ) RETURNING codigo, fantasia
    `;

    const result = await query(insertQuery, [
      fantasiaUpper,
      fornecedorData.razao_social?.toUpperCase() || null,
      fornecedorData.cpf_cnpj || null,
      fornecedorData.inscricao_rg || null,
      fornecedorData.comprador?.toUpperCase() || null,
      fornecedorData.vendedor?.toUpperCase() || null,
      fornecedorData.cep || null,
      fornecedorData.logradouro?.toUpperCase() || null,
      fornecedorData.complemento?.toUpperCase() || null,
      fornecedorData.bairro?.toUpperCase() || null,
      fornecedorData.fone || null,
      fornecedorData.fax || null,
      fornecedorData.celular || null,
      fornecedorData.operadora?.toUpperCase() || null,
      fornecedorData.email || null
    ]);

    const novoFornecedor = result.rows[0];
    console.log('✅ Fornecedor criado:', novoFornecedor.fantasia);

    return NextResponse.json({
      success: true,
      data: novoFornecedor,
      message: 'Fornecedor criado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
});
