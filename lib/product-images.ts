import { promises as fs } from 'fs'
import path from 'path'
import { getCurrentTenant } from './request-context'

// Preferir a pasta ../upload (irmã de retaguarda_new), com fallback para public/upload
// Estrutura esperada pelo cliente:
//   retaguarda/
//     ├─ retaguarda_new/ (projeto Next)
//     └─ upload/        (pasta pública servida via URL /upload)
// Em ambiente Next puro, o fallback public/upload continua funcionando.
export async function resolveUploadDir(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'upload'), // irmã de retaguarda_new
    path.join(process.cwd(), 'upload'),          // dentro do projeto
    path.join(process.cwd(), 'public', 'upload') // fallback Next
  ]
  for (const dir of candidates) {
    try {
      const st = await fs.stat(dir)
      if (st.isDirectory()) return dir
    } catch {}
  }
  return null
}

export interface LocalImageInfo {
  name: string
  pos: number
  url: string // absolute URL
}

// Suporta múltiplas extensões comuns
const ALLOWED_EXT = ['.webp', '.jpg', '.jpeg', '.png']

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listLocalImages(codigo: string, baseUrl: string): Promise<LocalImageInfo[]> {
  try {
    const dirRoot = await resolveUploadDir()
    if (!dirRoot) return []
    const { cnpj } = getCurrentTenant()
    const dir = cnpj ? path.join(dirRoot, cnpj) : dirRoot
    // garantir que diretório do cnpj exista
    try { await fs.mkdir(dir, { recursive: true }) } catch {}
    const files = await fs.readdir(dir)
    const prefix = `${codigo}`
    const extPattern = '(?:webp|jpe?g|png)'
    const re = new RegExp(`^${escapeRegExp(prefix)}(?:_(\\d+))?\\.${extPattern}$`, 'i')
    const candidates = files
      .map(f => {
        const m = f.match(re)
        if (!m) return null
        const pos = m[1] ? parseInt(m[1], 10) : 1
        // garantir extensão permitida
        const ext = path.extname(f).toLowerCase()
        if (!ALLOWED_EXT.includes(ext)) return null
        return { file: f, pos }
      })
      .filter((x): x is { file: string; pos: number } => !!x)
      .sort((a, b) => a.pos - b.pos)

    return candidates.map(i => ({
      name: i.file,
      pos: i.pos,
      url: `${baseUrl.replace(/\/$/, '')}/upload/${cnpj ? `${cnpj}/` : ''}${i.file}`
    }))
  } catch {
    return []
  }
}

export function ensureAbsoluteBaseUrl(reqHeaders?: Headers): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL
  if (env && /^https?:\/\//i.test(env)) return env
  // Fallback a partir do host do request (se disponível)
  try {
    const host = reqHeaders?.get('host') || 'localhost:3000'
    const proto = reqHeaders?.get('x-forwarded-proto') || 'http'
    return `${proto}://${host}`
  } catch {
    return 'http://localhost:3000'
  }
}
