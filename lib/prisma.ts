// Este arquivo mantém apenas referências do Prisma para compatibilidade
// O Prisma Schema em prisma/schema.prisma é mantido apenas para referência
// As conexões reais ao banco agora usam o arquivo /lib/database.ts com a biblioteca pg

// Informações de configuração do banco (se necessário para outros propósitos)
export const DATABASE_CONFIG = {
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}

console.log('ℹ️ Prisma client removido - usando conexões diretas com PostgreSQL via pg library')
