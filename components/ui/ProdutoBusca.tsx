import React, { useState } from 'react';

interface ProdutoBuscaProps {
  onProdutoSelecionado: (produto: { codigo_interno: number; codigo_gtin: string; descricao: string }) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ProdutoBusca({ onProdutoSelecionado, placeholder = "Digite o GTIN", disabled = false }: ProdutoBuscaProps) {
  const [gtin, setGtin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarProduto = async (gtinBusca: string) => {
    if (!gtinBusca || gtinBusca.trim() === '') {
      setError('GTIN é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [BUSCA] Buscando produto com GTIN:', gtinBusca);
      
      const response = await fetch(`/api/produtos/buscar-por-gtin?gtin=${encodeURIComponent(gtinBusca)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar produto');
      }

      if (!data.success) {
        setError(data.error || 'Produto não encontrado');
        return;
      }

      console.log('✅ [BUSCA] Produto encontrado:', data.data.descricao);
      onProdutoSelecionado(data.data);
      setError(null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [BUSCA] Erro ao buscar produto:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = () => {
    if (gtin.trim()) {
      buscarProduto(gtin.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (gtin.trim()) {
        buscarProduto(gtin.trim());
      }
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={gtin}
        onChange={(e) => setGtin(e.target.value)}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        disabled={disabled || loading}
        placeholder={loading ? 'Buscando...' : placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
      />
      
      {error && (
        <div className="text-red-600 text-xs mt-1">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
}
