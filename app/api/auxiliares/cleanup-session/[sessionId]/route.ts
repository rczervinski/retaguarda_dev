import { NextRequest, NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { resolveUploadDir as resolveUploadBase } from '@/lib/product-images'

export const runtime = 'nodejs'

/**
 * DELETE /api/auxiliares/cleanup-session/{sessionId}
 * Limpa uma sessão específica quando o usuário sai da página
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Validar formato do sessionId (UUID)
    if (!sessionId || !/^[a-f0-9-]{36}$/.test(sessionId)) {
      return NextResponse.json(
        { error: 'Session ID inválido' },
        { status: 400 }
      )
    }

    const baseUpload = await resolveUploadBase()
    if (!baseUpload) {
      return NextResponse.json(
        { error: 'Diretório de upload não encontrado no servidor' },
        { status: 500 }
      )
    }
    const sessionDir = join(baseUpload, 'temp', sessionId)

    // Verificar se diretório existe
    if (!existsSync(sessionDir)) {
      return NextResponse.json(
        { success: true, message: 'Sessão já foi removida' },
        { status: 200 }
      )
    }

    // Deletar diretório recursivamente
    await rm(sessionDir, { recursive: true, force: true })

    console.log(`[Cleanup] Sessão ${sessionId} removida pelo usuário`)

    return NextResponse.json({
      success: true,
      message: 'Sessão removida com sucesso'
    })

  } catch (error) {
    console.error('[Cleanup] Erro ao remover sessão:', error)
    
    return NextResponse.json(
      { error: 'Erro ao remover sessão' },
      { status: 500 }
    )
  }
}
