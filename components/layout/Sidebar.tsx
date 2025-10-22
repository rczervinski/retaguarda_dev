'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import {
  HomeIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  UsersIcon,
  TagIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  DocumentIcon,
  ShoppingCartIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  {
    name: 'CADASTROS',
    icon: CubeIcon,
    children: [
      { name: 'Clientes', href: '/cadastros/clientes' },
      { name: 'Produtos', href: '/cadastros/produtos' },
      { name: 'Fornecedores', href: '/cadastros/fornecedores' },
      { name: 'Transportadoras', href: '/cadastros/transportadoras' },
      { name: 'Vendedores', href: '/cadastros/vendedores' },
      { name: 'Usuários', href: '/cadastros/usuarios' },
      { name: 'Promoções', href: '/cadastros/promocoes' },
    ],
  },
  {
    name: 'FINANCEIRO',
    icon: CurrencyDollarIcon,
    children: [
      { name: 'Contas a Receber', href: '/financeiro/contas-receber' },
      { name: 'Contas a Pagar', href: '/financeiro/contas-pagar' },
    ],
  },
  {
    name: 'RELATÓRIOS',
    icon: DocumentTextIcon,
    children: [
      { name: 'Listagem de Produtos', href: '/relatorios/produtos' },
      { name: 'Produtos no E-commerce', href: '/relatorios/ecommerce' },
    ],
  },
  { name: 'NFE', href: '/nfe', icon: DocumentIcon },
  { name: 'ORÇAMENTO', href: '/orcamento', icon: DocumentTextIcon },
  { name: 'VENDAS ONLINE', href: '/vendas-online', icon: ShoppingCartIcon },
  {
    name: 'AUXILIARES',
    icon: WrenchScrewdriverIcon,
    children: [
      { name: 'Extrator de Imagem PDF', href: '/auxiliares/extrator-pdf' },
    ],
  },
  {
    name: 'INTEGRAÇÕES',
    icon: CogIcon,
    children: [
          { name: 'Nuvemshop', href: '/integracoes/nuvemshop', children: [
            { name: 'Painel', href: '/integracoes/nuvemshop/painel' }
          ] },
      { name: 'MercadoLivre', href: '/integracoes/mercadolivre' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, close } = useSidebar()
  const [expandedItems, setExpandedItems] = useState<string[]>(['CADASTROS'])

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  // Fechar sidebar ao clicar em um link no mobile
  const handleLinkClick = () => {
    close()
  }

  // Fechar sidebar quando pressionar Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-0
        flex flex-col w-64 bg-white shadow-lg lg:shadow-sm border-r border-gray-200
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">GUTTY</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3 text-gray-500" />
                    {item.name}
                  </div>
                  {expandedItems.includes(item.name) ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                </button>
                {expandedItems.includes(item.name) && (
                  <div className="mt-2 ml-6 space-y-1">
                    {item.children.map((child) => {
                      if (child.children) {
                        const nestedOpen = expandedItems.includes(child.name);
                        return (
                          <div key={child.name}>
                            <button
                              onClick={() => toggleExpanded(child.name)}
                              className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                            >
                              <span>{child.name}</span>
                              {nestedOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                            </button>
                            {nestedOpen && (
                              <div className="mt-1 ml-4 space-y-1">
                                {child.children.map(grand => (
                                  <Link
                                    key={grand.name}
                                    href={grand.href}
                                    onClick={handleLinkClick}
                                    className={`block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-200 ${pathname === grand.href ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                                  >
                                    {grand.name}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={handleLinkClick}
                          className={`block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors duration-200 ${pathname === child.href ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={item.href}
                onClick={handleLinkClick}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5 mr-3 text-gray-500" />
                {item.name}
              </Link>
            )}
          </div>
        ))}
      </nav>
      </div>
    </>
  )
}
