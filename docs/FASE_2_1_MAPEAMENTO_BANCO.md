# FASE 2.1 - MAPEAMENTO DO BANCO DE DADOS

## 🎯 OBJETIVO
Mapear completamente as operações de banco de dados do sistema PHP para implementação das APIs Next.js.

## 📊 TABELAS PRINCIPAIS

### 1. **produtos** (Tabela Principal)
- **Campos**: codigo_gtin, descricao, codigo_interno, status, ns, ml, shopee
- **Chave Primária**: codigo_interno
- **Chave Única**: codigo_gtin
- **Relacionamentos**: 1:1 com produtos_ib, produtos_ou, produtos_tb

### 2. **produtos_ib** (Informações Básicas)
```sql
-- Campos mapeados do formulário:
descricao_detalhada -> descricao_detalhada
grupo -> grupo  
subgrupo -> subgrupo
categoria -> categoria
unidade -> unidade
preco_venda -> preco_venda
preco_compra -> preco_compra  
perc_lucro -> perc_lucro
codigo_ncm -> ncm
produto_balanca -> produto_balanca (0/1)
validade -> validade
cfop -> cfop
cest -> cest
```

### 3. **produtos_ou** (Outros Dados)
```sql
-- Campos mapeados do formulário:
perc_desc_a -> perc_desc_a
perc_desc_b -> perc_desc_b
perc_desc_c -> perc_desc_c
perc_desc_d -> perc_desc_d
perc_desc_e -> perc_desc_e
val_desc_a -> val_desc_a
val_desc_b -> val_desc_b
val_desc_c -> val_desc_c
val_desc_d -> val_desc_d
val_desc_e -> val_desc_e
qtde -> qtde
qtde_min -> qtde_min
inativo -> inativo (0/1)
codfor -> codigo_fornecedor
tamanho -> tamanho
vencimento -> vencimento
descricao_personalizada -> descricao_personalizada (0/1)
producao -> produto_producao (0/1)
preco_gelado -> valorGelado
desc_etiqueta -> desc_etiqueta
comprimento -> comprimento
largura -> largura
altura -> altura
peso -> peso
```

### 4. **produtos_tb** (Tributação)
```sql
-- Campos mapeados do formulário:
ipi_reducao_bc -> ipi_reducao_bc
aliquota_ipi -> aliquota_ipi
ipi_reducao_bc_st -> ipi_reducao_bc_st
aliquota_ipi_st -> aliquota_ipi_st
pis_reducao_bc -> pis_reducao_bc
aliquita_pis -> aliquota_pis (ERRO NO CAMPO - aliquota_pis)
pis_reducao_bc_st -> pis_reducao_bc_st
aliquota_pis_st -> aliquota_pis_st
cofins_reducao_bc -> cofins_reducao_bc
aliquota_cofins -> aliquota_cofins
cofins_reducao_bc_st -> cofins_reducao_bc_st
aliquota_cofins_st -> aliquota_cofins_st
situacao_tributaria -> situacao_tributaria
origem -> origem (sempre '0')
aliquota_calculo_credito -> aliquota_calculo_credito
modalidade_deter_bc_icms -> mod_deter_bc_icms
aliquota_icms -> perc_icms
icms_reducao_bc -> perc_redu_icms
modalidade_deter_bc_icms_st -> mod_deter_bc_icms_st
icms_reducao_bc_st -> perc_redu_icms_st
perc_mva_icms_st -> perc_mv_adic_icms_st
aliquota_icms_st -> aliq_icms_st
cst_ipi -> cst_ipi
calculo_ipi -> calculo_ipi
cst_pis -> cst_pis
calculo_pis -> calculo_pis
cst_cofins -> cst_cofins
calculo_cofins -> calculo_cofins
aliquota_fcp -> aliq_fcp
aliquota_fcp_st -> aliq_fcp_st
perc_dif -> perc_dif
```

### 5. **fornecedores** (Fornecedores)
- **Campos**: codigo, razao_social, fantasia, cep
- **Sequência**: fornecedores_codigo_seq

### 6. **produtos_gd** (Grade de Produtos)
```sql
-- Estrutura da Grade:
codigo -> CODIGO (campo código da grade)
codigo_gtin -> codigo_gtin (EAN do produto pai)
nome -> NOME (nome da variante)
caracteristica -> CARACTERISTICA (ex: COR, TAMANHO)
variacao -> VARIACAO (ex: AZUL, M)
codigo_interno -> codigo_interno (FK produto pai)
```

