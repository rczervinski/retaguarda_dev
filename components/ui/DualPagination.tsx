'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface DualPaginationProps {
  currentPage: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  showPages?: number
  compact?: boolean
  showInfo?: boolean
  mobileHidden?: boolean
}

export function DualPagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  showPages = 5,
  compact = false,
  showInfo = true,
  mobileHidden = false
}: DualPaginationProps) {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2))
    let endPage = Math.min(totalPages, startPage + showPages - 1)

    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1)
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
  }

  const visiblePages = getVisiblePages()
  
  const startItem = (currentPage - 1) * limit + 1
  const endItem = Math.min(currentPage * limit, total)

  return (
    <div className={`flex items-center justify-between ${compact ? 'py-2' : 'py-4'} ${mobileHidden ? 'hidden lg:flex' : ''}`}>
      {/* Informações dos registros */}
      {showInfo && (
        <div className="flex items-center space-x-4">
          <span className="hidden sm:inline text-sm text-gray-600 font-medium">
            {startItem}-{endItem} de {total.toLocaleString()} produtos
          </span>
          {!compact && (
            <span className="text-xs text-gray-500 sm:hidden">
              Página {currentPage}/{totalPages}
            </span>
          )}
        </div>
      )}
      
      {/* Spacer quando não mostrar info */}
      {!showInfo && <div />}

      {/* Navegação */}
      <div className="flex items-center space-x-1">
        {/* Botão Anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500 transition-all duration-200"
          title="Página anterior"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        {/* Primeira página */}
        {visiblePages[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
            >
              1
            </button>
            {visiblePages[0] > 2 && (
              <span className="inline-flex items-center justify-center w-8 h-8 text-sm text-gray-400">
                ⋯
              </span>
            )}
          </>
        )}

        {/* Páginas visíveis */}
        {visiblePages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-lg transition-all duration-200 ${
              page === currentPage
                ? 'text-white bg-blue-600 border border-blue-600 shadow-sm'
                : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {page}
          </button>
        ))}

        {/* Última página */}
        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <span className="inline-flex items-center justify-center w-8 h-8 text-sm text-gray-400">
                ⋯
              </span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Botão Próximo */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500 transition-all duration-200"
          title="Próxima página"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}