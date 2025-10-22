import { promises as fs } from 'fs'
import path from 'path'
import { getCurrentTenant } from './request-context'

export async function getUploadRoot(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'upload'),
    path.join(process.cwd(), 'upload'),
    path.join(process.cwd(), 'public', 'upload'),
  ]
  for (const dir of candidates) {
    try {
      const st = await fs.stat(dir)
      if (st.isDirectory()) return dir
    } catch {}
  }
  return null
}

export async function ensureTenantUploadDir(): Promise<string | null> {
  const root = await getUploadRoot()
  if (!root) return null
  const { cnpj } = getCurrentTenant()
  const dir = cnpj ? path.join(root, cnpj) : root
  try { await fs.mkdir(dir, { recursive: true }) } catch {}
  return dir
}
