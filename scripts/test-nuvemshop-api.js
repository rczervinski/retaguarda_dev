#!/usr/bin/env node

/**
 * Script de teste para validar as APIs de exportação da NuvemShop
 * 
 * Execute com: node scripts/test-nuvemshop-api.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  console.log(`\n🔍 Testando: ${options.method || 'GET'} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    });

    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error(`❌ Erro:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Iniciando testes das APIs de exportação NuvemShop\n');
  
  // 1. Testar listagem de produtos
  console.log('='.repeat(50));
  console.log('TEST 1: Listagem de produtos');
  console.log('='.repeat(50));
  
  const listResult = await makeRequest('/api/nuvemshop/products/list?limit=5');
  
  if (listResult.success && listResult.data?.data?.products?.length > 0) {
    const firstProduct = listResult.data.data.products[0];
    console.log(`🎯 Primeiro produto encontrado: ${firstProduct.codigo_interno} - ${firstProduct.descricao}`);
    
    // 2. Testar exportação individual
    console.log('\n' + '='.repeat(50));
    console.log('TEST 2: Exportação individual de produto');
    console.log('='.repeat(50));
    
    const exportResult = await makeRequest('/api/nuvemshop/products/export', {
      method: 'POST',
      body: JSON.stringify({
        codigo_interno: firstProduct.codigo_interno
      })
    });
    
    console.log(`📦 Resultado da exportação:`, exportResult.success ? '✅ Sucesso' : '❌ Falhou');
    
    // 3. Testar adição à fila
    console.log('\n' + '='.repeat(50));
    console.log('TEST 3: Adicionar produto à fila');
    console.log('='.repeat(50));
    
    const queueResult = await makeRequest('/api/nuvemshop/products/queue', {
      method: 'POST',
      body: JSON.stringify({
        produtos: [firstProduct.codigo_interno],
        prioridade: 1
      })
    });
    
    console.log(`🗂️ Resultado da fila:`, queueResult.success ? '✅ Sucesso' : '❌ Falhou');
    
    // 4. Testar estatísticas da fila
    console.log('\n' + '='.repeat(50));
    console.log('TEST 4: Estatísticas da fila');
    console.log('='.repeat(50));
    
    const statsResult = await makeRequest('/api/nuvemshop/products/queue/process');
    console.log(`📊 Estatísticas da fila:`, statsResult.success ? '✅ Sucesso' : '❌ Falhou');
    
    // 5. Testar processamento da fila
    console.log('\n' + '='.repeat(50));
    console.log('TEST 5: Processar fila');
    console.log('='.repeat(50));
    
    const processResult = await makeRequest('/api/nuvemshop/products/queue/process', {
      method: 'POST',
      body: JSON.stringify({
        batch_size: 2
      })
    });
    
    console.log(`⚙️ Processamento da fila:`, processResult.success ? '✅ Sucesso' : '❌ Falhou');
    
  } else {
    console.log('❌ Não foi possível encontrar produtos para testar');
  }
  
  // 6. Testar listagem da fila
  console.log('\n' + '='.repeat(50));
  console.log('TEST 6: Listar fila de exportação');
  console.log('='.repeat(50));
  
  const queueListResult = await makeRequest('/api/nuvemshop/products/queue?limit=5');
  console.log(`📋 Listagem da fila:`, queueListResult.success ? '✅ Sucesso' : '❌ Falhou');
  
  console.log('\n🏁 Testes concluídos!');
  
  // Resumo
  console.log('\n' + '='.repeat(50));
  console.log('RESUMO DOS TESTES');
  console.log('='.repeat(50));
  
  console.log('✅ APIs testadas:');
  console.log('  - GET  /api/nuvemshop/products/list');
  console.log('  - POST /api/nuvemshop/products/export');
  console.log('  - POST /api/nuvemshop/products/queue');
  console.log('  - GET  /api/nuvemshop/products/queue');
  console.log('  - GET  /api/nuvemshop/products/queue/process');
  console.log('  - POST /api/nuvemshop/products/queue/process');
  
  console.log('\n📱 Interface disponível em:');
  console.log(`  ${BASE_URL}/nuvemshop/export`);
  
  console.log('\n📚 Documentação das APIs:');
  console.log('  - Listar produtos: GET /api/nuvemshop/products/list?search=&status=&limit=20&offset=0');
  console.log('  - Exportar produto: POST /api/nuvemshop/products/export { codigo_interno }');
  console.log('  - Adicionar à fila: POST /api/nuvemshop/products/queue { produtos[], prioridade }');
  console.log('  - Processar fila: POST /api/nuvemshop/products/queue/process { batch_size }');
  console.log('  - Limpar fila: DELETE /api/nuvemshop/products/queue?status=success|error|all');
}

// Executar testes
runTests().catch(console.error);
