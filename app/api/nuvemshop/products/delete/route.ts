import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { deleteProductById } from '@/lib/nuvemshop-api';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

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

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { codigo_interno } = body || {};
    if (!codigo_interno) return NextResponse.json({ success: false, error: 'codigo_interno obrigatório' }, { status: 400 });

    await ensureEventosTabela();
    const map = await query(`SELECT product_id FROM produtos_nuvemshop WHERE codigo_interno = $1 LIMIT 1`, [codigo_interno]);
    if (!map.rows.length || !map.rows[0].product_id) {
      return NextResponse.json({ success: false, error: 'Mapping não encontrado' }, { status: 404 });
    }
    const productId = Number(map.rows[0].product_id);

    await deleteProductById(productId).catch(err => { throw new Error('Falha ao deletar remoto: '+ err.message); });
    const removed = await query(`DELETE FROM produtos_nuvemshop WHERE product_id = $1 RETURNING codigo_interno`, [productId]);

    // Limpar tags NS (ENS/ENSP/ENSV) dos produtos afetados
    const codigos = removed.rows.map((r:any)=> r.codigo_interno).filter((v:any)=> v!=null);
    if (codigos.length > 0) {
      const params = codigos.map((_:any, i:number)=> `$${i+1}`).join(',');
      try { await query(`UPDATE produtos SET ns = NULL WHERE codigo_interno IN (${params})`, codigos); } catch {}
    }

    try { await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, codigo_interno, hmac_valid, payload) VALUES ($1,$2,$3,$4,$5)` , ['local/product_deleted', productId, codigo_interno, true, { codigo_interno, removed: codigos }]); } catch {}
    return NextResponse.json({ success: true, product_id: productId, removed_codigos: codigos });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})