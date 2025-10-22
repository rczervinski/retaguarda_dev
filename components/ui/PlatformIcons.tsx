'use client'

import { ComputerDesktopIcon, CloudIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'

interface PlatformIconsProps {
  ns?: string | null
  ml?: boolean | number | string | null
  className?: string
}

export function PlatformIcons({ ns, ml, className = '' }: PlatformIconsProps) {
  const icons: React.ReactNode[] = []

  const nsTag = (ns || '').toString().toUpperCase()
  const hasNS = nsTag === 'ENS' || nsTag === 'ENSP' || nsTag === 'ENSV'
  const mlStr = ml === null || ml === undefined ? '' : String(ml).toLowerCase()
  const hasML = mlStr !== '' && mlStr !== '0' && mlStr !== 'false' && mlStr !== 'no' && mlStr !== 'null'

  // Local (sem plataformas)
  if (!hasNS && !hasML) {
    icons.push(
      <ComputerDesktopIcon key="local" className="w-5 h-5 text-gray-600" title="Produto Local" />
    )
  }

  // Nuvemshop: cor por tag
  if (hasNS) {
    const color = nsTag === 'ENSP' ? 'text-green-500' : nsTag === 'ENSV' ? 'text-yellow-500' : 'text-blue-500'
    const title = nsTag === 'ENSP' ? 'Nuvemshop - PAI' : nsTag === 'ENSV' ? 'Nuvemshop - VARIANTE' : 'Nuvemshop - NORMAL'
    icons.push(
      <CloudIcon key="nuvemshop" className={`w-5 h-5 ${color}`} title={title} />
    )
  }

  // Mercado Livre por flag ml
  if (hasML) {
    icons.push(
      <ShoppingBagIcon key="mercadolivre" className="w-5 h-5 text-yellow-500" title="Mercado Livre" />
    )
  }

  return <div className={`flex items-center gap-1 ${className}`}>{icons}</div>
}
