import React, { useState, useEffect } from 'react';

interface CategoriaSelectProps {
  value?: string;
  onChange: (categoria: string) => void;
  disabled?: boolean;
}

export default function CategoriaSelectDebug({ value, onChange, disabled = false }: CategoriaSelectProps) {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const carregarCategorias = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      console.log('📁 [SELECT-DEBUG] Iniciando carregamento...');
      console.log('📁 [SELECT-DEBUG] URL:', window.location.origin + '/api/categorias?tipo=categoria');
      
      const response = await fetch('/api/categorias?tipo=categoria');
      
      console.log('📁 [SELECT-DEBUG] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      const data = await response.json();
      
      console.log('📁 [SELECT-DEBUG] Data parsed:', data);
      
      setDebugInfo({
        response: {
          status: response.status,
          ok: response.ok,
          url: response.url
        },
        data: data
      });

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.success) {
        setCategorias(data.data);
        console.log('✅ [SELECT-DEBUG] Categorias definidas:', data.data.length, data.data);
      } else {
        throw new Error(data.error || 'API retornou success=false');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [SELECT-DEBUG] Erro completo:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack'
      });
      setError(errorMessage);
      setDebugInfo((prev: any) => ({ ...prev, error: errorMessage, errorObj: err }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('📁 [SELECT-DEBUG] useEffect executado');
    carregarCategorias();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue);
  };

  return (
    <div>
      <div className="mb-2">
        <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
          Categoria {loading && '(Carregando...)'}
          {error && <span className="text-red-600 text-xs ml-2">ERRO: {error}</span>}
        </label>
        
        <select
          id="categoria"
          value={value || ''}
          onChange={handleChange}
          disabled={disabled || loading}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? 'Carregando...' : error ? 'Erro ao carregar' : 'Selecione uma categoria'}
          </option>
          {categorias.map((categoria, index) => (
            <option key={`${categoria}-${index}`} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
      </div>
      
      {/* Debug Info */}
      {debugInfo && (
        <div className="text-xs bg-gray-100 p-2 rounded mt-2">
          <strong>Debug Info:</strong>
          <pre className="mt-1 whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
