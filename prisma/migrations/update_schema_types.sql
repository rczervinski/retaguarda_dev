-- Alterar a tabela produtos para modificar o tipo de codigo_interno
ALTER TABLE produtos ALTER COLUMN codigo_interno TYPE VARCHAR(20);

-- Alterar a tabela produtos_ib
ALTER TABLE produtos_ib ALTER COLUMN codigo_interno TYPE VARCHAR(20);
ALTER TABLE produtos_ib 
  ALTER COLUMN peso_bruto TYPE VARCHAR(20),
  ALTER COLUMN peso_liquido TYPE VARCHAR(20),
  ALTER COLUMN preco_venda TYPE VARCHAR(20),
  ALTER COLUMN preco_compra TYPE VARCHAR(20),
  ALTER COLUMN perc_lucro TYPE VARCHAR(20),
  ALTER COLUMN produto_balanca TYPE VARCHAR(1) USING (produto_balanca::text),
  ALTER COLUMN fator_conversao TYPE VARCHAR(20),
  ALTER COLUMN ex_tipi TYPE VARCHAR(20),
  ALTER COLUMN genero TYPE VARCHAR(20),
  ALTER COLUMN cfop TYPE VARCHAR(10);

-- Alterar a tabela produtos_ou
ALTER TABLE produtos_ou ALTER COLUMN codigo_interno TYPE VARCHAR(20);
ALTER TABLE produtos_ou
  ALTER COLUMN perc_desc_a TYPE VARCHAR(20) USING (COALESCE(perc_desc_a, 0)::text),
  ALTER COLUMN perc_desc_b TYPE VARCHAR(20) USING (COALESCE(perc_desc_b, 0)::text),
  ALTER COLUMN perc_desc_c TYPE VARCHAR(20) USING (COALESCE(perc_desc_c, 0)::text),
  ALTER COLUMN perc_desc_d TYPE VARCHAR(20) USING (COALESCE(perc_desc_d, 0)::text),
  ALTER COLUMN perc_desc_e TYPE VARCHAR(20) USING (COALESCE(perc_desc_e, 0)::text),
  ALTER COLUMN val_desc_a TYPE VARCHAR(20) USING (COALESCE(val_desc_a, 0)::text),
  ALTER COLUMN val_desc_b TYPE VARCHAR(20) USING (COALESCE(val_desc_b, 0)::text),
  ALTER COLUMN val_desc_c TYPE VARCHAR(20) USING (COALESCE(val_desc_c, 0)::text),
  ALTER COLUMN val_desc_d TYPE VARCHAR(20) USING (COALESCE(val_desc_d, 0)::text),
  ALTER COLUMN val_desc_e TYPE VARCHAR(20) USING (COALESCE(val_desc_e, 0)::text),
  ALTER COLUMN qtde TYPE VARCHAR(20) USING (COALESCE(qtde, 0)::text),
  ALTER COLUMN qtde_min TYPE VARCHAR(20) USING (COALESCE(qtde_min, 0)::text),
  ALTER COLUMN inativo TYPE VARCHAR(1) USING (CASE WHEN inativo = 0 THEN '0' ELSE '1' END),
  ALTER COLUMN codfor TYPE VARCHAR(20) USING (COALESCE(codfor, 0)::text),
  ALTER COLUMN qtde_promo TYPE VARCHAR(20) USING (COALESCE(qtde_promo, 0)::text),
  ALTER COLUMN valor_qtde_promo TYPE VARCHAR(20) USING (COALESCE(valor_qtde_promo, 0)::text),
  ALTER COLUMN valor_intervalo_promo TYPE VARCHAR(20) USING (COALESCE(valor_intervalo_promo, 0)::text),
  ALTER COLUMN descricao_personalizada TYPE VARCHAR(1) USING (CASE WHEN descricao_personalizada = 0 THEN '0' ELSE '1' END),
  ALTER COLUMN preco_gelado TYPE VARCHAR(20) USING (COALESCE(preco_gelado, 0)::text),
  ALTER COLUMN producao TYPE VARCHAR(1) USING (CASE WHEN producao IS NULL THEN NULL WHEN producao = 0 THEN '0' ELSE '1' END);

-- Alterar a tabela produtos_tb
ALTER TABLE produtos_tb ALTER COLUMN codigo_interno TYPE VARCHAR(20);
