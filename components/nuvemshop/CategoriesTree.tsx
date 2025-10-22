"use client";
import React, { useEffect, useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, FolderIcon } from '@heroicons/react/24/outline';

interface CategoryNode {
  id: number;
  name: { pt?: string };
  parent: number | null;
  children?: CategoryNode[];
}

function TreeItem({ node }: { node: CategoryNode }) {
  const [open, setOpen] = useState(false);
  const hasChildren = (node.children?.length || 0) > 0;
  const label = node.name?.pt || `Categoria ${node.id}`;
  return (
    <div className="ml-2">
      <div className="flex items-center gap-2 py-1">
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="text-gray-600 hover:text-gray-800">
            {open ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 h-4 inline-block" />
        )}
        <FolderIcon className="w-4 h-4 text-blue-500" />
        <span className="text-sm text-gray-800">{label}</span>
        <span className="text-[11px] text-gray-500 ml-2">#{node.id}</span>
      </div>
      {open && hasChildren && (
        <div className="ml-5 border-l pl-3 border-gray-200">
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesTree() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch('/api/nuvemshop/categories');
        const j = await r.json();
        if (mounted) {
          if (j.success) setTree(j.data?.tree || []);
          else setError(j.error || 'Falha ao carregar categorias');
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Erro ao carregar categorias');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, []);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Categorias Nuvemshop</h3>
        <button
          onClick={async ()=>{
            setLoading(true);
            try {
              const r = await fetch('/api/nuvemshop/categories');
              const j = await r.json();
              if (j.success) setTree(j.data?.tree || []);
              else setError(j.error || 'Falha ao atualizar categorias');
            } catch (e: any) {
              setError(e?.message || 'Erro ao atualizar categorias');
            } finally { setLoading(false); }
          }}
          className="btn-secondary"
        >Atualizar</button>
      </div>
      {loading && <div className="text-sm text-gray-500">Carregando categorias...</div>}
      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
      {!loading && !error && (
        <div>
          {tree.length === 0 ? (
            <div className="text-sm text-gray-500">Nenhuma categoria encontrada.</div>
          ) : (
            tree.map((n) => <TreeItem key={n.id} node={n} />)
          )}
        </div>
      )}
    </div>
  );
}
