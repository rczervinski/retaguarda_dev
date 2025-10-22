"use client"

import { useEffect, useState } from 'react'
import { CubeIcon, CurrencyDollarIcon, ShoppingCartIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/outline'

type Stats = {
  produtosTotal: number
  vendasMesTotal: number
  produtosEcom: number
  clientesAtivos: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setErro(null)
        const res = await fetch('/api/dashboard/stats')
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Falha ao carregar estatísticas')
        setStats(json.stats)
      } catch (e: any) {
        setErro(e.message)
      }
    }
    load()
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="card">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <CubeIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.produtosTotal ?? '-'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <CurrencyDollarIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-600">Vendas do Mês</p>
            <p className="text-2xl font-semibold text-gray-900">{(stats?.vendasMesTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <ShoppingCartIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-600">Produtos no E-commerce</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.produtosEcom ?? '-'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
              <button title="Relatório" className="text-primary-600 hover:text-primary-700">
                <ChartBarIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats?.clientesAtivos ?? '-'}</p>
            {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
