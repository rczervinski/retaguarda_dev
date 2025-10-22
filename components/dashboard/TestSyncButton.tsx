"use client";

export function TestSyncButton() {
  async function runSync() {
    try {
      const res = await fetch('/api/ecommerce/stock/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-sync-key': 'dev-secret-change-me'
        },
        body: JSON.stringify({ days: 1 })
      })
      const json = await res.json()
      alert(`Sync executado. Status: ${res.status}. Itens: ${Array.isArray(json.processed) ? json.processed.length : 0}`)
    } catch (e: any) {
      alert('Falha ao executar sync: ' + (e?.message || 'erro'))
    }
  }
  return (
    <div className="mt-4">
      <button onClick={runSync} className="px-3 py-2 rounded bg-primary-600 hover:bg-primary-700 text-white text-sm">
        Testar Sync de Estoque (últimas 24h)
      </button>
    </div>
  )
}
