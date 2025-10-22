import { NextRequest, NextResponse } from 'next/server';
import { fetchProductForExport, fetchVariantsForParent } from '@/lib/nuvemshop-product';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const codigo_interno = searchParams.get('codigo_interno');
    if (!codigo_interno) {
      return NextResponse.json({ success: false, error: 'codigo_interno obrigatório' }, { status: 400 });
    }
    const base = await fetchProductForExport(codigo_interno);
    if (!base) return NextResponse.json({ success: false, error: 'Produto não encontrado' }, { status: 404 });

    const variantes = await fetchVariantsForParent(codigo_interno);
    const variantCount = variantes.length;
    const warnings: string[] = [];

    let tipoDetectado: 'NORMAL' | 'PARENT' | 'VARIANT' = 'NORMAL';
    if (variantCount >= 2) tipoDetectado = 'PARENT';
    else if (variantCount === 1) warnings.push('Existe apenas 1 item na grade; será tratado como produto normal se exportado agora.');

    return NextResponse.json({
      success: true,
      codigo_interno,
      tipoDetectado,
      variantCount,
      warnings
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
})
