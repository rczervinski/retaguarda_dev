'use client';

import React, { useState, useEffect } from 'react';

interface Product {
  codigo_interno: string;
  descricao: string;
  descricao_detalhada?: string;
  preco_venda: number;
  quantidade: number;
  codigo_gtin?: string;
  status_nuvemshop?: string;
  produto_id_nuvemshop?: string;
  data_ultima_sincronizacao?: string;
  sync_status: string;
  can_export: boolean;
}

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  error: number;
}

const NuvemShopExport: React.FC = () => {
  // Estados para produtos
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados para fila
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    success: 0,
    error: 0
  });
  const [processingQueue, setProcessingQueue] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  
  // Estados para diálogos
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Função para mostrar mensagens
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Carregar produtos
  const loadProducts = async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: ((page - 1) * 20).toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/nuvemshop/products/list?${params}`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data.products);
      } else {
        showMessage(data.error || 'Erro desconhecido', 'error');
      }
    } catch (error) {
      showMessage('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Carregar estatísticas da fila
  const loadQueueStats = async () => {
    try {
      const response = await fetch('/api/nuvemshop/products/queue/process');
      const data = await response.json();

      if (data.success) {
        setQueueStats(data.queue_stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas da fila:', error);
    }
  };

  // Exportar produto individual
  const exportSingleProduct = async (codigoInterno: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/nuvemshop/products/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_interno: codigoInterno })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(data.message, 'success');
        loadProducts();
        loadQueueStats();
      } else {
        showMessage(data.error || 'Erro desconhecido', 'error');
      }
    } catch (error) {
      showMessage('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Adicionar produtos à fila
  const addToQueue = async (productCodes: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/nuvemshop/products/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtos: productCodes, prioridade: 1 })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(`${productCodes.length} produtos adicionados à fila de exportação`, 'success');
        setSelectedProducts(new Set());
        loadQueueStats();
      } else {
        showMessage(data.error || 'Erro desconhecido', 'error');
      }
    } catch (error) {
      showMessage('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Processar fila
  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      const response = await fetch('/api/nuvemshop/products/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: 5 })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(
          `Fila processada: ${data.success_count} produtos exportados com sucesso, ${data.error_count} com erro`,
          'success'
        );
        loadQueueStats();
        loadProducts();
      } else {
        showMessage(data.error || 'Erro desconhecido', 'error');
      }
    } catch (error) {
      showMessage('Erro de conexão', 'error');
    } finally {
      setProcessingQueue(false);
    }
  };

  // Toggle seleção de produto
  const toggleProductSelection = (codigoInterno: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(codigoInterno)) {
      newSelected.delete(codigoInterno);
    } else {
      newSelected.add(codigoInterno);
    }
    setSelectedProducts(newSelected);
  };

  // Toggle seleção de todos
  const toggleAllSelection = () => {
    if (selectedProducts.size === products.length && products.length > 0) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.codigo_interno)));
    }
  };

  // Renderizar badge de status
  const renderStatusBadge = (status: string) => {
    const statusConfig = {
      synced: { label: 'Sincronizado', className: 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs' },
      not_synced: { label: 'Não Sincronizado', className: 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs' },
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs' },
      error: { label: 'Erro', className: 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={config?.className || 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs'}>
        {config?.label || status}
      </span>
    );
  };

  // Efeitos
  useEffect(() => {
    loadProducts();
    loadQueueStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Exportação NuvemShop</h1>
        <p className="text-gray-600">Gerencie a exportação de produtos para a NuvemShop</p>
      </div>

      {/* Mensagens */}
      {message && (
        <div 
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Estatísticas da fila */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-900">{queueStats.total}</div>
          <div className="text-sm text-gray-500">Total na Fila</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
          <div className="text-2xl font-bold text-orange-600">{queueStats.pending}</div>
          <div className="text-sm text-gray-500">Pendente</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
          <div className="text-sm text-gray-500">Processando</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{queueStats.success}</div>
          <div className="text-sm text-gray-500">Sucesso</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
          <div className="text-2xl font-bold text-red-600">{queueStats.error}</div>
          <div className="text-sm text-gray-500">Erro</div>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white p-6 rounded-lg border shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Filtrar produtos por status"
          >
            <option value="">Todos os Status</option>
            <option value="synced">Sincronizados</option>
            <option value="not_synced">Não Sincronizados</option>
            <option value="pending">Pendentes</option>
          </select>
          
          <button
            onClick={() => loadProducts()}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {selectedProducts.size > 0 && (
            <>
              <button
                onClick={() => addToQueue(Array.from(selectedProducts))}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                Adicionar {selectedProducts.size} à Fila
              </button>
              
              <button
                onClick={() => setSelectedProducts(new Set())}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
              >
                Limpar Seleção
              </button>
            </>
          )}
          
          <button
            onClick={processQueue}
            disabled={processingQueue || queueStats.pending === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {processingQueue ? 'Processando...' : `Processar Fila (${queueStats.pending})`}
          </button>
        </div>
      </div>

      {/* Lista de produtos */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            Produtos ({products.length})
            {selectedProducts.size > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {selectedProducts.size} selecionados
              </span>
            )}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Selecionar todos os produtos"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Produto</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Preço</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Estoque</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.codigo_interno} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.codigo_interno)}
                        onChange={() => toggleProductSelection(product.codigo_interno)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Selecionar produto ${product.descricao}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{product.descricao}</div>
                        <div className="text-sm text-gray-500">
                          {product.codigo_interno}
                          {product.codigo_gtin && ` • GTIN: ${product.codigo_gtin}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      R$ {product.preco_venda.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {product.quantidade}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(product.sync_status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {product.can_export ? (
                          <button
                            onClick={() => exportSingleProduct(product.codigo_interno)}
                            disabled={loading}
                            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded transition-colors disabled:opacity-50"
                          >
                            Exportar
                          </button>
                        ) : (
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded">
                            Dados Incompletos
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NuvemShopExport;
