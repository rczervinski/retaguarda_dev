'use client'
import { useState } from 'react'

// SVG Icons
const CloudIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 15.5C3 13.015 5.015 11 7.5 11c.433 0 .854.062 1.25.177A5.5 5.5 0 0 1 18.5 11c2.485 0 4.5 2.015 4.5 4.5S20.985 20 18.5 20h-11C5.015 20 3 17.985 3 15.5Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ShoppingBagIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3.977 9.84A2 2 0 0 1 5.971 8h12.058a2 2 0 0 1 1.994 1.84l.853 10.66A2 2 0 0 1 18.882 23H5.118a2 2 0 0 1-1.994-2.5l.853-10.66Z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 11V6a4 4 0 0 0-8 0v5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ReceiptIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CloseIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function VendasOnlineClient({ data, filters, totalPages }: { data: any; filters: any; totalPages: number }) {
  const [modalData, setModalData] = useState<any>(null)
  const { s, sp, pr, df, dt, page } = filters

  const makeQuery = (patch: Record<string,string|undefined>) => {
    const usp = new URLSearchParams()
    if (s) usp.set('s', s)
    if (sp) usp.set('sp', sp)
    if (pr) usp.set('pr', pr)
    if (df) usp.set('df', df)
    if (dt) usp.set('dt', dt)
    usp.set('pg', String(page))
    for (const [k,v] of Object.entries(patch)) {
      if (v == null || v === '') usp.delete(k)
      else usp.set(k, v)
    }
    return `?${usp.toString()}`
  }

  const traduzirStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'Pendente',
      'authorized': 'Autorizado',
      'paid': 'Pago',
      'cancelled': 'Cancelado',
      'refunded': 'Reembolsado',
      'voided': 'Cancelado',
      'open': 'Aberto',
      'closed': 'Fechado',
      'shipped': 'Enviado',
      'delivered': 'Entregue'
    }
    return map[status?.toLowerCase()] || status || '—'
  }

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase()
    if (['paid', 'authorized'].includes(s)) return 'bg-green-50 border-green-200'
    if (['pending', 'open'].includes(s)) return 'bg-yellow-50 border-yellow-200'
    if (['cancelled', 'voided', 'refunded'].includes(s)) return 'bg-red-50 border-red-200'
    return 'bg-gray-50 border-gray-200'
  }

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase()
    if (['paid', 'authorized'].includes(s)) return 'bg-green-100 text-green-800 border-green-300'
    if (['pending', 'open'].includes(s)) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (['cancelled', 'voided', 'refunded'].includes(s)) return 'bg-red-100 text-red-800 border-red-300'
    return 'bg-gray-100 text-gray-800 border-gray-300'
  }

  // A cor da linha deve priorizar o status do pedido. Se o pedido está cancelado, fica vermelho independentemente do pagamento.
  const getRowColor = (statusPedido: string, statusPagamento: string) => {
    const op = (statusPedido || '').toLowerCase()
    if (['cancelled','canceled','voided'].includes(op)) return 'bg-red-50 border-red-200'
    return getStatusColor(statusPagamento || '')
  }

  // Badge de Status do Pedido (forte): Aberto (verde), Cancelado (vermelho), fallback neutro
  const getOrderStatusPill = (statusPedido: string) => {
    const s = (statusPedido || '').toLowerCase()
    if (s === 'open') return { label: 'Aberto', cls: 'bg-green-300 text-white' }
    if (['cancelled','canceled','voided'].includes(s)) return { label: 'Cancelado', cls: 'bg-red-300 text-white' }
    return { label: traduzirStatus(statusPedido || ''), cls: 'bg-gray-200 text-gray-800' }
  }

  const getPlataformaIcon = (plat: string) => {
    if (plat === 'nuvemshop') return <div className="text-blue-500"><CloudIcon /></div>
    if (plat === 'mercadolivre') return <div className="text-yellow-500"><ShoppingBagIcon /></div>
    return <div className="text-gray-500"><ShoppingBagIcon /></div>
  }

  const openModal = (r: any, its: any[]) => {
    setModalData({ pedido: r, itens: its })
  }

  const closeModal = () => {
    setModalData(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Vendas Online</h1>
        <div className="text-sm text-gray-600">
          {data.total} pedido{data.total !== 1 ? 's' : ''}
        </div>
      </div>

      <form className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3" method="GET">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
          <input name="s" defaultValue={s} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Pedido, cliente, email" />
        </div>
        <div>
          <label htmlFor="f-sp" className="block text-xs font-medium text-gray-700 mb-1">Pagamento</label>
          <select id="f-sp" name="sp" defaultValue={sp} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" title="Status de pagamento">
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="authorized">Autorizado</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-pr" className="block text-xs font-medium text-gray-700 mb-1">Processado</label>
          <select id="f-pr" name="pr" defaultValue={pr} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" title="Filtrar por processado">
            <option value="all">Todos</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-df" className="block text-xs font-medium text-gray-700 mb-1">Data inicial</label>
          <input id="f-df" type="date" name="df" defaultValue={df} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" title="Data inicial" />
        </div>
        <div>
          <label htmlFor="f-dt" className="block text-xs font-medium text-gray-700 mb-1">Data final</label>
          <input id="f-dt" type="date" name="dt" defaultValue={dt} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" title="Data final" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="flex-1 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">Filtrar</button>
          <a href="/vendas-online" className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Limpar</a>
        </div>
      </form>

      {/* Desktop: Tabela */}
      <div className="hidden lg:block bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Pedido</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Pagamento</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Plataforma</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Processado</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.rows.map((r:any)=>{
              const k = String(r.id)
              const its = data.itens[k] || []
              const isProcessed = !!r.processed_at
              const statusPay = r.status_pagamento || ''
              const statusOrder = r.status_pedido || ''
              return (
                <tr key={r.id} className={`${getRowColor(statusOrder, statusPay)} transition-colors hover:bg-opacity-80`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">#{r.numero || r.order_id}</div>
                    <div className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]" title={r.cliente_nome || ''}>{r.cliente_nome || '—'}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={r.cliente_email || ''}>{r.cliente_email || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(statusPay)}`}>
                      {traduzirStatus(statusPay)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold text-gray-900">
                      {r.total != null ? Number(r.total).toLocaleString('pt-BR',{style:'currency',currency: (r.currency || 'BRL')}) : '—'}
                    </div>
                    <div className="text-xs text-gray-500">{its.length} {its.length === 1 ? 'item' : 'itens'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center justify-center">{getPlataformaIcon(r.plataforma)}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${isProcessed? 'bg-emerald-100 text-emerald-800':'bg-gray-100 text-gray-600'}`}>
                      {isProcessed? 'Sim':'Não'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => { const p = getOrderStatusPill(statusOrder); return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.cls}`}>{p.label}</span>
                    )})()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openModal(r, its)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                      title="Ver detalhes"
                    >
                      <ReceiptIcon />
                    </button>
                  </td>
                </tr>
              )})}
            {data.rows.length===0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Nenhum pedido encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet: Cards */}
      <div className="lg:hidden space-y-3">
        {data.rows.map((r:any)=>{
          const k = String(r.id)
          const its = data.itens[k] || []
          const isProcessed = !!r.processed_at
          const statusPay = r.status_pagamento || ''
          const statusOrder = r.status_pedido || ''
          return (
            <div key={r.id} className={`${getRowColor(statusOrder, statusPay)} border rounded-lg p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-lg text-gray-900">#{r.numero || r.order_id}</div>
                  <div className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {getPlataformaIcon(r.plataforma)}
                </div>
              </div>
              
              <div className="space-y-2 mb-3">
                <div>
                  <div className="text-xs text-gray-500">Cliente</div>
                  <div className="font-medium text-gray-900">{r.cliente_nome || '—'}</div>
                  <div className="text-sm text-gray-600">{r.cliente_email || '—'}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Pagamento</div>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(statusPay)} mt-1`}>
                      {traduzirStatus(statusPay)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="font-bold text-gray-900">
                      {r.total != null ? Number(r.total).toLocaleString('pt-BR',{style:'currency',currency: (r.currency || 'BRL')}) : '—'}
                    </div>
                    <div className="text-xs text-gray-500">{its.length} {its.length === 1 ? 'item' : 'itens'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  {(() => { const p = getOrderStatusPill(statusOrder); return (
                    <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.cls}`}>{p.label}</span>
                  )})()}
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-gray-600">
                    Processado: <span className={`font-medium ${isProcessed? 'text-emerald-700':'text-gray-600'}`}>{isProcessed? 'Sim':'Não'}</span>
                  </div>
                  <button
                    onClick={() => openModal(r, its)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                  >
                    <ReceiptIcon />
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          )})}
        {data.rows.length===0 && (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">Nenhum pedido encontrado</div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Detalhes do Pedido #{modalData.pedido.numero || modalData.pedido.order_id}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-full transition-colors" title="Fechar">
                <CloseIcon />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informações do Pedido */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Informações do Pedido</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Número:</span>
                      <div className="font-semibold text-gray-900">#{modalData.pedido.numero || modalData.pedido.order_id}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Data:</span>
                      <div className="text-sm text-gray-800">{modalData.pedido.created_at ? new Date(modalData.pedido.created_at).toLocaleString('pt-BR') : '—'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Status:</span>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(modalData.pedido.status_pagamento)} mt-1`}>
                        {traduzirStatus(modalData.pedido.status_pagamento)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Plataforma:</span>
                      <div className="flex items-center gap-2 mt-1">
                        {getPlataformaIcon(modalData.pedido.plataforma)}
                        <span className="text-sm text-gray-800 capitalize">{modalData.pedido.plataforma}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Cliente</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Nome:</span>
                      <div className="font-medium text-gray-900">{modalData.pedido.cliente_nome || '—'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Email:</span>
                      <div className="text-sm text-gray-800">{modalData.pedido.cliente_email || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endereço de Entrega */}
              {(() => {
                const shipping = modalData.pedido.shipping || null
                const sh = shipping || {}
                const shName = sh?.name || sh?.receiver || ''
                const shLine = [sh?.address, sh?.number, sh?.floor, sh?.apartment, sh?.additional_info].filter(Boolean).join(', ')
                const shCity = [sh?.city, sh?.province, sh?.state].filter(Boolean).join(' / ')
                const shZip = [sh?.zip, sh?.zipcode, sh?.postal_code].filter(Boolean).join(' ')
                return (shName || shLine || shCity) ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Endereço de Entrega</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                      <div className="font-medium text-gray-900">{shName || '—'}</div>
                      <div className="text-sm text-gray-700">{shLine || '—'}</div>
                      <div className="text-sm text-gray-700">{shCity || '—'} {shZip ? `· ${shZip}`:''}</div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Itens do Pedido */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Itens do Pedido ({modalData.itens.length})</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-700">Produto</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-700">SKU / GTIN</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-gray-700">Qtd</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700">Preço Unit.</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-700">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {modalData.itens.map((it: any) => (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{it.produto_nome || 'Item'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-600">
                              <div>SKU: {it.sku || '—'}</div>
                              <div>GTIN: {it.gtin || '—'}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-medium text-gray-900">{it.quantidade}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-gray-900">{Number(it.preco||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-gray-900">
                              {(Number(it.preco||0) * Number(it.quantidade||0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">Total do Pedido:</td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-gray-900">
                          {modalData.pedido.total != null ? Number(modalData.pedido.total).toLocaleString('pt-BR',{style:'currency',currency: (modalData.pedido.currency || 'BRL')}) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-sm text-gray-600">
          Página {page} de {totalPages} · {data.total} pedido{data.total !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <a 
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${page<=1?'opacity-50 pointer-events-none bg-gray-100 text-gray-400':'bg-white text-gray-700 hover:bg-gray-50'}`} 
            href={makeQuery({ pg: String(page-1) })}
          >
            ← Anterior
          </a>
          <a 
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${page>=totalPages?'opacity-50 pointer-events-none bg-gray-100 text-gray-400':'bg-white text-gray-700 hover:bg-gray-50'}`} 
            href={makeQuery({ pg: String(page+1) })}
          >
            Próxima →
          </a>
        </div>
      </div>
    </div>
  )
}
