import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { deleteVariant, deleteProductById } from '@/lib/nuvemshop-api';

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
  try {
    const body = await req.json().catch(()=>({}));
    const { codigo_interno, forceDeleteParent } = body;
    if (!codigo_interno) return NextResponse.json({ success:false, error:'codigo_interno obrigatório' }, { status:400 });

    await ensureEventosTabela();
    const mapRes = await query(`SELECT product_id, variant_id, parent_codigo_interno FROM produtos_nuvemshop WHERE codigo_interno = $1 AND tipo = 'VARIANT'`, [codigo_interno]);
    if (!mapRes.rows?.length) return NextResponse.json({ success:false, error:'Variante não mapeada' }, { status:404 });
    const { product_id, variant_id, parent_codigo_interno } = mapRes.rows[0];
    if (!product_id || !variant_id) return NextResponse.json({ success:false, error:'IDs insuficientes (product_id/variant_id)' }, { status:400 });

    // Deleta variante na NuvemShop
    await deleteVariant(product_id, variant_id);

    // Remove mapeamento local da variante
    await query(`DELETE FROM produtos_nuvemshop WHERE codigo_interno = $1`, [codigo_interno]);

    // Regras de limpeza de tag ENSV/ENSP
    // Variante: remover ENSV da variante
    try { await query(`UPDATE produtos SET ns = NULL WHERE codigo_interno = $1`, [codigo_interno]); } catch {}

    // Verificar se ainda existem variantes do mesmo product_id
    const restantes = await query(`SELECT COUNT(*)::int AS total FROM produtos_nuvemshop WHERE product_id = $1 AND tipo = 'VARIANT'`, [product_id]);
    const totalRestantes = restantes.rows?.[0]?.total ?? 0;

    let parentDeleted = false;
    if (totalRestantes === 0 && forceDeleteParent) {
      // Excluir também o produto pai na NuvemShop
      await deleteProductById(product_id);
      // Limpar mapeamento/linhas do pai
      await query(`DELETE FROM produtos_nuvemshop WHERE product_id = $1`, [product_id]);
      // Remover ENSP do pai
      if (parent_codigo_interno) {
        try { await query(`UPDATE produtos SET ns = NULL WHERE codigo_interno = $1`, [parent_codigo_interno]); } catch {}
      }
      parentDeleted = true;
    }

    // Registrar evento local
    try {
      await query(`INSERT INTO produtos_nuvemshop_eventos (event, product_id, variant_id, codigo_interno, hmac_valid, payload)
                   VALUES ($1,$2,$3,$4,$5,$6)`,
                  ['local/variant_deleted', product_id, variant_id, codigo_interno, true, { parent_deleted: parentDeleted }]);
    } catch {}

    return NextResponse.json({ success:true, product_id, variant_id, parent_deleted: parentDeleted });
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e.message }, { status:500 });
  }
}
