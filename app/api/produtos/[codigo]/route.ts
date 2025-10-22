import { NextRequest, NextResponse } from 'next/server';
import { convertBigIntToString } from '@/lib/bigint-utils';
import { query, transaction } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

// Garantir ambiente Node.js para acesso ao PostgreSQL
export const runtime = 'nodejs';

// GET /api/produtos/[codigo] - Buscar produto específico por código
export const GET = withTenant(async (
  request: NextRequest,
  params?: { codigo?: string }
) => {
  console.log('🔍 API /api/produtos/[codigo] GET chamada - PRODUTO ESPECÍFICO');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📝 Código recebido:', params?.codigo);
  
  try {
    const codigo = params?.codigo;
    
    if (!codigo) {
      console.log('❌ Código não fornecido');
      return NextResponse.json(
        { success: false, error: 'Código do produto é obrigatório' },
        { status: 400 }
      );
    }
    const codigoInt = parseInt(String(codigo), 10);
    if (!Number.isFinite(codigoInt)) {
      return NextResponse.json(
        { success: false, error: 'Código inválido' },
        { status: 400 }
      );
    }
    
    console.log('🔍 Buscando produto com código:', codigoInt);
    
    // Query para buscar produto completo com todas as tabelas relacionadas
    const produtoQuery = `
      SELECT 
        p.codigo_interno::text as codigo_interno,
        p.codigo_gtin, 
        p.descricao, 
        p.status,
        p.ns,
        p.ml,
        p.shopee,
        -- Dados de produtos_ib
        pib.descricao_detalhada,
        pib.grupo,
        pib.subgrupo,
        pib.categoria,
        pib.unidade,
        pib.preco_venda::text as preco_venda,
        pib.preco_compra::text as preco_compra,
        pib.perc_lucro::text as perc_lucro,
        pib.codigo_ncm,
        pib.produto_balanca,
        pib.validade,
        pib.cfop,
        pib.cest,
        -- Dados de produtos_ou
        pou.perc_desc_a::text as perc_desc_a,
        pou.perc_desc_b::text as perc_desc_b,
        pou.perc_desc_c::text as perc_desc_c,
        pou.perc_desc_d::text as perc_desc_d,
        pou.perc_desc_e::text as perc_desc_e,
        pou.val_desc_a::text as val_desc_a,
        pou.val_desc_b::text as val_desc_b,
        pou.val_desc_c::text as val_desc_c,
        pou.val_desc_d::text as val_desc_d,
        pou.val_desc_e::text as val_desc_e,
        pou.qtde::text as qtde,
        pou.qtde_min::text as qtde_min,
        pou.inativo,
        pou.codfor,
        pou.tamanho,
        pou.comprimento::text as comprimento,
        pou.largura::text as largura,
        pou.altura::text as altura,
        pou.peso::text as peso,
        pou.vencimento,
        pou.descricao_personalizada,
        pou.producao,
  pou.preco_gelado::text as preco_gelado,
        pou.desc_etiqueta,
  pou.dt_cadastro::text as data_cadastro,
  pou.dt_ultima_alteracao::text as data_alteracao,
        -- Dados de produtos_tb
        ptb.ipi_reducao_bc::text as ipi_reducao_bc,
        ptb.aliquota_ipi::text as aliquota_ipi,
        ptb.ipi_reducao_bc_st::text as ipi_reducao_bc_st,
        ptb.aliquota_ipi_st::text as aliquota_ipi_st,
        ptb.pis_reducao_bc::text as pis_reducao_bc,
        ptb.aliquita_pis::text as aliquota_pis,
        ptb.pis_reducao_bc_st::text as pis_reducao_bc_st,
        ptb.aliquota_pis_st::text as aliquota_pis_st,
        ptb.cofins_reducao_bc::text as cofins_reducao_bc,
        ptb.aliquota_cofins::text as aliquota_cofins,
        ptb.cofins_reducao_bc_st::text as cofins_reducao_bc_st,
        ptb.aliquota_cofins_st::text as aliquota_cofins_st,
        ptb.situacao_tributaria,
        ptb.origem,
        ptb.aliquota_calculo_credito::text as aliquota_calculo_credito,
        ptb.modalidade_deter_bc_icms,
        ptb.aliquota_icms::text as aliquota_icms,
        ptb.icms_reducao_bc::text as icms_reducao_bc,
        ptb.modalidade_deter_bc_icms_st,
        ptb.icms_reducao_bc_st::text as icms_reducao_bc_st,
        ptb.perc_mva_icms_st::text as perc_mva_icms_st,
        ptb.aliquota_icms_st::text as aliquota_icms_st,
        ptb.cst_ipi,
        ptb.calculo_ipi,
        ptb.cst_pis,
        ptb.calculo_pis,
        ptb.cst_cofins,
        ptb.calculo_cofins,
        ptb.aliquota_fcp::text as aliquota_fcp,
        ptb.aliquota_fcp_st::text as aliquota_fcp_st,
        ptb.perc_dif::text as perc_dif
      FROM produtos p
      LEFT JOIN produtos_ib pib ON p.codigo_interno = pib.codigo_interno
      LEFT JOIN produtos_ou pou ON p.codigo_interno = pou.codigo_interno
      LEFT JOIN produtos_tb ptb ON p.codigo_interno = ptb.codigo_interno
      WHERE p.codigo_interno = $1
    `;
    
    console.log('🔍 Executando query para produto:', codigoInt);
    
    const resultado = await query(produtoQuery, [codigoInt]);
    
    if (!resultado || resultado.rows.length === 0) {
      console.log('❌ Produto não encontrado');
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }
    
    const produto = resultado.rows[0];
    console.log('✅ Produto encontrado:', produto.descricao);
    
    // Buscar composição do produto
    console.log('🔍 Buscando composição do produto...');
    const composicaoQuery = `
      SELECT 
        gd.codigo_gtin,
        gd.variacao as quantidade,
        gd.caracteristica as observacao,
        p.descricao as nome_produto,
        pib.unidade,
        pib.preco_compra::text as custo
      FROM produtos_gd gd
      LEFT JOIN produtos p ON gd.codigo_gtin = p.codigo_gtin
      LEFT JOIN produtos_ib pib ON p.codigo_interno = pib.codigo_interno
      WHERE gd.codigo_interno = $1 AND gd.nome ILIKE '%composicao%'
      ORDER BY gd.codigo
    `;
    
    const composicao = await query(composicaoQuery, [codigoInt]);
    console.log('📦 Composição encontrada:', composicao.rows.length, 'itens');
    
    // Buscar grade do produto
    console.log('🔍 Buscando grade do produto...');
    const gradeQuery = `
      SELECT 
        gd.codigo_interno as codigo_interno_variacao,
        gd.caracteristica as observacao,
        p.descricao as nome_variacao,
        p.codigo_gtin as gtin_variacao
      FROM produtos_gd gd
      LEFT JOIN produtos p ON gd.codigo_interno = p.codigo_interno
      WHERE gd.codigo_interno = $1 AND gd.nome ILIKE '%grade%'
      ORDER BY gd.codigo
    `;
    
    const grade = await query(gradeQuery, [codigoInt]);
    console.log('📊 Grade encontrada:', grade.rows.length, 'variações');
    
    // Adicionar composição e grade ao produto
    const produtoCompleto = {
      ...produto,
      composicao: convertBigIntToString(composicao.rows),
      grade: convertBigIntToString(grade.rows)
    };
    
    const response = {
      success: true,
      data: convertBigIntToString(produtoCompleto)
    };
    
    console.log('✅ Resposta formatada com sucesso');
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Erro na API produtos/[codigo]:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});

// PUT /api/produtos/[codigo] - Atualizar produto específico
export const PUT = withTenant(async (
  request: NextRequest,
  params?: { codigo?: string }
) => {
  console.log('✏️ API /api/produtos/[codigo] PUT chamada - ATUALIZAR PRODUTO');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📝 Código recebido:', params?.codigo);
  
  try {
    const codigo = params?.codigo;
    const produtoData = await request.json();
    
    console.log('📦 Dados recebidos para atualização:', Object.keys(produtoData));
    
    if (!codigo) {
      console.log('❌ Código não fornecido');
      return NextResponse.json(
        { success: false, error: 'Código do produto é obrigatório' },
        { status: 400 }
      );
    }
    const codigoInt = parseInt(String(codigo), 10);
    if (!Number.isFinite(codigoInt)) {
      return NextResponse.json(
        { success: false, error: 'Código inválido' },
        { status: 400 }
      );
    }
    
    // Verificar se o produto existe
    const produtoExiste = await query(
      'SELECT codigo_interno FROM produtos WHERE codigo_interno = $1',
      [codigoInt]
    );
    
    if (!produtoExiste || produtoExiste.rows.length === 0) {
      console.log('❌ Produto não encontrado para atualização');
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }
    
    // Executar todas as atualizações em uma transação
    await transaction(async (client) => {
      // Atualizar tabela produtos
      if (produtoData.codigo_gtin || produtoData.descricao || produtoData.status || 
          produtoData.ns !== undefined || produtoData.ml !== undefined || produtoData.shopee !== undefined) {
        const updateProdutos = `
          UPDATE produtos SET 
            codigo_gtin = COALESCE($2, codigo_gtin),
            descricao = COALESCE($3, descricao),
            status = COALESCE($4, status),
            ns = COALESCE($5, ns),
            ml = COALESCE($6, ml),
            shopee = COALESCE($7, shopee)
          WHERE codigo_interno = $1
        `;
        await client.query(
          updateProdutos,
          [
            codigoInt,
            produtoData.codigo_gtin || null,
            produtoData.descricao || null,
            produtoData.status || null,
            produtoData.ns || null,
            produtoData.ml || null,
            produtoData.shopee || null
          ]
        );
        console.log('✅ Tabela produtos atualizada');
      }
    
    // Helpers para parsing seguro
    const intOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    };
    const numOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const s = typeof v === 'string' ? v.replace(',', '.').trim() : v;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };
    const flagOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      return (v === true || v === 1 || v === '1') ? 1 : 0;
    };
    // Helpers específicos para colunas VARCHAR
    const strOrNull = (v: any) => {
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
      return String(v);
    };
    const numStrOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const s = typeof v === 'string' ? v.replace(',', '.').trim() : String(v);
      // Não validar número aqui; a coluna é VARCHAR e aceitará string
      return s;
    };
    const flagStrOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      return (v === true || v === 1 || v === '1') ? '1' : '0';
    };

    // Atualizar tabela produtos_ib
    console.log('🔄 Iniciando atualização da tabela produtos_ib...');
    
    if (produtoData.descricao_detalhada || produtoData.grupo || produtoData.subgrupo || 
        produtoData.categoria || produtoData.unidade || produtoData.preco_venda || 
        produtoData.preco_compra || produtoData.perc_lucro || produtoData.codigo_ncm ||
        produtoData.produto_balanca !== undefined || produtoData.validade !== undefined || 
        produtoData.cfop || produtoData.cest) {
      
      const updateProdutosIb = `
        UPDATE produtos_ib SET 
          descricao_detalhada = COALESCE($2, descricao_detalhada),
          grupo = COALESCE($3, grupo),
          subgrupo = COALESCE($4, subgrupo),
          categoria = COALESCE($5, categoria),
          unidade = COALESCE($6, unidade),
          preco_venda = COALESCE($7, preco_venda),
          preco_compra = COALESCE($8, preco_compra),
          perc_lucro = COALESCE($9, perc_lucro),
          codigo_ncm = COALESCE($10, codigo_ncm),
          produto_balanca = COALESCE($11, produto_balanca),
          validade = COALESCE($12, validade),
          cfop = COALESCE($13, cfop),
          cest = COALESCE($14, cest)
        WHERE codigo_interno = $1
      `;
      
      const ibParams = [
          parseInt(codigo),
          strOrNull(produtoData.descricao_detalhada),
          strOrNull(produtoData.grupo),
          strOrNull(produtoData.subgrupo),
          strOrNull(produtoData.categoria),
          strOrNull(produtoData.unidade),
          numStrOrNull(produtoData.preco_venda),
          numStrOrNull(produtoData.preco_compra),
          numStrOrNull(produtoData.perc_lucro),
          strOrNull(produtoData.codigo_ncm),
          flagStrOrNull(produtoData.produto_balanca),
          strOrNull(produtoData.validade),
          strOrNull(produtoData.cfop),
          strOrNull(produtoData.cest)
        ];
      console.log('✏️ [PUT/IB] Params:', ibParams);
      await client.query(updateProdutosIb, ibParams);
      
      console.log('✅ Tabela produtos_ib atualizada');
    }
    
    // Atualizar tabela produtos_ou
    console.log('🔄 Iniciando atualização da tabela produtos_ou...');
    
    // Debug do vencimento
    console.log('🔍 [DEBUG] produtoData.vencimento:', JSON.stringify(produtoData.vencimento), 'tipo:', typeof produtoData.vencimento);
    
    // Função para tratar data de vencimento de forma segura
    const tratarVencimento = (vencimento: any) => {
      if (!vencimento) return null;
      if (typeof vencimento === 'object') return null; // Se for objeto {}, retorna null
      if (typeof vencimento === 'string' && vencimento.trim() === '') return null;
      if (typeof vencimento === 'string') return vencimento;
      return null;
    };
    
    const vencimentoTratado = tratarVencimento(produtoData.vencimento);
    console.log('🔍 [DEBUG] vencimentoTratado:', vencimentoTratado);
    
    if (produtoData.perc_desc_a || produtoData.perc_desc_b || produtoData.perc_desc_c || 
        produtoData.perc_desc_d || produtoData.perc_desc_e || produtoData.val_desc_a || 
        produtoData.val_desc_b || produtoData.val_desc_c || produtoData.val_desc_d || 
        produtoData.val_desc_e || produtoData.qtde || produtoData.qtde_min || 
        produtoData.inativo !== undefined || produtoData.codfor || produtoData.tamanho ||
        produtoData.comprimento || produtoData.largura || produtoData.altura || 
        produtoData.peso || produtoData.vencimento || produtoData.descricao_personalizada !== undefined ||
        produtoData.producao !== undefined || produtoData.preco_gelado || produtoData.desc_etiqueta) {
      
      const updateProdutosOu = `
        UPDATE produtos_ou SET 
          perc_desc_a = COALESCE($2, perc_desc_a),
          perc_desc_b = COALESCE($3, perc_desc_b),
          perc_desc_c = COALESCE($4, perc_desc_c),
          perc_desc_d = COALESCE($5, perc_desc_d),
          perc_desc_e = COALESCE($6, perc_desc_e),
          val_desc_a = COALESCE($7, val_desc_a),
          val_desc_b = COALESCE($8, val_desc_b),
          val_desc_c = COALESCE($9, val_desc_c),
          val_desc_d = COALESCE($10, val_desc_d),
          val_desc_e = COALESCE($11, val_desc_e),
          qtde = COALESCE($12, qtde),
          qtde_min = COALESCE($13, qtde_min),
          inativo = COALESCE($14, inativo),
          codfor = COALESCE($15, codfor),
          tamanho = COALESCE($16, tamanho),
          comprimento = COALESCE($17, comprimento),
          largura = COALESCE($18, largura),
          altura = COALESCE($19, altura),
          peso = COALESCE($20, peso),
          vencimento = COALESCE($21::date, vencimento),
          descricao_personalizada = COALESCE($22, descricao_personalizada),
          producao = COALESCE($23, producao),
          preco_gelado = COALESCE($24, preco_gelado),
          desc_etiqueta = COALESCE($25, desc_etiqueta)
        WHERE codigo_interno = $1
      `;
      
      const ouParams = [
          parseInt(codigo),
          numStrOrNull(produtoData.perc_desc_a),
          numStrOrNull(produtoData.perc_desc_b),
          numStrOrNull(produtoData.perc_desc_c),
          numStrOrNull(produtoData.perc_desc_d),
          numStrOrNull(produtoData.perc_desc_e),
          numStrOrNull(produtoData.val_desc_a),
          numStrOrNull(produtoData.val_desc_b),
          numStrOrNull(produtoData.val_desc_c),
          numStrOrNull(produtoData.val_desc_d),
          numStrOrNull(produtoData.val_desc_e),
          numStrOrNull(produtoData.qtde),
          numStrOrNull(produtoData.qtde_min),
          flagStrOrNull(produtoData.inativo),
          strOrNull(produtoData.codfor),
          strOrNull(produtoData.tamanho),
          numStrOrNull(produtoData.comprimento),
          numStrOrNull(produtoData.largura),
          numStrOrNull(produtoData.altura),
          numStrOrNull(produtoData.peso),
          vencimentoTratado,
          flagStrOrNull(produtoData.descricao_personalizada),
          flagStrOrNull(produtoData.producao),
          numStrOrNull(produtoData.preco_gelado),
          strOrNull(produtoData.desc_etiqueta)
        ];
      console.log('✏️ [PUT/OU] Params:', ouParams);
      await client.query(updateProdutosOu, ouParams);
      
      console.log('✅ Tabela produtos_ou atualizada');
    }
    
    // Atualizar tabela produtos_tb (tributação)
    console.log('🔄 Iniciando atualização da tabela produtos_tb...');
    
    if (produtoData.ipi_reducao_bc || produtoData.aliquota_ipi || produtoData.ipi_reducao_bc_st || 
        produtoData.aliquota_ipi_st || produtoData.pis_reducao_bc || produtoData.aliquota_pis || 
        produtoData.pis_reducao_bc_st || produtoData.aliquota_pis_st || produtoData.cofins_reducao_bc || 
        produtoData.aliquota_cofins || produtoData.cofins_reducao_bc_st || produtoData.aliquota_cofins_st ||
        produtoData.situacao_tributaria !== undefined || produtoData.origem !== undefined || 
        produtoData.aliquota_calculo_credito || produtoData.modalidade_deter_bc_icms || 
        produtoData.aliquota_icms || produtoData.icms_reducao_bc || produtoData.modalidade_deter_bc_icms_st ||
        produtoData.icms_reducao_bc_st || produtoData.perc_mva_icms_st || produtoData.aliquota_icms_st ||
        produtoData.cst_ipi !== undefined || produtoData.calculo_ipi || produtoData.cst_pis !== undefined ||
        produtoData.calculo_pis || produtoData.cst_cofins !== undefined || produtoData.calculo_cofins ||
        produtoData.aliquota_fcp || produtoData.aliquota_fcp_st || produtoData.perc_dif) {
      
      const updateProdutosTb = `
        UPDATE produtos_tb SET 
          ipi_reducao_bc = COALESCE($2::numeric, ipi_reducao_bc),
          aliquota_ipi = COALESCE($3::numeric, aliquota_ipi),
          ipi_reducao_bc_st = COALESCE($4::numeric, ipi_reducao_bc_st),
          aliquota_ipi_st = COALESCE($5::numeric, aliquota_ipi_st),
          pis_reducao_bc = COALESCE($6::numeric, pis_reducao_bc),
          aliquita_pis = COALESCE($7::numeric, aliquita_pis),
          pis_reducao_bc_st = COALESCE($8::numeric, pis_reducao_bc_st),
          aliquota_pis_st = COALESCE($9::numeric, aliquota_pis_st),
          cofins_reducao_bc = COALESCE($10::numeric, cofins_reducao_bc),
          aliquota_cofins = COALESCE($11::numeric, aliquota_cofins),
          cofins_reducao_bc_st = COALESCE($12::numeric, cofins_reducao_bc_st),
          aliquota_cofins_st = COALESCE($13::numeric, aliquota_cofins_st),
          situacao_tributaria = COALESCE($14::integer, situacao_tributaria),
          origem = COALESCE($15::integer, origem),
          aliquota_calculo_credito = COALESCE($16::numeric, aliquota_calculo_credito),
          modalidade_deter_bc_icms = COALESCE($17, modalidade_deter_bc_icms),
          aliquota_icms = COALESCE($18::numeric, aliquota_icms),
          icms_reducao_bc = COALESCE($19::numeric, icms_reducao_bc),
          modalidade_deter_bc_icms_st = COALESCE($20, modalidade_deter_bc_icms_st),
          icms_reducao_bc_st = COALESCE($21::numeric, icms_reducao_bc_st),
          perc_mva_icms_st = COALESCE($22::numeric, perc_mva_icms_st),
          aliquota_icms_st = COALESCE($23::numeric, aliquota_icms_st),
          cst_ipi = COALESCE($24::integer, cst_ipi),
          calculo_ipi = COALESCE($25, calculo_ipi),
          cst_pis = COALESCE($26::integer, cst_pis),
          calculo_pis = COALESCE($27, calculo_pis),
          cst_cofins = COALESCE($28::integer, cst_cofins),
          calculo_cofins = COALESCE($29, calculo_cofins),
          aliquota_fcp = COALESCE($30::numeric, aliquota_fcp),
          aliquota_fcp_st = COALESCE($31::numeric, aliquota_fcp_st),
          perc_dif = COALESCE($32::numeric, perc_dif)
        WHERE codigo_interno = $1
      `;
      
      const tbParams = [
          parseInt(codigo),
          numOrNull(produtoData.ipi_reducao_bc),
          numOrNull(produtoData.aliquota_ipi),
          numOrNull(produtoData.ipi_reducao_bc_st),
          numOrNull(produtoData.aliquota_ipi_st),
          numOrNull(produtoData.pis_reducao_bc),
          numOrNull(produtoData.aliquota_pis),
          numOrNull(produtoData.pis_reducao_bc_st),
          numOrNull(produtoData.aliquota_pis_st),
          numOrNull(produtoData.cofins_reducao_bc),
          numOrNull(produtoData.aliquota_cofins),
          numOrNull(produtoData.cofins_reducao_bc_st),
          numOrNull(produtoData.aliquota_cofins_st),
          intOrNull(produtoData.situacao_tributaria),
          intOrNull(produtoData.origem),
          numOrNull(produtoData.aliquota_calculo_credito),
          produtoData.modalidade_deter_bc_icms || null,
          numOrNull(produtoData.aliquota_icms),
          numOrNull(produtoData.icms_reducao_bc),
          produtoData.modalidade_deter_bc_icms_st || null,
          numOrNull(produtoData.icms_reducao_bc_st),
          numOrNull(produtoData.perc_mva_icms_st),
          numOrNull(produtoData.aliquota_icms_st),
          intOrNull(produtoData.cst_ipi),
          produtoData.calculo_ipi || null,
          intOrNull(produtoData.cst_pis),
          produtoData.calculo_pis || null,
          intOrNull(produtoData.cst_cofins),
          produtoData.calculo_cofins || null,
          numOrNull(produtoData.aliquota_fcp),
          numOrNull(produtoData.aliquota_fcp_st),
          numOrNull(produtoData.perc_dif)
        ];
      console.log('✏️ [PUT/TB] Params:', tbParams);
      await client.query(updateProdutosTb, tbParams);
      
      console.log('✅ Tabela produtos_tb atualizada');
    }
    
    // Processar Composição se fornecida
    if (produtoData.composicao && Array.isArray(produtoData.composicao)) {
      console.log('🔧 Processando composição...');
      
      // Remover composições existentes
      await client.query(
        'DELETE FROM produtos_gd WHERE codigo_interno = $1 AND nome ILIKE $2',
        [codigoInt, '%composicao%']
      );
      
      // Inserir novas composições
      for (const item of produtoData.composicao) {
        if (item.codigo_gtin && item.quantidade) {
          await client.query(`
            INSERT INTO produtos_gd (codigo_interno, codigo_gtin, variacao, caracteristica, nome)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            codigoInt,
            item.codigo_gtin,
            item.quantidade, // usando variacao para quantidade
            item.observacao || null, // usando caracteristica para observacao
            'composicao'
          ]);
        }
      }
      
      console.log('✅ Composição atualizada');
    }
    
    // Processar Grade se fornecida
    if (produtoData.grade && Array.isArray(produtoData.grade)) {
      console.log('🔧 Processando grade...');
      
      // Remover grades existentes
      await client.query(
        'DELETE FROM produtos_gd WHERE codigo_interno = $1 AND nome ILIKE $2',
        [codigoInt, '%grade%']
      );
      
      // Inserir novas grades
      for (const item of produtoData.grade) {
        if (item.codigo_interno_variacao) {
          await client.query(`
            INSERT INTO produtos_gd (codigo_interno, codigo_gtin, caracteristica, nome)
            VALUES ($1, (SELECT codigo_gtin FROM produtos WHERE codigo_interno = $2), $3, $4)
          `,
          [
            codigoInt,
            parseInt(item.codigo_interno_variacao),
            item.observacao || null,
            'grade'
          ]);
        }
      }
      
      console.log('✅ Grade atualizada');
    }
    });
    
    console.log('✅ Produto atualizado com sucesso');
    
    return NextResponse.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: { codigo_interno: String(codigoInt) }
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar produto:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
});
