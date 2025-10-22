import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { withTenant } from '@/lib/with-tenant'
import { ensureTenantUploadDir } from '@/lib/upload'
import { getCurrentTenant } from '@/lib/request-context'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

async function ensureDir() {
  const dir = await ensureTenantUploadDir()
  if (dir) await fs.mkdir(dir, { recursive: true })
}

function buildFileName(codigo: string, position: number) {
  return position === 1 ? `${codigo}.png` : `${codigo}_${position}.png`
}

const ALLOWED_EXT = ['.webp', '.jpg', '.jpeg', '.png']

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

async function listImages(codigo: string) {
  try {
    const dir = await ensureTenantUploadDir()
    if (!dir) return []
    const files = await fs.readdir(dir)
    const prefix = `${codigo}`
    const re = new RegExp(`^${escapeRegExp(prefix)}(?:_(\\d+))?\\.(?:webp|jpe?g|png)$`, 'i')
    const filtered = files
      .map(f => {
        if (f.toLowerCase().includes('_thumb')) return null
        const m = f.match(re)
        if (!m) return null
        const ext = path.extname(f).toLowerCase()
        if (!ALLOWED_EXT.includes(ext)) return null
        const pos = m[1] ? parseInt(m[1], 10) : 1
        return { file: f, pos }
      })
      .filter((x): x is { file: string; pos: number } => !!x)
      .sort((a, b) => a.pos - b.pos)
    const { cnpj } = getCurrentTenant()
    return filtered.map(i => ({ name: i.file, url: `/upload/${cnpj ? `${cnpj}/` : ''}${i.file}`, pos: i.pos }))
  } catch {
    return []
  }
}

export const runtime = 'nodejs'

export const GET = withTenant(async (_req: NextRequest, paramPromise: Promise<{ codigo: string }>) => {
  await ensureDir()
  const params = await paramPromise
  const imgs = await listImages(params.codigo)
  return NextResponse.json({ success: true, imagens: imgs })
})

// Upload nova imagem (multipart/form-data) campos: file, crop (json opcional com {x,y,w,h,scale})
export const POST = withTenant(async (req: NextRequest, paramPromise: Promise<{ codigo: string }>) => {
  const params = await paramPromise
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

    // Determinar próxima posição
    const existing = await listImages(codigo)
    if (existing.length >= MAX_IMAGES) {
      return NextResponse.json({ success: false, error: 'Limite máximo de 4 imagens' }, { status: 400 })
    }
    const nextPos = existing.length + 1
    const filename = buildFileName(codigo, nextPos)

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

  const dir = await ensureTenantUploadDir()
  if (!dir) return NextResponse.json({ success: false, error: 'Diretório de upload indisponível' }, { status: 500 })
  const outPath = path.join(dir, filename)
    await img.png({ compressionLevel: 9 }).toFile(outPath)

    const { cnpj } = getCurrentTenant()
    const url = `/upload/${cnpj ? `${cnpj}/` : ''}${filename}`
    return NextResponse.json({ success: true, file: filename, url, pos: nextPos })
  } catch (e: any) {
    console.error('UPLOAD ERRO', e)
    return NextResponse.json({ success: false, error: 'Falha upload', detalhe: e.message }, { status: 500 })
  }
})

// Reordenar: body { ordem: ["200.png","200_2.png", ...] }
export const PUT = withTenant(async (req: NextRequest, paramPromise: Promise<{ codigo: string }>) => {
  const params = await paramPromise
  const codigo = params.codigo
  await ensureDir()
  try {
    const body = await req.json()
    const ordem: string[] = body?.ordem || []
    if (!Array.isArray(ordem) || !ordem.length) return NextResponse.json({ success: false, error: 'Lista vazia' }, { status: 400 })
    // Filtrar somente deste produto
    const valid = ordem.filter(n => n.startsWith(codigo))
    // Dois passos para evitar sobrescrita: primeiro renomear para temporário, depois para destino final
    interface Pair { temp: string; final: string; original: string }
    const pairs: Pair[] = []
    let pos = 1
    const dir = await ensureTenantUploadDir()
    if (!dir) return NextResponse.json({ success: false, error: 'Diretório de upload indisponível' }, { status: 500 })
    for (const original of valid) {
      const finalName = buildFileName(codigo, pos)
      if (original !== finalName) {
        const tempName = `${original}.reorder_tmp` // garantir unicidade
        // rename original -> temp
        try {
          await fs.rename(path.join(dir, original), path.join(dir, tempName))
          pairs.push({ temp: tempName, final: finalName, original })
        } catch (e) {
          console.warn('fase1 reorder rename falhou', original, e)
        }
      }
      pos++
    }
    // Segunda fase: temp -> final
    for (const p of pairs) {
      try {
        const dir2 = await ensureTenantUploadDir()
        if (!dir2) continue
        await fs.rename(path.join(dir2, p.temp), path.join(dir2, p.final))
      } catch (e) {
        console.warn('fase2 reorder rename falhou', p, e)
      }
    }
    const imagens = await listImages(codigo)
    return NextResponse.json({ success: true, imagens })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'Falha reorder', detalhe: e.message }, { status: 500 })
  }
})

