'use client'

import { PencilIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { PlatformIcons } from './PlatformIcons'

interface Produto {
  codigo_interno: number
  codigo_gtin: string
  descricao: string
  ns?: string | null
  ml?: boolean | number | string | null
  preco_venda?: number
  qtde?: number
  unidade?: string
  selected?: boolean
}

interface ProductCardProps {
  produto: Produto
  isSelected: boolean
  onSelectionChange: (codigoInterno: number) => void
}

export function ProductCard({
  produto,
  isSelected,
  onSelectionChange,
}: ProductCardProps) {
  const nsTag = (produto.ns || '').toString().toUpperCase()
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 space-y-3 min-w-[280px] max-w-[300px]">
      {/* Header com checkbox e ações */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelectionChange(produto.codigo_interno)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-xs text-gray-500 font-medium">E-commerce</span>
        </label>
        
        <Link
          href={`/cadastros/produtos/${produto.codigo_interno}/editar`}
          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors duration-200"
          title="Editar produto"
        >
          <PencilIcon className="w-4 h-4" />
        </Link>
      </div>

      {/* Código do produto */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 font-medium">Código</div>
        <div className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">
          {produto.codigo_gtin}
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 font-medium">Descrição</div>
        <div className="text-sm text-gray-900 font-medium leading-5 line-clamp-2">
          {produto.descricao || 'Sem descrição'}
        </div>
      </div>

      {/* Informações adicionais */}
      {(produto.preco_venda !== undefined || produto.qtde !== undefined) && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          {produto.preco_venda !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">Preço</div>
              <div className="text-sm font-semibold text-green-600">
                R$ {produto.preco_venda.toFixed(2)}
              </div>
            </div>
          )}
          
          {produto.qtde !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">Estoque</div>
              <div className={`text-sm font-semibold ${
                produto.qtde > 0 ? 'text-green-600' : 
                produto.qtde === 0 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {produto.qtde} {produto.unidade || 'UN'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plataformas */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">Plataformas</div>
          <PlatformIcons ns={produto.ns || ''} ml={produto.ml ?? ''} />
        </div>
        
        {/* Indicador de status */}
        <div
          className={`w-3 h-3 rounded-full ${
            nsTag === 'ENSP' ? 'bg-green-400' :
            nsTag === 'ENSV' ? 'bg-yellow-400' :
            nsTag === 'ENS' ? 'bg-blue-400' :
            'bg-gray-300'
          }`}
          title={nsTag ? `NS: ${nsTag}` : 'Local'}
        ></div>
      </div>
    </div>
  )
}