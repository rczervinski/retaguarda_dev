const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: "postgresql://u09565010000149:095149@@@g01414955000158.cj4w84gocmo6.sa-east-1.rds.amazonaws.com:5432/09565010000149?sslmode=require",
    ssl: {
      rejectUnauthorized: false // Para certificados auto-assinados
    }
  });

  try {
    console.log('🔄 Conectando ao RDS...');
    await client.connect();
    
    console.log('✅ Conectado com sucesso!');
    
    // Testar uma query simples
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 Resultado da query:');
    console.log('   Hora do servidor:', result.rows[0].current_time);
    console.log('   Versão PostgreSQL:', result.rows[0].pg_version);
    
    // Listar algumas tabelas
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name 
      LIMIT 10
    `);
    
    console.log('📋 Algumas tabelas disponíveis:');
    tables.rows.forEach(row => {
      console.log('   -', row.table_name);
    });
    
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    console.error('🔍 Detalhes do erro:', error.code);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

testConnection();