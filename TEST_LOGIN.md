# 🔍 DEBUG: Problema de Loop de Login

## 🐛 Problema Identificado

O cookie `AUTH_TOKEN` estava sendo setado com `secure: true` em produção, mas **cookies secure só funcionam com HTTPS**.

Se o servidor não tem SSL configurado, o navegador **não envia o cookie**, causando loop de login.

## ✅ Correções Aplicadas

### 1. **Cookie sem secure por padrão** (`lib/auth.ts`)
```javascript
secure: process.env.FORCE_SECURE_COOKIE === 'true'  // false por padrão
```

### 2. **Logs adicionados**
- `app/api/auth/login/route.ts` - logs do token gerado e cookie setado
- `middleware.ts` - logs de cada requisição mostrando se token está presente/válido
- `lib/auth.ts` - log ao setar cookie

## 🧪 Como Testar no Servidor

### 1. **Fazer deploy das mudanças**
```bash
cd retaguarda_new
git pull origin main
npm install
npm run build
pm2 restart retaguarda-web
```

### 2. **Acompanhar logs em tempo real**
```bash
pm2 logs retaguarda-web --lines 100
```

### 3. **Tentar fazer login**
Você verá os logs:
```
[auth] Login bem-sucedido para gutty (tenant=gutty)
[auth] Token gerado (length=xxx)
[auth] Setando cookie: secure=false, httpOnly=true, sameSite=lax, maxAge=43200s
[auth] Cookie setado: AUTH_TOKEN
[middleware] GET /
[middleware] Rota protegida /, token presente: true
[middleware] Autenticado como tenant gutty
```

### 4. **Se ainda der loop, verificar:**

#### A) **Verificar se TENANTS_JSON está correto no servidor**
```bash
# No servidor
cd retaguarda_new
cat .env.production | grep TENANTS_JSON
```

Deve ter algo assim:
```env
TENANTS_JSON='[{"id":"gutty","nome":"gutty","senha":"SUA_SENHA","dbUrl":"postgres://...","cnpj":"12345678000199"}]'
```

#### B) **Verificar nos logs se o tenant foi encontrado**
```bash
pm2 logs retaguarda-web | grep "tenant não encontrado"
```

#### C) **Testar manualmente a API de login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nome":"gutty","senha":"SUA_SENHA"}' \
  -v
```

Deve retornar:
```
< Set-Cookie: AUTH_TOKEN=eyJhbG...; Path=/; HttpOnly; SameSite=Lax
{"ok":true,"tenant":{"id":"gutty","nome":"gutty"}}
```

## 🔒 Quando Configurar HTTPS/SSL

Depois que você configurar SSL no servidor (com certbot/Let's Encrypt), adicione no `.env.production`:

```env
FORCE_SECURE_COOKIE=true
```

Isso vai ativar `secure: true` nos cookies para maior segurança.

## 📋 Checklist

- [ ] Git pull + npm install + build
- [ ] PM2 restart
- [ ] Verificar logs do login
- [ ] Verificar logs do middleware
- [ ] Confirmar que cookie está sendo setado (secure=false)
- [ ] Confirmar que middleware encontra o token
- [ ] Login funcionando sem loop

## ❓ Se Ainda Não Funcionar

Me envie os logs do PM2 durante a tentativa de login:
```bash
pm2 logs retaguarda-web --lines 50 --nostream
```
