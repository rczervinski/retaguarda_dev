import { NextRequest, NextResponse } from 'next/server'
import { readAuthFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = await readAuthFromRequest(req)
  if (!payload) return NextResponse.json({ ok:false, authenticated:false })
  return NextResponse.json({ ok:true, authenticated:true, tenant: payload.tid, cnpj: payload.cnpj, nome: payload.nome })
}
