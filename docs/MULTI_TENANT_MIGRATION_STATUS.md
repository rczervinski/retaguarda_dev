# APIs Multi-tenant - Status de Migração

## ✅ APIs já migradas (usam withTenant ou runWithContext)

### Dashboard
- `/api/dashboard/stats` - ✅ withTenant
- `/api/dashboard/vendas-locais` - ✅ withTenant
- `/api/dashboard/sales-by-month` - 🔶 Usa query(), precisa withTenant

### NuvemShop Dashboard
- `/api/nuvemshop/divergencias` - ✅ withTenant (GET e POST)
- `/api/nuvemshop/dashboard/eventos` - ✅ withTenant
- `/api/nuvemshop/dashboard/produtos-nomes` - ✅ withTenant
- `/api/nuvemshop/dashboard/produtos` - 🔶 Usa query(), precisa withTenant
- `/api/nuvemshop/dashboard/divergencias-agrupadas` - 🔶 Usa query(), precisa withTenant

### NuvemShop Sync
- `/api/nuvemshop/products/export` - ✅ runWithContext
- `/api/nuvemshop/resync` - ✅ runWithContext
- `/api/ecommerce/stock/sync` - ✅ runWithContext

## ❌ APIs que AINDA usam Pool direto (process.env.DATABASE_URL)

**URGENTE - Precisam ser refatoradas:**

1. `/api/produtos/[codigo]` - GET/PUT de produto específico
2. `/api/produtos` - Lista de produtos
3. `/api/produtos/[codigo]/grade` - Grade de produtos
4. `/api/produtos/buscar-por-gtin` - Busca por código de barras
5. `/api/produtos/buscar-gtin` - Busca GTIN
6. `/api/produtos/buscar-completo` - Busca completa
7. `/api/categorias` - Lista de categorias
8. `/api/fornecedores` - Lista de fornecedores

**APIs de teste (podem ser removidas ou ignoradas):**
- `/api/test-db-connection`
- `/api/test-connection`

## 🔶 APIs que usam query() mas NÃO têm withTenant

**Precisam adicionar wrapper withTenant:**

### Vendas
- `/api/vendas/simular` - POST
- `/api/vendas/cancelar` - POST

### NuvemShop (várias)
- `/api/nuvemshop/sync-status` - GET/POST
- `/api/nuvemshop/webhook` - POST
- `/api/nuvemshop/products/list` - GET
- `/api/nuvemshop/products/queue` - GET/POST/DELETE
- `/api/nuvemshop/products/queue/process` - GET/POST
- `/api/nuvemshop/products/delete` - POST
- `/api/nuvemshop/products/reconcile-variants` - POST
- `/api/nuvemshop/products/validate` - GET
- `/api/nuvemshop/variants/delete` - POST
- `/api/nuvemshop/pending` - POST
- `/api/nuvemshop/mapear-produtos` - GET/POST
- `/api/nuvemshop/test/database` - GET
- `/api/nuvemshop/init` - (verificar)
- `/api/nuvemshop/config/list` - GET
- `/api/nuvemshop/divergencias/recheck-all` - (verificar)
- `/api/nuvemshop/debug/tokens` - GET
- `/api/nuvemshop/maintenance/cleanup` - (verificar)
- `/api/nuvemshop/connection/test` - GET
- `/api/nuvemshop/auth/callback` - GET
- `/api/nuvemshop/auth/save-token` - POST

## 📋 Plano de Migração

### Fase 1 (FEITO ✅)
- [x] Dashboard principal: stats, vendas-locais
- [x] NuvemShop dashboard: divergências, eventos, produtos-nomes

### Fase 2 (PRÓXIMO)
- [ ] APIs de produtos principais: `/api/produtos/*`
- [ ] APIs de categorias e fornecedores
- [ ] Vendas: simular e cancelar

### Fase 3 (Depois)
- [ ] Restante das APIs NuvemShop
- [ ] APIs de configuração e manutenção

## 🔧 Como migrar uma API

### Para APIs que JÁ usam `query()` da lib/database:

```typescript
// ANTES
import { query } from '@/lib/database'

export async function GET(req: NextRequest) {
  const data = await query('SELECT * FROM produtos')
  return NextResponse.json({ data })
}

// DEPOIS
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async (req: NextRequest) => {
  const data = await query('SELECT * FROM produtos')
  return NextResponse.json({ data })
})
```

### Para APIs que usam Pool direto:

Precisam refatoração maior - substituir todas as chamadas `pool.query()` por `query()` da lib/database.

## 🚨 Impacto da migração

**Antes da migração completa:**
- ✅ Login funciona
- ✅ Dashboard mostra dados corretos por tenant
- ❌ Algumas APIs (produtos, categorias) ainda pegam dados de DATABASE_URL (quatroestacoes)
- ❌ Usuários de diferentes tenants podem ver dados misturados em certas telas

**Depois da migração completa:**
- ✅ Todas as APIs respeitam o tenant logado
- ✅ Isolamento completo de dados entre tenants
- ✅ DATABASE_URL pode ser removida do .env.local
