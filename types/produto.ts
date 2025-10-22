// Tipos para o sistema de produtos baseado no schema do banco
export interface ProdutoCompleto {
  // ===== IDENTIFICAÇÃO =====
  codigo_interno: string;           // Código interno do produto
  codigo_gtin: string;              // Código GTIN (EAN)
  descricao: string;                // Nome/descrição do produto
  descricao_detalhada?: string;     // Descrição detalhada
  status: string;                   // Status do produto (Ativo/Inativo)
  
  // ===== PREÇOS E CUSTOS =====
  preco_venda: string;              // Preço de venda
  preco_compra: string;             // Preço de custo
  perc_lucro: string;               // Percentual de lucro
  preco_gelado?: string;            // Preço para produtos gelados
  
  // ===== ESTOQUE =====
  qtde: string;                     // Quantidade em estoque
  qtde_min: string;                 // Estoque mínimo
  
  // ===== DIMENSÕES E PESOS =====
  peso_bruto: string;               // Peso bruto
  peso_liquido: string;             // Peso líquido
  comprimento: string;              // Comprimento
  largura: string;                  // Largura
  altura: string;                   // Altura
  peso: string;                     // Peso
  
  // ===== TRIBUTAÇÃO =====
  // Básica
  aliquota_icms: number;            // Alíquota ICMS
  aliquota_ipi: number;             // Alíquota IPI
  aliquota_pis: string;             // Alíquota PIS
  aliquota_cofins: number;          // Alíquota COFINS
  situacao_tributaria: number;      // Situação tributária
  origem: number;                   // Origem da mercadoria
  ncm?: string;                     // NCM
  cfop?: string;                    // CFOP
  cest?: string;                    // CEST
  
  // IPI
  ipi_reducao_bc?: string;          // % Redução BC IPI
  aliquota_ipi_st?: string;         // Alíquota IPI ST
  ipi_reducao_bc_st?: string;       // % Redução BC IPI ST
  cst_ipi?: string;                 // CST IPI
  calculo_ipi?: string;             // Cálculo por (Valor/Quantidade)
  
  // PIS
  pis_reducao_bc?: string;          // % Redução BC PIS
  pis_reducao_bc_st?: string;       // % Redução BC PIS ST
  aliquota_pis_st?: string;         // Alíquota PIS ST
  cst_pis?: string;                 // CST PIS
  calculo_pis?: string;             // Cálculo por (Valor/Quantidade)
  
  // COFINS
  cofins_reducao_bc?: string;       // % Redução BC COFINS
  aliquota_cofins_st?: string;      // Alíquota COFINS ST
  cofins_reducao_bc_st?: string;    // % Redução BC COFINS ST
  cst_cofins?: string;              // CST COFINS
  calculo_cofins?: string;          // Cálculo por (Valor/Quantidade)
  
  // Tributação por Estado
  estados_tributarios?: Array<{
    uf: string;                    // UF do estado
    perc_redu_icms_st: string;     // % Redução BC ICMS ST
    perc_margem_adicional_icms_st: string;  // % Margem Adicional ICMS ST
    perc_icms_st: string;          // % ICMS ST
  }>;
  
  // ===== CLASSIFICAÇÃO E FORNECEDOR =====
  grupo?: string;                   // Grupo do produto
  subgrupo?: string;                // Subgrupo do produto
  categoria?: string;               // Categoria do produto
  unidade?: string;                 // Unidade de medida
  
  fornecedor_id?: string;           // ID do fornecedor (frontend)
  fornecedor_nome?: string;         // Nome do fornecedor
  codfor?: number;                  // Código do fornecedor (backend/API)
  
  // ===== OUTROS CAMPOS =====
  tamanho?: string;                 // Tamanho do produto
  producao?: string;                // Indica se o produto está em produção
  descricao_personalizada?: string;  // Descrição personalizada
  validade?: string;                // Data de validade do produto
  controla_estoque?: boolean;       // Se o produto controla estoque
  
