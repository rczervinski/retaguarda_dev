'use client'

import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Column {
  key: string
  label: string | React.ReactNode
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  data: any[]
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (row: any) => void
  loading?: boolean
  emptyMessage?: string
  onSearch?: (term: string) => void
  onSort?: (field: string) => void
  externalSearch?: boolean
  currentSort?: { field: string; direction: 'ASC' | 'DESC' }
  mobileCardComponent?: React.ComponentType<any>
  enableMobileCards?: boolean
}

export function DataTable({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Pesquisar...',
  onRowClick,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado',
  onSearch,
  onSort,
  externalSearch = false,
  currentSort,
  mobileCardComponent: MobileCard,
  enableMobileCards = false
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  // Use external search if provided, otherwise filter locally
  const filteredData = externalSearch ? data : data.filter(row =>
    columns.some(column => {
      const value = row[column.key]
      return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    })
  )

  // Sort data (only if not using external sorting)
  const sortedData = externalSearch ? filteredData : [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1
    }
    return 0
  })

  const handleSort = (key: string) => {
    if (externalSearch && onSort) {
      onSort(key)
    } else {
      let direction: 'asc' | 'desc' = 'asc'
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc'
      }
      setSortConfig({ key, direction })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (externalSearch && onSearch) {
      onSearch(value)
    }
  }

  const getSortIcon = (columnKey: string) => {
    if (externalSearch && currentSort) {
      if (currentSort.field !== columnKey) return null
      return currentSort.direction === 'ASC' ? (
        <ChevronUpIcon className="w-4 h-4" />
      ) : (
        <ChevronDownIcon className="w-4 h-4" />
      )
    }
    
    if (!sortConfig || sortConfig.key !== columnKey) {
      return null
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      {searchable && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
          />
        </div>
      )}

      {/* Mobile Cards View */}
      {enableMobileCards && MobileCard && (
        <div className="block lg:hidden">
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
                <span className="text-sm text-gray-500 font-medium">Carregando produtos...</span>
              </div>
            ) : sortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <MagnifyingGlassIcon className="w-6 h-6 text-gray-400" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-gray-900">Nenhum produto encontrado</p>
                  <p className="text-xs text-gray-500">Tente ajustar seus filtros ou termos de busca</p>
                </div>
              </div>
            ) : (
              <div className="flex space-x-4 overflow-x-auto pb-4 px-1 custom-scrollbar">
                {sortedData.map((row, index) => (
                  <MobileCard key={index} {...row} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Table Container with Fixed Height and Scroll */}
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${enableMobileCards ? 'hidden lg:block' : ''}`}>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100 transition-colors duration-150' : ''
                    }`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <div className="ml-2 flex-shrink-0">
                          {getSortIcon(column.key)}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
                      <span className="text-sm text-gray-500 font-medium">Carregando produtos...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <MagnifyingGlassIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">Nenhum produto encontrado</p>
                        <p className="text-xs text-gray-500">Tente ajustar seus filtros ou termos de busca</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((row, index) => (
                  <tr
                    key={index}
                    className={`transition-colors duration-150 ${
                      onRowClick ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {column.render
                          ? column.render(row[column.key], row)
                          : row[column.key]
                        }
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Mostrando {sortedData.length} de {data.length} registros
          </span>
          {searchTerm && (
            <span>
              Filtrado por: "{searchTerm}"
            </span>
          )}
        </div>
      )}
    </div>
  )
}
