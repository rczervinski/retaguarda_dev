# 🚀 Quick Start - Deploy no Lightsail

## Resumo Rápido

### 1️⃣ Setup Inicial (uma vez)

No servidor Lightsail:
```bash
# Fazer upload do script de setup
scp -i ~/Downloads/LightsailDefaultKey.pem scripts/setup-lightsail.sh ubuntu@SEU_IP:/home/ubuntu/

# Conectar via SSH
ssh -i ~/Downloads/LightsailDefaultKey.pem ubuntu@SEU_IP

# Executar setup
bash setup-lightsail.sh
```

### 2️⃣ Deploy do Código

```bash
# No servidor, clonar o repositório
cd /var/www/retaguarda
git clone https://github.com/rczervinski/retaguarda_new.git .

# Ou fazer upload via SCP (do seu Mac):
tar -czf retaguarda.tar.gz --exclude='node_modules' --exclude='.next' .
scp -i ~/Downloads/LightsailDefaultKey.pem retaguarda.tar.gz ubuntu@SEU_IP:/home/ubuntu/
```

### 3️⃣ Configurar e Iniciar

No servidor:
```bash
cd /var/www/retaguarda

# Copiar e editar .env
cp .env.lightsail.example .env
nano .env  # Preencha com seus valores

# Dar permissão aos scripts
chmod +x scripts/*.sh

# Executar deploy
bash scripts/deploy-lightsail.sh
```

### 4️⃣ Configurar Nginx

```bash
# Copiar configuração (veja DEPLOY_LIGHTSAIL.md seção 7)
sudo nano /etc/nginx/sites-available/retaguarda

# Ativar
sudo ln -s /etc/nginx/sites-available/retaguarda /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5️⃣ Configurar IP Estático

1. No painel do Lightsail: Networking → Create static IP
2. Associar à instância
3. Atualizar variável `NEXTAUTH_URL` no `.env` com o novo IP
4. Reiniciar: `pm2 restart retaguarda-web`

### 6️⃣ Configurar SSL (Opcional)

```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

---

## 📝 Comandos Úteis

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs

# Reiniciar
pm2 restart retaguarda-web

# Health check
bash scripts/health-check.sh

# Backup do banco
bash scripts/backup-db.sh

# Atualizar aplicação
cd /var/www/retaguarda
git pull
bash scripts/deploy-lightsail.sh
```

---

## 🆘 Troubleshooting Rápido

**Aplicação não inicia:**
```bash
pm2 logs retaguarda-web --lines 50
```

**Erro de banco:**
```bash
sudo systemctl status postgresql
psql -U retaguarda_user -d retaguarda
```

**Nginx erro 502:**
```bash
pm2 status  # Verificar se app está rodando
curl http://localhost:3000  # Testar localmente
sudo tail -f /var/log/nginx/error.log
```

---

## 📚 Documentação Completa

Veja **DEPLOY_LIGHTSAIL.md** para o tutorial completo e detalhado.
