import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { getCurrentDbUrl } from './request-context'

// Detectar se precisa SSL (AWS RDS, Neon, Supabase, etc)
function getGlobalUrl() {
  return process.env.DATABASE_URL || ''
}
const url = getGlobalUrl()
const sslModeFromUrl = /[?&]sslmode=([^&]+)/i.exec(url)?.[1]
const needsSSL =
  sslModeFromUrl === 'require' ||
  sslModeFromUrl === 'verify-full' ||
  sslModeFromUrl === 'verify-ca' ||
  process.env.DB_SSL_MODE === 'require' ||
  process.env.DB_SSL_MODE === 'verify-full' ||
  process.env.DB_SSL_MODE === 'verify-ca' ||
  url.includes('rds.amazonaws.com') ||
  process.env.NODE_ENV === 'production'

// Se explicitamente solicitado 'no-verify', desabilitar verificação globalmente
if (sslModeFromUrl === 'no-verify' || process.env.DB_SSL_MODE === 'no-verify') {
  // Atenção: afeta todas as conexões TLS do processo
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.warn('⚠️ [DATABASE] NODE_TLS_REJECT_UNAUTHORIZED=0 aplicado (no-verify mode)')
}

// Preparar configuração SSL
let ssl: any = false

// 1) Se houver CA fornecido (path ou inline), priorizar verificação estrita
const caPath = process.env.DB_SSL_CA_PATH
const caInline = process.env.DB_SSL_CA
try {
  const ca = caInline || (caPath ? fs.readFileSync(path.resolve(caPath), 'utf8') : undefined)
  if (ca) {
    ssl = { ca, rejectUnauthorized: true }
  }
} catch (err) {
  console.warn('⚠️ [DATABASE] Falha ao ler CA em DB_SSL_CA_PATH:', err)
}

// 2) Se não houver CA e precisar SSL, aplicar modo conforme variável/url
if (!ssl && (needsSSL || sslModeFromUrl === 'no-verify' || process.env.DB_SSL_MODE === 'no-verify')) {
  // Modo sem verificação (resolve SELF_SIGNED_CERT_IN_CHAIN em dev)
  ssl = { rejectUnauthorized: false }
}

console.log(`🔐 [DATABASE] SSL habilitado: ${Boolean(ssl)} | sslModeFromUrl=${sslModeFromUrl || 'n/a'} | DB_SSL_MODE=${process.env.DB_SSL_MODE || 'n/a'}`)

// Configuração da pool de conexões
// Pool por DB URL (multi-tenant). Mantém um pool default para fallback.
const pools = new Map<string, Pool>()

/**
 * Detecta configuração SSL para uma dbUrl específica
 */
function getSSLForUrl(dbUrl: string): any {
  // Extrair sslmode da URL
  const sslModeMatch = /[?&]sslmode=([^&]+)/i.exec(dbUrl)
  const sslMode = sslModeMatch?.[1]
  
  // Forçar no-verify se DB_SSL_MODE global está setado
  const globalSSLMode = process.env.DB_SSL_MODE
  
  // Casos onde SSL deve ser desabilitado
  const disableSSL = 
    sslMode === 'disable' ||
    dbUrl.includes('cloudclusters.net')
  
  // Se explicitamente disable, retornar false
  if (disableSSL) {
    return false
  }
  
  // Casos onde SSL é necessário
  const needsSSL = 
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca' ||
    dbUrl.includes('rds.amazonaws.com') ||
    dbUrl.includes('neon.tech') ||
    dbUrl.includes('supabase')
  
  // Se precisa SSL ou global no-verify está setado
  if (needsSSL || globalSSLMode === 'no-verify' || sslMode === 'no-verify') {
    return { rejectUnauthorized: false }
  }
  
  // Default: sem SSL
  return false
}

function getPoolFor(dbUrl?: string): Pool {
  const key = dbUrl || getGlobalUrl()
  let p = pools.get(key)
  if (!p) {
    const sslConfig = key ? getSSLForUrl(key) : ssl
    console.log(`🔍 [DATABASE] Conectar: ${key.substring(0, 50)}... | SSL: ${Boolean(sslConfig)}`)
    p = new Pool({
      connectionString: key,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    })
    pools.set(key, p)
  }
  return p
}

// Função para executar queries
export async function query(text: string, params?: any[], opts?: { dbUrl?: string }) {
  const currentUrl = opts?.dbUrl || getCurrentDbUrl() || getGlobalUrl()
  const pool = getPoolFor(currentUrl)
  const start = Date.now()
  let client
  
  try {
    // Timeout personalizado para aquisição da conexão
    client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao conectar ao pool após 20s')), 20000)
      )
    ]) as any
    
    const result = await client.query(text, params)
    const duration = Date.now() - start
    
    console.log(`🔍 [DATABASE] Query executada em ${duration}ms`)
    return result
  } catch (error: any) {
    const duration = Date.now() - start
    console.error(`❌ [DATABASE] Erro na query após ${duration}ms:`)
    console.error(`❌ [DATABASE] Tipo do erro: ${error.constructor.name}`)
    console.error(`❌ [DATABASE] Mensagem: ${error.message}`)
    console.error(`❌ [DATABASE] Código: ${error.code}`)
    
    // Re-throw com informações mais detalhadas
    throw new Error(`Database error: ${error.message} (${error.code || 'NO_CODE'})`)
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Função para executar transações
export async function transaction(callback: (client: any) => Promise<any>, opts?: { dbUrl?: string }) {
  const currentUrl = opts?.dbUrl || getCurrentDbUrl() || getGlobalUrl()
  const pool = getPoolFor(currentUrl)
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ [DATABASE] Erro na transação:', error)
    throw error
  } finally {
    client.release()
  }
}

// Teste de conexão
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as timestamp')
    console.log('✅ Conexão com PostgreSQL estabelecida:', result.rows[0].timestamp)
    return true
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error)
    return false
  }
}

// Inicializar teste de conexão apenas em produção
if (process.env.NODE_ENV === 'production') {
  testConnection()
}

export { getPoolFor }