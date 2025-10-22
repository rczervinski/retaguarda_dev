"use client";
import { useEffect, useMemo, useState } from 'react'

// Tipos – Webhooks
type Webhook = { id?: number|string; topic?: string; address?: string; url?: string; is_active?: boolean }
type ListResp = { ok: boolean; tenant?: string; webhooks?: Webhook[]; error?: string }
type RegResp = { ok: boolean; tenant?: string; created?: any[]; skipped?: any[]; error?: string }

// Tipos – Configurações
type ConfigRow = { codigo: number; descricao: string; store_id?: string; url_checkout?: string; ativo: number; tem_token: 'SIM'|'NÃO' }
type ConfigListResp = { success: boolean; configs?: ConfigRow[]; error?: string }
type TestResp = { success: boolean; error?: string; store_info?: any; message?: string; details?: any }

export default function NuvemshopConfiguracoesPage() {
  // Webhooks state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|undefined>()
  const [tenant, setTenant] = useState<string>('')
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [resultMsg, setResultMsg] = useState<string|undefined>()

  // Config integrações state
  const [cfgLoading, setCfgLoading] = useState(false)
  const [cfgError, setCfgError] = useState<string|undefined>()
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [testMsg, setTestMsg] = useState<string|undefined>()
  const [storeUrl, setStoreUrl] = useState('')
  const [authError, setAuthError] = useState<string|undefined>()

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }, [])

  // ---- WEBHOOKS ----
  async function loadWebhooks() {
    setLoading(true); setError(undefined); setResultMsg(undefined)
    try {
      const res = await fetch('/api/nuvemshop/webhooks/register', { method: 'GET', cache: 'no-store' })
      const json: ListResp = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error || `Erro ${res.status}`)
      setTenant(json.tenant || '')
      setWebhooks(Array.isArray(json.webhooks) ? json.webhooks : [])
    } catch (e:any) {
      setError(e?.message || 'Falha ao carregar webhooks')
    } finally { setLoading(false) }
  }

  async function handleAtivarWebhooks() {
    setSaving(true); setError(undefined); setResultMsg(undefined)
    try {
      const res = await fetch('/api/nuvemshop/webhooks/register', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const json: RegResp = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error || `Erro ${res.status}`)
      const created = json.created?.length || 0
      const skipped = json.skipped?.length || 0
      setResultMsg(`Webhooks registrados: ${created} novo(s), ${skipped} já existente(s).`)
      await loadWebhooks()
    } catch (e:any) {
      setError(e?.message || 'Falha ao registrar webhooks')
    } finally { setSaving(false) }
  }

  async function handleDeletarWebhooks() {
    setSaving(true); setError(undefined); setResultMsg(undefined)
    try {
      const res = await fetch('/api/nuvemshop/webhooks/register', { method: 'DELETE' })
      const json: any = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error || `Erro ${res.status}`)
      setResultMsg(`Webhooks removidos: ${json.deleted || 0}.`)
      await loadWebhooks()
    } catch (e:any) {
      setError(e?.message || 'Falha ao deletar webhooks')
    } finally { setSaving(false) }
  }

  // ---- CONFIG INTEGRAÇÃO/LOJA ----
  async function loadConfigs() {
    setCfgLoading(true); setCfgError(undefined); setTestMsg(undefined)
    try {
      const res = await fetch('/api/nuvemshop/config/list', { cache: 'no-store' })
      const json: ConfigListResp = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error || `Erro ${res.status}`)
      setConfigs(Array.isArray(json.configs) ? json.configs : [])
    } catch (e:any) {
      setCfgError(e?.message || 'Falha ao carregar configurações')
    } finally { setCfgLoading(false) }
  }

  async function toggleAtivo(codigo: number, ativo: boolean) {
    try {
      const res = await fetch('/api/nuvemshop/config/list', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, status: ativo }) })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error || `Erro ${res.status}`)
      await loadConfigs()
    } catch (e:any) { alert(e?.message || 'Falha ao atualizar status') }
  }

  async function testarConexao(codigo?: number) {
    setTestMsg(undefined)
    try {
      const url = codigo ? `/api/nuvemshop/connection/test?codigo=${codigo}` : '/api/nuvemshop/connection/test'
      const res = await fetch(url)
      const json: TestResp = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error || `Erro ${res.status}`)
      setTestMsg(json.message || 'Conexão ok')
    } catch (e:any) { setTestMsg(e?.message || 'Falha ao testar conexão') }
  }

  async function iniciarAutorizacao() {
    setAuthError(undefined)
    try {
      if (!storeUrl.trim()) throw new Error('Informe a URL da loja (ex.: https://minhaloja.lojavirtual.com.br)')
      const r = await fetch(`/api/nuvemshop/auth/authorize?store_url=${encodeURIComponent(storeUrl.trim())}`)
      const j = await r.json()
      if (!r.ok || !j.success || !j.authUrl) throw new Error(j?.error || `Erro ${r.status}`)
      window.location.href = j.authUrl
    } catch (e:any) { setAuthError(e?.message || 'Falha ao iniciar autorização') }
  }

  useEffect(() => { loadConfigs(); loadWebhooks(); }, [])

  const targetAddress = tenant ? `${baseUrl.replace(/\/$/, '')}/api/nuvemshop/webhooks/${tenant}` : ''

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Nuvemshop · Configurações</h1>

      {/* Seção de Conexão/Autorização da Loja (como estava) */}
      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-medium">Conexão da Loja</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm text-gray-700">URL da Loja</label>
            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="https://minhaloja..." value={storeUrl} onChange={e=>setStoreUrl(e.target.value)} />
              <button onClick={iniciarAutorizacao} className="px-4 py-2 rounded bg-emerald-600 text-white">Autorizar</button>
            </div>
            {authError && <div className="text-sm text-red-600">{authError}</div>}
            <p className="text-xs text-gray-500">Após autorizar, a loja será vinculada e as credenciais salvas em token_integracao.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={()=>testarConexao()} className="px-3 py-2 rounded bg-gray-100">Testar conexão (ativa)</button>
              {testMsg && <span className="text-sm text-gray-700">{testMsg}</span>}
            </div>
            <div>
              <h3 className="font-medium mb-2">Configurações encontradas</h3>
              {cfgLoading ? (
                <div className="text-sm text-gray-600">Carregando…</div>
              ) : cfgError ? (
                <div className="text-sm text-red-600">{cfgError}</div>
              ) : (
                <ul className="space-y-2">
                  {configs.map(cfg => (
                    <li key={cfg.codigo} className="p-2 border rounded text-sm flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium">{cfg.descricao} #{cfg.codigo}</div>
                        <div className="text-gray-600">Store ID: {cfg.store_id || '—'} · Token: {cfg.tem_token}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={()=>testarConexao(cfg.codigo)} className="px-2 py-1 rounded bg-gray-100">Testar</button>
                        <label className="inline-flex items-center gap-1 text-sm">
                          <input type="checkbox" checked={!!cfg.ativo} onChange={e=>toggleAtivo(cfg.codigo, e.target.checked)} /> Ativo
                        </label>
                      </div>
                    </li>
                  ))}
                  {configs.length===0 && (
                    <li className="text-sm text-gray-600">Nenhuma configuração encontrada.</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Webhooks (adicionada ABAIXO) */}
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-medium">Webhooks de Pedidos</h2>
        <p className="text-sm text-gray-600">Ative os webhooks para receber pedidos automaticamente e descontar o estoque quando o pagamento for autorizado.</p>
        <div className="text-sm">
          <div><span className="font-medium">Tenant:</span> {tenant || '—'}</div>
          <div className="break-all"><span className="font-medium">Destino esperado:</span> {targetAddress || '—'}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleAtivarWebhooks} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
            {saving ? 'Ativando…' : 'Ativar webhooks'}
          </button>
          <button onClick={loadWebhooks} disabled={loading} className="px-4 py-2 rounded bg-gray-200 disabled:opacity-60">Recarregar</button>
          <button onClick={handleDeletarWebhooks} disabled={saving} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60">Deletar webhooks atuais</button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {resultMsg && <div className="text-green-700 text-sm">{resultMsg}</div>}

        <div className="mt-2">
          <h3 className="font-medium mb-1">Webhooks cadastrados</h3>
          {loading ? (
            <div className="text-sm text-gray-600">Carregando…</div>
          ) : webhooks.length === 0 ? (
            <div className="text-sm text-gray-600">Nenhum webhook encontrado.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {webhooks.map((w, i) => (
                <li key={(w.id || i) as any} className="p-2 border rounded">
                  <div><span className="font-medium">Evento:</span> {(w as any).event || w.topic || '—'}</div>
                  <div className="break-all"><span className="font-medium">Endereço:</span> {w.address || (w as any).url || '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
