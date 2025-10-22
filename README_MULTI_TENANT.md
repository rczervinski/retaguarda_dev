# Sistema Multi-Tenant - Status Atual

## ✅ Funcionando Perfeitamente

### Autenticação
- Login com nome/senha
- OTP via console (dev)
- JWT em cookie HTTP-Only
- Middleware protegendo rotas
- Logout funcional

### Multi-Tenant (APIs Migradas)
**Estas APIs respeitam o tenant logado:**

#### Dashboard
- `/api/dashboard/stats` - Estatísticas gerais
- `/api/dashboard/vendas-locais` - Vendas recentes
- `/api/dashboard/sales-by-month` - Vendas mensais

#### NuvemShop
- `/api/nuvemshop/divergencias` - GET/POST
- `/api/nuvemshop/dashboard/eventos` - Eventos webhook
- `/api/nuvemshop/dashboard/produtos-nomes` - Nomes produtos
- `/api/nuvemshop/products/export` - Exportação produtos
- `/api/nuvemshop/resync` - Resincronização
- `/api/ecommerce/stock/sync` - Sincronização estoque (via cron)

### SSL por Tenant
- **AWS RDS**: SSL habilitado automaticamente (rejectUnauthorized: false)
- **CloudClusters**: SSL desabilitado automaticamente
- Detecção automática baseada na URL do banco

## ⚠️ Limitações Atuais

### APIs Ainda Single-Tenant (usam DATABASE_URL fallback)

**Estas APIs sempre acessam banco QUATROESTACOES:**

#### Produtos
- `/api/produtos` - Lista e criação (usa Prisma Client)
- `/api/produtos/[codigo]` - GET/PUT individual (usa Pool direto)
- `/api/produtos/[codigo]/grade` - Grade produtos
- `/api/produtos/buscar-por-gtin` - Busca por código barras
- `/api/produtos/buscar-gtin` - Busca GTIN
- `/api/produtos/buscar-completo` - Busca completa

#### Outras
- `/api/categorias` - Lista categorias (usa Pool direto)
- `/api/fornecedores` - Lista fornecedores (usa Pool direto)

**Impacto:** Usuários logados como GUTTY veem dados de QUATROESTACOES nestas telas.

## 🔧 Como Funciona

### Para usuário QUATROESTACOES:
- ✅ Dashboard mostra dados corretos (próprio banco)
- ✅ NuvemShop mostra dados corretos (próprio banco)
- ✅ Produtos/Categorias mostram dados corretos (DATABASE_URL = quatroestacoes)

### Para usuário GUTTY:
- ✅ Dashboard mostra dados corretos (banco gutty via withTenant)
- ✅ NuvemShop mostra dados corretos (banco gutty via withTenant)
- ❌ Produtos/Categorias mostram dados de QUATROESTACOES (fallback DATABASE_URL)

## 📋 Roadmap de Migração

### Fase 1 - Concluída ✅
- [x] Autenticação multi-tenant
- [x] Middleware de proteção
- [x] Contexto tenant via AsyncLocalStorage
- [x] Pool manager multi-tenant
- [x] SSL por tenant
- [x] Dashboard migrado
- [x] APIs NuvemShop principais migradas

### Fase 2 - Próximo
- [ ] Refatorar `/api/produtos` (substituir Prisma por query())
- [ ] Refatorar `/api/produtos/[codigo]` (substituir Pool por query())
- [ ] Refatorar `/api/categorias`
- [ ] Refatorar `/api/fornecedores`

### Fase 3 - Depois
- [ ] Migrar todas as APIs de produtos
- [ ] Remover DATABASE_URL do .env.local completamente
- [ ] Validação completa multi-tenant

## 🚀 Para Desenvolvedores

### Criar nova API multi-tenant

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async (req: NextRequest) => {
  // query() automaticamente usa o banco do tenant logado
  const result = await query('SELECT * FROM produtos')
  return NextResponse.json({ data: result.rows })
})
```

### Migrar API existente

**Antes (single-tenant):**
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ... }
})

export async function GET(req: NextRequest) {
  const result = await pool.query('SELECT * FROM produtos')
  return NextResponse.json({ data: result.rows })
}
```

**Depois (multi-tenant):**
```typescript
import { query } from '@/lib/database'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async (req: NextRequest) => {
  const result = await query('SELECT * FROM produtos')
  return NextResponse.json({ data: result.rows })
})
```

## 🔐 Variáveis de Ambiente

```bash
# AUTH
AUTH_JWT_SECRET=seu-segredo-jwt-aqui

# TENANTS (JSON em uma linha)
TENANTS_JSON=[{"id":"quatroestacoes","nome":"quatroestacoes","senha":"***","dbUrl":"postgresql://...","cnpj":"09565010000149"},{"id":"gutty",...}]

# DATABASE FALLBACK (para APIs antigas - será removido no futuro)
DATABASE_URL="postgresql://u09565010000149:...@...amazonaws.com..."

# SSL
DB_SSL_MODE=no-verify
```

## ⚡ Performance

- Cada tenant tem seu próprio **connection pool** (max 10 conexões)
- Pools são **cached** e reutilizados
- SSL configurado **por pool**, não globalmente
- Zero overhead para APIs já migradas

## 🐛 Troubleshooting

### "DATABASE_URL resolved to an empty string"
**Causa:** API usa Prisma Client que depende de DATABASE_URL no schema.prisma  
**Solução:** Garantir que DATABASE_URL está preenchida no .env.local (fallback)

### "The server does not support SSL connections"
**Causa:** Tentando SSL com CloudClusters  
**Solução:** Já corrigido - detecção automática em lib/database.ts

### Dados errados aparecem após login
**Causa:** API não usa withTenant  
**Solução:** Verificar em docs/MULTI_TENANT_MIGRATION_STATUS.md quais APIs estão migradas
