import React, { useState, useEffect } from 'react';

interface GrupoSelectProps {
  value?: string;
  onChange: (grupo: string) => void;
  disabled?: boolean;
}

export default function GrupoSelect({ value, onChange, disabled = false }: GrupoSelectProps) {
  const [grupos, setGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const carregarGrupos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🏷️ [SELECT] Carregando grupos...');
      
      const response = await fetch('/api/categorias?tipo=grupo');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar grupos');
      }

      if (data.success) {
        const unique = Array.from(new Set((data.data as string[]).map(s => (s || '').trim()).filter(Boolean)));
        setGrupos(unique);
        console.log('✅ [SELECT] Grupos carregados:', data.data.length);
      } else {
        throw new Error(data.error || 'Erro ao carregar grupos');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ [SELECT] Erro ao carregar grupos:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarGrupos();
  }, []); // Empty dependency array - carrega apenas uma vez

  // Se valor externo chegar e não existir na lista, injeta localmente
  useEffect(() => {
    if (value && value.trim() && !grupos.includes(value)) {
      const v = value.trim();
      setGrupos(prev => Array.from(new Set([v, ...prev])));
    }
  }, [value, grupos]);

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
        aria-label="Selecionar grupo"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
      >
        <option value="">
          {loading ? 'Carregando...' : 'Selecione um grupo'}
        </option>
        {grupos.map((grupo) => (
          <option key={grupo} value={grupo}>
            {grupo}
          </option>
        ))}
      </select>
      
      <button
        type="button"
        className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="Adicionar novo grupo"
        disabled={loading}
        onClick={()=>{ setNewName(''); setShowAdd(true); }}
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
          <div className="text-sm font-medium text-gray-900 mb-2">Adicionar grupo (local)</div>
          <input
            type="text"
            value={newName}
            onChange={(e)=>setNewName(e.target.value)}
            placeholder="Nome do grupo"
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
                if (!grupos.includes(name)) setGrupos(prev => [name, ...prev]);
                onChange(name);
                setShowAdd(false);
              }}
            >Adicionar</button>
          </div>
          <div className="text-[11px] text-gray-500 mt-2">Esta ação apenas adiciona ao formulário. O grupo será gravado no banco ao salvar o produto.</div>
        </div>
      )}
    </div>
  );
}
