'use client'

import { useState, useEffect } from 'react'
import { addItemsToQueue } from '@/components/ui/ExportQueue'
import { useRouter, useParams } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ProductEditForm } from '@/components/forms/ProductEditForm'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { ProdutoCompleto } from '@/types/produto'
import { useToast } from '@/components/ui/Toast'

export default function EditarProdutoPage() {
  const router = useRouter()
  const params = useParams()
  const codigo = params.codigo as string
  
  const [produto, setProduto] = useState<ProdutoCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decisionCodigo, setDecisionCodigo] = useState<string | null>(null)
  const [decisionBusy, setDecisionBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const { showToast, toasts } = useToast()
  const [promptOpen, setPromptOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<Partial<ProdutoCompleto> | null>(null)

  useEffect(() => {
    if (codigo) {
      fetchProduto()
    }
  }, [codigo])

  const fetchProduto = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/produtos/${codigo}`)
      
      if (response.ok) {
        const result = await response.json()
        console.log('📡 [DEBUG] Resposta da API:', result)
        
        // A API retorna { success: true, data: { produto } }
        if (result.success && result.data) {
          console.log('📦 [DEBUG] Dados do produto:', result.data)
          let loaded: ProdutoCompleto = result.data
          // Default checkbox baseado em NS: ENS/ENSP/ENSV -> true
          const nsTag = ((loaded as any).ns || '').toString().toUpperCase()
          const hasNS = nsTag === 'ENS' || nsTag === 'ENSP' || nsTag === 'ENSV'
          if (hasNS && (loaded as any).vender_ecommerce !== true) {
            loaded = { ...loaded, vender_ecommerce: true }
          }
          setProduto(loaded)
        } else {
          console.error('❌ [DEBUG] Formato inválido:', result)
          setError('Formato de resposta inválido')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Erro ao carregar produto')
      }
    } catch (error) {
      console.error('Erro ao carregar produto:', error)
      setError('Erro ao carregar produto')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (produtoData: Partial<ProdutoCompleto>) => {
    // Se a checkbox "vender_ecommerce" estiver marcada, perguntar ação antes de salvar
    const willSell = produtoData.vender_ecommerce === true || (produtoData.vender_ecommerce === undefined && produto?.vender_ecommerce === true)
    if (willSell) {
      setPendingSave(produtoData)
      setPromptOpen(true)
      return
    }
    // Caso não venda no e-commerce, apenas salvar
    await doSaveOnly(produtoData)
  }

  const doSaveOnly = async (produtoData: Partial<ProdutoCompleto>) => {
    try {
      const response = await fetch(`/api/produtos/${codigo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(produtoData),
      })
      if (response.ok) {
        await fetchProduto()
        setError(null)
        setFlash('Produto salvo')
        setTimeout(() => setFlash(null), 3000)
        // Recalcula divergências para marcar needs_update (painel Nuvemshop)
        try { await fetch('/api/nuvemshop/divergencias', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ codigo_interno: String(codigo) }) }) } catch {}
      } else {
        const errorData = await response.json()
        const msg = errorData.error || 'Erro ao salvar produto'
        setError(msg)
        showToast(msg, 'error')
      }
    } catch (e) {
      console.error('Erro ao salvar produto:', e)
      setError('Erro ao salvar produto')
      showToast('Erro ao salvar produto', 'error')
    }
  }

  const doPending = async () => {
    try {
      setDecisionBusy(true)
      // Salvar alterações primeiro
      if (pendingSave) await doSaveOnly(pendingSave)
      // Enfileirar
      const r = await fetch('/api/nuvemshop/pending', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ codigo_interno: String(codigo) }) })
      if (!r.ok) throw new Error(await r.text())
      if (produto) {
        addItemsToQueue([{ codigo_interno: Number(produto.codigo_interno as any), descricao: produto.descricao, destino: 'Nuvemshop' }])
      }
      showToast('Adicionado à fila de exportação. Este produto ainda não está vinculado à Nuvemshop até exportar.', 'info')
      setPromptOpen(false)
    } catch (e) {
      setError('Falha ao adicionar à fila')
    } finally {
      setDecisionBusy(false)
      setPendingSave(null)
    }
  }

  const doResync = async () => {
    try {
      setDecisionBusy(true)
      // Salvar alterações primeiro
      if (pendingSave) await doSaveOnly(pendingSave)
      // Exportar apenas este produto
      const r = await fetch('/api/nuvemshop/resync', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ codigo_interno: String(codigo) }) })
      const data = await r.json().catch(()=>({}))
      if (!r.ok) {
        showToast('Falha ao exportar agora', 'error')
        return
      }
      // A API retorna 200 sempre, com array data[] contendo ok:true/false e erros por item
      if (data && Array.isArray(data.data)) {
        const itens = data.data
        const mapMsg = (f: string, backend?: string) => {
          const ff = (f||'').toLowerCase()
          if (ff === 'descricao') return 'Descrição obrigatória'
          if (ff === 'preco_venda') return 'Preço de venda deve ser maior que zero'
          if (ff === 'quantidade') return 'Estoque tem que ser maior ou igual a zero'
          return backend || 'Campo inválido'
        }
        let algumErro = false
        for (const item of itens) {
          if (item?.ok === false) {
            algumErro = true
            if (item.error === 'validacao' && Array.isArray(item.issues)) {
              const msgs = Array.from(new Set(item.issues.map((iss:any)=>mapMsg(iss?.field, iss?.message)).filter(Boolean)))
              showToast(`Produto ${codigo}: ${msgs.join(' • ')}`, 'error')
            } else if (item.error === 'limite_categorias') {
              showToast(`Produto ${codigo}: Limite de categorias excedido na Nuvemshop (1000).`, 'error')
            } else {
              showToast(`Produto ${codigo}: ${item.error || 'Erro na exportação'}`, 'error')
            }
          }
        }
        if (!algumErro) {
          showToast('Exportação iniciada para Nuvemshop', 'success')
        }
      } else {
        showToast('Exportação iniciada para Nuvemshop', 'success')
      }
      setPromptOpen(false)
    } catch (e) {
      setError('Falha ao exportar agora')
      showToast('Falha ao exportar agora', 'error')
    } finally {
      setDecisionBusy(false)
      setPendingSave(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Erro
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {flash && (
              <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-800 text-sm">{flash}</div>
            )}
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Link
                  href="/cadastros/produtos"
                  className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftIcon className="w-5 h-5 mr-1" />
                  Voltar para produtos
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Editar Produto - {produto?.codigo_interno}
              </h1>
              <p className="text-gray-600">
                {produto?.descricao || 'Produto sem descrição'}
              </p>
            </div>

            {/* Form */}
            {produto && (
              <div className="space-y-8">
                {/* Formulário Principal */}
                <ProductEditForm
                  produto={produto}
                  onSave={handleSave}
                  onCancel={() => router.push('/cadastros/produtos')}
                />
              </div>
            )}
            
            {!produto && !loading && !error && (
              <div className="text-center text-gray-500">
                Nenhum produto carregado
              </div>
            )}
          </div>
        </main>
      </div>
    </div>

    {/* Action prompt (toast-like) for export choice */}
    {promptOpen && (
      <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold text-gray-900">Este produto será exportado para:</div>
            <div className="text-xs text-gray-600 mt-1">• Nuvemshop</div>
          </div>
          <div className="p-3 space-y-2">
            <button disabled={decisionBusy} onClick={doResync} className="w-full inline-flex justify-center items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm">Atualizar e exportar</button>
            <button disabled={decisionBusy} onClick={doPending} className="w-full inline-flex justify-center items-center px-3 py-2 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 text-sm">Atualizar e adicionar na fila</button>
            <button disabled={decisionBusy} onClick={async ()=>{ if(pendingSave) await doSaveOnly(pendingSave); setPromptOpen(false); setPendingSave(null); }} className="w-full inline-flex justify-center items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm">Somente atualizar</button>
            <div className="text-[11px] text-gray-500">Ao adicionar na fila, o produto pode não estar vinculado na Nuvemshop até ser exportado.</div>
          </div>
        </div>
        {toasts}
      </div>
    )}
    </>
  )
}