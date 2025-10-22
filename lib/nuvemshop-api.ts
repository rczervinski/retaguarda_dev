// Direct NuvemShop API helper (sem dependência do PHP legacy)
// As credenciais são buscadas prioritariamente da tabela token_integracao (descricao='NUVEMSHOP' AND ativo=1)
// Fallback: variáveis de ambiente (NUVEMSHOP_STORE_ID, NUVEMSHOP_ACCESS_TOKEN) se não houver registro ativo

import { query } from '@/lib/database';
import { getCurrentDbUrl, getCurrentTenant } from '@/lib/request-context';

interface ApiOptions { method?: string; body?: any; query?: Record<string, string | number | undefined | null>; }

interface NuvemshopCredentials { storeId: string; accessToken: string; userAgent: string; }

// Cache de credenciais por contexto (tenant/dbUrl) para evitar vazamento entre clientes
type CacheEntry = { creds: NuvemshopCredentials; lastFetch: number };
const credsCache = new Map<string, CacheEntry>();
const CACHE_MS = 60_000; // 1 minuto

function getCacheKey() {
  const t = getCurrentTenant()?.id || 'no-tenant';
  const db = getCurrentDbUrl() || process.env.DATABASE_URL || 'no-db';
  return `${t}|${db}`;
}

export async function getActiveNuvemshopCredentials(forceRefresh = false): Promise<NuvemshopCredentials> {
  const now = Date.now();
  const key = getCacheKey();
  const cached = credsCache.get(key);
  if (!forceRefresh && cached && (now - cached.lastFetch) < CACHE_MS) return cached.creds;

  // Buscar do banco
  const dbResult = await query(`
    SELECT access_token, user_id, code, url_checkout, ativo
    FROM token_integracao
    WHERE descricao = 'NUVEMSHOP' AND ativo = 1
    ORDER BY codigo DESC
    LIMIT 1
  `, []);

  let accessToken: string | undefined;
  let storeId: string | undefined;
  if (dbResult.rows?.length) {
    const row = dbResult.rows[0];
    accessToken = row.access_token;
    // Alguns fluxos salvaram store id em user_id; outros em code. Escolher o que tiver valor.
    storeId = row.user_id || row.code;
  }

  // Fallback para env se banco não retornar
  if (!accessToken) accessToken = process.env.NUVEMSHOP_ACCESS_TOKEN;
  if (!storeId) storeId = process.env.NUVEMSHOP_STORE_ID;

  if (!accessToken || !storeId) {
    throw new Error('Credenciais NuvemShop não encontradas (BD ou variáveis de ambiente).');
  }

  // Sanitize user agent to remove invalid characters (newlines, control chars)
  const rawUserAgent = process.env.NUVEMSHOP_USER_AGENT || 'RetaguardaApp (contato@example.com)';
  const userAgent = String(rawUserAgent)
    .replace(/[\r\n\t]+/g, ' ')  // Replace CR, LF, TAB with space
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII chars
    .trim()                       // Remove leading/trailing spaces
    .slice(0, 200);              // Limit length to 200 chars
  
  const creds = { storeId: String(storeId), accessToken: String(accessToken), userAgent };
  credsCache.set(key, { creds, lastFetch: now });
  return creds;
}

async function getConfig() { return getActiveNuvemshopCredentials(); }

async function buildUrl(path: string, queryParams?: ApiOptions['query']) {
  const { storeId } = await getConfig();
  const base = `https://api.tiendanube.com/v1/${storeId}`;
  const q = queryParams ? Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&') : '';
  return q ? `${base}${path}?${q}` : `${base}${path}`;
}

async function apiFetch<T=any>(path: string, { method = 'GET', body, query }: ApiOptions = {}): Promise<T> {
  const { accessToken, userAgent } = await getConfig();
  const url = await buildUrl(path, query);
  const startedAt = Date.now();
  const headers: Record<string,string> = {
    'Authentication': `bearer ${accessToken}`,
    'User-Agent': userAgent,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  const controller = new AbortController();
  const timeoutMs = 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      throw new Error(`NuvemShop ${method} ${url} -> ${res.status} ${res.statusText} body=${txt.slice(0,400)}`);
    }
    const json = await res.json().catch(()=>undefined);
    return json as T;
  } catch (err: any) {
    const elapsed = Date.now() - startedAt;
    console.error('[NUVEMSHOP_API] Falha', { path, method, elapsed, message: err?.message });
    throw err;
  }
}

// Search product by SKU. According to API, filtering param is sku.
export async function searchProductBySKU(sku: string) { return apiFetch<any[]>('/products', { query: { sku } }); }

