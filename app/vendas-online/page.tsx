import { headers } from 'next/headers'
import { getTenantById } from '@/lib/tenants'
import { runWithContext } from '@/lib/request-context'
import { ensureVendasOnlineTables } from '@/lib/stock/tables'
import { query } from '@/lib/database'
import VendasOnlineClient from './VendasOnlineClient'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { SidebarProvider } from '@/contexts/SidebarContext'

type SearchParams = { [key: string]: string | string[] | undefined }

function toStr(v: any) { return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '' }

export default async function VendasOnlinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const hdrs = await headers()
  const tenantId = hdrs.get('x-tenant-id') || ''
  const t = getTenantById(tenantId)
  if (!t) return <div className="p-6">Tenant inválido</div>

  const spObj = await searchParams
  const s = toStr(spObj.s || '')
  const sp = toStr(spObj.sp || 'all')
  const pr = toStr(spObj.pr || 'all')
  const df = toStr(spObj.df || '')
  const dt = toStr(spObj.dt || '')
  const page = Math.max(1, parseInt(toStr(spObj.pg || '1') || '1', 10))
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const data = await runWithContext({ tenantId: t.id, dbUrl: t.dbUrl, cnpj: t.cnpj }, async () => {
    await ensureVendasOnlineTables()
    const wh: string[] = []
    const args: any[] = []

    if (s) {
      args.push(`%${s}%`)
      wh.push(`(numero ILIKE $${args.length} OR cliente_nome ILIKE $${args.length} OR cliente_email ILIKE $${args.length})`)
    }
    if (sp && sp !== 'all') {
      args.push(sp)
      wh.push(`LOWER(status_pagamento) = LOWER($${args.length})`)
    }
    if (pr === 'yes') {
      wh.push(`processed_at IS NOT NULL`)
    } else if (pr === 'no') {
      wh.push(`processed_at IS NULL`)
    }
    if (df) {
      args.push(df)
      wh.push(`(created_at IS NULL OR created_at::date >= $${args.length}::date)`)
    }
    if (dt) {
      args.push(dt)
      wh.push(`(created_at IS NULL OR created_at::date <= $${args.length}::date)`)
    }
    const where = wh.length ? `WHERE ${wh.join(' AND ')}` : ''

    const rows = await query(`
      SELECT vo.*,
             COALESCE((SELECT COUNT(*) FROM vendas_online_itens vi WHERE vi.venda_online_id = vo.id),0) AS itens_count
        FROM vendas_online vo
        ${where}
        ORDER BY COALESCE(created_at, updated_at) DESC NULLS LAST, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
    `, args)

    const totalRes = await query(`SELECT COUNT(*) AS n FROM vendas_online ${where}`, args)
    const total = Number(totalRes.rows?.[0]?.n || 0)
    const ids = rows.rows.map((r: any) => r.id)
    let itens: Record<string, any[]> = {}
    if (ids.length) {
      const ir = await query(`SELECT * FROM vendas_online_itens WHERE venda_online_id = ANY($1::bigint[]) ORDER BY id`, [ids])
      itens = ir.rows.reduce((acc: any, it: any) => {
        const k = String(it.venda_online_id)
        if (!acc[k]) acc[k] = []
        acc[k].push(it)
        return acc
      }, {})
    }
    return { rows: rows.rows, total, itens }
  })

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto w-full">
              <VendasOnlineClient
                data={data}
                filters={{ s, sp, pr, df, dt, page }}
                totalPages={Math.max(1, Math.ceil(data.total / pageSize))}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
