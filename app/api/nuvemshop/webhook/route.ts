import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import crypto from 'crypto';

// Forçar renderização dinâmica para evitar problemas durante build
export const dynamic = 'force-dynamic'

// Webhook reduzido: somente aceita deleções remotas de produtos.

function verifyHmac(raw: string, header?: string | null) {
  const secret = process.env.NUVEMSHOP_APP_SECRET || process.env.APP_SECRET;
  if (!secret || !header) return false;
  const calc = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(header)); } catch { return false; }
}

async function ensureEventosTabela() {
  try {
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
  } catch {}
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch {}
  const event = String(payload?.event || 'unknown');
  const productId = payload?.id ? Number(payload.id) : null;
  const variantId = payload?.variant_id ? Number(payload.variant_id) : null;
  const hmacHeader = req.headers.get('x-linkedstore-hmac-sha256') || req.headers.get('http_x_linkedstore_hmac_sha256');
  const hmacValid = verifyHmac(raw, hmacHeader);

  await ensureEventosTabela();

  if (event !== 'product/deleted') {
    // Ignorado – apenas para auditoria opcional
    try { await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5)` , ['remote/ignored_'+event, productId, variantId, hmacValid, payload]); } catch {}
    return NextResponse.json({ success: true, ignored: true });
  }

  if (!productId) {
    return NextResponse.json({ success: false, error: 'product_id ausente no payload' }, { status: 400 });
  }

  // Registrar evento de deleção remota
  // Capturar codigos_internos antes de deletar
  let codigos: number[] = [];
  try {
    const existing = await query(`SELECT codigo_interno FROM produtos_nuvemshop WHERE product_id = $1`, [productId]);
    codigos = existing.rows.map((r: any) => Number(r.codigo_interno));
  } catch {}
  try { await query(`DELETE FROM produtos_nuvemshop WHERE product_id = $1`, [productId]); } catch (e) { console.warn('[NUVEMSHOP_WEBHOOK] Falha ao remover mappings', e); }
  // Limpar tags NS (ns = NULL) dos produtos afetados
  if (codigos.length) {
    const placeholders = codigos.map((_,i)=>`$${i+1}`).join(',');
    try { await query(`UPDATE produtos SET ns = NULL WHERE codigo_interno IN (${placeholders})`, codigos); } catch (e) { console.warn('[NUVEMSHOP_WEBHOOK] Falha ao limpar tags NS', e); }
  }
  try { await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, hmac_valid, payload, codigo_interno) VALUES ($1,$2,$3,$4,$5,$6)` , ['remote/product_deleted', productId, variantId, hmacValid, { productId, variantId, removed_codigos: codigos, note: 'Deletado via NuvemShop' }, codigos[0] || null]); } catch {}
  return NextResponse.json({ success: true, removed_product_id: productId, removed_codigos: codigos });
}
