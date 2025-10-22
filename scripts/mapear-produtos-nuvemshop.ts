#!/usr/bin/env npx tsx

import { query } from '../lib/database';
import { getActiveNuvemshopCredentials } from '../lib/nuvemshop-api';

interface NuvemshopProduct {
  id: number;
  name: { pt: string };
  description: { pt: string };
  handle: { pt: string };
  published: boolean;
  free_shipping: boolean;
  requires_shipping: boolean;
  canonical_url: string;
  video_url: string | null;
  seo_title: { pt: string };
  seo_description: { pt: string };
  brand: string | null;
  created_at: string;
  updated_at: string;
  variants: Array<{
    id: number;
    image_id: number | null;
    product_id: number;
    position: number;
    price: string;
    compare_at_price: string | null;
    promotional_price: string | null;
    stock_management: boolean;
    stock: number;
    weight: string;
    width: string;
    height: string;
    depth: string;
    sku: string;
    values: Array<{ pt: string }>;
    barcode: string | null;
    mpn: string | null;
    age_group: string | null;
    gender: string | null;
    size_system: string | null;
    size_type: string | null;
    mobile_size_type: string | null;
    created_at: string;
    updated_at: string;
  }>;
  tags: string;
  images: Array<{
    id: number;
    product_id: number;
    src: string;
    position: number;
    alt: Array<{ pt: string }>;
    created_at: string;
    updated_at: string;
  }>;
  categories: Array<{
    id: number;
    name: { pt: string };
    description: { pt: string };
    handle: { pt: string };
    parent: number | null;
    subcategories: any[];
    google_shopping_category: string | null;
    created_at: string;
    updated_at: string;
  }>;
  attributes: Array<{
    pt: string;
  }>;
}