## 🔄 OPERAÇÕES PRINCIPAIS

### **A. CONSULTAS (SELECT)**

#### A.1 - Carregamento de Combos
```php
// 1. Carregar Categorias
carregar_categoria: "SELECT DISTINCT categoria FROM produtos_ib ORDER BY categoria"

// 2. Carregar Grupos (pode filtrar por categoria)
carregar_grupo: "SELECT DISTINCT grupo FROM produtos_ib [WHERE categoria = ?] ORDER BY grupo"

// 3. Carregar Subgrupos  
carregar_subgrupo: "SELECT DISTINCT subgrupo FROM produtos_ib ORDER BY subgrupo"

// 4. Carregar Unidades
carregar_unidade: "SELECT DISTINCT unidade FROM produtos_ib ORDER BY unidade"

// 5. Carregar Fornecedores
carregar_fornecedor: "SELECT codigo, razao_social FROM fornecedores ORDER BY razao_social"
```

#### A.2 - Buscar Produto Específico
```php
// Por categoria/grupo do produto
buscar_categorias_produto: "SELECT categoria, grupo FROM produtos_ib WHERE codigo_interno = ?"

// Consultar se código existe  
consultarCodigoProduto: "SELECT codigo_interno FROM produtos WHERE codigo_gtin = ?"
```

#### A.3 - Listagem de Produtos
```php
fetchall: 
  Base: "FROM produtos p"
  Joins: "INNER JOIN produtos_ib pib ON p.codigo_interno = pib.codigo_interno" (quando filtros)
  Where: Filtros por categoria, grupo, status NS, pesquisa por GTIN/descrição
  Order: "ORDER BY p.descricao ASC LIMIT 50 OFFSET ?"
```

#### A.4 - Grade Completa
```php
carregar_grade_completa: "SELECT * FROM produtos_gd WHERE codigo_interno = ? ORDER BY codigo"
```

### **B. INSERÇÕES (INSERT)**

#### B.1 - Novo Produto
```sql
-- 1. Tabela produtos
INSERT INTO produtos (codigo_interno, descricao, codigo_gtin, status) 
VALUES (nextval('produtos_seq'), upper(?), ?, ?) 
RETURNING codigo_interno

-- 2. Tabela produtos_ib  
INSERT INTO produtos_ib (codigo_interno, descricao_detalhada, grupo, subgrupo, categoria, unidade, preco_venda, preco_compra, perc_lucro, codigo_ncm, produto_balanca, validade, cfop, cest)
VALUES (?, upper(?), ?, ?, ?, upper(?), ?, ?, ?, ?, ?, ?, ?, ?)

-- 3. Tabela produtos_ou
INSERT INTO produtos_ou (codigo_interno, perc_desc_a, perc_desc_b, perc_desc_c, perc_desc_d, perc_desc_e, val_desc_a, val_desc_b, val_desc_c, val_desc_d, val_desc_e, qtde, qtde_min, inativo, codfor, tamanho, comprimento, largura, altura, peso, vencimento, descricao_personalizada, producao, preco_gelado, desc_etiqueta)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

-- 4. Tabela produtos_tb
INSERT INTO produtos_tb (codigo_interno, ipi_reducao_bc, aliquota_ipi, ipi_reducao_bc_st, aliquota_ipi_st, pis_reducao_bc, aliquita_pis, pis_reducao_bc_st, aliquota_pis_st, cofins_reducao_bc, aliquota_cofins, cofins_reducao_bc_st, aliquota_cofins_st, situacao_tributaria, origem, aliquota_calculo_credito, modalidade_deter_bc_icms, aliquota_icms, icms_reducao_bc, modalidade_deter_bc_icms_st, icms_reducao_bc_st, perc_mva_icms_st, aliquota_icms_st, cst_ipi, calculo_ipi, cst_pis, calculo_pis, cst_cofins, calculo_cofins, aliquota_fcp, aliquota_fcp_st, perc_dif)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

#### B.2 - Novo Fornecedor
```sql
INSERT INTO fornecedores (codigo, razao_social, fantasia, cep) 
VALUES (nextval('fornecedores_codigo_seq'), upper(?), upper(?), '83005410')
```

#### B.3 - Grade de Produto
```sql
INSERT INTO produtos_gd (codigo, codigo_gtin, nome, caracteristica, variacao, codigo_interno)
VALUES (?, ?, ?, ?, ?, ?)
```

### **C. ATUALIZAÇÕES (UPDATE)**

#### C.1 - Produto Existente
```sql
-- 1. Tabela produtos
UPDATE produtos SET descricao = upper(?), status = ? WHERE codigo_interno = ?

