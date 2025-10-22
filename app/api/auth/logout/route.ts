import { NextResponse } from 'next/server'
import { clearAuthOnResponse } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearAuthOnResponse(res)
  return res
}
