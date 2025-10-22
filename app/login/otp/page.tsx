"use client"
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function OtpInner() {
  const sp = useSearchParams()
  const nome = sp.get('nome') || ''
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string|null>(null)
  const router = useRouter()

  useEffect(() => { if (!nome) router.replace('/login') }, [nome, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const r = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, code }),
      credentials: 'include'
    })
    if (r.ok) {
      try { console.debug('[OTP] verify ok', await r.json().catch(()=>null)) } catch {}
      // Aguardar para garantir que o cookie seja processado
      await new Promise(resolve => setTimeout(resolve, 200))
      // Forçar reload completo para middleware processar o cookie
      router.replace('/')
      router.refresh()
    } else {
      const j = await r.text().catch(()=>(''))
      try { console.error('[OTP] verify fail', j) } catch {}
      let parsed: any = {}
      try { parsed = JSON.parse(j) } catch {}
      const msg = parsed?.error || (typeof j === 'string' && j || 'erro')
      setErr(String(msg))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="space-y-3 w-full max-w-sm border p-4 rounded">
        <h1 className="text-xl font-semibold">Autenticação</h1>
        <p className="text-sm text-gray-600">Digite o código enviado (no console, temporariamente)</p>
        <input className="w-full border p-2 rounded" placeholder="código" value={code} onChange={e=>setCode(e.target.value)} />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button className="w-full bg-blue-600 text-white p-2 rounded" type="submit">Entrar</button>
      </form>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function OtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando…</div>}>
      <OtpInner />
    </Suspense>
  )
}
