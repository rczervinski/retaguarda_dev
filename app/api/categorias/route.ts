import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs';

export const GET = withTenant(async (request: NextRequest) => {
  console.log('📂 API /api/categorias GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'categoria', 'grupo', 'subgrupo'

    if (!tipo || !['categoria', 'grupo', 'subgrupo'].includes(tipo)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo deve ser: categoria, grupo ou subgrupo'
      }, { status: 400 });
    }

    console.log('📝 Tipo solicitado:', tipo);

    // Buscar valores únicos da coluna especificada
    const sql = `
      SELECT DISTINCT ${tipo}
      FROM produtos_ib 
      WHERE ${tipo} IS NOT NULL 
        AND ${tipo} != ''
      ORDER BY ${tipo} ASC
    `;

    console.log('🔍 Executando query para buscar', tipo + 's...'); 
    const result = await query(sql);

    // Extrair apenas os valores (não objetos)
    const valores = result.rows.map((row: any) => row[tipo]).filter(Boolean);

    console.log(`📦 ${tipo}s encontradas: ${valores.length}`);

    return NextResponse.json({
      success: true,
      data: valores
    });

  } catch (error) {
    console.error('❌ Erro ao buscar categorias:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
});
