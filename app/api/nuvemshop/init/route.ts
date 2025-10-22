import { NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { getActiveNuvemshopCredentials } from '@/lib/nuvemshop-api';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

async function ensureEventosTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS produtos_nuvemshop_eventos (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      event VARCHAR(60) NOT NULL,
      product_id BIGINT,
      variant_id BIGINT,
      codigo_interno BIGINT,
      hmac_valid BOOLEAN,
      payload JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_pn_eventos_product ON produtos_nuvemshop_eventos(product_id);
    CREATE INDEX IF NOT EXISTS idx_pn_eventos_event ON produtos_nuvemshop_eventos(event);
  `, []);
}

async function listWebhooks() {
  const { accessToken, storeId, userAgent } = await getActiveNuvemshopCredentials();
  const res = await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return [];
  return res.json().catch(()=>[]);
}

async function createWebhook(event: string, url: string) {
  const { accessToken, storeId, userAgent } = await getActiveNuvemshopCredentials();
  const res = await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
    method: 'POST',
    headers: {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ event, url })
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> '');
    console.warn('[NUVEMSHOP_INIT] Falha ao criar webhook', event, res.status, t);
  }
}

async function ensureWebhooks(baseUrl: string) {
  const desired = ['product/created','product/updated','product/deleted'];
  const existing = await listWebhooks();
  const existingSet = new Set((existing||[]).map((w:any)=>`${w.event}|${w.url}`));
  for (let i=0;i<desired.length;i++) {
    const ev = desired[i];
    const url = `${baseUrl}/api/nuvemshop/webhook`;
    let already = false;
    existingSet.forEach((val:any)=> { if (!already && typeof val === 'string' && val.indexOf(ev+'|')===0) already = true; });
    if (!already) await createWebhook(ev, url);
  }
}

// Endpoint para inicializar integrações NuvemShop: cria tabela produtos_nuvemshop se não existir.
export async function POST() {
  try {
  await query(`
      CREATE TABLE IF NOT EXISTS produtos_nuvemshop (
        codigo_interno BIGINT PRIMARY KEY REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
        parent_codigo_interno BIGINT REFERENCES produtos(codigo_interno) ON DELETE CASCADE,
        sku VARCHAR(60),
        barcode VARCHAR(60),
        product_id BIGINT,
        variant_id BIGINT,
        last_status VARCHAR(10),
        last_sync_at TIMESTAMPTZ,
        last_error TEXT,
        sync_attempts INT DEFAULT 0,
        payload_snapshot JSONB,
        needs_update BOOLEAN DEFAULT FALSE,
        estoque_enviado INT,
        preco_enviado NUMERIC(14,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_sku ON produtos_nuvemshop(sku);
      CREATE INDEX IF NOT EXISTS idx_produtos_nuvemshop_parent ON produtos_nuvemshop(parent_codigo_interno);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_nuvemshop_product_variant ON produtos_nuvemshop(product_id, variant_id) WHERE variant_id IS NOT NULL;
    `, []);
    await ensureEventosTable();

    const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (baseUrl) {
      await ensureWebhooks(baseUrl.replace(/\/$/, ''));
    } else {
      console.warn('[NUVEMSHOP_INIT] APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definido - webhooks não registrados');
    }
    return NextResponse.json({ success: true, created: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
