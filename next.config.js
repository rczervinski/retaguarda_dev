/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  images: {
    unoptimized: true,
    domains: ['localhost'],
  },
  // Ignora ESLint durante o build de produção para não bloquear a compilação
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Evita warning de detecção de monorepo e aponta a raiz correta
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  // Configuração para Vercel
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app"]
    }
  },
}

module.exports = nextConfig
