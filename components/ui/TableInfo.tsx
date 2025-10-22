'use client'

interface TableInfoProps {
  currentPage: number
  totalPages: number
  total: number
  limit: number
  loading?: boolean
  selectedCount?: number
}

export function TableInfo({
  currentPage,
  totalPages,
  total,
  limit,
  loading = false,
  selectedCount = 0
}: TableInfoProps) {
  if (loading || total === 0) return null

  const startItem = (currentPage - 1) * limit + 1
  const endItem = Math.min(currentPage * limit, total)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        {/* Informações principais */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0">
          <span className="text-sm text-gray-600 font-medium">
            Exibindo <span className="font-semibold text-gray-900">{startItem}-{endItem}</span> de{' '}
            <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> produtos
          </span>
          
          {selectedCount > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Info adicional - Oculta em mobile */}
        <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-500">
          <span>Página {currentPage} de {totalPages}</span>
          <span>•</span>
          <span>{limit} por página</span>
        </div>

        {/* Info compacta para mobile */}
        <div className="flex sm:hidden items-center justify-between text-xs text-gray-500">
          <span>Página {currentPage}/{totalPages}</span>
          <span>{limit}/página</span>
        </div>
      </div>
    </div>
  )
}