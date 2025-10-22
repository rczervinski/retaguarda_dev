import { NextResponse } from 'next/server'
import { getLinkedPlatforms } from '@/lib/ecommerce-sync'

export async function GET(_req: Request, context: { params: Promise<{ codigo: string }> }) {
  const params = await context.params
  const codigo = params.codigo
  try {
    const platforms = await getLinkedPlatforms(codigo)
    return NextResponse.json({ success: true, platforms })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
