import { useState } from 'react';

interface ProdutoData {
  codigo_interno: number;
  codigo_gtin: string;
  descricao: string;
}

interface UseProdutoGtinResult {
  buscarProduto: (gtin: string) => Promise<ProdutoData | null>;
  loading: boolean;
  error: string | null;
}

export function useProdutoGtin(): UseProdutoGtinResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarProduto = async (gtin: string): Promise<ProdutoData | null> => {
    if (!gtin || gtin.trim() === '') {
      setError('GTIN é obrigatório');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [HOOK] Buscando produto com GTIN:', gtin);
      
      const response = await fetch(`/api/produtos/buscar-por-gtin?gtin=${encodeURIComponent(gtin)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar produto');
      }

      if (!data.success) {
        setError(data.error || 'Produto não encontrado');
        return null;
      }

      console.log('✅ [HOOK] Produto encontrado:', data.data.descricao);
      return data.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [HOOK] Erro ao buscar produto:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarProduto, loading, error };
}
