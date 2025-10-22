import { NextRequest, NextResponse } from 'next/server'
import { syncImageActionAcrossPlatforms } from '@/lib/ecommerce-sync'

export async function POST(req: NextRequest, context: { params: Promise<{ codigo: string }> }) {
  const params = await context.params
  const codigo = params.codigo
  try {
    const body = await req.json()
    const action = body?.action
    if (!action || !action.type) return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 })
    const results = await syncImageActionAcrossPlatforms(codigo, action)
    const ok = results.every(r => r.success)
    return NextResponse.json({ success: ok, results })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
