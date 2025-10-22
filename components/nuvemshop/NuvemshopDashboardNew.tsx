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
  const [saving, setSaving] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'TODOS'|'PAIS'|'SEM_VARIACAO'>('TODOS');
  const [busca, setBusca] = useState('');
  const [modalVariantes, setModalVariantes] = useState<ProdutoDecorado | null>(null);
  const [variantesDoPai, setVariantesDoPai] = useState<ProdutoDecorado[]>([]);

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

      if (!prodResp.ok) throw new Error('Erro ao carregar produtos');
      if (!eventResp.ok) throw new Error('Erro ao carregar eventos');

      const produtosRaw: ProdutoLinhaRaw[] = await prodResp.json();
      const eventosRaw: EventoLinha[] = await eventResp.json();

      // Buscar nomes dos produtos e parents
      const codigosSet = new Set<string>();
      produtosRaw.forEach(p => {
        codigosSet.add(p.codigo_interno);
        if (p.parent_codigo_interno) codigosSet.add(p.parent_codigo_interno);
      });
      
      const nomesResp = await fetch('/api/nuvemshop/dashboard/produtos-nomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigos: Array.from(codigosSet) })
      });
      
      const nomesMap = await nomesResp.json();
      
      const produtosArr = produtosRaw.map(p => ({
        ...p,
        nome: nomesMap[p.codigo_interno] || null,
        parent_nome: p.parent_codigo_interno ? nomesMap[p.parent_codigo_interno] || null : null
      }));
      setProdutos(produtosArr);

      const eventosArr = eventosRaw.map(ev => {
        const nome = ev.nome_produto || (ev.codigo_interno ? nomesMap[ev.codigo_interno.toString()] : null) || 'Produto desconhecido';
        let acao = '';
        if (ev.event === 'product/updated') acao = `Produto atualizado`;
        else if (ev.event === 'product/created') acao = `Produto criado`;
        else if (ev.event === 'variant/updated') acao = `Variante atualizada`;
        else if (ev.event.startsWith('remote/ignored_')) acao = `Ignorado evento remoto (${ev.event.replace('remote/ignored_','')})`;
        else acao = `${nome} evento (${ev.event})`;
        return { ...ev, nome_produto: nome, mensagem: acao };
      });
      setEventos(eventosArr);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

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

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel NuvemShop</h1>
          <p className="text-gray-600">Monitore produtos, sincronização e eventos da integração NuvemShop</p>
        </div>
        <button 
          onClick={carregar} 
          disabled={loading}
          className="btn-primary flex items-center justify-center min-w-[120px]"
        >
          <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

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
                aria-label="Filtrar tipo de produto"
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value as any)}
                className="input-field sm:w-48"
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
                          <span className="badge badge-green">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            Sincronizado
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 truncate">{produto.nome || 'Nome não disponível'}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        {produto.preco_enviado && (
                          <span>Preço: R$ {produto.preco_enviado.toFixed(2)}</span>
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
                      <button
                        onClick={() => {
                          setEditing(produto);
                          setEditPreco(produto.preco_enviado?.toString() || '');
                          setEditEstoque(produto.estoque_enviado?.toString() || '');
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
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
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">{evento.mensagem}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{evento.nome_produto}</span>
                        <span>{new Date(evento.received_at).toLocaleString('pt-BR')}</span>
                        {evento.hmac_valid !== undefined && (
                          <span className={`badge ${evento.hmac_valid ? 'badge-green' : 'badge-yellow'}`}>
                            {evento.hmac_valid ? 'Verificado' : 'Não verificado'}
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
                aria-label="Fechar edição"
                title="Fechar edição"
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
                    setProdutos(prev => prev.map(pr => 
                      pr.codigo_interno === editing.codigo_interno 
                        ? { 
                            ...pr, 
                            preco_enviado: editPreco ? Number(editPreco) : null, 
                            estoque_enviado: editEstoque ? Number(editEstoque) : null 
                          } 
                        : pr
                    ));
                    setEditing(null);
                  } finally { 
                    setSaving(false); 
                  }
                }}
                className="btn-primary flex-1 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
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
                aria-label="Fechar variantes"
                title="Fechar variantes"
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
                            {variante.preco_enviado && (
                              <span>Preço: R$ {variante.preco_enviado.toFixed(2)}</span>
                            )}
                            {variante.estoque_enviado !== null && (
                              <span>Estoque: {variante.estoque_enviado}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditing(variante);
                            setEditPreco(variante.preco_enviado?.toString() || '');
                            setEditEstoque(variante.estoque_enviado?.toString() || '');
                            setModalVariantes(null);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Editar variante"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