export async function createProduct(body: any) {
  return apiFetch('/products', { method: 'POST', body });
}

export async function updateProduct(productId: string | number, body: any) {
  return apiFetch(`/products/${productId}`, { method: 'PUT', body });
}

// Busca primeiro produto por SKU e devolve objeto normalizado ou null
export async function findSingleProductBySKU(sku: string) {
  const list = await searchProductBySKU(sku);
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[0];
}

// Upsert com verificação explícita (não incluir variants no PUT se causar 422)
export async function upsertProductSmart(productPayload: any) {
  const sku = productPayload?.variants?.[0]?.sku || productPayload?.sku;
  if (!sku) throw new Error('SKU ausente no payload para upsert');
  const { accessToken, storeId, userAgent } = await getConfig();
  const existing = await findSingleProductBySKU(sku).catch(() => null);
  const headers = {
    'Authentication': `bearer ${accessToken}`,
    'User-Agent': userAgent,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (existing?.id) {
    const productId = existing.id;
    // Clonar e remover variants para update (API rejeita em alguns casos)
    const updateBody = { ...productPayload };
    if (updateBody.variants) delete updateBody.variants;
    const url = `https://api.tiendanube.com/v1/${storeId}/products/${productId}`;
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(updateBody) });
    const text = await res.text().catch(()=> '');
    if (!res.ok) {
      // Se 422 e menção a variants, tentar segunda tentativa sem variants (já removidas) -> já está sem
      throw new Error(`NuvemShop PUT ${url} -> ${res.status} ${res.statusText} body=${text}`);
    }
    const json = text ? JSON.parse(text) : {};
    return { action: 'updated', id: productId, data: json };
  } else {
    const url = `https://api.tiendanube.com/v1/${storeId}/products`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(productPayload) });
    const text = await res.text().catch(()=> '');
    if (!res.ok) {
      throw new Error(`NuvemShop POST ${url} -> ${res.status} ${res.statusText} body=${text}`);
    }
    const json = text ? JSON.parse(text) : {};
    return { action: 'created', id: json.id, data: json };
  }
}

export async function deleteProductBySKU(sku: string) {
  const { accessToken, storeId, userAgent } = await getConfig();
  const existing = await findSingleProductBySKU(sku).catch(() => null);
  if (!existing?.id) return { existed: false };
  const url = `https://api.tiendanube.com/v1/${storeId}/products/${existing.id}`;
  const headers = {
    'Authentication': `bearer ${accessToken}`,
    'User-Agent': userAgent,
    'Accept': 'application/json'
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`NuvemShop DELETE ${url} -> ${res.status} ${res.statusText} body=${txt}`);
  }
  return { existed: true };
}

export async function deleteProductById(productId: number | string) {
  const { accessToken, storeId, userAgent } = await getConfig();
  const url = `https://api.tiendanube.com/v1/${storeId}/products/${productId}`;
  const headers = {
    'Authentication': `bearer ${accessToken}`,
    'User-Agent': userAgent,
    'Accept': 'application/json'
  };
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`NuvemShop DELETE ${url} -> ${res.status} ${res.statusText} body=${txt}`);
  }
  return { existed: true };
}

export async function pingNuvemShop(): Promise<boolean> { try { await apiFetch('/products', { query: { limit: 1 } }); return true; } catch { return false; } }

// ---------------- Webhooks ----------------
export async function listWebhooks() {
  return apiFetch<any[]>('/webhooks', { method: 'GET' })
}

export async function createWebhook(address: string, topic: string) {
  // Nuvemshop/Tiendanube espera campos: event e url
  const body: any = { event: topic, url: address }
  return apiFetch('/webhooks', { method: 'POST', body })
}

export async function deleteWebhook(webhookId: number | string) {
  return apiFetch(`/webhooks/${webhookId}`, { method: 'DELETE' })
}

// ---------------- Mapping-aware helpers ----------------
async function getMappedProductId(codigo_interno: string | number): Promise<number | null> {
  try {
    const res = await query(`SELECT product_id FROM produtos_nuvemshop WHERE codigo_interno = $1 LIMIT 1`, [codigo_interno]);
    const id = res.rows?.[0]?.product_id;
    return (id !== undefined && id !== null) ? Number(id) : null;
  } catch {
    return null; // tabela pode não existir ainda em algum cliente
  }
}

export async function getProductById(productId: number | string) {
  return apiFetch(`/products/${productId}`, { method: 'GET' });
}

