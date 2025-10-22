type Entry = { code: string; expiresAt: number; tries: number; tenantId: string }

const store = new Map<string, Entry>() // key: login (nome)

export function createOtpFor(nome: string, tenantId: string, ttlSeconds = 120): string {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 dígitos
  const expiresAt = Date.now() + ttlSeconds * 1000
  store.set(String(nome), { code, expiresAt, tries: 0, tenantId })
  console.log('[OTP-STORE] createOtpFor', { nome: String(nome), code, expiresAt, tenantId, storeSize: store.size })
  return code
}

export function verifyOtp(nome: string, code: string): { ok: boolean; tenantId?: string; reason?: string } {
  console.log('[OTP-STORE] verifyOtp attempt', { nome: String(nome), code: String(code), storeSize: store.size, storeKeys: Array.from(store.keys()) })
  const e = store.get(String(nome))
  console.log('[OTP-STORE] verifyOtp found entry', { found: !!e, entry: e ? { code: e.code, expiresAt: e.expiresAt, tries: e.tries, tenantId: e.tenantId, now: Date.now() } : null })
  if (!e) return { ok: false, reason: 'no_otp' }
  if (Date.now() > e.expiresAt) {
    store.delete(String(nome))
    console.log('[OTP-STORE] verifyOtp expired', { nome: String(nome) })
    return { ok: false, reason: 'expired' }
  }
  e.tries += 1
  if (e.tries > 5) {
    store.delete(String(nome))
    console.log('[OTP-STORE] verifyOtp too many attempts', { nome: String(nome) })
    return { ok: false, reason: 'too_many_attempts' }
  }
  if (String(code) === e.code) {
    store.delete(String(nome))
    console.log('[OTP-STORE] verifyOtp SUCCESS', { nome: String(nome), tenantId: e.tenantId })
    return { ok: true, tenantId: e.tenantId }
  }
  console.log('[OTP-STORE] verifyOtp invalid code', { nome: String(nome), providedCode: String(code), expectedCode: e.code })
  return { ok: false, reason: 'invalid' }
}
