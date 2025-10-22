import React, { useState, useEffect } from 'react';

interface Fornecedor {
  codigo: number;
  fantasia: string;
}

interface FornecedorSelectProps {
  value?: number | string;
  onChange: (codigo: number | null, nome?: string) => void;
  disabled?: boolean;
}

export default function FornecedorSelect({ value, onChange, disabled = false }: FornecedorSelectProps) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarFornecedores = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🏭 [SELECT] Carregando fornecedores...');
      
      const response = await fetch('/api/fornecedores');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar fornecedores');
      }

      if (data.success) {
        setFornecedores(data.data);
        console.log('✅ [SELECT] Fornecedores carregados:', data.data.length);
      } else {
        throw new Error(data.error || 'Erro ao carregar fornecedores');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [SELECT] Erro ao carregar fornecedores:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, []); // Empty dependency array - carrega apenas uma vez

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === '') {
      onChange(null);
    } else {
      const codigo = parseInt(selectedValue);
      const fornecedor = fornecedores.find(f => f.codigo === codigo);
      
      if (fornecedor) {
        onChange(codigo, fornecedor?.fantasia);
      } else {
        // Em caso de recompilação, ainda passamos o código
        onChange(codigo, 'Fornecedor');
      }
    }
  };

  return (
    <div className="relative">
      <select
        value={value?.toString() || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
      >
        <option value="">
          {loading ? 'Carregando...' : 'Selecione um fornecedor'}
        </option>
        {fornecedores.map((fornecedor) => (
          <option key={fornecedor.codigo} value={fornecedor.codigo}>
            {fornecedor.fantasia}
          </option>
        ))}
      </select>
      
      {error && (
        <div className="text-red-600 text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