export async function getLocalMapping(codigo_interno: string | number): Promise<{ product_id: number | null; tipo: 'NORMAL'|'PARENT'|'VARIANT'|null } | null> {
  try {
    const res = await query(`SELECT product_id, tipo FROM produtos_nuvemshop WHERE codigo_interno = $1 LIMIT 1`, [codigo_interno]);
    if (!res.rows?.length) return null;
    const row = res.rows[0];
    return { product_id: row.product_id != null ? Number(row.product_id) : null, tipo: row.tipo || null };
  } catch {
    return null;
  }
}

// Upsert que PRIORIZA o mapeamento local: se existe product_id mapeado e ainda existe na NuvemShop => PUT
// Caso contrário => POST. Não usa search por SKU para decidir, evitando colisões e sobrescritas indevidas.
export async function upsertProductWithMapping(codigo_interno: string | number, productPayload: any) {
  const { accessToken, storeId, userAgent } = await getConfig();
  const headers = {
    'Authentication': `bearer ${accessToken}`,
    'User-Agent': userAgent,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const mappedId = await getMappedProductId(codigo_interno);
  if (mappedId) {
    // Verificar se existe remoto
    const urlGet = `https://api.tiendanube.com/v1/${storeId}/products/${mappedId}`;
    const getRes = await fetch(urlGet, { method: 'GET', headers });
    if (getRes.ok) {
      // Atualizar (PUT) SEM variants
  const updateBody = { ...productPayload };
  if (updateBody.variants) delete updateBody.variants;
  if (updateBody.images) delete updateBody.images; // imagens apenas na criação; updates podem ser rejeitados
      const urlPut = `https://api.tiendanube.com/v1/${storeId}/products/${mappedId}`;
      const putRes = await fetch(urlPut, { method: 'PUT', headers, body: JSON.stringify(updateBody) });
      const putText = await putRes.text().catch(()=> '');
      if (!putRes.ok) throw new Error(`NuvemShop PUT ${urlPut} -> ${putRes.status} ${putRes.statusText} body=${putText}`);
      const json = putText ? JSON.parse(putText) : {};
      return { action: 'updated', id: mappedId, data: json };
    } else if (getRes.status !== 404) {
      const txt = await getRes.text().catch(()=> '');
      throw new Error(`NuvemShop GET ${urlGet} -> ${getRes.status} ${getRes.statusText} body=${txt}`);
    }
    // Se 404, limpar mapeamento local e cair para criação
    if (getRes.status === 404) {
      try { await query(`UPDATE produtos_nuvemshop SET product_id = NULL, variant_id = NULL, updated_at = NOW() WHERE codigo_interno = $1`, [codigo_interno]); } catch {}
    }
  }

  // Criar (POST)
  const urlPost = `https://api.tiendanube.com/v1/${storeId}/products`;
  const postRes = await fetch(urlPost, { method: 'POST', headers, body: JSON.stringify(productPayload) });
  const postText = await postRes.text().catch(()=> '');
  if (!postRes.ok) throw new Error(`NuvemShop POST ${urlPost} -> ${postRes.status} ${postRes.statusText} body=${postText}`);
  const json = postText ? JSON.parse(postText) : {};
  return { action: 'created', id: json.id, data: json };
}

// Variants helpers
export async function createVariant(productId: number | string, variantPayload: any) {
  return apiFetch(`/products/${productId}/variants`, { method: 'POST', body: variantPayload });
}

export async function updateVariant(productId: number | string, variantId: number | string, variantPayload: any) {
  return apiFetch(`/products/${productId}/variants/${variantId}`, { method: 'PUT', body: variantPayload });
}

export async function deleteVariant(productId: number | string, variantId: number | string) {
  return apiFetch(`/products/${productId}/variants/${variantId}`, { method: 'DELETE' });
}

// Product images helpers
export async function getProductImages(productId: number | string) {
  return apiFetch(`/products/${productId}/images`, { method: 'GET' });
}

export async function createProductImage(productId: number | string, imagePayload: { src: string; position?: number }) {
  return apiFetch(`/products/${productId}/images`, { method: 'POST', body: imagePayload });
}

export async function reorderProductImages(productId: number | string, items: Array<{ id: number; position: number }>) {
  return apiFetch(`/products/${productId}/images`, { method: 'PUT', body: items });
}

export async function deleteProductImage(productId: number | string, imageId: number | string) {
  return apiFetch(`/products/${productId}/images/${imageId}`, { method: 'DELETE' });
}

// ---------------- Orders ----------------
export async function getOrderById(orderId: number | string) {
  return apiFetch(`/orders/${orderId}`, { method: 'GET' });
}
