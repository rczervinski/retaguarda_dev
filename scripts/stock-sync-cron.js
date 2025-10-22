#!/usr/bin/env node
/*
  Stock Sync Cron Script
  - POSTs to /api/ecommerce/stock/sync to apply deltas from vendas_* to Nuvemshop
  - Uses a shared secret (STOCK_SYNC_KEY) if configured
  - Adjustable lookback window via STOCK_SYNC_DAYS (default 1)
  - Intended to be run by PM2 cron or system cron on the server
*/

const http = require('http');
const https = require('https');

function log(msg, obj) { console.log(`[stock-sync] ${new Date().toISOString()} ${msg}`, obj || ''); }

(async function main() {
  const key = process.env.STOCK_SYNC_KEY || undefined;
  const days = Number(process.env.STOCK_SYNC_DAYS || 1);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  async function probe(base) {
    return new Promise((resolve) => {
      try {
        const u = new URL('/api/health', base);
        const client = u.protocol === 'https:' ? https : http;
        const req = client.request(u, { method: 'GET', timeout: 4000 }, (res) => {
          // any 2xx is OK
          resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
          res.resume();
        });
        req.on('timeout', () => { req.destroy(new Error('timeout')); resolve(false); });
        req.on('error', () => resolve(false));
        req.end();
      } catch { resolve(false); }
    });
  }

  // Determine base URL
  const candidates = [];
  if (process.env.APP_URL) candidates.push(process.env.APP_URL);
  if (process.env.APP_BASE_URL) candidates.push(process.env.APP_BASE_URL);
  candidates.push(`http://127.0.0.1:${port}`);
  candidates.push(`http://localhost:${port}`);

  let appUrl = candidates[0];
  for (const c of candidates) {
    const ok = await probe(c);
    if (ok) { appUrl = c; break; }
  }

  // Definir quais tenants serão sincronizados
  const envTenant = (process.env.TENANT_ID || process.env.TENANT || '').trim();
  let tenantIds = [];
  if (envTenant) {
    tenantIds = envTenant.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    // Se não foi informado, tentar perguntar para a própria app (endpoint protegido)
    try {
      const u = new URL('/api/ecommerce/stock/tenants', appUrl);
      if (key) u.searchParams.set('key', key);
      const client = u.protocol === 'https:' ? https : http;
      const tRes = await new Promise((resolve) => {
        const req = client.request(u, { method: 'GET', timeout: 8000 }, (res) => {
          let body = '';
          res.on('data', (c) => body += c);
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json?.ok && Array.isArray(json.tenants)) resolve(json.tenants);
              else resolve([]);
            } catch { resolve([]); }
          });
        });
        req.on('timeout', () => { req.destroy(new Error('timeout')); resolve([]); });
        req.on('error', () => resolve([]));
        req.end();
      });
      if (Array.isArray(tRes) && tRes.length) tenantIds = tRes;
    } catch { /* ignore */ }

    // Fallback final: TENANTS_JSON do ambiente
    if (!tenantIds.length) {
      try {
        const raw = process.env.TENANTS_JSON;
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) tenantIds = arr.map(t => String(t.id)).filter(Boolean);
        }
      } catch (e) {
        log('WARN TENANTS_JSON parse failed');
      }
    }
  }
  if (!tenantIds.length) tenantIds = ['']; // vazio = sem tenant (deve falhar na API com 400)

  const results = [];
  for (const tid of tenantIds) {
    const params = new URLSearchParams();
    if (key) params.set('key', key);
    if (tid) params.set('tenant', tid);
    const syncUrl = new URL('/api/ecommerce/stock/sync' + (params.toString() ? `?${params.toString()}` : ''), appUrl);
    const isHttps = syncUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({ days });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
    if (key) headers['x-sync-key'] = key;

    log(`POST ${syncUrl.href} days=${days}`);

    const r = await new Promise((resolve) => {
      const req = client.request(syncUrl, { method: 'POST', headers, timeout: 15000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          let parsed; try { parsed = JSON.parse(body); } catch {}
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          log(`response ${res.statusCode} tenant=${tid || '(none)'}`);
          if (parsed) log('body', parsed); else log('body', body);
          resolve({ ok, status: res.statusCode, body: parsed || body, tenant: tid });
          if (!ok) process.exitCode = 1;
        });
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', (err) => {
        console.error('[stock-sync] request error:', err.message, 'tenant=', tid || '(none)');
        process.exitCode = 1; resolve({ ok: false, error: err.message, tenant: tid });
      });
      req.write(payload);
      req.end();
    });
    results.push(r);
  }
  log('done', { count: results.length, failed: results.filter(x => !x.ok).length });
})();
