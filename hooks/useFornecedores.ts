import { useState, useEffect } from 'react';

interface Fornecedor {
  codigo: number;
  fantasia: string;
}

interface UseFornecedoresResult {
  fornecedores: Fornecedor[];
  loading: boolean;
  error: string | null;
  recarregarFornecedores: () => Promise<void>;
  criarFornecedor: (dadosFornecedor: any) => Promise<Fornecedor | null>;
}

export function useFornecedores(): UseFornecedoresResult {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarFornecedores = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🏭 [HOOK] Carregando fornecedores...');
      
      const response = await fetch('/api/fornecedores');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar fornecedores');
      }

      if (data.success) {
        setFornecedores(data.data);
        console.log('✅ [HOOK] Fornecedores carregados:', data.data.length);
      } else {
        throw new Error(data.error || 'Erro ao carregar fornecedores');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [HOOK] Erro ao carregar fornecedores:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const criarFornecedor = async (dadosFornecedor: any): Promise<Fornecedor | null> => {
    setLoading(true);
    setError(null);

    try {
      console.log('🏭 [HOOK] Criando fornecedor...');
      
      const response = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dadosFornecedor),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar fornecedor');
      }

      if (data.success) {
        console.log('✅ [HOOK] Fornecedor criado:', data.data.fantasia);
        // Recarregar lista
        await carregarFornecedores();
        return data.data;
      } else {
        throw new Error(data.error || 'Erro ao criar fornecedor');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [HOOK] Erro ao criar fornecedor:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, []);

  return {
    fornecedores,
    loading,
    error,
    recarregarFornecedores: carregarFornecedores,
    criarFornecedor
  };
}
