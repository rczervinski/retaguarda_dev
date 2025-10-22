'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon, ChevronUpIcon, ChevronDownIcon, CloudIcon } from '@heroicons/react/24/outline'

export type QueueItem = {
  codigo_interno: number
  descricao: string
  destino: 'Nuvemshop' | 'Mercado Livre'
}

interface ExportQueueProps {
  items?: QueueItem[]
  onClear?: () => void
}

export const STORAGE_KEY = 'exportQueueItems'
export const STORAGE_MIN_KEY = 'exportQueueMinimized'
export const OPEN_MODAL_EVENT = 'export-queue-open'

export function readQueueFromStorage(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

export function writeQueueToStorage(items: QueueItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function addItemsToQueue(items: QueueItem[]) {
  const current = readQueueFromStorage()
  // Avoid duplicates by codigo+destino
  const key = (it: QueueItem) => `${it.codigo_interno}:${it.destino}`
  const existing = new Set(current.map(key))
  const merged = [...current]
  for (const it of items) {
    if (!existing.has(key(it))) merged.push(it)
  }
  writeQueueToStorage(merged)
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(merged) }))
}

export function removeItemFromQueue(codigo_interno: number, destino: 'Nuvemshop' | 'Mercado Livre') {
  const current = readQueueFromStorage()
  const filtered = current.filter(it => !(it.codigo_interno === codigo_interno && it.destino === destino))
  writeQueueToStorage(filtered)
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(filtered) })) } catch {}
}

export function clearQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify([]) }))
  } catch {}
}

export function openExportQueueModal() {
  try { window.dispatchEvent(new CustomEvent(OPEN_MODAL_EVENT)) } catch {}
}

export default function ExportQueue({ items, onClear }: ExportQueueProps) {
  const [localItems, setLocalItems] = useState<QueueItem[]>([])
  const [minimized, setMinimized] = useState<boolean>(false)

  useEffect(() => {
    // Initialize from storage
    setLocalItems(readQueueFromStorage())
    try {
      const min = localStorage.getItem(STORAGE_MIN_KEY)
      setMinimized(min === '1')
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setLocalItems(readQueueFromStorage())
      }
      if (e.key === STORAGE_MIN_KEY) {
        setMinimized(localStorage.getItem(STORAGE_MIN_KEY) === '1')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const displayed = items ?? localItems

  const clearAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setLocalItems([])
      onClear?.()
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify([]) }))
    } catch {}
  }

  const toggleMin = () => {
    const next = !minimized
    setMinimized(next)
    try {
      localStorage.setItem(STORAGE_MIN_KEY, next ? '1' : '0')
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_MIN_KEY, newValue: next ? '1' : '0' }))
    } catch {}
  }

  if (!displayed || displayed.length === 0) return null

  return (
    <div className="fixed bottom-3 right-3 z-40">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg w-80 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <CloudIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Fila de exportação</span>
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{displayed.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleMin} className="p-1 rounded hover:bg-gray-100" title={minimized ? 'Expandir' : 'Minimizar'}>
              {minimized ? <ChevronUpIcon className="w-4 h-4 text-gray-600" /> : <ChevronDownIcon className="w-4 h-4 text-gray-600" />}
            </button>
            <button onClick={clearAll} className="p-1 rounded hover:bg-gray-100" title="Limpar fila">
              <XMarkIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        {!minimized && (
          <ul className="max-h-64 overflow-auto divide-y">
            {displayed.map((it) => (
              <li key={`${it.codigo_interno}-${it.destino}`} className="px-3 py-2 text-sm">
                <div className="font-medium text-gray-800 line-clamp-1">{it.descricao}</div>
                <div className="text-xs text-gray-500">Código {it.codigo_interno} • {it.destino}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
