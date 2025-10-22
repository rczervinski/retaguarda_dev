"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { 
  CloudIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ArrowPathIcon, 
  TrashIcon, 
  PlusIcon,
  Cog6ToothIcon,
  LinkIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  UserCircleIcon,
  GlobeAltIcon,
  ChartBarIcon,
  CubeIcon,
  ClockIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface ProdutoLinhaRaw {
  codigo_interno: string;
  tipo: 'NORMAL'|'PARENT'|'VARIANT';
  parent_codigo_interno?: string | null;
  sku?: string | null;
  barcode?: string | null;
  product_id?: number | null;
  variant_id?: number | null;
  estoque_enviado?: number | null;
  preco_enviado?: number | null;
}

interface ProdutoDecorado extends ProdutoLinhaRaw {
  nome?: string | null;
  parent_nome?: string | null;
}

interface EventoLinha {
  id: number;
  event: string;
  product_id?: number;
  codigo_interno?: number;
  received_at: string;
  hmac_valid?: boolean;
  payload?: any;
  nome_produto?: string | null;
  mensagem?: string;
}

export default function NuvemshopDashboard() {
  const [produtos, setProdutos] = useState<ProdutoDecorado[]>([]);
  const [eventos, setEventos] = useState<EventoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProdutoDecorado | null>(null);
  const [editPreco, setEditPreco] = useState<string>('');
  const [editEstoque, setEditEstoque] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'TODOS'|'PAIS'|'SEM_VARIACAO'>('TODOS');
  const [busca, setBusca] = useState('');
  const [modalVariantes, setModalVariantes] = useState<ProdutoDecorado | null>(null);
  const [variantesDoPai, setVariantesDoPai] = useState<ProdutoDecorado[]>([]);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const pRes = await fetch('/api/nuvemshop/dashboard/produtos');
      const pJson = await pRes.json();
      if (!pJson.success) throw new Error(pJson.error || 'Falha produtos');
      // Buscar nomes dos produtos em lote
      const rows: ProdutoLinhaRaw[] = pJson.data || [];
      const codigos = Array.from(new Set(rows.map(r=> r.codigo_interno).concat(rows.map(r=> r.parent_codigo_interno).filter(Boolean) as string[])));
      let nomes: Record<string,string> = {};
      if (codigos.length) {
        try {
          const nomeRes = await fetch('/api/nuvemshop/dashboard/produtos-nomes', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ codigos }) });
          const nomeJson = await nomeRes.json();
          if (nomeJson.success) nomes = nomeJson.nomes || {};
        } catch {}
      }
      const decorados: ProdutoDecorado[] = rows.map(r => ({ ...r, nome: nomes[r.codigo_interno], parent_nome: r.parent_codigo_interno ? nomes[String(r.parent_codigo_interno)] : null }));
      setProdutos(decorados);
      const eRes = await fetch('/api/nuvemshop/dashboard/eventos');
      const eJson = await eRes.json();
      if (!eJson.success) throw new Error(eJson.error || 'Falha eventos');
      // Enriquecer eventos com nome
      const eventosArr: EventoLinha[] = (eJson.data || []).map((ev: any) => {
        const pid = ev.product_id;
        const prod = decorados.find(p => p.product_id === pid) || decorados.find(p=> p.product_id && p.product_id === pid);
        let nome = prod?.nome || prod?.codigo_interno || ev.codigo_interno || 'Produto';
        let acao: string;
        if (ev.event === 'local/product_created') acao = `CRIOU o produto ${nome}`;
        else if (ev.event === 'local/product_updated') acao = `ATUALIZOU o produto ${nome}`;
        else if (ev.event === 'local/product_deleted') acao = `DELETOU o produto ${nome}`;
        else if (ev.event === 'remote/product_deleted') acao = `NUVEMSHOP removeu produto ${nome}`;
        else if (ev.event.startsWith('remote/ignored_')) acao = `Ignorado evento remoto (${ev.event.replace('remote/ignored_','')})`; 
        else acao = `${nome} evento (${ev.event})`;
        return { ...ev, nome_produto: nome, mensagem: acao };
      });
      setEventos(eventosArr);
    } catch (e:any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=> { carregar(); }, []);

  const parentsMap = useMemo(()=> {
    const m = new Map<string, ProdutoDecorado>();
    produtos.forEach(p => { if (p.tipo === 'PARENT') m.set(p.codigo_interno, p); });
    return m;
  }, [produtos]);

  const produtosLista = useMemo(()=> {
    let base = produtos.filter(p => p.tipo !== 'VARIANT'); // mistura PARENT + NORMAL
    if (filtroTipo === 'PAIS') base = base.filter(p => p.tipo === 'PARENT');
    if (filtroTipo === 'SEM_VARIACAO') base = base.filter(p => p.tipo === 'NORMAL');
    if (busca.trim()) {
      const b = busca.trim().toLowerCase();
      base = base.filter(p => (p.nome || '').toLowerCase().includes(b));
    }
    return base;
  }, [produtos, filtroTipo, busca]);

  const tipoLabel = (t: string) => t === 'PARENT' ? 'COM VARIAÇÃO' : 'SEM VARIAÇÃO';

  async function abrirVariantes(pai: ProdutoDecorado) {
    // Variantes são as linhas VARIANT com parent_codigo_interno = pai.codigo_interno
    const vars = produtos.filter(v => v.tipo === 'VARIANT' && v.parent_codigo_interno === pai.codigo_interno);
    setVariantesDoPai(vars.map(v => ({ ...v, nome: v.nome || v.codigo_interno })));
    setModalVariantes(pai);
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">NuvemShop - Painel</h2>
        <button onClick={carregar} className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-500">Recarregar</button>
      </div>
      {erro && <div className="text-red-600 text-sm">Erro: {erro}</div>}
      {loading && <div className="text-sm text-gray-500">Carregando...</div>}
      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded p-4 shadow-sm">
              <h3 className="font-medium mb-1">Total Produtos</h3>
              <div className="text-2xl font-bold">{produtosLista.length}</div>
            </div>
            <div className="bg-white border rounded p-4 shadow-sm">
              <h3 className="font-medium mb-1">Pais</h3>
              <div className="text-2xl font-bold">{produtos.filter(p=>p.tipo==='PARENT').length}</div>
            </div>
            <div className="bg-white border rounded p-4 shadow-sm">
              <h3 className="font-medium mb-1">Eventos (últimos 30)</h3>
              <div className="text-2xl font-bold">{eventos.length}</div>
            </div>
            <div className="bg-white border rounded p-4 shadow-sm">
              <h3 className="font-medium mb-1">Sem Variação</h3>
              <div className="text-2xl font-bold">{produtos.filter(p=>p.tipo==='NORMAL').length}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end mt-4">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Filtro Tipo</label>
              <select aria-label="Filtro Tipo" value={filtroTipo} onChange={e=> setFiltroTipo(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                <option value="TODOS">Todos</option>
                <option value="PAIS">Somente Pais</option>
                <option value="SEM_VARIACAO">Sem Variação</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Busca Produto</label>
              <input value={busca} onChange={e=> setBusca(e.target.value)} className="border rounded px-2 py-1 text-sm" placeholder="Nome..." />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Produtos / Variações</h3>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-2 py-2 text-left">Produto</th>
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Preço</th>
                    <th className="px-2 py-2 text-left">Estoque</th>
                    <th className="px-2 py-2 text-left">Variações</th>
                    <th className="px-2 py-2 text-left">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosLista.map(p => {
                    return (
                      <tr key={p.codigo_interno} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-2 text-sm font-medium">{p.nome || p.codigo_interno}</td>
                        <td className="px-2 py-2 text-xs font-semibold">
                          <span className={p.tipo==='PARENT' ? 'text-indigo-600' : 'text-gray-600'}>{tipoLabel(p.tipo)}</span>
                        </td>
                        <td className="px-2 py-2">{p.preco_enviado ?? '-'}</td>
                        <td className="px-2 py-2">{p.estoque_enviado ?? '-'}</td>
                        <td className="px-2 py-2">
                          {p.tipo === 'PARENT' ? (
                            <button onClick={()=> abrirVariantes(p)} className="text-blue-600 text-xs underline">Ver ({produtos.filter(v=> v.tipo==='VARIANT' && v.parent_codigo_interno===p.codigo_interno).length})</button>
                          ) : <span className="text-gray-400 text-xs">-</span>}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => { setEditing(p); setEditPreco(p.preco_enviado?.toString()||''); setEditEstoque(p.estoque_enviado?.toString()||''); }}
                            className="text-blue-600 hover:underline text-xs"
                          >Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="font-semibold mb-2">Eventos E-commerce Recentes (NuvemShop)</h3>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-2 py-2 text-left">Quando</th>
                    <th className="px-2 py-2 text-left">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map(e => (
                    <tr key={e.id} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-2 text-xs">{new Date(e.received_at).toLocaleString()}</td>
                      <td className="px-2 py-2 text-xs">{e.mensagem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
  {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4 space-y-4">
            <h4 className="font-semibold">Editar Produto {editing.codigo_interno}</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm space-y-1">
                <span>Preço Enviar</span>
                <input value={editPreco} onChange={e=> setEditPreco(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </label>
              <label className="text-sm space-y-1">
                <span>Estoque Enviar</span>
                <input value={editEstoque} onChange={e=> setEditEstoque(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={()=> setEditing(null)} className="px-3 py-1 text-sm rounded border">Cancelar</button>
              <button
                disabled={saving}
                onClick={async ()=> {
                  setSaving(true);
                  try {
                    // Placeholder: apenas atualiza localmente; integração real faria POST para endpoint de atualização
                    setProdutos(prev => prev.map(pr => pr.codigo_interno === editing.codigo_interno ? { ...pr, preco_enviado: editPreco? Number(editPreco): null, estoque_enviado: editEstoque? Number(editEstoque): null } : pr));
                    setEditing(null);
                  } finally { setSaving(false); }
                }}
                className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
              >{saving? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
      {modalVariantes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Variantes de {modalVariantes.nome || modalVariantes.codigo_interno}</h4>
              <button onClick={()=> { setModalVariantes(null); setVariantesDoPai([]); }} className="text-sm text-gray-600 hover:text-black">Fechar</button>
            </div>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 text-gray-600 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left">Variante</th>
                    <th className="px-2 py-2 text-left">Barcode</th>
                    <th className="px-2 py-2 text-left">Preço</th>
                    <th className="px-2 py-2 text-left">Estoque</th>
                    <th className="px-2 py-2 text-left">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {variantesDoPai.map(v => (
                    <tr key={v.codigo_interno} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-2">{v.nome || v.codigo_interno}</td>
                      <td className="px-2 py-2">{v.barcode || '-'}</td>
                      <td className="px-2 py-2">{v.preco_enviado ?? '-'}</td>
                      <td className="px-2 py-2">{v.estoque_enviado ?? '-'}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => { setEditing(v); setEditPreco(v.preco_enviado?.toString()||''); setEditEstoque(v.estoque_enviado?.toString()||''); }}
                          className="text-blue-600 underline"
                        >Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
