import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { searchProductBySKU } from '@/lib/nuvemshop-api';

interface QueueItem {
  id?: number;
  codigo_interno: string;
  operacao: 'create' | 'update';
  status: 'pending' | 'processing' | 'success' | 'error';
  tentativas: number;
  data_criacao: string;
  data_processamento?: string;
  erro_detalhes?: string;
  prioridade: number;
}

// POST - Adicionar produtos à fila de exportação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { produtos, prioridade = 1 } = body;

    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
      return NextResponse.json(
        { error: 'Lista de produtos é obrigatória' },
        { status: 400 }
      );
    }

    // Não vamos usar fila por enquanto - comentado para evitar criar tabelas
    // await createQueueTableIfNotExists();

    const results = [];
    
    for (const codigo_interno of produtos) {
      try {
        // Verificar se o produto existe
        const productCheck = await query(
          'SELECT codigo_interno FROM produtos WHERE codigo_interno = $1',
          [codigo_interno]
        );

        if (productCheck.rows.length === 0) {
          results.push({
            codigo_interno,
            status: 'error',
            message: 'Produto não encontrado'
          });
          continue;
        }

        // Verificar se já existe na fila (não processado)
        const existingQueue = await query(
          `SELECT id FROM nuvemshop_export_queue 
           WHERE codigo_interno = $1 AND status IN ('pending', 'processing')`,
          [codigo_interno]
        );

        if (existingQueue.rows.length > 0) {
          results.push({
            codigo_interno,
            status: 'skipped',
            message: 'Produto já está na fila de processamento'
          });
          continue;
        }

        // Verificar se produto já existe na NuvemShop (API direta) para determinar operação
        let operacao: 'create' | 'update' = 'create';
        try {
          const existing = await searchProductBySKU(String(codigo_interno));
          if (Array.isArray(existing) && existing.length) operacao = 'update';
        } catch (error) {
          console.log('Busca SKU falhou, assumindo create:', (error as Error)?.message);
        }

        // Adicionar à fila
        const insertResult = await query(
          `INSERT INTO nuvemshop_export_queue 
           (codigo_interno, operacao, status, tentativas, data_criacao, prioridade)
           VALUES ($1, $2, 'pending', 0, NOW(), $3)
           RETURNING id`,
          [codigo_interno, operacao, prioridade]
        );

        results.push({
          codigo_interno,
          status: 'added',
          queue_id: insertResult.rows[0].id,
          operacao,
          message: 'Produto adicionado à fila com sucesso'
        });

      } catch (error) {
        results.push({
          codigo_interno,
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processados ${produtos.length} produtos`,
      results
    });

  } catch (error) {
    console.error('Erro ao adicionar produtos à fila:', error);
    
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

// GET - Listar itens da fila
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || '';

    await createQueueTableIfNotExists();

    let whereClause = '';
    let queryParams: any[] = [];
    
    if (status) {
      whereClause = 'WHERE q.status = $1';
      queryParams.push(status);
    }

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM nuvemshop_export_queue q
      ${whereClause}
    `;

    // Query principal com JOIN para buscar dados do produto
    const mainQuery = `
      SELECT 
        q.*,
        p.descricao,
        p.preco_venda,
        p.quantidade
      FROM nuvemshop_export_queue q
      LEFT JOIN produtos p ON q.codigo_interno = p.codigo_interno
      ${whereClause}
      ORDER BY 
        q.prioridade DESC,
        q.data_criacao ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const queueResult = await query(mainQuery, [...queryParams, limit, offset]);

    return NextResponse.json({
      success: true,
      data: {
        queue: queueResult.rows,
        pagination: {
          total,
          limit,
          offset,
          has_more: (offset + limit) < total,
          current_page: Math.floor(offset / limit) + 1,
          total_pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erro ao listar fila de exportação:', error);
    
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

// DELETE - Limpar fila (itens processados com sucesso ou com erro)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'success'; // 'success', 'error', 'all'
    
    await createQueueTableIfNotExists();

    let whereClause = '';
    
    if (status === 'success') {
      whereClause = "WHERE status = 'success'";
    } else if (status === 'error') {
      whereClause = "WHERE status = 'error'";
    } else if (status === 'all') {
      whereClause = "WHERE status IN ('success', 'error')";
    } else {
      return NextResponse.json(
        { error: 'Status inválido. Use: success, error ou all' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM nuvemshop_export_queue ${whereClause}`,
      []
    );

    return NextResponse.json({
      success: true,
      message: `${result.rowCount} itens removidos da fila`
    });

  } catch (error) {
    console.error('Erro ao limpar fila de exportação:', error);
    
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

// Função para criar a tabela de fila se não existir
async function createQueueTableIfNotExists() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS nuvemshop_export_queue (
      id SERIAL PRIMARY KEY,
      codigo_interno BIGINT NOT NULL,
      operacao VARCHAR(10) NOT NULL CHECK (operacao IN ('create', 'update')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error')),
      tentativas INTEGER NOT NULL DEFAULT 0,
      data_criacao TIMESTAMP NOT NULL DEFAULT NOW(),
      data_processamento TIMESTAMP,
      erro_detalhes TEXT,
      prioridade INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (codigo_interno) REFERENCES produtos(codigo_interno) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_nuvemshop_queue_status ON nuvemshop_export_queue(status);
    CREATE INDEX IF NOT EXISTS idx_nuvemshop_queue_codigo ON nuvemshop_export_queue(codigo_interno);
    CREATE INDEX IF NOT EXISTS idx_nuvemshop_queue_prioridade ON nuvemshop_export_queue(prioridade DESC, data_criacao ASC);
  `;

  await query(createTableQuery, []);
}