// DELETE ?nome=200_2.png
export const DELETE = withTenant(async (req: NextRequest, paramPromise: Promise<{ codigo: string }>) => {
  const params = await paramPromise
  const codigo = params.codigo
  await ensureDir()
  const { searchParams } = new URL(req.url)
  const nome = searchParams.get('nome')
  if (!nome) return NextResponse.json({ success: false, error: 'Param nome ausente' }, { status: 400 })
  if (!nome.startsWith(codigo)) return NextResponse.json({ success: false, error: 'Arquivo não pertence ao produto' }, { status: 400 })
  try {
    const dir = await ensureTenantUploadDir()
    if (!dir) return NextResponse.json({ success: false, error: 'Diretório de upload indisponível' }, { status: 500 })
    await fs.unlink(path.join(dir, nome))
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 })
  }
  // Recompactar ordem para evitar buracos
  const imgs = await listImages(codigo)
  // Renomear em sequência
  // Compactação segura pós exclusão
  let pos = 1
  const compPairs: { temp: string; final: string }[] = []
  for (const img of imgs) {
    const finalName = buildFileName(codigo, pos)
    if (img.name !== finalName) {
      const tempName = `${img.name}.compact_tmp`
      try {
        const dir2 = await ensureTenantUploadDir()
        if (!dir2) continue
        await fs.rename(path.join(dir2, img.name), path.join(dir2, tempName))
        compPairs.push({ temp: tempName, final: finalName })
      } catch (e) { console.warn('compact fase1 falhou', img.name, e) }
    }
    pos++
  }
  for (const p of compPairs) {
    try {
      const dir2 = await ensureTenantUploadDir()
      if (!dir2) continue
      await fs.rename(path.join(dir2, p.temp), path.join(dir2, p.final))
    } catch (e) { console.warn('compact fase2 falhou', p, e) }
  }
  const finalList = await listImages(codigo)
  return NextResponse.json({ success: true, imagens: finalList })
})

export const dynamic = 'force-dynamic'

// PATCH: swap positions { acao:'swap', from: number, to: number }
export const PATCH = withTenant(async (req: NextRequest, paramPromise: Promise<{ codigo: string }>) => {
  const params = await paramPromise
  const codigo = params.codigo
  console.log('🔄 API SWAP DEBUG - Recebendo PATCH para código:', codigo)
  await ensureDir()
  try {
    const body = await req.json()
    console.log('🔄 API SWAP DEBUG - Body recebido:', body)
    if (body?.acao !== 'swap') return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 })
    const from = parseInt(body.from, 10)
    const to = parseInt(body.to, 10)
    console.log('🔄 API SWAP DEBUG - Posições:', { from, to })
    if (!from || !to || from === to) return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 })
    if (from < 1 || to < 1 || from > MAX_IMAGES || to > MAX_IMAGES) return NextResponse.json({ success: false, error: 'Fora do limite' }, { status: 400 })
    const fileFrom = buildFileName(codigo, from)
    const fileTo = buildFileName(codigo, to)
  const dir = await ensureTenantUploadDir()
  if (!dir) return NextResponse.json({ success: false, error: 'Diretório de upload indisponível' }, { status: 500 })
  const pathFrom = path.join(dir, fileFrom)
  const pathTo = path.join(dir, fileTo)
    console.log('🔄 API SWAP DEBUG - Arquivos:', { fileFrom, fileTo, pathFrom, pathTo })
    // Verificar existência
    try { 
      await fs.stat(pathFrom) 
      console.log('🔄 API SWAP DEBUG - Arquivo FROM existe')
    } catch { 
      console.log('❌ API SWAP DEBUG - Arquivo FROM não existe')
      return NextResponse.json({ success: false, error: 'Origem inexistente' }, { status: 404 }) 
    }
    try { 
      await fs.stat(pathTo) 
      console.log('🔄 API SWAP DEBUG - Arquivo TO existe')
    } catch { 
      console.log('❌ API SWAP DEBUG - Arquivo TO não existe')
      return NextResponse.json({ success: false, error: 'Destino inexistente' }, { status: 404 }) 
    }
  const temp = `${fileFrom}.swap_tmp`
  const tempPath = path.join(dir, temp)
    console.log('🔄 API SWAP DEBUG - Iniciando swap com temp:', temp)
    // swap principal
    await fs.rename(pathFrom, tempPath)
    await fs.rename(pathTo, pathFrom)
    await fs.rename(tempPath, pathTo)
    console.log('✅ API SWAP DEBUG - Swap principal concluído')
    // thumbnails removidos do fluxo
    const imagens = await listImages(codigo)
    console.log('✅ API SWAP DEBUG - Success, retornando imagens:', imagens)
    return NextResponse.json({ success: true, imagens })
  } catch (e: any) {
    console.log('❌ API SWAP DEBUG - Erro:', e)
    return NextResponse.json({ success: false, error: 'Falha swap', detalhe: e.message }, { status: 500 })
  }
})