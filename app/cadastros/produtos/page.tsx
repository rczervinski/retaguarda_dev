'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/ui/DataTable'
import { DualPagination } from '@/components/ui/DualPagination'
import { ProductCard } from '@/components/ui/ProductCard'
import { TableInfo } from '@/components/ui/TableInfo'
import { PlusIcon, PencilIcon, EyeIcon, CloudIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { PlatformIcons } from '@/components/ui/PlatformIcons'
import { addItemsToQueue, readQueueFromStorage, removeItemFromQueue, STORAGE_KEY } from '../../../components/ui/ExportQueue'
import { useToast } from '@/components/ui/Toast'

interface Produto {
  codigo_interno: number
  codigo_gtin: string
  descricao: string
  ns?: string | null
  ml?: boolean | number | string | null
  selected?: boolean
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface ApiResponse {
  data: Produto[]
  pagination: PaginationInfo
  search: string
  orderBy: string
  orderDirection: string
}

const statusLabels: { [key: string]: { label: string; color: string } } = {
  'ENS': { label: 'Nuvemshop', color: 'bg-blue-100 text-blue-800' },
  'ENSVI': { label: 'Vitrine', color: 'bg-green-100 text-green-800' },
  'ENSV': { label: 'Variante', color: 'bg-purple-100 text-purple-800' },
  'E': { label: 'E-commerce', color: 'bg-orange-100 text-orange-800' },
  '': { label: 'Local', color: 'bg-gray-100 text-gray-800' },
}

export default function ProdutosPage() {
  const { showToast, toasts } = useToast()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [queue, setQueue] = useState<{ codigo_interno: number; descricao: string; destino: 'Nuvemshop' | 'Mercado Livre' }[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [orderBy, setOrderBy] = useState('descricao')
  const [orderDirection, setOrderDirection] = useState('ASC')
  // Fila visual é global via ExportQueue no layout; aqui apenas adicionamos itens quando necessário
  // React to global queue changes
  useEffect(() => {
    setQueue(readQueueFromStorage())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setQueue(readQueueFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProdutos()
    }, searchTerm ? 500 : 0) // Debounce search by 500ms

    return () => clearTimeout(timeoutId)
  }, [pagination.page, searchTerm, orderBy, orderDirection])

  const isQueued = useCallback((codigo: number) => {
    return queue.some(q => q.codigo_interno === codigo && q.destino === 'Nuvemshop')
  }, [queue])

  const fetchProdutos = async () => {
    try {
      console.log('🔍 [FRONTEND] Iniciando busca de produtos...')
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        orderBy,
        orderDirection
      })
      
      const response = await fetch(`/api/produtos?${params}`)
      console.log('📡 [FRONTEND] Response status:', response.status)
      console.log('📡 [FRONTEND] Response ok:', response.ok)
      
      if (response.ok) {
        const apiData: ApiResponse = await response.json()
        console.log('📦 [FRONTEND] Dados recebidos:', apiData)
        console.log('📊 [FRONTEND] Quantidade de produtos:', apiData.data.length)
        
  setProdutos(apiData.data)
  setPagination(apiData.pagination)
      } else {
        const errorData = await response.json()
        console.error('❌ [FRONTEND] Erro na API:', errorData)
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleQueueFor = (produto: Produto) => {
    const inQ = isQueued(produto.codigo_interno)
    if (inQ) {
      removeItemFromQueue(produto.codigo_interno, 'Nuvemshop')
      showToast(`Removeu "${produto.descricao}" da fila`, 'info')
    } else {
      addItemsToQueue([{ codigo_interno: produto.codigo_interno, descricao: produto.descricao, destino: 'Nuvemshop' }])
      showToast(`Adicionou "${produto.descricao}" à fila`, 'success')
    }
  }

  const toggleSelectAll = () => {
    // Add all visible to queue if not already; if all are queued, remove all
    const allQueued = produtos.every(p => isQueued(p.codigo_interno))
    if (allQueued) {
      for (const p of produtos) removeItemFromQueue(p.codigo_interno, 'Nuvemshop')
      showToast('Removeu todos os itens visíveis da fila', 'info')
    } else {
      const items = produtos.filter(p => !isQueued(p.codigo_interno)).map(p => ({ codigo_interno: p.codigo_interno, descricao: p.descricao, destino: 'Nuvemshop' as const }))
      if (items.length) addItemsToQueue(items)
      showToast('Adicionou produtos visíveis à fila', 'success')
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleSearch = (search: string) => {
    setSearchTerm(search)
    setPagination(prev => ({ ...prev, page: 1 })) // Voltar para primeira página
  }

  const handleSort = (field: string) => {
    const newDirection = field === orderBy && orderDirection === 'ASC' ? 'DESC' : 'ASC'
    setOrderBy(field)
    setOrderDirection(newDirection)
    setPagination(prev => ({ ...prev, page: 1 })) // Voltar para primeira página
  }

  // Exportar fila (apenas Nuvemshop)
  const exportQueueNow = async () => {
    const itens = queue.filter(q => q.destino === 'Nuvemshop')
    if (itens.length === 0) return

    try {
      setExporting(true)
      const selectedIds = itens.map(i => i.codigo_interno)
      let sucessos = 0
      let erros = 0
      
      showToast(`Iniciando exportação de ${selectedIds.length} produtos da fila...`, 'info')
      
      // Exportar cada produto individualmente
      const mapValidationMessage = (field: string, backendMsg?: string) => {
        const f = (field || '').toLowerCase()
        if (f === 'descricao') return 'Descrição obrigatória'
        if (f === 'preco_venda') return 'Preço de venda deve ser maior que zero'
        if (f === 'quantidade') return 'Estoque tem que ser maior ou igual a zero'
        // fallback para mensagem do backend ou genérica
        return backendMsg || 'Campo inválido'
      }
      for (const codigoInterno of selectedIds) {
        try {
          const response = await fetch('/api/nuvemshop/products/export', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ codigo_interno: codigoInterno })
          })

          const result = await response.json()

          if (response.ok && result.success) {
            sucessos++
            removeItemFromQueue(codigoInterno, 'Nuvemshop')
          } else {
            erros++
            // Mostrar mensagens amigáveis via toast para erros de validação (400)
            if (response.status === 400 && result?.error === 'Falha de validação' && Array.isArray(result?.issues)) {
              const messages: string[] = result.issues.map((iss: any) => mapValidationMessage(iss?.field, iss?.message))
              const uniqueMessages = Array.from(new Set(messages.filter(Boolean)))
              const msg = uniqueMessages.join(' • ')
              showToast(`Produto ${codigoInterno}: ${msg}`, 'error')
            } else {
              // Outros erros (ex.: 422 limite de categorias, 500, etc.)
              const generic = typeof result?.error === 'string' ? result.error : 'Erro na exportação'
              showToast(`Produto ${codigoInterno}: ${generic}`, 'error')
            }
          }
        } catch (error) {
          erros++
          console.error(`Erro ao exportar produto ${codigoInterno}:`, error)
          showToast(`Produto ${codigoInterno}: erro inesperado na exportação`, 'error')
        }
      }
      
      // Mostrar resultado final
      if (sucessos > 0 && erros === 0) {
        showToast(`✅ Todos os ${sucessos} produtos foram exportados com sucesso!`, 'success')
      } else if (sucessos > 0 && erros > 0) {
        showToast(`⚠️ ${sucessos} produtos exportados com sucesso, ${erros} com erro`, 'info')
      } else {
        showToast(`❌ Erro ao exportar todos os produtos (${erros} erros)`, 'error')
      }
      await fetchProdutos()
      
    } catch (error) {
      showToast('Erro ao exportar produtos da fila', 'error')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'ecommerce',
      label: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={produtos.length > 0 && produtos.every(p => isQueued(p.codigo_interno))}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 mr-2"
            aria-label="Selecionar todos os produtos"
          />
          E-commerce
        </div>
      ),
      render: (_: any, row: Produto) => (
        <input
          type="checkbox"
          checked={isQueued(row.codigo_interno)}
          onChange={() => toggleQueueFor(row)}
          className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
          aria-label={`Fila de exportação para ${row.descricao}`}
        />
      )
    },
    {
      key: 'codigo_gtin',
      label: 'Código',
      sortable: true,
    },
    {
      key: 'descricao',
      label: 'Descrição',
      sortable: true,
    },
    {
      key: 'plataformas',
      label: 'Plataformas',
      render: (_: any, row: Produto) => {
  return <PlatformIcons ns={(row as any).ns} ml={(row as any).ml} />
      }
    },
    {
      key: 'actions',
      label: 'Editar',
      render: (_: any, row: Produto) => (
        <Link
          href={`/cadastros/produtos/${row.codigo_interno}/editar`}
          className="text-blue-600 hover:text-blue-800"
          title="Editar produto"
        >
          <PencilIcon className="w-4 h-4" />
        </Link>
      )
    }
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
                <p className="text-gray-600">Gerencie o catálogo de produtos</p>
                {queue.some(q => q.destino==='Nuvemshop') && (
                  <p className="text-sm text-blue-600 mt-1">
                    {queue.filter(q=>q.destino==='Nuvemshop').length} produto{queue.filter(q=>q.destino==='Nuvemshop').length > 1 ? 's' : ''} na fila
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {queue.some(q => q.destino === 'Nuvemshop') && (
                  <button
                    onClick={exportQueueNow}
                    disabled={exporting}
                    className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <div className="animate-spin w-5 h-5 mr-2 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                    ) : (
                      <CloudIcon className="w-5 h-5 mr-2" />
                    )}
                    {exporting ? 'Exportando...' : 'Exportar Fila'}
                  </button>
                )}
                <Link
                  href="/cadastros/produtos/novo"
                  className="btn-primary flex items-center"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Novo Produto
                </Link>
              </div>
            </div>



            {/* Top Pagination - Hidden on mobile */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <DualPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={handlePageChange}
                compact={true}
                showInfo={false}
                mobileHidden={true}
              />
            </div>

            {/* Table */}
            <div>
              <DataTable
                columns={columns}
                data={produtos}
                loading={loading}
                searchPlaceholder="Código exato (números) ou nome parcial (texto)..."
                emptyMessage="Nenhum produto encontrado"
                externalSearch={true}
                onSearch={handleSearch}
                onSort={handleSort}
                currentSort={{ field: orderBy, direction: orderDirection as 'ASC' | 'DESC' }}
                enableMobileCards={true}
                mobileCardComponent={(props) => (
                  <ProductCard
                    produto={props}
                    isSelected={isQueued(props.codigo_interno)}
                    onSelectionChange={() => toggleQueueFor(props)}
                  />
                )}
              />
            </div>

            {/* Table Info */}
            <TableInfo
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              loading={loading}
              selectedCount={queue.filter(q=>q.destino==='Nuvemshop').length}
            />

            {/* Bottom Pagination */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <DualPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={handlePageChange}
                showInfo={false}
              />
            </div>
          </div>
        </main>
      </div>
      {toasts}
    </div>
  )
}
