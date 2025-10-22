import { query } from '@/lib/database'

export async function ensureProdutosEcommerceAttTable() {
  // Auditoria de atualizações de estoque disparadas por vendas (não manuais)
  // UNIQUE por (plataforma, venda_item_codigo, movimento) para idempotência
  await query(`
    CREATE TABLE IF NOT EXISTS produtos_ecommerce_att (
      id BIGSERIAL PRIMARY KEY,
      codigo_interno BIGINT NOT NULL,
      plataforma VARCHAR(30) NOT NULL,
      venda_codigo BIGINT NOT NULL,
      venda_item_codigo BIGINT NOT NULL,
      movimento VARCHAR(10) NOT NULL,
      qty_delta INTEGER NOT NULL,
      occurred_at TIMESTAMP NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ns_tag VARCHAR(10),
      remote_product_id BIGINT,
      remote_variant_id BIGINT,
      sku VARCHAR(100),
      status VARCHAR(16) NOT NULL DEFAULT 'succeeded',
      error TEXT,
      CONSTRAINT uq_prod_ecom_att UNIQUE (plataforma, venda_item_codigo, movimento)
    );
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_prod_ecom_att_prod ON produtos_ecommerce_att (codigo_interno, processed_at DESC);`)
  await query(`CREATE INDEX IF NOT EXISTS idx_prod_ecom_att_occur ON produtos_ecommerce_att (occurred_at);`)
}

// Tabelas para sincronização de pedidos (vendas online)
// - vendas_online: cabeçalho do pedido
// - vendas_online_itens: itens do pedido
// Observações:
// - Nomes em minúsculo conforme instruções
// - Campos essenciais para idempotência e débito de estoque quando pagamento "authorized"
export async function ensureVendasOnlineTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS vendas_online (
      id BIGSERIAL PRIMARY KEY,
      plataforma VARCHAR(30) NOT NULL, -- ex: 'nuvemshop'
      order_id BIGINT NOT NULL,        -- ID do pedido na plataforma
      numero TEXT,                     -- número/identificador exibido ao cliente
      status_pagamento TEXT,           -- payment_status
      status_pedido TEXT,              -- status geral do pedido
      cliente_nome TEXT,
      cliente_email TEXT,
      total NUMERIC(14,2),
      currency VARCHAR(8),
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      processed_at TIMESTAMP,          -- quando debitamos estoque
      CONSTRAINT uq_vendas_online UNIQUE (plataforma, order_id)
    );
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_vendas_online_status ON vendas_online (status_pagamento, processed_at);`)

  // Colunas adicionais para enriquecer dados do pedido
  await query(`ALTER TABLE vendas_online ADD COLUMN IF NOT EXISTS pagamento JSONB;`)
  await query(`ALTER TABLE vendas_online ADD COLUMN IF NOT EXISTS shipping JSONB;`)
  await query(`ALTER TABLE vendas_online ADD COLUMN IF NOT EXISTS cliente_json JSONB;`)

  await query(`
    CREATE TABLE IF NOT EXISTS vendas_online_itens (
      id BIGSERIAL PRIMARY KEY,
      venda_online_id BIGINT NOT NULL REFERENCES vendas_online(id) ON DELETE CASCADE,
      codigo_interno BIGINT,           -- mapeado via local mapping/GTIN
      gtin TEXT,
      sku TEXT,
      produto_nome TEXT,
      quantidade INTEGER NOT NULL,
      preco NUMERIC(14,2),
      variant_id BIGINT,
      product_id BIGINT
    );
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_vendas_online_itens_venda ON vendas_online_itens (venda_online_id);`)
}
