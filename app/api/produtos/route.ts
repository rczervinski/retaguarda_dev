import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';
import { convertBigIntToString } from '@/lib/bigint-utils';

// Garantir ambiente Node.js (necessário para pg)
export const runtime = 'nodejs';

// GET /api/produtos - Listagem de produtos
export const GET = withTenant(async (request: NextRequest) => {
  console.log('🔍 API /api/produtos GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    
    console.log('📊 Parâmetros:', { page, limit, search });
    
    const offset = (page - 1) * limit;
    
    // Query com SQL bruto
    let whereClause = '';
    let params: any[] = [];
    
    if (search) {
      // Se for numérico, busca exata por código_gtin ou codigo_interno
      // Se for texto, busca parcial por descrição
      const isNumeric = /^\d+$/.test(search.trim());
      
      if (isNumeric) {
        whereClause = 'WHERE p.codigo_gtin = $1';
        params.push(search.trim());
      } else {
        whereClause = 'WHERE p.descricao ILIKE $1';
        params.push(`%${search}%`);
      }
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
    
    // Executar queries usando lib/database
    const [produtosRes, totalRes] = await Promise.all([
      query(produtosQuery, [...params, limit, offset]),
      query(countQuery, params)
    ]);
    
    const produtos = produtosRes.rows;
    const total = Number(totalRes.rows[0].count);
    
    console.log(`📦 Produtos encontrados: ${produtos.length} de ${total} total`);
    
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
})

// POST /api/produtos - Criação de produto
export const POST = withTenant(async (request: NextRequest) => {
  console.log('🆕 API /api/produtos POST chamada - Criação de produto');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const produtoData = await request.json();
    console.log('📦 Dados recebidos:', JSON.stringify(produtoData, null, 2));

    // Helpers
    const toUpper = (v: any) => (typeof v === 'string' && v.trim() !== '' ? v.toUpperCase() : null);
    const num = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const s = typeof v === 'string' ? v.replace(',', '.').trim() : v;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };
    const int = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    };
    const flag = (v: any) => (v === true || v === 1 || v === '1') ? 1 : 0;
    const safeDate = (v: any) => {
      if (!v) return null;
      if (typeof v === 'object') return null;
      const s = String(v).trim();
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '2099-01-01';
      return s;
    };

    // Validações básicas
    if (!produtoData?.descricao || !produtoData?.codigo_gtin) {
      return NextResponse.json(
        { success: false, error: 'Descrição e Código GTIN são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar GTIN duplicado
    const dup = await query('SELECT codigo_interno FROM produtos WHERE codigo_gtin = $1', [produtoData.codigo_gtin]);
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Código GTIN já existe', codigo_interno: dup.rows[0].codigo_interno },
        { status: 409 }
      );
    }

    // Usar transaction() da lib/database
    const created = await transaction(async (client) => {
      // 1) produtos
      const insertProduto = `
        INSERT INTO produtos (codigo_interno, descricao, codigo_gtin, status, ns, ml, shopee)
        VALUES (nextval('produtos_seq'), upper($1), $2, $3, $4, $5, $6)
        RETURNING codigo_interno
      `;
      const status = produtoData.status || 'ATIVO';
      const resProduto = await client.query(insertProduto, [
        produtoData.descricao,
        produtoData.codigo_gtin,
        status,
        produtoData.ns || null,
        produtoData.ml || null,
        produtoData.shopee || null,
      ]);
      const codigoInterno: number = resProduto.rows[0].codigo_interno;

      // 2) produtos_ib
      const insertIb = `
        INSERT INTO produtos_ib (codigo_interno, descricao_detalhada, grupo, subgrupo, categoria, unidade, preco_venda, preco_compra, perc_lucro, codigo_ncm, produto_balanca, validade, cfop, cest)
        VALUES ($1, upper($2), $3, $4, $5, upper($6), $7, $8, $9, $10, $11, $12, $13, $14)
      `;
      const ibParams = [
        codigoInterno,
        produtoData.descricao_detalhada || null,
        produtoData.grupo || null,
        produtoData.subgrupo || null,
        produtoData.categoria || null,
        produtoData.unidade || null,
        num(produtoData.preco_venda),
        num(produtoData.preco_compra),
        num(produtoData.perc_lucro),
        produtoData.codigo_ncm || produtoData.ncm || null,
        int(produtoData.produto_balanca) ?? 0,
        int(produtoData.validade),
        int(produtoData.cfop),
        produtoData.cest || null,
      ];
      console.log('💾 [IB] Params:', ibParams);
      await client.query(insertIb, ibParams);

      // 3) produtos_ou
      const insertOu = `
        INSERT INTO produtos_ou (codigo_interno, perc_desc_a, perc_desc_b, perc_desc_c, perc_desc_d, perc_desc_e, val_desc_a, val_desc_b, val_desc_c, val_desc_d, val_desc_e, qtde, qtde_min, inativo, codfor, tamanho, comprimento, largura, altura, peso, vencimento, descricao_personalizada, producao, preco_gelado, desc_etiqueta, dt_cadastro, dt_ultima_alteracao)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, current_date, current_date)
      `;
      const ouParams = [
        codigoInterno,
        num(produtoData.perc_desc_a) || 0,
        num(produtoData.perc_desc_b) || 0,
        num(produtoData.perc_desc_c) || 0,
        num(produtoData.perc_desc_d) || 0,
        num(produtoData.perc_desc_e) || 0,
        num(produtoData.val_desc_a) || 0,
        num(produtoData.val_desc_b) || 0,
        num(produtoData.val_desc_c) || 0,
        num(produtoData.val_desc_d) || 0,
        num(produtoData.val_desc_e) || 0,
        num(produtoData.qtde) || 0,
        num(produtoData.qtde_min) || 0,
        flag(produtoData.inativo),
        int(produtoData.codfor),
        produtoData.tamanho || null,
        num(produtoData.comprimento),
        num(produtoData.largura),
        num(produtoData.altura),
        num(produtoData.peso),
        safeDate(produtoData.vencimento),
        flag(produtoData.descricao_personalizada),
        flag(produtoData.producao),
        num(produtoData.preco_gelado) || 0,
        produtoData.desc_etiqueta || produtoData.descricao_etiqueta || null,
      ];
      console.log('💾 [OU] Params:', ouParams);
      await client.query(insertOu, ouParams);

      // 4) produtos_tb
      const insertTb = `
        INSERT INTO produtos_tb (
          codigo_interno, ipi_reducao_bc, aliquota_ipi, ipi_reducao_bc_st, aliquota_ipi_st,
          pis_reducao_bc, aliquita_pis, pis_reducao_bc_st, aliquota_pis_st,
          cofins_reducao_bc, aliquota_cofins, cofins_reducao_bc_st, aliquota_cofins_st,
          situacao_tributaria, origem, aliquota_calculo_credito, modalidade_deter_bc_icms,
          aliquota_icms, icms_reducao_bc, modalidade_deter_bc_icms_st, icms_reducao_bc_st,
          perc_mva_icms_st, aliquota_icms_st, cst_ipi, calculo_ipi, cst_pis, calculo_pis,
          cst_cofins, calculo_cofins, aliquota_fcp, aliquota_fcp_st, perc_dif
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
        )
      `;
      const tbParams = [
        codigoInterno,
        num(produtoData.ipi_reducao_bc) || 0,
        num(produtoData.aliquota_ipi) || 0,
        num(produtoData.ipi_reducao_bc_st) || 0,
        num(produtoData.aliquota_ipi_st) || 0,
        num(produtoData.pis_reducao_bc) || 0,
        num(produtoData.aliquota_pis) || 0, // OBS: coluna é aliquita_pis no banco
        num(produtoData.pis_reducao_bc_st) || 0,
        num(produtoData.aliquota_pis_st) || 0,
        num(produtoData.cofins_reducao_bc) || 0,
        num(produtoData.aliquota_cofins) || 0,
        num(produtoData.cofins_reducao_bc_st) || 0,
        num(produtoData.aliquota_cofins_st) || 0,
        int(produtoData.situacao_tributaria) ?? 0,
        int(produtoData.origem) ?? 0,
        num(produtoData.aliquota_calculo_credito) || 0,
        produtoData.modalidade_deter_bc_icms || produtoData.modalidade_bc_icms || null,
        num(produtoData.aliquota_icms) || 0,
        num(produtoData.icms_reducao_bc) || 0,
        produtoData.modalidade_deter_bc_icms_st || null,
        num(produtoData.icms_reducao_bc_st) || 0,
        num(produtoData.perc_mva_icms_st) || 0,
        num(produtoData.aliquota_icms_st) || 0,
        int(produtoData.cst_ipi) ?? 0,
        produtoData.calculo_ipi || null,
        int(produtoData.cst_pis) ?? 0,
        produtoData.calculo_pis || null,
        int(produtoData.cst_cofins) ?? 0,
        produtoData.calculo_cofins || null,
        num(produtoData.aliquota_fcp) || 0,
        num(produtoData.aliquota_fcp_st) || 0,
        num(produtoData.perc_dif) || 0,
      ];
      console.log('💾 [TB] Params:', tbParams);
      await client.query(insertTb, tbParams);

      return { codigoInterno };
    });

    // Resposta de sucesso
    return NextResponse.json({
      success: true,
      message: 'Produto criado com sucesso',
      data: { codigo_interno: String(created.codigoInterno), codigo_gtin: produtoData.codigo_gtin, descricao: produtoData.descricao }
    });
  } catch (error) {
    console.error('❌ Erro ao criar produto:', error);
    
    // Se for erro de constraint (código duplicado, etc)
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Código GTIN já existe no sistema',
          details: error.message
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor ao criar produto',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
})
