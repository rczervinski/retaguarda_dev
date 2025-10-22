import { NextRequest, NextResponse } from 'next/server';
import { listAllCategories, NuvemshopCategory } from '@/lib/nuvemshop-categories';
import { withTenant } from '@/lib/with-tenant';

export const runtime = 'nodejs'

function buildTree(categories: NuvemshopCategory[]) {
  const byId = new Map<number, NuvemshopCategory & { children: any[] }>();
  const roots: Array<NuvemshopCategory & { children: any[] }> = [];
  for (const c of categories) byId.set(c.id, { ...c, children: [] });
  for (const c of categories) {
    const node = byId.get(c.id)!;
    if (c.parent) {
      const parent = byId.get(c.parent);
      if (parent) parent.children.push(node);
      else roots.push(node); // órfãos (incomuns) sobem como raiz
    } else {
      roots.push(node);
    }
  }
  // Ordena por nome pt
  const sortRec = (arr: any[]) => {
    arr.sort((a, b) => ((a.name?.pt || '').localeCompare(b.name?.pt || '', 'pt')));
    for (const n of arr) if (n.children?.length) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export const GET = withTenant(async (_req: NextRequest) => {
  try {
    const all = await listAllCategories('pt');
    const tree = buildTree(all || []);
    return NextResponse.json({ success: true, data: { flat: all, tree } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao listar categorias' }, { status: 500 });
  }
})