-- 2. Tabela produtos_ib
UPDATE produtos_ib SET descricao_detalhada = upper(?), grupo = ?, subgrupo = ?, categoria = ?, unidade = ?, preco_venda = ?, preco_compra = ?, perc_lucro = ?, codigo_ncm = ?, produto_balanca = ?, validade = ?, cfop = ?, cest = ? WHERE codigo_interno = ?

-- 3. Tabela produtos_ou  
UPDATE produtos_ou SET perc_desc_a = ?, perc_desc_b = ?, perc_desc_c = ?, perc_desc_d = ?, perc_desc_e = ?, val_desc_a = ?, val_desc_b = ?, val_desc_c = ?, val_desc_d = ?, val_desc_e = ?, qtde = ?, qtde_min = ?, inativo = ?, codfor = ?, tamanho = ?, vencimento = ?, descricao_personalizada = ?, dt_ultima_alteracao = current_date, preco_gelado = ?, desc_etiqueta = ?, producao = ?, comprimento = ?, largura = ?, altura = ?, peso = ? WHERE codigo_interno = ?

-- 4. Tabela produtos_tb
UPDATE produtos_tb SET ipi_reducao_bc = ?, aliquota_ipi = ?, ipi_reducao_bc_st = ?, aliquota_ipi_st = ?, pis_reducao_bc = ?, aliquita_pis = ?, pis_reducao_bc_st = ?, aliquota_pis_st = ?, cofins_reducao_bc = ?, aliquota_cofins = ?, cofins_reducao_bc_st = ?, aliquota_cofins_st = ?, situacao_tributaria = ?, origem = ?, aliquota_calculo_credito = ?, modalidade_deter_bc_icms = ?, aliquota_icms = ?, icms_reducao_bc = ?, modalidade_deter_bc_icms_st = ?, icms_reducao_bc_st = ?, perc_mva_icms_st = ?, aliquota_icms_st = ?, cst_ipi = ?, calculo_ipi = ?, cst_pis = ?, calculo_pis = ?, cst_cofins = ?, calculo_cofins = ?, aliquota_fcp = ?, aliquota_fcp_st = ?, perc_dif = ? WHERE codigo_interno = ?
```

## ⚠️ PROBLEMAS IDENTIFICADOS

### 1. **Erro no Schema produtos_tb**
- Campo **aliquita_pis** (ERRO) → deveria ser **aliquota_pis**
- Inconsistência entre schema e query UPDATE

### 2. **Campos Opcionais com NULL**
- fornecedor: Usar 'NULL' string ou NULL real
- dimensões (comprimento, largura, altura, peso): Tratamento especial

### 3. **Validações Necessárias**
- codigo_gtin único antes de inserir
- vencimento mínimo "2099-01-01" se inválido
- conversão vírgula → ponto para números decimais

## 📋 PRÓXIMOS PASSOS (FASE 2.2)

### APIs a Implementar:
1. **GET /api/produtos/combos** - Carregamento de categorias/grupos/fornecedores
2. **GET /api/produtos/[id]** - Buscar produto específico  
3. **POST /api/produtos** - Criar novo produto
4. **PUT /api/produtos/[id]** - Atualizar produto existente
5. **GET /api/produtos** - Listagem com filtros e paginação
6. **POST /api/fornecedores** - Criar novo fornecedor
7. **GET /api/produtos/[id]/grade** - Buscar grade do produto
8. **POST /api/produtos/[id]/grade** - Salvar grade do produto

### Validações de Campo:
- Sanitização de strings (upper case automático)
- Conversão numérica (vírgula → ponto)
- Validação de códigos únicos
- Tratamento de campos NULL/opcionais

---
**✅ FASE 2.1 COMPLETA** - Mapeamento detalhado concluído.
