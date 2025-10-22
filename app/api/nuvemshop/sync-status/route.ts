import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { getActiveNuvemshopCredentials } from '@/lib/nuvemshop-api';

async function fetchAllRemoteProducts(): Promise<any[]> {
  const creds = await getActiveNuvemshopCredentials();
  const headers: Record<string,string> = {
    'Authentication': `bearer ${creds.accessToken}`,
    'User-Agent': creds.userAgent,
    'Accept': 'application/json'
  };
  const base = `https://api.tiendanube.com/v1/${creds.storeId}`;
  const out: any[] = [];
  let page = 1;
  const limit = 50;
  for (;;) {
    const url = `${base}/products?page=${page}&per_page=${limit}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Falha ao listar produtos página ${page}: ${res.status}`);
    const arr = await res.json().catch(()=>[]);
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < limit) break; // última página
    page++;
    if (page > 40) break; // safety (máx ~2000 produtos nesta chamada)
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    // Estratégia: carrega mapping local -> carrega produtos remotos -> identifica quais IDs remotos sumiram.
    const local = await query(`SELECT codigo_interno, product_id FROM produtos_nuvemshop WHERE product_id IS NOT NULL`, []);
    const localMap: Record<string, number> = {};
    for (const r of local.rows || []) {
      if (r.product_id != null) localMap[String(r.product_id)] = Number(r.codigo_interno);
    }
    const remotos = await fetchAllRemoteProducts();
    const remoteIds = new Set(remotos.map(r => String(r.id)));
    const missing: Array<{ product_id: number; codigo_interno: number }> = [];
    for (const pidStr of Object.keys(localMap)) {
      if (!remoteIds.has(pidStr)) {
        missing.push({ product_id: Number(pidStr), codigo_interno: localMap[pidStr] });
      }
    }
    // Marcar ausentes limpando product_id (mantém histórico local)
    for (const m of missing) {
      await query(`UPDATE produtos_nuvemshop SET product_id = NULL, variant_id = NULL, last_error = 'Removido na NuvemShop', updated_at = NOW() WHERE codigo_interno = $1`, [m.codigo_interno]);
    }
    return NextResponse.json({ success: true, totalLocal: local.rows.length, totalRemotos: remotos.length, removidos: missing.length, missing });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, info: 'Use POST para sincronizar status.' }, { status: 400 });
}