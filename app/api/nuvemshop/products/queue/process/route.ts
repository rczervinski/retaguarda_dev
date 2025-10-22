import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { searchProductBySKU, createProduct, updateProduct } from '@/lib/nuvemshop-api';
import { prepareNuvemShopProduct } from '@/lib/nuvemshop-product';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

interface QueueItem {
  id: number;
  codigo_interno: string;
  operacao: 'create' | 'update';
  status: string;
  tentativas: number;
  prioridade: number;
}

interface ProductData {
  codigo_interno: string;
  descricao: string;
  descricao_detalhada?: string;
  preco_venda: number;
  quantidade: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  codigo_gtin?: string;
}

// Tipos agora centralizados em lib/nuvemshop-product

// POST - Processar próximos itens da fila
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_size = 5, max_tentativas = 3 } = body;

    // Buscar próximos itens da fila para processar
    const queueItems = await query(
      `UPDATE nuvemshop_export_queue 
       SET status = 'processing', data_processamento = NOW()
       WHERE id IN (
         SELECT id FROM nuvemshop_export_queue 
         WHERE status = 'pending' AND tentativas < $1
         ORDER BY prioridade DESC, data_criacao ASC 
         LIMIT $2
       )
       RETURNING *`,
      [max_tentativas, batch_size]
    );

    if (queueItems.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum item pendente na fila para processar',
        processed: 0,
        results: []
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Processar cada item da fila
    for (const item of queueItems.rows as QueueItem[]) {
      try {
        console.log(`Processando item da fila ID: ${item.id}, Produto: ${item.codigo_interno}`);

        // Buscar dados do produto
        const productResult = await query(
          `SELECT * FROM produtos WHERE codigo_interno = $1`,
          [item.codigo_interno]
        );

        if (productResult.rows.length === 0) {
          await updateQueueItemStatus(item.id, 'error', 'Produto não encontrado no banco');
          results.push({
            queue_id: item.id,
            codigo_interno: item.codigo_interno,
            status: 'error',
            message: 'Produto não encontrado no banco'
          });
          errorCount++;
          continue;
        }

        const productData: ProductData = productResult.rows[0];

        // Exportar produto para NuvemShop
  const exportResult = await exportProductToNuvemShop(productData, item.operacao);

        if (exportResult.success) {
          // Atualizar status do produto na tabela produtos se necessário
          if (exportResult.product_id) {
            await query(
              `UPDATE produtos 
               SET status_nuvemshop = 'sincronizado',
                   produto_id_nuvemshop = $1,
                   data_ultima_sincronizacao = NOW()
               WHERE codigo_interno = $2`,
              [exportResult.product_id.toString(), item.codigo_interno]
            );
          }

          await updateQueueItemStatus(item.id, 'success', null);
          
          results.push({
            queue_id: item.id,
            codigo_interno: item.codigo_interno,
            status: 'success',
            message: exportResult.message || 'Produto exportado com sucesso',
            product_id: exportResult.product_id,
            action: exportResult.action
          });
          successCount++;
        } else {
          await updateQueueItemStatus(item.id, 'error', exportResult.error || 'Erro desconhecido');
          
          results.push({
            queue_id: item.id,
            codigo_interno: item.codigo_interno,
            status: 'error',
            message: exportResult.error || 'Erro desconhecido'
          });
          errorCount++;
        }

      } catch (error) {
        console.error(`Erro ao processar item ${item.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Erro interno';
        await updateQueueItemStatus(item.id, 'error', errorMessage);
        
        results.push({
          queue_id: item.id,
          codigo_interno: item.codigo_interno,
          status: 'error',
          message: errorMessage
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processados ${queueItems.rows.length} itens da fila`,
      processed: queueItems.rows.length,
      success_count: successCount,
      error_count: errorCount,
      results
    });

  } catch (error) {
    console.error('Erro ao processar fila de exportação:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// GET - Status do processamento da fila
export async function GET() {
  try {
    // Estatísticas da fila
    const stats = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM nuvemshop_export_queue 
      GROUP BY status
      UNION ALL
      SELECT 
        'total',
        COUNT(*)
      FROM nuvemshop_export_queue
    `);

    const statsMap = stats.rows.reduce((acc: any, row: any) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      queue_stats: {
        total: statsMap.total || 0,
        pending: statsMap.pending || 0,
        processing: statsMap.processing || 0,
        success: statsMap.success || 0,
        error: statsMap.error || 0
      }
    });

  } catch (error) {
    console.error('Erro ao obter status da fila:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Função para atualizar status de um item da fila
async function updateQueueItemStatus(queueId: number, status: string, errorDetails?: string | null) {
  const updateQuery = `
    UPDATE nuvemshop_export_queue 
    SET status = $1, 
        tentativas = tentativas + 1,
        data_processamento = NOW(),
        erro_detalhes = $2
    WHERE id = $3
  `;
  
  await query(updateQuery, [status, errorDetails, queueId]);
}

// Função para exportar produto usando API direta
async function exportProductToNuvemShop(productData: ProductData, operation: 'create' | 'update') {
  try {
    const nuvemshopProduct = prepareNuvemShopProduct({
      codigo_interno: productData.codigo_interno,
      descricao: productData.descricao,
      descricao_detalhada: productData.descricao_detalhada,
      preco_venda: productData.preco_venda,
      quantidade: productData.quantidade,
      peso: productData.peso,
      comprimento: productData.comprimento,
      largura: productData.largura,
      altura: productData.altura,
      codigo_gtin: productData.codigo_gtin
    });

    let existingProductId: string | number | undefined;
    if (operation === 'update') {
      const existing = await searchProductBySKU(productData.codigo_interno);
      if (Array.isArray(existing) && existing.length) existingProductId = existing[0].id;
      if (!existingProductId) {
        return { success: false, error: 'Produto para atualização não encontrado na NuvemShop' };
      }
    }

    let result: any;
    if (existingProductId) {
      result = await updateProduct(existingProductId, nuvemshopProduct);
      return { success: true, action: 'updated', product_id: existingProductId, message: 'Produto atualizado', data: result };
    } else {
      result = await createProduct(nuvemshopProduct);
      return { success: true, action: 'created', product_id: result?.id, message: 'Produto criado', data: result };
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' };
  }
}

// Removidas funções de proxy legacy
