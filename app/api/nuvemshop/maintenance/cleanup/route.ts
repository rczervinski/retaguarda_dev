import { NextResponse } from 'next/server';
import { query } from '@/lib/database';

// Limpeza simples: eventos >30 dias e mappings sem product_id/variant_id há >30 dias com erro
export async function POST() {
  try {
    const delEventos = await query(`DELETE FROM produtos_nuvemshop_eventos WHERE received_at < NOW() - INTERVAL '30 days' RETURNING id`, []);
    const cleanMappings = await query(`UPDATE produtos_nuvemshop SET last_error = NULL WHERE last_error IS NOT NULL AND updated_at < NOW() - INTERVAL '30 days' RETURNING codigo_interno`, []);
    return NextResponse.json({ success: true, eventosRemovidos: delEventos.rowCount, mappingsLimpos: cleanMappings.rowCount });
  } catch (e:any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
