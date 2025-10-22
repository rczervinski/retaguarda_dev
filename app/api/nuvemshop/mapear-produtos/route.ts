import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { getActiveNuvemshopCredentials } from '@/lib/nuvemshop-api';

interface NuvemshopProduct {
  id: number;
  name: { pt: string };
  description: { pt: string };
  handle: { pt: string };
  published: boolean;
  variants: Array<{
    id: number;
    product_id: number;
    price: string;
    stock: number;
    weight: string;
    width: string;
    height: string;
    depth: string;
    sku: string;
    barcode: string | null;
  }>;
  categories: Array<{
    id: number;
    name: { pt: string };
  }>;
}

async function fetchAllRemoteProducts(): Promise<NuvemshopProduct[]> {
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
  
  for (;;) {
    const url = `${base}/products?page=${page}&per_page=${limit}`;
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      throw new Error(`Falha ao listar produtos página ${page}: ${res.status} ${res.statusText}`);
    }
    
    const arr = await res.json().catch(()=>[]);
    if (!Array.isArray(arr) || !arr.length) break;
    
    out.push(...arr);
    
    if (arr.length < limit) break; // última página
    page++;
    
    if (page > 100) break; // safety
  }
  
  return out;
}

async function ensureProdutosNuvemshopTable() {
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
}

function determinarTipoProduto(product: NuvemshopProduct): { tipo: 'NORMAL' | 'PARENT' | 'VARIANT'; isParent: boolean } {
  // Se tem mais de 1 variante, é produto pai
  if (product.variants && product.variants.length > 1) {
    return { tipo: 'PARENT', isParent: true };
  }
  
  // Se tem apenas 1 variante, é produto normal
  return { tipo: 'NORMAL', isParent: false };
}

async function buscarProdutoLocalPorSku(sku: string): Promise<{ codigo_interno: number; codigo_gtin: string | null } | null> {
  if (!sku) return null;
  
  const result = await query(
    `SELECT codigo_interno, codigo_gtin FROM produtos WHERE codigo_gtin = $1 LIMIT 1`,
    [sku]
  );
  
  if (result.rows.length > 0) {
    return {
      codigo_interno: Number(result.rows[0].codigo_interno),
      codigo_gtin: result.rows[0].codigo_gtin
    };
  }
  
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

async function processarProdutoNuvemshop(product: NuvemshopProduct): Promise<{ mapeado: boolean; tipo: string; detalhes: string }> {
  const { tipo, isParent } = determinarTipoProduto(product);
  
  if (isParent) {
    // Produto pai
    const firstVariant = product.variants[0];
    if (!firstVariant) return { mapeado: false, tipo, detalhes: 'Sem variantes' };
    
    const produtoLocal = await buscarProdutoLocalPorSku(firstVariant.sku);
    if (!produtoLocal) {
      return { mapeado: false, tipo, detalhes: `SKU ${firstVariant.sku} não encontrado` };
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
    
    await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'PARENT');
    
    // Processar outras variantes
    let variantesMapeadas = 0;
    for (let i = 1; i < product.variants.length; i++) {
      const variant = product.variants[i];
      const varianteMapeada = await processarVariante(variant, product, produtoLocal.codigo_interno);
      if (varianteMapeada) variantesMapeadas++;
    }
    
    return { 
      mapeado: true, 
      tipo: 'PARENT', 
      detalhes: `Produto pai + ${variantesMapeadas} variantes mapeadas` 
    };
    
  } else {
    // Produto normal
    const variant = product.variants[0];
    if (!variant) return { mapeado: false, tipo, detalhes: 'Sem variantes' };
    
    let produtoLocal = null;
    
    if (variant.sku) {
      produtoLocal = await buscarProdutoLocalPorSku(variant.sku);
    }
    
    if (!produtoLocal && variant.barcode) {
      produtoLocal = await buscarProdutoLocalPorBarcode(variant.barcode);
    }
    
    if (!produtoLocal) {
      return { 
        mapeado: false, 
        tipo, 
        detalhes: `SKU=${variant.sku}, Barcode=${variant.barcode} não encontrados` 
      };
    }
    
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
    
    await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'NORMAL');
    
    return { 
      mapeado: true, 
      tipo: 'NORMAL', 
      detalhes: `Mapeado: ${produtoLocal.codigo_interno} -> ${product.id}` 
    };
  }
}

async function processarVariante(variant: any, product: NuvemshopProduct, parentCodigoInterno: number): Promise<boolean> {
  if (!variant.barcode) return false;
  
  const produtoLocal = await buscarProdutoLocalPorBarcode(variant.barcode);
  if (!produtoLocal) return false;
  
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
  
  await atualizarTipoNsProduto(produtoLocal.codigo_interno, 'VARIANT');
  
  return true;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando mapeamento de produtos Nuvemshop via API');
    
    // 1. Garantir tabela
    await ensureProdutosNuvemshopTable();
    
    // 2. Buscar produtos da Nuvemshop
    const produtos = await fetchAllRemoteProducts();
    
    if (produtos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum produto encontrado na Nuvemshop',
        stats: { total: 0, mapeados: 0, erros: 0 }
      });
    }
    
    // 3. Processar produtos
    let mapeados = 0;
    let erros = 0;
    const resultados = [];
    
    for (const product of produtos) {
      try {
        const resultado = await processarProdutoNuvemshop(product);
        resultados.push({
          product_id: product.id,
          nome: product.name.pt,
          ...resultado
        });
        
        if (resultado.mapeado) {
          mapeados++;
        }
      } catch (error) {
        console.error(`Erro ao processar produto ${product.id}:`, error);
        erros++;
        resultados.push({
          product_id: product.id,
          nome: product.name.pt,
          mapeado: false,
          tipo: 'ERROR',
          detalhes: `Erro: ${error}`
        });
      }
    }
    
    // 4. Estatísticas finais
    const stats = await query(`
      SELECT 
        tipo,
        COUNT(*) as quantidade
      FROM produtos_nuvemshop 
      GROUP BY tipo
      ORDER BY tipo
    `, []);
    
    return NextResponse.json({
      success: true,
      message: `Mapeamento concluído: ${mapeados} produtos mapeados de ${produtos.length} processados`,
      stats: {
        total: produtos.length,
        mapeados,
        erros,
        distribuicao: stats.rows
      },
      resultados: resultados.slice(0, 20) // Primeiros 20 para não sobrecarregar a resposta
    });
    
  } catch (error) {
    console.error('Erro durante o mapeamento:', error);
    return NextResponse.json({
      success: false,
      error: `Erro durante o mapeamento: ${error}`
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Retornar estatísticas do mapeamento atual
    const stats = await query(`
      SELECT 
        tipo,
        COUNT(*) as quantidade
      FROM produtos_nuvemshop 
      GROUP BY tipo
      ORDER BY tipo
    `, []);
    
    const total = await query(`
      SELECT COUNT(*) as total FROM produtos_nuvemshop
    `, []);
    
    const naoMapeados = await query(`
      SELECT COUNT(*) as count
      FROM produtos p
      LEFT JOIN produtos_nuvemshop pn ON p.codigo_interno = pn.codigo_interno
      WHERE pn.codigo_interno IS NULL
    `, []);
    
    return NextResponse.json({
      success: true,
      stats: {
        totalMapeados: Number(total.rows[0].total),
        naoMapeados: Number(naoMapeados.rows[0].count),
        distribuicao: stats.rows
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json({
      success: false,
      error: `Erro ao buscar estatísticas: ${error}`
    }, { status: 500 });
  }
}