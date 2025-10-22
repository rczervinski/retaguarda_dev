import { NextRequest, NextResponse } from 'next/server'
import { query, transaction } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const runtime = 'nodejs'

type Mode = 'numeric' | 'alphabetic' | 'sizes' | 'custom'

interface Body {
  mode: Mode
  // para 'custom', sequência explícita (case-insensitive); tokens separados já normalizados pelo cliente, mas aqui aceitamos array
  sequence?: string[]
}

export const POST = withTenant(async (req: NextRequest, params?: { codigo?: string }) => {
  const inicio = Date.now()
  const codigoInternoStr = params?.codigo

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  try {
    if (!codigoInternoStr) {
      return NextResponse.json({ success: false, error: 'Código do produto é obrigatório' }, { status: 400 })
    }
    const codigoInterno = parseInt(String(codigoInternoStr), 10)
    if (!Number.isFinite(codigoInterno)) {
      return NextResponse.json({ success: false, error: 'Código inválido' }, { status: 400 })
    }

    // Carregar linhas atuais do produto
    const rowsRes = await query(
      `SELECT codigo, codigo_gtin, variacao, caracteristica
       FROM produtos_gd
       WHERE codigo_interno = $1 AND (nome IS NULL OR nome <> 'composicao')
       ORDER BY codigo ASC`,
      [codigoInterno]
    )
    const current: Array<{ codigo: number; codigo_gtin: string | null; variacao: string | null; caracteristica: string | null }> = rowsRes.rows

    if (!current.length) {
      return NextResponse.json({ success: true, message: 'Nada para ordenar', count: 0, tempo_ms: Date.now() - inicio })
    }

    // Preparar lista ordenada por caracteristica, conforme modo
    const numericKey = (s: string | null) => {
      const m = (s || '').replace(/[^0-9]+/g, '')
      return m ? parseInt(m, 10) : 0
    }

    // Helpers para ordenação por caracteristica
    const normalize = (s: string | null) => (s || '').trim().toUpperCase()
    const sizesPreset = ['PP','P','M','G','GG','G1','G2','G3','G4']
    const customSeq = (Array.isArray(body.sequence) ? body.sequence : []).map(s => normalize(s))

    const ordered = [...current].sort((a, b) => {
      if (body.mode === 'numeric') {
        const ka = numericKey(a.caracteristica)
        const kb = numericKey(b.caracteristica)
        if (ka !== kb) return ka - kb
        // empate: fallback alfabético
        const sa = normalize(a.caracteristica)
        const sb = normalize(b.caracteristica)
        if (sa !== sb) return sa < sb ? -1 : 1
        return Number(a.codigo) - Number(b.codigo)
      } else if (body.mode === 'alphabetic') {
        const sa = normalize(a.caracteristica)
        const sb = normalize(b.caracteristica)
        if (sa !== sb) return sa < sb ? -1 : 1
        return Number(a.codigo) - Number(b.codigo)
      } else if (body.mode === 'sizes') {
        const sa = normalize(a.caracteristica)
        const sb = normalize(b.caracteristica)
        const ia = sizesPreset.indexOf(sa)
        const ib = sizesPreset.indexOf(sb)
        const va = ia >= 0 ? ia : Number.POSITIVE_INFINITY
        const vb = ib >= 0 ? ib : Number.POSITIVE_INFINITY
        if (va !== vb) return va - vb
        // não mapeados: ordena alfabético
        if (sa !== sb) return sa < sb ? -1 : 1
        return Number(a.codigo) - Number(b.codigo)
      } else { // custom
        const sa = normalize(a.caracteristica)
        const sb = normalize(b.caracteristica)
        const ia = customSeq.length ? customSeq.indexOf(sa) : -1
        const ib = customSeq.length ? customSeq.indexOf(sb) : -1
        const va = ia >= 0 ? ia : Number.POSITIVE_INFINITY
        const vb = ib >= 0 ? ib : Number.POSITIVE_INFINITY
        if (va !== vb) return va - vb
        if (sa !== sb) return sa < sb ? -1 : 1
        return Number(a.codigo) - Number(b.codigo)
      }
    })

    // Slots finais: os mesmos códigos existentes, ordenados asc
    const slots = [...current.map(r => Number(r.codigo))].sort((a, b) => a - b)
    if (slots.length !== ordered.length) {
      return NextResponse.json({ success: false, error: 'Conjunto de linhas mudou durante a operação' }, { status: 409 })
    }

    const TEMP_BASE = '1000000000000'

    await transaction(async (client) => {
      // Fase 1: move cada linha (na ordem desejada) para TEMP_BASE + idx
      for (let i = 0; i < ordered.length; i++) {
        const oldCodigo = Number(ordered[i].codigo)
        await client.query(
          `UPDATE produtos_gd
           SET codigo = (CAST($1 AS BIGINT) + $2)
           WHERE codigo = $3 AND codigo_interno = $4 AND (nome IS NULL OR nome <> 'composicao')`,
          [TEMP_BASE, i + 1, oldCodigo, codigoInterno]
        )
      }
      // Fase 2: traz de volta atribuindo os slots finais em ordem
      for (let i = 0; i < ordered.length; i++) {
        const finalCodigo = slots[i]
        await client.query(
          `UPDATE produtos_gd
           SET codigo = $1
           WHERE codigo = (CAST($2 AS BIGINT) + $3) AND codigo_interno = $4 AND (nome IS NULL OR nome <> 'composicao')`,
          [finalCodigo, TEMP_BASE, i + 1, codigoInterno]
        )
      }
    })

    // Ajustar sequence do PK (se existir). Se não existir, ignorar erro.
    try {
      await query(`SELECT setval(pg_get_serial_sequence('produtos_gd','codigo'), (SELECT MAX(codigo) FROM produtos_gd))`)
    } catch (e) {
      // silencioso: algumas bases podem ter PK sem sequence default
    }

    return NextResponse.json({
      success: true,
      message: 'Ordenação aplicada',
      count: ordered.length,
      tempo_ms: Date.now() - inicio
    })
  } catch (e: any) {
    console.error('🔴 [GRADE ORDER] ERRO:', e)
    return NextResponse.json({ success: false, error: 'Erro ao ordenar grade', detalhe: e.message }, { status: 500 })
  }
})
