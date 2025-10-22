"use client";
import React, { useEffect, useMemo, useState } from 'react';

interface NSCat {
  id: number;
  parent: number | null;
  name?: { pt?: string };
  children?: NSCat[];
}

interface FlatWithPath extends NSCat {
  pathNames: string[];
  isLeaf: boolean;
  depth: number;
}

export default function CategoriesTable() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [tree, setTree] = useState<NSCat[]>([]);
  const [flat, setFlat] = useState<NSCat[]>([]);
  const [filter, setFilter] = useState('');
  const [showOnlyLeaves, setShowOnlyLeaves] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch('/api/nuvemshop/categories');
        const j = await r.json();
        if (!j.success) throw new Error(j.error || 'Erro ao carregar categorias');
        setTree(j.data.tree || []);
        setFlat(j.data.flat || []);
      } catch (e:any) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Monta paths a partir da árvore (mais robusto para manter ordem hierárquica)
  const flatWithPath: FlatWithPath[] = useMemo(() => {
    const acc: FlatWithPath[] = [];
    const walk = (nodes: NSCat[], path: string[]) => {
      for (const n of nodes) {
        const currentName = n.name?.pt || `#${n.id}`;
        const newPath = [...path, currentName];
        const isLeaf = !n.children || n.children.length === 0;
        acc.push({ ...n, pathNames: newPath, isLeaf, depth: newPath.length - 1 });
        if (n.children?.length) walk(n.children, newPath);
      }
    };
    walk(tree, []);
    return acc;
  }, [tree]);

  const filtered = flatWithPath.filter(row => {
    if (showOnlyLeaves && !row.isLeaf) return false;
    if (!filter.trim()) return true;
    const term = filter.toLowerCase();
    return row.pathNames.some(p => p.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-600 mb-1">Filtro</label>
            <input
              type="text"
              value={filter}
              onChange={e=>setFilter(e.target.value)}
              placeholder="Buscar por qualquer parte do caminho..."
              className="input-field w-full"
            />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 select-none">
          <input type="checkbox" checked={showOnlyLeaves} onChange={e=>setShowOnlyLeaves(e.target.checked)} />
          Somente folhas
        </label>
        <button
          onClick={()=>{
            setLoading(true); setError(null);
            fetch('/api/nuvemshop/categories').then(r=>r.json()).then(j=>{
              if (!j.success) throw new Error(j.error||'Erro');
              setTree(j.data.tree||[]); setFlat(j.data.flat||[]);
            }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
          }}
          className="btn-secondary text-xs"
          disabled={loading}
        >Atualizar</button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Carregando categorias...</div>}

      {!loading && !error && (
        <div className="overflow-auto border rounded-md max-h-[420px]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Nome</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Caminho Completo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Nível</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Folha?</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Filhos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500 text-xs">Nenhuma categoria encontrada</td>
                </tr>
              )}
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-600">#{row.id}</td>
                  <td className="px-3 py-2">{row.name?.pt || '(sem nome)'}</td>
                  <td className="px-3 py-2">
                    {row.pathNames.map((p,i)=>(
                      <span key={i} className="inline-block">
                        {p}{i < row.pathNames.length-1 && <span className="text-gray-400"> / </span>}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2">{row.depth}</td>
                  <td className="px-3 py-2">{row.isLeaf ? 'Sim' : 'Não'}</td>
                  <td className="px-3 py-2">{row.children?.length||0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
