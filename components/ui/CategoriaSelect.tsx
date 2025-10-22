import React, { useState, useEffect } from 'react';

interface CategoriaSelectProps {
  value?: string;
  onChange: (categoria: string) => void;
  disabled?: boolean;
}

export default function CategoriaSelect({ value, onChange, disabled = false }: CategoriaSelectProps) {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const carregarCategorias = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📁 [SELECT] Carregando categorias...');
      
      const response = await fetch('/api/categorias?tipo=categoria');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar categorias');
      }

      if (data.success) {
        const unique = Array.from(new Set((data.data as string[]).map(s => (s || '').trim()).filter(Boolean)));
        setCategorias(unique);
        console.log('✅ [SELECT] Categorias carregadas:', data.data.length);
      } else {
        throw new Error(data.error || 'Erro ao carregar categorias');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [SELECT] Erro ao carregar categorias:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCategorias();
  }, []); // Empty dependency array - carrega apenas uma vez

  // Garante que se o value vier de fora (ex: modal e-commerce) e não estiver na lista carregada, adicionar localmente
  useEffect(() => {
    if (value && value.trim() && !categorias.includes(value)) {
      const v = value.trim();
      setCategorias(prev => Array.from(new Set([v, ...prev])));
    }
  }, [value, categorias]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue);
  };

  return (
    <div className="flex relative">
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        aria-label="Selecionar categoria"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
      >
        <option value="">
          {loading ? 'Carregando...' : 'Selecione uma categoria'}
        </option>
        {categorias.map((categoria) => (
          <option key={categoria} value={categoria}>
            {categoria}
          </option>
        ))}
      </select>
      
      <button
        type="button"
        className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="Adicionar nova categoria"
        disabled={loading}
        onClick={() => { setNewName(''); setShowAdd(true); }}
      >
        ➕
      </button>
      
      {error && (
        <div className="text-red-600 text-sm mt-1">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="text-sm font-medium text-gray-900 mb-2">Adicionar categoria (local)</div>
          <input
            type="text"
            value={newName}
            onChange={(e)=>setNewName(e.target.value)}
            placeholder="Nome da categoria"
            className="w-full mb-2 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm px-3 py-1" onClick={()=>setShowAdd(false)}>Cancelar</button>
            <button
              type="button"
              className="btn-primary text-sm px-3 py-1"
              onClick={()=>{
                const name = newName.trim();
                if (!name) return;
                if (!categorias.includes(name)) setCategorias(prev => [name, ...prev]);
                onChange(name);
                setShowAdd(false);
              }}
            >Adicionar</button>
          </div>
          <div className="text-[11px] text-gray-500 mt-2">Esta ação apenas adiciona ao formulário. A categoria será gravada no banco ao salvar o produto.</div>
        </div>
      )}
    </div>
  );
}
