import { getActiveNuvemshopCredentials } from '@/lib/nuvemshop-api';

// Tipos básicos conforme docs
export interface NuvemshopCategory {
  id: number;
  name: { pt?: string; en?: string; es?: string };
  handle?: { pt?: string; en?: string; es?: string };
  parent: number | null;
  subcategories?: number[];
}

export class CategoryLimitError extends Error {
  constructor(msg = 'Store has reached maximum limit of 1000 allowed categories') {
    super(msg);
    this.name = 'CategoryLimitError';
  }
}

function normalizeName(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const { storeId } = await getActiveNuvemshopCredentials();
  const base = `https://api.tiendanube.com/v1/${storeId}`;
  const q = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return q ? `${base}${path}?${q}` : `${base}${path}`;
}

async function nsFetch<T = any>(path: string, options: { method?: string; body?: any; query?: Record<string, any> } = {}): Promise<T> {
  const { accessToken, userAgent } = await getActiveNuvemshopCredentials();
  const url = await buildUrl(path, options.query);
  const headers: Record<string, string> = {
    Authentication: `bearer ${accessToken}`,
    'User-Agent': userAgent,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 422 && /maximum limit of 1000 allowed categories/i.test(txt)) {
      throw new CategoryLimitError();
    }
    throw new Error(`NuvemShop ${options.method || 'GET'} ${url} -> ${res.status} ${res.statusText} body=${txt.slice(0, 400)}`);
  }
  const json = await res.json().catch(() => undefined);
  return json as T;
}

export async function listCategories(params: { parent_id?: number | null; language?: 'pt' | 'es' | 'en'; page?: number; per_page?: number } = {}): Promise<NuvemshopCategory[]> {
  const { parent_id, language = 'pt', page = 1, per_page = 200 } = params;
  return nsFetch<NuvemshopCategory[]>(`/categories`, { method: 'GET', query: { parent_id: parent_id ?? undefined, language, page, per_page } });
}

export async function listAllCategories(language: 'pt' | 'es' | 'en' = 'pt'): Promise<NuvemshopCategory[]> {
  const per_page = 200;
  let page = 1;
  let all: NuvemshopCategory[] = [];
  while (true) {
    const batch = await listCategories({ language, page, per_page }).catch((e) => {
      // se a loja não tem nenhuma categoria, API retorna [] com 200 OK
      throw e;
    });
    all = all.concat(batch || []);
    if (!batch || batch.length < per_page) break;
    page++;
  }
  return all;
}

export async function findChildByName(parentId: number | null, name: string, language: 'pt' | 'es' | 'en' = 'pt'): Promise<NuvemshopCategory | null> {
  const target = normalizeName(name);
  let page = 1;
  const per_page = 200;
  while (true) {
    const children = await listCategories({ parent_id: parentId ?? null, language, page, per_page });
    if (!children.length) return null;
    const found = children.find((c) => normalizeName(c?.name?.[language] || '') === target);
    if (found) return found;
    if (children.length < per_page) return null;
    page++;
  }
}

export async function createCategoryPt(name: string, parentId?: number | null): Promise<NuvemshopCategory> {
  const body = { name: { pt: name }, parent: parentId ?? null };
  return nsFetch<NuvemshopCategory>(`/categories`, { method: 'POST', body });
}

export interface EnsurePathResult { leafId: number; pathIds: number[]; }

export async function ensureCategoryPathExists(names: string[], language: 'pt' | 'es' | 'en' = 'pt'): Promise<EnsurePathResult | null> {
  const clean = names.map((n) => (n || '').trim()).filter(Boolean);
  if (!clean.length) return null; // sem categorias definidas

  let parentId: number | null = null;
  const pathIds: number[] = [];
  for (const rawName of clean) {
    // Buscar filho pelo nome sob o parent atual
    let node = await findChildByName(parentId, rawName, language);
    if (!node) {
      // Criar
      node = await createCategoryPt(rawName, parentId);
    }
    pathIds.push(node.id);
    parentId = node.id;
  }
  return { leafId: pathIds[pathIds.length - 1], pathIds };
}
