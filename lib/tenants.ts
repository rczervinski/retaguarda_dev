// Utilitário para ler e consultar tenants do ENV
// Formato esperado em process.env.TENANTS_JSON (sem hash, conforme solicitado):
// [
//   {
//     "id": "empresa1",          // identificador curto (pode ser o mesmo do nome)
//     "nome": "empresa1",        // login (nome)
//     "senha": "segredo",        // senha em claro
//     "dbUrl": "postgres://...", // URL do banco do tenant
//     "cnpj": "12345678000199",  // CNPJ do tenant
//     "telefone": "+55..."        // opcional
//   }
// ]

export type TenantRecord = {
  id: string
  nome: string
  senha: string
  dbUrl: string
  cnpj: string
  telefone?: string
}

let cached: TenantRecord[] | null = null

export function loadTenants(): TenantRecord[] {
  if (cached) return cached
  try {
    const raw = process.env.TENANTS_JSON
    if (!raw) return (cached = [])
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return (cached = [])
    // sanity
    cached = parsed.filter((t: any) => t && t.id && t.nome && t.senha && t.dbUrl && t.cnpj)
    return cached
  } catch (e) {
    console.error('[tenants] erro ao ler TENANTS_JSON:', (e as any)?.message)
    cached = []
    return cached
  }
}

export function findTenantByLogin(nome: string, senha: string): TenantRecord | null {
  const list = loadTenants()
  const t = list.find((x) => String(x.nome) === String(nome) && String(x.senha) === String(senha))
  return t || null
}

export function getTenantById(id: string): TenantRecord | null {
  const list = loadTenants()
  const t = list.find((x) => String(x.id) === String(id))
  return t || null
}

export function listTenantIds(): string[] {
  return loadTenants().map((t) => String(t.id))
}

// Indica explicitamente se a configuração de tenants está presente e válida
export function isTenantsConfigured(): boolean {
  try {
    const raw = process.env.TENANTS_JSON
    if (!raw) return false
    const list = loadTenants()
    return Array.isArray(list) && list.length > 0
  } catch {
    return false
  }
}