  // ===== DATAS =====
  data_cadastro?: string;           // Data de cadastro
  data_alteracao?: string;          // Data da última alteração
  
  // ===== FLAGS E CONFIGURAÇÕES =====
  inativo?: boolean;                // Se o produto está inativo
  produto_balanca?: boolean;        // Se é produto de balança
  vender_ecommerce?: boolean;       // Se está disponível para venda no e-commerce
  produto_producao?: boolean;       // Se é produto de produção
  descricao_etiqueta?: string;      // Descrição para etiqueta
  
  // ===== EMBALAGEM =====
  comprimento_embalagem?: string;   // Comprimento da embalagem
  largura_embalagem?: string;       // Largura da embalagem
  altura_embalagem?: string;        // Altura da embalagem
  peso_embalagem?: string;          // Peso da embalagem
  
  // ===== CONFIGURAÇÕES DE GRADE =====
  tem_grade?: boolean;              // Se o produto tem grade/variações
  grade_obrigatoria?: boolean;      // Se a grade é obrigatória
  sequencia_grade?: string;         // Sequência da grade (P,M,G,GG)
  tipo_grade?: string;              // Tipo de grade (Tamanho, Cor, etc.)
  
  // ===== CONFIGURAÇÕES DE IMAGEM =====
  imagem_principal?: string;        // URL da imagem principal
  redimensionar_imagem?: string;    // Configuração de redimensionamento
  qualidade_imagem?: string;        // Qualidade da imagem (60%, 80%, etc.)
  gerar_thumbnail?: boolean;        // Se deve gerar thumbnail
  
  // ===== ALTERAÇÃO DE CÓDIGO =====
  novo_codigo_interno?: string;     // Campo para alterar código interno

  // ===== DESCONTOS POR CLASSE =====
  perc_desc_a?: string;             // % Desconto Classe A
  perc_desc_b?: string;             // % Desconto Classe B
  perc_desc_c?: string;             // % Desconto Classe C
  perc_desc_d?: string;             // % Desconto Classe D
  perc_desc_e?: string;             // % Desconto Classe E
  val_desc_a?: string;              // R$ Desconto Classe A
  val_desc_b?: string;              // R$ Desconto Classe B
  val_desc_c?: string;              // R$ Desconto Classe C
  val_desc_d?: string;              // R$ Desconto Classe D
  val_desc_e?: string;              // R$ Desconto Classe E
  
  // ===== CAMPOS TRIBUTÁRIOS ADICIONAIS =====
  modalidade_bc_icms?: string;      // Modalidade BC ICMS
  mod_deter_bc_icms_st?: string;    // Modalidade BC ICMS ST
  reducao_bc_icms?: string;         // % Redução BC ICMS
  perc_fcp_st?: string;             // % FCP ST
  perc_diferimento?: string;        // % Diferimento
  perc_credito_icms?: string;       // % Crédito ICMS
  perc_fcp?: string;                // % FCP (campo do formulário)
  
  // ===== GRADE DE PRODUTOS =====
  grade?: Array<{
    id: string;                    // ID da variação
    codigo_gtin: string;           // Código GTIN da variação
    descricao: string;             // Descrição da variação
    variacao: string;              // Nome da variação
    caracteristica: string;        // Característica da variação
    preco_venda: string;           // Preço de venda
    qtde: string;                  // Quantidade em estoque
    comprimento: string;           // Comprimento
    largura: string;               // Largura
    altura: string;                // Altura
    peso: string;                  // Peso
  }>;
  
  // ===== IMAGENS =====
  imagens?: Array<{
    id: string;                    // ID da imagem
    url: string;                   // URL da imagem
    principal: boolean;            // Se é a imagem principal
  }>;
  
