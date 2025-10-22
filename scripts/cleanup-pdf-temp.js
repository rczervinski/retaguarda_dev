#!/usr/bin/env node

/**
 * Script para limpar arquivos temporários do extrator de PDF
 * Remove sessões com mais de 1 hora de idade
 */

const fs = require('fs').promises
const path = require('path')

const TEMP_DIR = path.join(__dirname, '..', 'upload', 'temp')
const MAX_AGE_MINUTES = 15 // Limpar arquivos com mais de 15 minutos

async function cleanupTempFiles() {
  try {
    console.log('[Cleanup] Iniciando limpeza de arquivos temporários...')
    console.log('[Cleanup] Diretório:', TEMP_DIR)

    // Verificar se diretório existe
    try {
      await fs.access(TEMP_DIR)
    } catch {
      console.log('[Cleanup] Diretório temp não existe, criando...')
      await fs.mkdir(TEMP_DIR, { recursive: true })
      return
    }

    // Listar todas as sessões (subdiretórios)
    const sessions = await fs.readdir(TEMP_DIR)
    
    if (sessions.length === 0) {
      console.log('[Cleanup] Nenhuma sessão encontrada')
      return
    }

    console.log(`[Cleanup] Encontradas ${sessions.length} sessões`)

    let deletedCount = 0
    let keptCount = 0
    const now = Date.now()
    const maxAgeMs = MAX_AGE_MINUTES * 60 * 1000

    for (const session of sessions) {
      const sessionPath = path.join(TEMP_DIR, session)

      try {
        const stats = await fs.stat(sessionPath)

        // Verificar se é diretório
        if (!stats.isDirectory()) {
          console.log(`[Cleanup] Ignorando arquivo: ${session}`)
          continue
        }

        // Calcular idade
        const ageMs = now - stats.mtimeMs
        const ageMinutes = Math.floor(ageMs / 1000 / 60)

        if (ageMs > maxAgeMs) {
          // Deletar sessão antiga
          await fs.rm(sessionPath, { recursive: true, force: true })
          console.log(`[Cleanup] ✅ Deletada sessão ${session} (idade: ${ageMinutes} min)`)
          deletedCount++
        } else {
          console.log(`[Cleanup] ⏳ Mantida sessão ${session} (idade: ${ageMinutes} min)`)
          keptCount++
        }
      } catch (error) {
        console.error(`[Cleanup] ❌ Erro ao processar ${session}:`, error.message)
      }
    }

    console.log('[Cleanup] Finalizado!')
    console.log(`[Cleanup] Deletadas: ${deletedCount} | Mantidas: ${keptCount}`)

  } catch (error) {
    console.error('[Cleanup] Erro fatal:', error)
    process.exit(1)
  }
}

// Executar limpeza
cleanupTempFiles()
  .then(() => {
    console.log('[Cleanup] Script concluído com sucesso')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Cleanup] Script falhou:', error)
    process.exit(1)
  })
