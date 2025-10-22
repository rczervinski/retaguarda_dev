import { useState } from 'react';

type TipoCategoria = 'categoria' | 'grupo' | 'subgrupo';

interface UseCategoriesResult {
  buscarCategorias: (tipo: TipoCategoria) => Promise<string[]>;
  loading: boolean;
  error: string | null;
}

export function useCategorias(): UseCategoriesResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCategorias = async (tipo: TipoCategoria): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      console.log('📂 [HOOK] Buscando', tipo + 's...');
      
      const response = await fetch(`/api/categorias?tipo=${tipo}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ao buscar ${tipo}s`);
      }

      if (data.success) {
        console.log(`✅ [HOOK] ${tipo}s encontradas:`, data.data.length);
        return data.data;
      } else {
        throw new Error(data.error || `Erro ao buscar ${tipo}s`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error(`❌ [HOOK] Erro ao buscar ${tipo}s:`, errorMessage);
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    buscarCategorias,
    loading,
    error
  };
}