async function fetchAllRemoteProducts(): Promise<NuvemshopProduct[]> {
  console.log('🔍 Buscando credenciais da Nuvemshop...');
  const creds = await getActiveNuvemshopCredentials();
  
  const headers: Record<string,string> = {
    'Authentication': `bearer ${creds.accessToken}`,
    'User-Agent': creds.userAgent,
    'Accept': 'application/json'
  };
  
  const base = `https://api.tiendanube.com/v1/${creds.storeId}`;
  const out: NuvemshopProduct[] = [];
  let page = 1;
  const limit = 50;
  
  console.log('📦 Iniciando busca de produtos na Nuvemshop...');
  
  for (;;) {
    const url = `${base}/products?page=${page}&per_page=${limit}`;
    console.log(`   Página ${page}...`);
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Falha ao listar produtos página ${page}: ${res.status} ${res.statusText}`);
    }
    
    const arr = await res.json().catch(()=>[]);
    if (!Array.isArray(arr) || !arr.length) break;
    
    out.push(...arr);
    console.log(`   ✓ ${arr.length} produtos encontrados na página ${page}`);
    
    if (arr.length < limit) break; // última página
    page++;
    
    if (page > 100) { // safety para não travar em loop infinito
      console.warn('⚠️  Limite de páginas atingido (100), parando...');
      break;
    }
  }
  
  console.log(`✅ Total de produtos encontrados: ${out.length}`);
  return out;
}

async function ensureProdutosNuvemshopTable() {
  console.log('🔧 Garantindo que a tabela produtos_nuvemshop existe...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS produtos_nuvemshop (
      codigo_interno BIGINT PRIMARY KEY REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
      tipo VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
      parent_codigo_interno BIGINT REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
      sku VARCHAR(60),
      barcode VARCHAR(60),
      product_id BIGINT,
      variant_id BIGINT,
      last_status VARCHAR(10),
      last_sync_at TIMESTAMPTZ,
      last_error TEXT,
      sync_attempts INT DEFAULT 0,
      payload_snapshot JSONB,
      needs_update BOOLEAN DEFAULT FALSE,
      estoque_enviado INT,
      preco_enviado NUMERIC(14,2),
      categoria VARCHAR(100),
      grupo VARCHAR(100),
      subgrupo VARCHAR(100),
      nome VARCHAR(250),
      altura NUMERIC(14,2),
      largura NUMERIC(14,2),
      comprimento NUMERIC(14,2),
      peso NUMERIC(14,2),
      published BOOLEAN DEFAULT TRUE,
      published_pending BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `, []);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_sku ON produtos_nuvemshop(sku);
    CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_parent ON produtos_nuvemshop(parent_codigo_interno);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_nuvemshop_product_variant ON produtos_nuvemshop(product_id, variant_id) WHERE variant_id IS NOT NULL;
  `, []);
  
  console.log('✅ Tabela produtos_nuvemshop garantida');
}

function determinarTipoProduto(product: NuvemshopProduct): { tipo: 'NORMAL' | 'PARENT' | 'VARIANT'; isParent: boolean } {
  // Se tem mais de 1 variante, é produto pai
  if (product.variants && product.variants.length > 1) {
    return { tipo: 'PARENT', isParent: true };
  }
  
  // Se tem apenas 1 variante, verificar se SKU e barcode são diferentes
  if (product.variants && product.variants.length === 1) {
    const variant = product.variants[0];
    const sku = variant.sku || '';
    const barcode = variant.barcode || '';
    
    // Se SKU e barcode são iguais (ou ambos vazios), é produto normal
    if (sku === barcode || (!sku && !barcode)) {
      return { tipo: 'NORMAL', isParent: false };
    }
    
    // Se são diferentes, pode ser um produto pai com apenas uma variante
    // Vamos considerar como NORMAL por enquanto, mas isso pode precisar de ajuste
    return { tipo: 'NORMAL', isParent: false };
  }
  
  // Fallback para produto normal
  return { tipo: 'NORMAL', isParent: false };
}

async function buscarProdutoLocalPorSku(sku: string): Promise<{ codigo_interno: number; codigo_gtin: string | null } | null> {
  if (!sku) return null;
  
  // Primeiro tenta encontrar por código GTIN (barcode)
  const resultGtin = await query(
    `SELECT codigo_interno, codigo_gtin FROM produtos WHERE codigo_gtin = $1 LIMIT 1`,
    [sku]
  );
  
  if (resultGtin.rows.length > 0) {
    return {
      codigo_interno: Number(resultGtin.rows[0].codigo_interno),
      codigo_gtin: resultGtin.rows[0].codigo_gtin
    };
  }
  
  // Se não encontrou por GTIN, não vamos procurar por outros campos 
  // para manter a lógica específica do código de barras
  return null;
}

async function buscarProdutoLocalPorBarcode(barcode: string): Promise<{ codigo_interno: number; codigo_gtin: string | null } | null> {
  if (!barcode) return null;
  
  const result = await query(
    `SELECT codigo_interno, codigo_gtin FROM produtos WHERE codigo_gtin = $1 LIMIT 1`,
    [barcode]
  );
  
  if (result.rows.length > 0) {
    return {
      codigo_interno: Number(result.rows[0].codigo_interno),
      codigo_gtin: result.rows[0].codigo_gtin
    };
  }
  
  return null;
}

async function atualizarTipoNsProduto(codigo_interno: number, tipo: string) {
  let nsTipo = '';
  
  switch (tipo) {
    case 'PARENT':
      nsTipo = 'ENSP';
      break;
    case 'VARIANT':
      nsTipo = 'ENSV';
      break;
    case 'NORMAL':
      nsTipo = 'ENS';
      break;
    default:
      nsTipo = 'ENS';
  }
  
  await query(
    `UPDATE produtos SET ns = $1 WHERE codigo_interno = $2`,
    [nsTipo, codigo_interno]
  );
}

async function processarProdutoNuvemshop(product: NuvemshopProduct) {
  const { tipo, isParent } = determinarTipoProduto(product);
  
  console.log(`   📦 Produto: ${product.name.pt} (ID: ${product.id}) - Tipo: ${tipo}`);
  
  if (isParent) {
    // Produto pai - vamos processar apenas a primeira variante para o mapeamento principal
    // As outras variantes serão processadas separadamente
    const firstVariant = product.variants[0];
    if (!firstVariant) return;
    
    const produtoLocal = await buscarProdutoLocalPorSku(firstVariant.sku);
    if (!produtoLocal) {
      console.log(`   ⚠️  SKU ${firstVariant.sku} não encontrado localmente (produto pai)`);
      return;
    }
    
    // Inserir/atualizar produto pai
    await query(`
      INSERT INTO produtos_nuvemshop (
        codigo_interno, tipo, sku, barcode, product_id, variant_id,
        nome, categoria, peso, altura, largura, comprimento, 
        preco_enviado, estoque_enviado, published,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
      ) ON CONFLICT (codigo_interno) DO UPDATE SET
        tipo = EXCLUDED.tipo,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        product_id = EXCLUDED.product_id,
        variant_id = EXCLUDED.variant_id,
        nome = EXCLUDED.nome,
        categoria = EXCLUDED.categoria,
        peso = EXCLUDED.peso,
        altura = EXCLUDED.altura,
        largura = EXCLUDED.largura,
        comprimento = EXCLUDED.comprimento,
        preco_enviado = EXCLUDED.preco_enviado,
        estoque_enviado = EXCLUDED.estoque_enviado,
        published = EXCLUDED.published,
        updated_at = NOW()
    `, [
      produtoLocal.codigo_interno,
      'PARENT',
      firstVariant.sku || null,
      firstVariant.barcode || null,
      product.id,
      firstVariant.id,
      product.name.pt || null,
      product.categories?.[0]?.name?.pt || null,
      firstVariant.weight ? parseFloat(firstVariant.weight) : null,
      firstVariant.height ? parseFloat(firstVariant.height) : null,
      firstVariant.width ? parseFloat(firstVariant.width) : null,
      firstVariant.depth ? parseFloat(firstVariant.depth) : null,
      firstVariant.price ? parseFloat(firstVariant.price) : null,
      firstVariant.stock || null,
      product.published
    ]);
    
    // Atualizar tipo 'ns' na tabela produtos
    await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'PARENT');
    
    console.log(`   ✅ Produto pai mapeado: ${produtoLocal.codigo_interno} -> ${product.id}`);
    
    // Processar variantes (pulando a primeira que já foi processada)
    for (let i = 1; i < product.variants.length; i++) {
      const variant = product.variants[i];
      await processarVariante(variant, product, produtoLocal.codigo_interno);
    }
    
  } else {
    // Produto normal ou variante única
    const variant = product.variants[0];
    if (!variant) return;
    
    let produtoLocal = null;
    
    // Para produtos normais, SKU e barcode devem ser iguais
    if (variant.sku) {
      produtoLocal = await buscarProdutoLocalPorSku(variant.sku);
    }
    
    if (!produtoLocal && variant.barcode) {
      produtoLocal = await buscarProdutoLocalPorBarcode(variant.barcode);
    }
    
    if (!produtoLocal) {
      console.log(`   ⚠️  Produto não encontrado localmente: SKU=${variant.sku}, Barcode=${variant.barcode}`);
      return;
    }
    
    // Inserir/atualizar produto normal
    await query(`
      INSERT INTO produtos_nuvemshop (
        codigo_interno, tipo, sku, barcode, product_id, variant_id,
        nome, categoria, peso, altura, largura, comprimento, 
        preco_enviado, estoque_enviado, published,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
      ) ON CONFLICT (codigo_interno) DO UPDATE SET
        tipo = EXCLUDED.tipo,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        product_id = EXCLUDED.product_id,
        variant_id = EXCLUDED.variant_id,
        nome = EXCLUDED.nome,
        categoria = EXCLUDED.categoria,
        peso = EXCLUDED.peso,
        altura = EXCLUDED.altura,
        largura = EXCLUDED.largura,
        comprimento = EXCLUDED.comprimento,
        preco_enviado = EXCLUDED.preco_enviado,
        estoque_enviado = EXCLUDED.estoque_enviado,
        published = EXCLUDED.published,
        updated_at = NOW()
    `, [
      produtoLocal.codigo_interno,
      'NORMAL',
      variant.sku || null,
      variant.barcode || null,
      product.id,
      variant.id,
      product.name.pt || null,
      product.categories?.[0]?.name?.pt || null,
      variant.weight ? parseFloat(variant.weight) : null,
      variant.height ? parseFloat(variant.height) : null,
      variant.width ? parseFloat(variant.width) : null,
      variant.depth ? parseFloat(variant.depth) : null,
      variant.price ? parseFloat(variant.price) : null,
      variant.stock || null,
      product.published
    ]);
    
    // Atualizar tipo 'ns' na tabela produtos
    await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'NORMAL');
    
    console.log(`   ✅ Produto normal mapeado: ${produtoLocal.codigo_interno} -> ${product.id}`);
  }
}

async function processarVariante(variant: any, product: NuvemshopProduct, parentCodigoInterno: number) {
  if (!variant.barcode) {
    console.log(`   ⚠️  Variante sem barcode: ${variant.sku}`);
    return;
  }
  
  const produtoLocal = await buscarProdutoLocalPorBarcode(variant.barcode);
  if (!produtoLocal) {
    console.log(`   ⚠️  Variante não encontrada localmente: Barcode=${variant.barcode}`);
    return;
  }
  
  // Inserir/atualizar variante
  await query(`
    INSERT INTO produtos_nuvemshop (
      codigo_interno, tipo, parent_codigo_interno, sku, barcode, product_id, variant_id,
      nome, categoria, peso, altura, largura, comprimento, 
      preco_enviado, estoque_enviado, published,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    ) ON CONFLICT (codigo_interno) DO UPDATE SET
      tipo = EXCLUDED.tipo,
      parent_codigo_interno = EXCLUDED.parent_codigo_interno,
      sku = EXCLUDED.sku,
      barcode = EXCLUDED.barcode,
      product_id = EXCLUDED.product_id,
      variant_id = EXCLUDED.variant_id,
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      peso = EXCLUDED.peso,
      altura = EXCLUDED.altura,
      largura = EXCLUDED.largura,
      comprimento = EXCLUDED.comprimento,
      preco_enviado = EXCLUDED.preco_enviado,
      estoque_enviado = EXCLUDED.estoque_enviado,
      published = EXCLUDED.published,
      updated_at = NOW()
  `, [
    produtoLocal.codigo_interno,
    'VARIANT',
    parentCodigoInterno,
    variant.sku || null,
    variant.barcode || null,
    product.id,
    variant.id,
    product.name.pt || null,
    product.categories?.[0]?.name?.pt || null,
    variant.weight ? parseFloat(variant.weight) : null,
    variant.height ? parseFloat(variant.height) : null,
    variant.width ? parseFloat(variant.width) : null,
    variant.depth ? parseFloat(variant.depth) : null,
    variant.price ? parseFloat(variant.price) : null,
    variant.stock || null,
    product.published
  ]);
  
  // Atualizar tipo 'ns' na tabela produtos
  await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'VARIANT');
  
  console.log(`   ✅ Variante mapeada: ${produtoLocal.codigo_interno} -> ${product.id}/${variant.id}`);
}

async function main() {
  try {
    console.log('🚀 Iniciando mapeamento de produtos Nuvemshop');
    console.log('=' .repeat(50));
    
    // 1. Garantir que a tabela existe
    await ensureProdutosNuvemshopTable();
    
    // 2. Buscar todos os produtos da Nuvemshop
    const produtos = await fetchAllRemoteProducts();
    
    if (produtos.length === 0) {
      console.log('⚠️  Nenhum produto encontrado na Nuvemshop');
      return;
    }
    
    console.log(`\n📊 Processando ${produtos.length} produtos...`);
    console.log('-' .repeat(50));
    
    let processados = 0;
    let mapeados = 0;
    let erros = 0;
    
    // 3. Processar cada produto
    for (const product of produtos) {
      try {
        const quantidadeAntes = await query(
          `SELECT COUNT(*) as count FROM produtos_nuvemshop WHERE product_id = $1`,
          [product.id]
        );
        const existiaAntes = Number(quantidadeAntes.rows[0].count) > 0;
        
        await processarProdutoNuvemshop(product);
        
        const quantidadeDepois = await query(
          `SELECT COUNT(*) as count FROM produtos_nuvemshop WHERE product_id = $1`,
          [product.id]
        );
        const existeDepois = Number(quantidadeDepois.rows[0].count) > 0;
        
        if (!existiaAntes && existeDepois) {
          mapeados++;
        }
        
        processados++;
        
        if (processados % 10 === 0) {
          console.log(`   📈 Progresso: ${processados}/${produtos.length} produtos processados`);
        }
        
      } catch (error) {
        console.error(`   ❌ Erro ao processar produto ${product.id}: ${error}`);
        erros++;
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📋 RESUMO DO MAPEAMENTO');
    console.log('=' .repeat(50));
    console.log(`✅ Produtos processados: ${processados}`);
    console.log(`🆕 Novos mapeamentos: ${mapeados}`);
    console.log(`❌ Erros: ${erros}`);
    
    // 4. Estatísticas finais
    const stats = await query(`
      SELECT 
        tipo,
        COUNT(*) as quantidade
      FROM produtos_nuvemshop 
      GROUP BY tipo
      ORDER BY tipo
    `, []);
    
    console.log('\n📊 DISTRIBUIÇÃO POR TIPO:');
    console.log('-' .repeat(30));
    for (const stat of stats.rows) {
      const label = stat.tipo === 'PARENT' ? 'Produtos Pai' :
                   stat.tipo === 'VARIANT' ? 'Variantes' : 'Produtos Normais';
      console.log(`   ${label}: ${stat.quantidade}`);
    }
    
    // 5. Verificar produtos não mapeados
    const naoMapeados = await query(`
      SELECT p.codigo_interno, p.descricao, p.codigo_gtin, p.ns
      FROM produtos p
      LEFT JOIN produtos_nuvemshop pn ON p.codigo_interno = pn.codigo_interno
      WHERE pn.codigo_interno IS NULL
        AND p.ns IS NULL
      LIMIT 10
    `, []);
    
    if (naoMapeados.rows.length > 0) {
      console.log('\n⚠️  PRODUTOS LOCAIS NÃO MAPEADOS (primeiros 10):');
      console.log('-' .repeat(50));
      for (const produto of naoMapeados.rows) {
        console.log(`   ${produto.codigo_interno} - ${produto.descricao} (GTIN: ${produto.codigo_gtin})`);
      }
    }
    
    console.log('\n🎉 Mapeamento concluído com sucesso!');
    
  } catch (error) {
    console.error('💥 Erro durante o mapeamento:', error);
    process.exit(1);
  }
}

// Executar script se chamado diretamente
if (require.main === module) {
  main().then(() => {
    console.log('\n👋 Até mais!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { main as mapearProdutosNuvemshop };