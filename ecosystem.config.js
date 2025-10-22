module.exports = {
  apps: [
    {
      name: 'retaguarda-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        NODE_TLS_REJECT_UNAUTHORIZED: "0"
      }
    },
    {
      name: 'stock-sync-cron',
      script: 'scripts/stock-sync-cron.js',
      exec_mode: 'fork',
      instances: 1,
      cron_restart: '*/5 * * * *', // <-- executa a cada 5 minutos
      env_production: {
        NODE_ENV: 'production',
        STOCK_SYNC_KEY: 'dev-secret-change-me',
        STOCK_SYNC_DAYS: '1',
        APP_URL: 'http://127.0.0.1:3000'
      }
    },
    {
      name: 'pdf-temp-cleanup',
      script: 'scripts/cleanup-pdf-temp.js',
      exec_mode: 'fork',
      instances: 1,
      cron_restart: '*/15 * * * *', // <-- executa a cada 15 minutos
      autorestart: false,
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
}
