import { NextRequest, NextResponse } from 'next/server'
import { listTenantIds } from '@/lib/tenants'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const expectedKey = process.env.STOCK_SYNC_KEY
    if (expectedKey) {
      const url = new URL(req.url)
      const qKey = url.searchParams.get('key')
      const hKey = req.headers.get('x-sync-key')
      if (qKey !== expectedKey && hKey !== expectedKey) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
      }
    }

    const tenants = listTenantIds()
    return NextResponse.json({ ok: true, tenants })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0