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
import CategoriesTree from '@/components/nuvemshop/CategoriesTree';
import CategoriesTable from '@/components/nuvemshop/CategoriesTable';

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
  needs_update?: boolean | null;
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

interface StatsData {
  totalProdutos: number;
  produtosComVariacao: number;
  produtosSemVariacao: number;
  totalEventos: number;
  eventosRecentes: number;
  produtosSincronizados: number;
}

export default function NuvemshopDashboard() {
  const [produtos, setProdutos] = useState<ProdutoDecorado[]>([]);
  const [eventos, setEventos] = useState<EventoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProdutoDecorado | null>(null);
  const [editPreco, setEditPreco] = useState<string>('');
  const [editEstoque, setEditEstoque] = useState<string>('');
  const [editAltura, setEditAltura] = useState<string>('');
  const [editLargura, setEditLargura] = useState<string>('');
  const [editComprimento, setEditComprimento] = useState<string>('');
  const [editPeso, setEditPeso] = useState<string>('');
  // published removido (coluna inexistente no banco atual)
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'TODOS'|'PAIS'|'SEM_VARIACAO'>('TODOS');
  const [busca, setBusca] = useState('');
  const [modalVariantes, setModalVariantes] = useState<ProdutoDecorado | null>(null);
  const [variantesDoPai, setVariantesDoPai] = useState<ProdutoDecorado[]>([]);
  const [diffsModal, setDiffsModal] = useState<{codigo:string,diffs:any[]}|null>(null);
  const [agrupadas, setAgrupadas] = useState<any[]>([]);
  const [loadingAgrupadas, setLoadingAgrupadas] = useState(false);

  // Calcular estatísticas
  const stats: StatsData = useMemo(() => {
    const totalProdutos = produtos.filter(p => p.tipo !== 'VARIANT').length;
    const produtosComVariacao = produtos.filter(p => p.tipo === 'PARENT').length;
    const produtosSemVariacao = produtos.filter(p => p.tipo === 'NORMAL').length;
    const totalEventos = eventos.length;
    const eventosRecentes = eventos.filter(e => {
      const eventDate = new Date(e.received_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return eventDate > oneDayAgo;
    }).length;
    const produtosSincronizados = produtos.filter(p => p.product_id !== null).length;

    return {
      totalProdutos,
      produtosComVariacao,
      produtosSemVariacao,
      totalEventos,
      eventosRecentes,
      produtosSincronizados
    };
  }, [produtos, eventos]);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [prodResp, eventResp] = await Promise.all([
        fetch('/api/nuvemshop/dashboard/produtos'),
        fetch('/api/nuvemshop/dashboard/eventos')
      ]);

      if (!prodResp.ok) throw new Error('Erro HTTP produtos');
      if (!eventResp.ok) throw new Error('Erro HTTP eventos');

      const prodJson = await prodResp.json();
      const eventJson = await eventResp.json();

      if (!prodJson.success) throw new Error(prodJson.error || 'Falha produtos');
      if (!eventJson.success) throw new Error(eventJson.error || 'Falha eventos');

      const produtosRaw: ProdutoLinhaRaw[] = Array.isArray(prodJson.data) ? prodJson.data : [];
      const eventosRaw: EventoLinha[] = Array.isArray(eventJson.data) ? eventJson.data : [];

      // Proteção caso backend mude formato
      if (!Array.isArray(prodJson.data)) {
        console.warn('[NuvemshopDashboard] data produtos não é array', prodJson.data);
  }

  // Atualiza divergências agrupadas junto com o refresh principal
  if (fetchAgrupadas) await fetchAgrupadas();
      if (!Array.isArray(eventJson.data)) {
        console.warn('[NuvemshopDashboard] data eventos não é array', eventJson.data);
      }

      const codigosSet = new Set<string>();
      produtosRaw.forEach(p => {
        if (p && p.codigo_interno) {
          codigosSet.add(String(p.codigo_interno));
          if (p.parent_codigo_interno) codigosSet.add(String(p.parent_codigo_interno));
        }
      });

      let nomesMap: Record<string,string> = {};
      if (codigosSet.size) {
        const nomesResp = await fetch('/api/nuvemshop/dashboard/produtos-nomes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigos: Array.from(codigosSet) })
        });
        const nomesJson = await nomesResp.json();
        if (nomesJson.success && nomesJson.nomes && typeof nomesJson.nomes === 'object') {
          nomesMap = nomesJson.nomes;
        } else {
          console.warn('[NuvemshopDashboard] nomes map inesperado', nomesJson);
        }
      }

      const produtosArr = produtosRaw.map(p => ({
        ...p,
        nome: nomesMap[String(p.codigo_interno)] || null,
        parent_nome: p.parent_codigo_interno ? (nomesMap[String(p.parent_codigo_interno)] || null) : null
      }));
      setProdutos(produtosArr);

      const eventosArr = eventosRaw.map(ev => {
        const nome = ev.nome_produto || (ev.codigo_interno ? nomesMap[String(ev.codigo_interno)] : null) || 'DESCONHECIDO';
        const prodRef = ev.codigo_interno ? produtosArr.find(p => String(p.codigo_interno) === String(ev.codigo_interno)) : null;
        let tipoTxt = 'NORMAL';
        if (prodRef) {
          if (prodRef.tipo === 'PARENT') tipoTxt = 'PAI';
          else if (prodRef.tipo === 'VARIANT') tipoTxt = 'VARIANTE';
        }
        // Eventos de variante dedicados
        if (ev.event?.includes('variant')) {
          const actionWord = ev.event.includes('criada') ? 'CRIADA' : ev.event.includes('deletada') ? 'DELETADA' : 'ATUALIZADA';
            const parentName = prodRef?.parent_codigo_interno ? (nomesMap[String(prodRef.parent_codigo_interno)] || '') : '';
          const value = ev.payload?.value || nome;
          const mensagem = `VARIANTE ${value} ${actionWord}` + (parentName ? ` e atribuída ao produto ${parentName}` : '');
          return { ...ev, nome_produto: nome, mensagem };
        }
        // Agora recebemos eventos já normalizados do backend (criado/atualizado/deletado/ignorado)
        let acao = 'ATUALIZADO';
        const e = String(ev.event || '').toLowerCase();
        if (e.includes('criado')) acao = 'CRIADO';
        else if (e.includes('deletado')) acao = 'DELETADO';
        else if (e.includes('ignorado')) acao = 'IGNORADO';
        else if (e.includes('atualizado')) acao = 'ATUALIZADO';
        const mensagem = `Produto ${tipoTxt} ${nome} foi ${acao}`;
        return { ...ev, nome_produto: nome, mensagem };
      });
      setEventos(eventosArr);
    } catch (e: any) {
      console.error('[NuvemshopDashboard] erro carregar', e);
      setErro(e.message || 'Erro inesperado');
      setProdutos([]);
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);
  useEffect(()=>{ console.log('[NuvemshopDashboard] versão 2024-09-12-2 (sem published)'); },[]);
  // Tornar fetchAgrupadas reutilizável
  let fetchAgrupadas: (() => Promise<void>) | null = null;
  useEffect(()=>{
    fetchAgrupadas = async function(){
      setLoadingAgrupadas(true);
      try {
        const r = await fetch('/api/nuvemshop/dashboard/divergencias-agrupadas');
        const j = await r.json();
        if (j.success) setAgrupadas(j.data||[]); else setAgrupadas([]);
      } catch { setAgrupadas([]); }
      finally { setLoadingAgrupadas(false); }
    }
    fetchAgrupadas();
  },[]);

  const parentsMap = useMemo(() => {
    const m = new Map<string, ProdutoDecorado>();
    produtos.forEach(p => { if (p.tipo === 'PARENT') m.set(p.codigo_interno, p); });
    return m;
  }, [produtos]);

  const produtosLista = useMemo(() => {
    let base = produtos.filter(p => p.tipo !== 'VARIANT');
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
    const vars = produtos.filter(v => v.tipo === 'VARIANT' && v.parent_codigo_interno === pai.codigo_interno);
    setVariantesDoPai(vars.map(v => ({ ...v, nome: v.nome || v.codigo_interno })));
    setModalVariantes(pai);
  }

  const pendentes = useMemo(()=> produtos.filter(p=>p.needs_update && p.tipo!=='VARIANT'), [produtos]);

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel NuvemShop</h1>
          <p className="text-gray-600">Monitore produtos, sincronização e eventos da integração NuvemShop</p>
          {pendentes.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-amber-700 text-sm">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span>{pendentes.length} produto(s) com divergências pendentes</span>
              <button
                onClick={async ()=>{
                  const codigos = pendentes.map(p=>p.codigo_interno);
                  await fetch('/api/nuvemshop/resync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ codigos }) });
                  await fetch('/api/nuvemshop/divergencias/recheck-all', { method:'POST' });
                  carregar();
                }}
                className="ml-2 underline hover:text-amber-800"
              >Re-sincronizar todos</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={carregar} 
            disabled={loading}
            className="btn-primary flex items-center justify-center min-w-[120px]"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Painel de Avisos removido por solicitação */}

      {/* A tabela de Divergências foi movida para o final conforme solicitado */}

      {/* Mensagem de erro */}
      {erro && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Erro ao carregar dados</p>
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProdutos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CubeIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Com Variação</p>
              <p className="text-2xl font-bold text-gray-900">{stats.produtosComVariacao}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Cog6ToothIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sem Variação</p>
              <p className="text-2xl font-bold text-gray-900">{stats.produtosSemVariacao}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <ShoppingBagIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sincronizados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.produtosSincronizados}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CloudIcon className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Eventos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEventos}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Eventos (24h)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.eventosRecentes}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
  {/* Seção de Produtos */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Produtos Sincronizados</h3>
            <span className="badge badge-blue">{produtosLista.length} produtos</span>
          </div>

          {/* Filtros */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="input-field flex-1"
              />
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value as any)}
                className="input-field sm:w-48"
                title="Filtrar por tipo de produto"
              >
                <option value="TODOS">Todos os tipos</option>
                <option value="PAIS">Com variação</option>
                <option value="SEM_VARIACAO">Sem variação</option>
              </select>
            </div>
          </div>

          {/* Lista de Produtos */}
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="loading-spinner w-8 h-8"></div>
                <span className="ml-3 text-gray-600">Carregando produtos...</span>
              </div>
            ) : produtosLista.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CubeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              produtosLista.map(produto => (
                <div key={produto.codigo_interno} className="card-compact hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-gray-500">#{produto.codigo_interno}</span>
                        <span className={`badge ${produto.tipo === 'PARENT' ? 'badge-blue' : 'badge-gray'}`}>
                          {tipoLabel(produto.tipo)}
                        </span>
                        {produto.product_id && (
                          <span className="badge badge-green flex items-center">
                            <CloudIcon className="w-3 h-3 mr-1" />OK
                          </span>
                        )}
                        {produto.needs_update && (
                          <span className="badge badge-yellow">PENDENTE</span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 truncate">{produto.nome || 'Nome não disponível'}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        {produto.preco_enviado !== null && produto.preco_enviado !== undefined && (
                          <span>Preço: R$ {Number(produto.preco_enviado).toFixed(2)}</span>
                        )}
                        {produto.estoque_enviado !== null && (
                          <span>Estoque: {produto.estoque_enviado}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {produto.tipo === 'PARENT' && (
                        <button
                          onClick={() => abrirVariantes(produto)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver variantes"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      )}
                      {/* Delete product button */}
                      {produto.tipo !== 'VARIANT' && (
                        <button
                          onClick={async () => {
                            const ok = window.confirm(`Excluir produto ${produto.nome || produto.codigo_interno} da NuvemShop?`);
                            if (!ok) return;
                            try {
                              const resp = await fetch('/api/nuvemshop/products/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo_interno: produto.codigo_interno }) });
                              const j = await resp.json();
                              if (!j.success) alert(`Falha ao excluir: ${j.error || 'erro'}`);
                              await carregar();
                            } catch (e:any) { alert(`Erro: ${e.message}`); }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir produto na NuvemShop"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditing(produto);
                          setEditPreco(produto.preco_enviado?.toString() || '');
                          setEditEstoque(produto.estoque_enviado?.toString() || '');
                          // published removido
                          setEditAltura('');
                          setEditLargura('');
                          setEditComprimento('');
                          setEditPeso('');
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2">
                        {produto.needs_update && (
                          <button
                            onClick={async () => {
                              const r = await fetch(`/api/nuvemshop/divergencias?codigo_interno=${produto.codigo_interno}`);
                              const j = await r.json();
                              if (j.success) setDiffsModal({ codigo: String(produto.codigo_interno), diffs: j.data.diffs });
                            }}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Ver divergências"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Seção de Eventos */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Eventos Recentes</h3>
            <span className="badge badge-orange">{eventos.length} eventos</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="loading-spinner w-8 h-8"></div>
                <span className="ml-3 text-gray-600">Carregando eventos...</span>
              </div>
            ) : eventos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ClockIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum evento encontrado</p>
              </div>
            ) : (
              eventos.map(evento => (
                <div key={evento.id} className="card-compact">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                      evento.event === 'product/created' ? 'bg-green-500' :
                      evento.event === 'product/updated' ? 'bg-blue-500' :
                      evento.event === 'variant/updated' ? 'bg-purple-500' :
                      evento.event?.includes('deleted') ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{evento.mensagem}</p>
                      <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                        <span>{new Date(evento.received_at).toLocaleString('pt-BR')}</span>
                        {evento.hmac_valid !== undefined && (
                          <span className={`badge ${evento.hmac_valid ? 'badge-green' : 'badge-yellow'}`}>
                            {evento.hmac_valid ? 'VERIFICADO' : 'NÃO VERIFICADO'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Categorias Nuvemshop */}
      <div className="mt-10">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Categorias Nuvemshop</h3>
            <span className="text-xs text-gray-500">Somente leitura • Atual mostra estrutura hierárquica</span>
          </div>
          <CategoriesTable />
        </div>
      </div>

      {/* Seção de Divergências (final) */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Divergências</h3>
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-xs"
              title="Comparação tipo-aware entre dados locais e snapshot das últimas exportações"
            >i</span>
          </div>
          {loadingAgrupadas && <span className="text-xs text-gray-500">Carregando...</span>}
        </div>
        {(!agrupadas || agrupadas.length===0) && !loadingAgrupadas ? (
          <p className="text-sm text-gray-500">Nenhuma divergência encontrada.</p>
        ) : (
          <div className="overflow-auto max-h-80 custom-scrollbar text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">ID Nuvemshop</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Código de Barras</th>
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Campos Divergentes</th>
                </tr>
              </thead>
              <tbody>
                {agrupadas.map(item => (
                  <tr key={item.codigo_interno} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-gray-700">#{item.codigo_interno}</td>
                    <td className="py-2 pr-4">
                      {item.tipo === 'VARIANT' ? (
                        <span className="text-xs text-gray-700">P:{item.product_id} / V:{item.variant_id}</span>
                      ) : (
                        <span className="text-xs text-gray-700">{item.product_id || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs text-gray-700">{item.sku || '-'}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs text-gray-700">{item.barcode || '-'}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs text-gray-800">{item.nome || '-'}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <ul className="flex flex-wrap gap-2">
                        {item.divergencias.map((d:any,i:number)=>(
                          <li key={i} className="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium" title={`Local: ${d.local} | Snapshot: ${d.snapshot}`}>{d.campo}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-gray-900">
                Editar Produto #{editing.codigo_interno}
              </h4>
              <button
                onClick={() => setEditing(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                title="Fechar modal"
                aria-label="Fechar modal de edição"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preço para Envio
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editPreco}
                  onChange={e => setEditPreco(e.target.value)}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estoque para Envio
                </label>
                <input
                  type="number"
                  value={editEstoque}
                  onChange={e => setEditEstoque(e.target.value)}
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Altura (cm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAltura}
                    onChange={e => setEditAltura(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Largura (cm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editLargura}
                    onChange={e => setEditLargura(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comprimento (cm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editComprimento}
                    onChange={e => setEditComprimento(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Peso (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPeso}
                    onChange={e => setEditPeso(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Campo de publicação removido */}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    // Persistir dimensões/peso localmente
                    const dims: any = {
                      comprimento: editComprimento ? Number(editComprimento) : undefined,
                      largura: editLargura ? Number(editLargura) : undefined,
                      altura: editAltura ? Number(editAltura) : undefined,
                      peso: editPeso ? Number(editPeso) : undefined,
                    };
                    await fetch(`/api/produtos/${editing.codigo_interno}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(dims)
                    });
                    // Pendência local de preço/estoque
                    await fetch('/api/nuvemshop/pending', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ codigo_interno: editing.codigo_interno, preco: editPreco? Number(editPreco):undefined, estoque: editEstoque? Number(editEstoque):undefined }) });
                    setEditing(null);
                    carregar();
                  } finally { 
                    setSaving(false); 
                  }
                }}
                className="btn-secondary flex-1 flex items-center justify-center"
              >
                {saving ? '...' : 'Salvar Pendência'}
              </button>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    // Persistir dimensões/peso antes do export
                    const dims: any = {
                      comprimento: editComprimento ? Number(editComprimento) : undefined,
                      largura: editLargura ? Number(editLargura) : undefined,
                      altura: editAltura ? Number(editAltura) : undefined,
                      peso: editPeso ? Number(editPeso) : undefined,
                    };
                    await fetch(`/api/produtos/${editing.codigo_interno}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(dims)
                    });
                    // Exportar imediato
                    await fetch('/api/nuvemshop/resync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ codigo_interno: editing.codigo_interno }) });
                    await fetch('/api/nuvemshop/divergencias/recheck-all', { method:'POST' });
                    setEditing(null);
                    carregar();
                  } finally { setSaving(false); }
                }}
                className="btn-primary flex-1 flex items-center justify-center"
              >
                {saving ? '...' : 'Exportar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Variantes */}
      {modalVariantes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-gray-900">
                Variantes de {modalVariantes.nome || modalVariantes.codigo_interno}
              </h4>
              <button
                onClick={() => {
                  setModalVariantes(null);
                  setVariantesDoPai([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                title="Fechar modal"
                aria-label="Fechar modal de variantes"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto custom-scrollbar">
              {variantesDoPai.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Nenhuma variante encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variantesDoPai.map(variante => (
                    <div key={variante.codigo_interno} className="card-compact">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono text-gray-500">#{variante.codigo_interno}</span>
                            <span className="badge badge-blue">Variante</span>
                          </div>
                          <p className="font-medium text-gray-900">{variante.nome}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Código: {variante.barcode || 'N/A'}</span>
                            {variante.preco_enviado !== null && variante.preco_enviado !== undefined && (
                              <span>Preço: R$ {Number(variante.preco_enviado).toFixed(2)}</span>
                            )}
                            {variante.estoque_enviado !== null && (
                              <span>Estoque: {variante.estoque_enviado}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditing(variante);
                              setEditPreco(variante.preco_enviado?.toString() || '');
                              setEditEstoque(variante.estoque_enviado?.toString() || '');
                              setEditAltura('');
                              setEditLargura('');
                              setEditComprimento('');
                              setEditPeso('');
                              setModalVariantes(null);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Editar variante"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = window.confirm(`Excluir variante ${variante.nome || variante.codigo_interno} da NuvemShop?`);
                              if (!ok) return;
                              try {
                                // First check if it's the last variant
                                const irmas = variantesDoPai.filter(v => v.codigo_interno !== variante.codigo_interno);
                                let forceDeleteParent = false;
                                if (irmas.length === 0) {
                                  forceDeleteParent = window.confirm('Essa é a última variante. Deseja também remover o produto pai?');
                                }
                                const resp = await fetch('/api/nuvemshop/variants/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo_interno: variante.codigo_interno, forceDeleteParent }) });
                                const j = await resp.json();
                                if (!j.success) alert(`Falha ao excluir: ${j.error || 'erro'}`);
                                await carregar();
                                setModalVariantes(null);
                              } catch (e:any) { alert(`Erro: ${e.message}`); }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir variante na NuvemShop"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Divergências */}
      {diffsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Divergências #{diffsModal.codigo}</h4>
              <button onClick={()=>setDiffsModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Fechar">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto custom-scrollbar max-h-[50vh] pr-2">
              {diffsModal.diffs.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma divergência.</p>
              ) : (
                <ul className="space-y-2">
                  {diffsModal.diffs.map((d,i)=>(
                    <li key={i} className="text-sm bg-gray-50 rounded p-2">
                      <strong className="uppercase text-xs text-gray-500">{d.campo}</strong><br/>
                      <span className="text-gray-700">Local: <span className="font-medium">{String(d.local ?? '')}</span></span><br/>
                      <span className="text-gray-700">Snapshot: <span className="font-medium">{String(d.remoto ?? '')}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setDiffsModal(null)} className="btn-secondary flex-1">Fechar</button>
              <button
                onClick={async ()=>{
                  // Re-sync este produto
                  await fetch('/api/nuvemshop/resync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ codigo_interno: diffsModal.codigo }) });
                  await fetch('/api/nuvemshop/divergencias/recheck-all', { method:'POST' });
                  setDiffsModal(null);
                  carregar();
                }}
                className="btn-primary flex-1"
              >Re-sincronizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
