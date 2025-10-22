'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ProductEditForm } from '@/components/forms/ProductEditForm'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { ProdutoCompleto } from '@/types/produto'

export default function NovoProdutoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleSave = async (produtoData: Partial<ProdutoCompleto>) => {
    try {
      const response = await fetch('/api/produtos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(produtoData),
      })

      // Verificar se a resposta tem conteúdo antes de tentar fazer .json()
      const contentType = response.headers.get('content-type')
      let responseData = null
      
      if (contentType && contentType.includes('application/json')) {
        try {
          responseData = await response.json()
        } catch (jsonError) {
          console.error('Erro ao fazer parse do JSON:', jsonError)
          throw new Error('Resposta inválida do servidor')
        }
      }

      if (response.ok) {
        const willSell = (produtoData as any)?.vender_ecommerce === true
        if (willSell) {
          showToast('Produto criado. Para exportar, abra o produto e escolha Exportar ou Adicionar à fila.', 'info')
        } else {
          showToast('Produto criado com sucesso!', 'success')
        }
        router.push('/cadastros/produtos')
      } else {
        // Tratar diferentes tipos de erro
        if (response.status === 404) {
          setError('Endpoint não encontrado. Verifique se a API está configurada corretamente.')
        } else if (response.status === 405) {
          setError('Método não permitido. A API não suporta criação de produtos.')
        } else if (responseData?.error) {
          setError(responseData.error)
        } else {
          setError(`Erro do servidor (${response.status}): ${response.statusText}`)
        }
      }
    } catch (error) {
      console.error('Erro ao criar produto:', error)
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError('Erro de conectividade. Verifique sua conexão.')
      } else if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Erro ao criar produto')
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
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
                Novo Produto
              </h1>
              <p className="text-gray-600">
                Cadastre um novo produto no sistema
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
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
            )}

            {/* Form */}
            <ProductEditForm
              produto={null}
              onSave={handleSave}
              onCancel={() => router.push('/cadastros/produtos')}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
