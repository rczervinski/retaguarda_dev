"use client";

import { useEffect, useState } from 'react';

interface VendaItem {
  venda_item_codigo: number;
  venda_codigo: number;
  data: string;
  hora: string;
  codigo_gtin: string | null;
  nome: string | null;
  qtde: number;
  preco_unit: number;
  cancelado: number;
}

export function RecentLocalSales() {
  const [items, setItems] = useState<VendaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setErro(null)
      try {
        const res = await fetch('/api/dashboard/vendas-locais?days=7&limit=100')
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Falha ao carregar vendas locais')
        setItems(json.items || [])
      } catch (e: any) {
        setErro(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vendas Locais Recentes</h3>
        <div className="text-xs text-gray-500">últimos 7 dias</div>
      </div>
      {erro && <div className="text-xs text-red-600">{erro}</div>}
      {loading && <div className="text-xs text-gray-500">Carregando...</div>}
      {!loading && !erro && (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="max-h-72 overflow-y-auto">{/* ~288px height, scroll */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venda</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GTIN</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qtde</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((it: VendaItem) => (
                  <tr key={it.venda_item_codigo} className={it.cancelado ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 text-sm text-gray-900">#{it.venda_codigo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{`${it.data || ''}${it.hora ? ' ' + it.hora : ''}`.trim() || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{it.codigo_gtin || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 break-words">{it.nome || '-'}</td>
                    <td className="px-3 py-2 text-right text-sm text-gray-900">{Math.abs(it.qtde)}</td>
                    <td className="px-3 py-2 text-right text-sm text-gray-900">{(it.preco_unit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {it.cancelado ? <span className="inline-flex px-2 py-1 rounded bg-red-100 text-red-700">Cancelado</span> : <span className="inline-flex px-2 py-1 rounded bg-green-100 text-green-700">OK</span>}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500">Sem vendas no período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
