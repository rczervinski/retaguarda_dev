import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { resolveUploadDir } from '@/lib/product-images'

// Diretório de upload é resolvido pela lib/product-images.ts (single source of truth)

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    default: return 'application/octet-stream'
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  const segments = params.path || []
  // Bloqueia traversal e segmentos maliciosos
  if (!segments.length) return new NextResponse('Not Found', { status: 404 })
  if (segments.some(s => s.includes('..') || s.includes('\\') || s.startsWith('/'))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const dir = await resolveUploadDir()
  if (!dir) return new NextResponse('Upload directory not found', { status: 404 })

  // Permite caminhos como <cnpj>/<arquivo> ou temp/<sessionId>/images/<arquivo>
  const safeSegs = segments.map(s => s.replace(/[^a-zA-Z0-9_\-\.]/g, ''))
  const fullPath = path.join(dir, ...safeSegs)
  try {
    const data = await fs.readFile(fullPath)
    const ext = path.extname(fullPath)
    const contentType = contentTypeFromExt(ext)
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
    if (process.env.NODE_ENV !== 'production') {
      headers.set('X-Upload-Base', dir)
      headers.set('X-Upload-Path', fullPath)
    }
    const bytes = new Uint8Array(data)
    return new NextResponse(bytes, { status: 200, headers })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
