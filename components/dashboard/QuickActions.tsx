'use client'

import Link from 'next/link'
import { PlusIcon, ShoppingBagIcon, CloudIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'

const actions = [
  {
    name: 'Novo Produto',
    description: 'Cadastrar um novo produto',
    href: '/cadastros/produtos/novo',
    icon: PlusIcon,
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    name: 'Produtos',
    description: 'Listagem e gerenciamento',
    href: '/cadastros/produtos',
    icon: ShoppingBagIcon,
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    name: 'Painel Nuvemshop',
    description: 'Visão geral do e-commerce',
    href: '/integracoes/nuvemshop/painel',
    icon: CloudIcon,
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    name: 'Vendas Online',
    description: 'Gerenciar vendas do e-commerce',
    href: '/vendas-online',
    icon: ShoppingCartIcon,
    color: 'bg-orange-500 hover:bg-orange-600',
  },
]

export function QuickActions() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
          >
            <div className={`p-3 rounded-full ${action.color} text-white mb-3 group-hover:scale-110 transition-transform duration-200`}>
              <action.icon className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-center mb-1">
              {action.name}
            </h4>
            <p className="text-xs text-gray-500 text-center">
              {action.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