  // ===== COMPOSIÇÃO (MATÉRIA-PRIMA) =====
  composicao?: Array<{
    id: string;                    // ID único do componente
    produto_id: string;            // ID do produto componente
    codigo_gtin: string;           // Código GTIN do componente
    descricao: string;             // Descrição do componente
    quantidade: string;            // Quantidade utilizada
    unidade: string;               // Unidade de medida
    custo: string;                 // Custo unitário
    observacao?: string;           // Observações adicionais
  }>;
}

// Seções organizadas para a interface
export interface SecoesProduto {
  informacoesBasicas: {
    codigo_interno: string
    codigo_gtin?: string
    descricao?: string
    descricao_detalhada?: string
    grupo?: string
    subgrupo?: string
    categoria?: string
    unidade?: string
    status?: string
  }

  precosEstoque: {
    preco_venda?: string
    preco_compra?: string
    perc_lucro?: string
    qtde?: string
    qtde_min?: string
    preco_gelado?: string
    codfor?: string
  }

  dimensoesPeso: {
    peso_bruto?: string
    peso_liquido?: string
    comprimento?: string
    largura?: string
    altura?: string
    peso?: string
    produto_balanca?: string
    tamanho?: string
  }

  tributario: {
    codigo_ncm?: string
    cfop?: string
    cest?: string
    situacao_tributaria?: number
    origem?: number
    aliquota_icms?: number
    icms_reducao_bc?: number
    modalidade_deter_bc_icms?: string
    modalidade_deter_bc_icms_st?: string
    icms_reducao_bc_st?: number
    perc_mva_icms_st?: number
    aliquota_icms_st?: number
    aliquota_fcp?: number
    aliquota_fcp_st?: number
    perc_dif?: number
  }

  ipiPisConfins: {
    // IPI
    aliquota_ipi?: number
    ipi_reducao_bc?: number
    ipi_reducao_bc_st?: number
    aliquota_ipi_st?: number
    cst_ipi?: number
    calculo_ipi?: string
    
    // PIS
    aliquita_pis?: number
    pis_reducao_bc?: number
    pis_reducao_bc_st?: number
    aliquota_pis_st?: number
    cst_pis?: number
    calculo_pis?: string
    
    // COFINS
    aliquota_cofins?: number
    cofins_reducao_bc?: number
    cofins_reducao_bc_st?: number
    aliquota_cofins_st?: number
    cst_cofins?: number
    calculo_cofins?: string
  }

  descontos: {
    perc_desc_a?: string
    perc_desc_b?: string
    perc_desc_c?: string
    perc_desc_d?: string
    perc_desc_e?: string
    val_desc_a?: string
    val_desc_b?: string
    val_desc_c?: string
    val_desc_d?: string
    val_desc_e?: string
  }

  promocoes: {
    qtde_promo?: string
    valor_qtde_promo?: string
    dt_promo1?: string
    dt_promo2?: string
    valor_intervalo_promo?: string
  }

  ecommerce: {
    ns?: string
    ml?: string
    shopee?: string
    categoria_ml?: string
  }

  outros: {
    validade?: string
    vencimento?: string
    vencimento2?: string
    unidade_entrada?: string
    fator_conversao?: string
    ex_tipi?: string
    genero?: string
    desc_etiqueta?: string
    producao?: string
    inativo?: string
    descricao_personalizada?: string
    dt_cadastro?: string
    dt_ultima_alteracao?: string
    aliquota_calculo_credito?: number
  }
}

// Form types para validação
export type ProdutoFormData = Partial<ProdutoCompleto>

