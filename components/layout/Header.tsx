'use client'

import { BellIcon, UserCircleIcon, Bars3Icon, XMarkIcon, CloudArrowUpIcon, TrashIcon, ExclamationTriangleIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import { useEffect, useState } from 'react'
import { OPEN_MODAL_EVENT, STORAGE_KEY, readQueueFromStorage, removeItemFromQueue, clearQueue } from '@/components/ui/ExportQueue'
import { useToast } from '@/components/ui/Toast'

export function Header() {
  const router = useRouter()
  const { isOpen, toggle } = useSidebar()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [queue, setQueue] = useState(readQueueFromStorage())
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Array<{ codigo: string; nome: string; diffs: number; signature: string }>>([])
  const [unseenCount, setUnseenCount] = useState(0)
  const [tenantLabel, setTenantLabel] = useState<string>('')
  const [showDebug, setShowDebug] = useState<boolean>(false)

  const NOTIF_STORAGE_KEY = 'ns_notifications_seen'

  function loadSeenMap(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '{}') || {}; } catch { return {}; }
  }
  function writeSeenMap(map: Record<string, number>) {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(map))
    // disparar evento de storage manual para mesma aba
    window.dispatchEvent(new StorageEvent('storage', { key: NOTIF_STORAGE_KEY, newValue: JSON.stringify(map) } as any))
  }

  async function fetchNotifications() {
    try {
      const resp = await fetch('/api/nuvemshop/divergencias', { cache: 'no-store' })
      const json = await resp.json()
      if (!json?.success || !Array.isArray(json?.data)) {
        setNotifications([]); setUnseenCount(0); return
      }
      const itens: Array<{ codigo: string; diffs: number; needs_update?: boolean; campos: string[] }> = json.data.map((r:any)=>({
        codigo: String(r.codigo_interno),
        diffs: Array.isArray(r.diffs)? r.diffs.length : (typeof r.divergencias==='number'? r.divergencias: 0),
        needs_update: !!r.needs_update,
        campos: Array.isArray(r.diffs)? r.diffs.map((d:any)=>d?.campo).filter(Boolean) : []
      })).filter((i: { diffs: number; needs_update?: boolean }) => (i.diffs>0) || i.needs_update)

      const codes = itens.map(i=>i.codigo)
      let nomesMap: Record<string,string> = {}
      if (codes.length) {
        const nomesResp = await fetch('/api/nuvemshop/dashboard/produtos-nomes', {
          method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ codigos: codes })
        })
        const nomesJson = await nomesResp.json().catch(()=>({success:false}))
        if (nomesJson?.success && nomesJson?.nomes) nomesMap = nomesJson.nomes
      }
      // signature baseada no conjunto de campos + quantidade
      const list = itens.map(i=>{
        const camposOrdenados = i.campos.slice().sort().join(',')
        const signature = `${i.codigo}|${i.diffs}|${camposOrdenados}`
        return { codigo: i.codigo, nome: nomesMap[i.codigo] || `#${i.codigo}`, diffs: i.diffs, signature }
      })
      setNotifications(list)
      const seen = loadSeenMap()
      const unseen = list.filter(n => !seen[n.signature])
      setUnseenCount(unseen.length)
    } catch {
      setNotifications([])
      setUnseenCount(0)
    }
  }

  useEffect(() => {
    // debug toggle via localStorage
    try { setShowDebug(localStorage.getItem('debug_ui') === '1') } catch {}
    // tentar buscar tenant atual via endpoint simples
    fetch('/api/debug/whoami', { cache: 'no-store' }).then(r=>r.json()).then(j=>{
      // Se existir um header injetado pelo middleware na resposta ou corpo com tid/cnpj, ajuste aqui.
      // Como fallback, mostre apenas "Autenticado".
      if (j && (j.tenant || j.cnpj)) {
        const t = j.tenant || ''
        const c = j.cnpj || ''
        setTenantLabel([t, c].filter(Boolean).join(' • '))
      } else {
        setTenantLabel('Autenticado')
      }
    }).catch(()=>{})
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setQueue(readQueueFromStorage())
      if (e.key === NOTIF_STORAGE_KEY) {
        // recalc unseen count quickly without refetch
        const seen = loadSeenMap()
        setUnseenCount(prev => {
          if (!notifications.length) return 0
          return notifications.filter(n => !seen[n.signature]).length
        })
      }
    }
    const onOpen = () => setModalOpen(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener(OPEN_MODAL_EVENT, onOpen as any)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(OPEN_MODAL_EVENT, onOpen as any)
    }
  }, [])

  // carregar notificações no mount e a cada 5 minutos
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 1800000) // 30 minutos ao invés de 5
    return () => clearInterval(id)
  }, [])

  const removeItem = (codigo_interno: number, destino: 'Nuvemshop'|'Mercado Livre', descricao: string) => {
    removeItemFromQueue(codigo_interno, destino)
    setQueue(readQueueFromStorage())
    showToast(`Removeu o produto "${descricao}" da fila`, 'info')
  }

  const clearAll = () => {
    clearQueue()
    setQueue([])
    showToast('Fila de exportação limpa', 'info')
  }

  const markAsRead = (signature: string) => {
    const seen = loadSeenMap()
    seen[signature] = Date.now()
    writeSeenMap(seen)
    setUnseenCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    const seen = loadSeenMap()
    const now = Date.now()
    notifications.forEach(n => { seen[n.signature] = now })
    writeSeenMap(seen)
    setUnseenCount(0)
  }

  return (
    <>
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-4 lg:px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Menu Hambúrguer - Visível apenas no mobile/tablet */}
          <button
            onClick={toggle}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 lg:hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>

          {/* Logo/Título responsivo */}
          <div className="flex items-center">
            <h1 className="text-lg lg:text-xl font-bold text-blue-600 lg:hidden">
              GUTTY
            </h1>
            <h2 className="hidden lg:block text-lg font-semibold text-gray-900">
              Sistema de gestão
            </h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Export queue button */}
          <button onClick={() => setModalOpen(true)} className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200">
            <CloudArrowUpIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">{queue.length}</span>
            )}
          </button>
          {/* Notifications */}
          <button onClick={() => setNotifOpen(v=>!v)} className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors duration-200" aria-label="Avisos" title="Avisos">
            <BellIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] bg-amber-600 text-white rounded-full px-1.5 py-0.5">{unseenCount}</span>
            )}
          </button>
          
          {/* User Menu + Logout */}
          <div className="flex items-center">
            <button className="flex items-center space-x-2 p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200">
              <UserCircleIcon className="w-6 h-6 lg:w-8 lg:h-8" />
              <span className="hidden sm:block text-sm font-medium">Usuário</span>
            </button>
            {tenantLabel && (
              <span className="ml-2 hidden md:inline text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                {tenantLabel}
              </span>
            )}
            <button
              className="ml-1 p-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors duration-200"
              title="Sair"
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST' })
                } finally {
                  router.replace('/login')
                }
              }}
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
  </header>
  {/* Notifications Dropdown */}
    {notifOpen && (
      <div className="fixed inset-0 z-40" aria-labelledby="menu-de-notificacoes" role="dialog" aria-modal="true">
        <div className="absolute inset-0" onClick={() => setNotifOpen(false)}></div>
        <div className="absolute right-4 top-16 w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <h3 id="menu-de-notificacoes" className="text-sm font-semibold text-gray-900 flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-amber-600"/> Avisos</h3>
            </div>
            <button onClick={markAllAsRead} className="text-xs text-gray-600 hover:text-gray-900">Marcar todas como lidas</button>
          </div>
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Sem avisos no momento</div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => (
                  <li key={n.signature} className="px-4 py-3 text-sm flex items-center justify-between">
                    <div className="pr-3">
                      <div className="font-medium text-gray-900 line-clamp-1">{n.nome}</div>
                      <div className="text-xs text-gray-500">Código {n.codigo} • {n.diffs} divergência(s)</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`/integracoes/nuvemshop/painel?codigo=${n.codigo}`} className="text-xs text-blue-600 hover:text-blue-700">Ver</a>
                      <button onClick={() => markAsRead(n.signature)} className="text-xs text-gray-600 hover:text-amber-700">Marcar lida</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-3 border-t text-right">
            <button onClick={() => { setNotifOpen(false); }} className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Fechar</button>
          </div>
        </div>
      </div>
    )}
  {/* Export Queue Modal */}
    {modalOpen && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)}></div>
        <div className="absolute right-4 top-16 w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Fila de exportação</h3>
              <p className="text-xs text-gray-500">E-commerces ativos: Nuvemshop</p>
            </div>
            <button onClick={clearAll} className="inline-flex items-center text-xs text-gray-600 hover:text-red-600">
              <TrashIcon className="w-4 h-4 mr-1" /> Limpar fila
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {queue.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Nenhum produto na fila</div>
            ) : (
              <ul className="divide-y">
                {queue.map((it) => (
                  <li key={`${it.codigo_interno}-${it.destino}`} className="px-4 py-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 line-clamp-1">{it.descricao}</div>
                      <div className="text-xs text-gray-500">Código {it.codigo_interno} • {it.destino}</div>
                    </div>
                    <button onClick={() => removeItem(it.codigo_interno, it.destino as any, it.descricao)} className="text-xs text-gray-600 hover:text-red-600">Remover</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-3 border-t text-right">
            <button onClick={() => setModalOpen(false)} className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Fechar</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
