import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { put, del, list } from '@vercel/blob'
import { getCurrentTenant } from '@/lib/request-context'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

// Detectar ambiente
const isProduction = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1'

// Configurações baseadas no ambiente
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'upload')
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

async function ensureDir() {
  if (!isVercel) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

function buildFileName(codigo: string, position: number) {
  return position === 1 ? `${codigo}.png` : `${codigo}_${position}.png`
}

function buildThumbName(main: string) {
  return main.replace(/\.png$/i, '_thumb.png')
}

async function listImagesLocal(codigo: string) {
  try {
    const { cnpj } = getCurrentTenant()
    const dir = cnpj ? path.join(UPLOAD_DIR, cnpj) : UPLOAD_DIR
    await fs.mkdir(dir, { recursive: true })
    const files = await fs.readdir(dir)
    const prefix = `${codigo}`
    const filtered = files
      .filter(f => f.startsWith(prefix) && f.endsWith('.png') && !f.endsWith('_thumb.png'))
      .map(f => {
        const m = f.match(/^(\d+)(?:_(\d+))?\.png$/)
        const pos = m && m[2] ? parseInt(m[2], 10) : 1
        return { file: f, pos }
      })
      .sort((a, b) => a.pos - b.pos)
    return filtered.map(i => ({ name: i.file, url: `/upload/${cnpj ? `${cnpj}/` : ''}${i.file}`, pos: i.pos }))
  } catch {
    return []
  }
}

async function listImagesVercel(codigo: string) {
  if (!BLOB_TOKEN) return []
  
  try {
    const { cnpj } = getCurrentTenant()
    const prefix = `${cnpj ? `${cnpj}/` : ''}${codigo}`
    const { blobs } = await list({ 
      prefix,
      token: BLOB_TOKEN
    })
    
    const filtered = blobs
      .filter(b => b.pathname.includes(codigo) && !b.pathname.includes('_thumb'))
      .map(b => {
        const name = b.pathname.split('/').pop() || b.pathname
        const m = name.match(/^(\d+)(?:_(\d+))?\.png$/)
        const pos = m && m[2] ? parseInt(m[2], 10) : 1
        return { name, url: b.url, pos }
      })
      .sort((a, b) => a.pos - b.pos)
      
    return filtered
  } catch (e) {
    console.error('Erro listando imagens Vercel Blob:', e)
    return []
  }
}

async function listImages(codigo: string) {
  return isVercel ? await listImagesVercel(codigo) : await listImagesLocal(codigo)
}

export async function GET(_req: NextRequest, context: { params: Promise<{ codigo: string }> }) {
  await ensureDir()
  const params = await context.params
  const imgs = await listImages(params.codigo)
  return NextResponse.json({ success: true, imagens: imgs, ambiente: isVercel ? 'vercel' : 'local' })
}

export async function POST(req: NextRequest, context: { params: Promise<{ codigo: string }> }) {
  const params = await context.params
  const codigo = params.codigo
  await ensureDir()
  
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'Arquivo ausente' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ success: false, error: 'Arquivo excede 10MB' }, { status: 400 })
    if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ success: false, error: 'Formato inválido' }, { status: 400 })

    const cropRaw = formData.get('crop') as string | null
    let crop: any = null
    if (cropRaw) {
      try { crop = JSON.parse(cropRaw) } catch { /* ignore */ }
    }

    const buff = Buffer.from(await file.arrayBuffer())
    const existing = await listImages(codigo)
    if (existing.length >= MAX_IMAGES) {
      return NextResponse.json({ success: false, error: 'Limite máximo de 4 imagens' }, { status: 400 })
    }
    
    const nextPos = existing.length + 1
    const filename = buildFileName(codigo, nextPos)

    // Processar imagem
    let img = sharp(buff)
    const meta = await img.metadata()
    
    if (crop && crop.w && crop.h) {
      const x = Math.max(0, Math.min(crop.x || 0, (meta.width || 0)))
      const y = Math.max(0, Math.min(crop.y || 0, (meta.height || 0)))
      const w = Math.min(crop.w, (meta.width || crop.w))
      const h = Math.min(crop.h, (meta.height || crop.h))
      img = img.extract({ left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) })
    }
    
    if (crop && crop.scale && crop.scale !== 1) {
      img = img.resize({ width: Math.round((meta.width || 0) * crop.scale) || undefined })
    }

    const processedBuffer = await img.png({ compressionLevel: 9 }).toBuffer()

    if (isVercel && BLOB_TOKEN) {
      // Upload para Vercel Blob
      const { cnpj } = getCurrentTenant()
      const key = `${cnpj ? `${cnpj}/` : ''}${filename}`
      const blob = await put(key, processedBuffer, {
        access: 'public',
        token: BLOB_TOKEN
      })
      
      // Criar thumbnail
      try {
        const thumbBuffer = await sharp(processedBuffer)
          .resize({ width: 300, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer()
        const thumbKey = `${cnpj ? `${cnpj}/` : ''}${buildThumbName(filename)}`
        await put(thumbKey, thumbBuffer, {
          access: 'public', 
          token: BLOB_TOKEN
        })
      } catch (e) {
        console.warn('Falha gerar thumbnail Vercel:', e)
      }
      
      return NextResponse.json({ 
        success: true, 
        file: filename, 
        pos: nextPos, 
        url: blob.url,
        ambiente: 'vercel-blob'
      })
      
    } else {
      // Salvar local
  const { cnpj } = getCurrentTenant()
  const dir = cnpj ? path.join(UPLOAD_DIR, cnpj) : UPLOAD_DIR
  await fs.mkdir(dir, { recursive: true })
  const outPath = path.join(dir, filename)
      await fs.writeFile(outPath, processedBuffer)
      
      // Gerar thumbnail local
      try {
        const thumbPath = path.join(dir, buildThumbName(filename))
        const thumbBuffer = await sharp(processedBuffer)
          .resize({ width: 300, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer()
        await fs.writeFile(thumbPath, thumbBuffer)
      } catch (e) {
        console.warn('Falha gerar thumbnail local:', e)
      }

      return NextResponse.json({ 
        success: true, 
        file: filename, 
        pos: nextPos,
        url: `/upload/${cnpj ? `${cnpj}/` : ''}${filename}`,
        ambiente: 'local'
      })
    }

  } catch (e: any) {
    console.error('UPLOAD ERRO:', e)
    return NextResponse.json({ 
      success: false, 
      error: 'Falha upload', 
      detalhe: e.message,
      ambiente: isVercel ? 'vercel' : 'local'
    }, { status: 500 })
  }
}

// Outras funções (PUT, DELETE, PATCH) com lógica híbrida similar...
export async function DELETE(req: NextRequest, context: { params: Promise<{ codigo: string }> }) {
  const params = await context.params
  const codigo = params.codigo
  const { searchParams } = new URL(req.url)
  const nome = searchParams.get('nome')
  if (!nome) return NextResponse.json({ success: false, error: 'Param nome ausente' }, { status: 400 })

  try {
    if (isVercel && BLOB_TOKEN) {
      // Delete do Vercel Blob
      const { cnpj } = getCurrentTenant()
      const key = `${cnpj ? `${cnpj}/` : ''}${nome}`
      await del(key, { token: BLOB_TOKEN })
      const thumbName = buildThumbName(nome)
      try {
        const thumbKey = `${cnpj ? `${cnpj}/` : ''}${thumbName}`
        await del(thumbKey, { token: BLOB_TOKEN })
      } catch {}
    } else {
      // Delete local
      const filePath = path.join(UPLOAD_DIR, nome)
      const thumbPath = path.join(UPLOAD_DIR, buildThumbName(nome))
      
      await fs.unlink(filePath).catch(() => {})
      await fs.unlink(thumbPath).catch(() => {})
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Imagem removida',
      ambiente: isVercel ? 'vercel' : 'local'
    })
  } catch (e: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Falha ao remover', 
      detalhe: e.message 
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