// Labels para os campos
export const CAMPO_LABELS: Record<keyof ProdutoCompleto, string> = {
  // Identificação
  codigo_interno: "Código Interno",
  codigo_gtin: "Código GTIN/EAN",
  descricao: "Descrição",
  descricao_detalhada: "Descrição Detalhada",
  status: "Status",
  
  // Preços e custos
  preco_venda: "Preço de Venda",
  preco_compra: "Preço de Compra",
  perc_lucro: "% Lucro",
  preco_gelado: "Preço Gelado",
  
  // Estoque
  qtde: "Quantidade em Estoque",
  qtde_min: "Estoque Mínimo",
  
  // Dimensões e pesos
  peso_bruto: "Peso Bruto",
  peso_liquido: "Peso Líquido",
  comprimento: "Comprimento",
  largura: "Largura",
  altura: "Altura",
  peso: "Peso",
  
  // Tributação básica
  aliquota_icms: "Alíquota ICMS",
  aliquota_ipi: "Alíquota IPI",
  aliquota_pis: "Alíquota PIS",
  aliquota_cofins: "Alíquota COFINS",
  situacao_tributaria: "Situação Tributária",
  origem: "Origem",
  ncm: "NCM",
  cfop: "CFOP",
  cest: "CEST",
  
  // IPI
  ipi_reducao_bc: "IPI Redução BC",
  aliquota_ipi_st: "Alíquota IPI ST",
  ipi_reducao_bc_st: "IPI Redução BC ST",
  cst_ipi: "CST IPI",
  calculo_ipi: "Cálculo IPI",
  
  // PIS
  pis_reducao_bc: "PIS Redução BC",
  pis_reducao_bc_st: "PIS Redução BC ST",
  aliquota_pis_st: "Alíquota PIS ST",
  cst_pis: "CST PIS",
  calculo_pis: "Cálculo PIS",
  
  // COFINS
  cofins_reducao_bc: "COFINS Redução BC",
  aliquota_cofins_st: "Alíquota COFINS ST",
  cofins_reducao_bc_st: "COFINS Redução BC ST",
  cst_cofins: "CST COFINS",
  
  // Classificação e Fornecedor
  grupo: "Grupo",
  subgrupo: "Subgrupo",
  categoria: "Categoria",
  unidade: "Unidade",
  fornecedor_id: "ID Fornecedor",
  fornecedor_nome: "Nome Fornecedor",
  
  // Datas
  data_cadastro: "Data de Cadastro",
  data_alteracao: "Data de Alteração",
  
  // Flags e configurações
  inativo: "Inativo",
  produto_balanca: "Produto de Balança",
  vender_ecommerce: "Vender no E-commerce",
  produto_producao: "Produto de Produção",
  descricao_etiqueta: "Descrição para Etiqueta",
  
  // Embalagem
  comprimento_embalagem: "Comprimento da Embalagem",
  largura_embalagem: "Largura da Embalagem",
  altura_embalagem: "Altura da Embalagem",
  peso_embalagem: "Peso da Embalagem",
  
  // Descontos por classe
  perc_desc_a: "% Desconto Classe A",
  perc_desc_b: "% Desconto Classe B",
  perc_desc_c: "% Desconto Classe C",
  perc_desc_d: "% Desconto Classe D",
  perc_desc_e: "% Desconto Classe E",
  val_desc_a: "Valor Desconto Classe A",
  val_desc_b: "Valor Desconto Classe B",
  val_desc_c: "Valor Desconto Classe C",
  val_desc_d: "Valor Desconto Classe D",
  val_desc_e: "Valor Desconto Classe E",
  
  // Campos tributários adicionais
  modalidade_bc_icms: "Modalidade BC ICMS",
  reducao_bc_icms: "% Redução BC ICMS",
  perc_fcp_st: "% FCP ST",
  perc_diferimento: "% Diferimento",
  perc_credito_icms: "% Crédito ICMS",
  perc_fcp: "% FCP",
  
  // Grade de produtos (não incluindo propriedades aninhadas)
  grade: "Grade de Produtos",
  
  // Imagens (não incluindo propriedades aninhadas)
  imagens: "Imagens",
  
  // Composição (não incluindo propriedades aninhadas)
  composicao: "Composição"
} as Record<keyof ProdutoCompleto, string>;