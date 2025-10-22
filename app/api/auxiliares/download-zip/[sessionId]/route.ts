import { NextRequest, NextResponse } from 'next/server'
import { existsSync, createReadStream, statSync, readdirSync } from 'fs'
import { join } from 'path'
import archiver from 'archiver'
import { Readable } from 'stream'
import { resolveUploadDir as resolveUploadBase } from '@/lib/product-images'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

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
    const imagesDir = join(baseUpload, 'temp', sessionId, 'images')

    // Check if directory exists
    if (!existsSync(imagesDir)) {
      return NextResponse.json(
        { error: 'Sessão não encontrada ou expirada' },
        { status: 404 }
      )
    }

    // Check if there are images
    const files = readdirSync(imagesDir).filter(file => {
      const filePath = join(imagesDir, file)
      return statSync(filePath).isFile()
    })

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma imagem encontrada nesta sessão' },
        { status: 404 }
      )
    }

    console.log(`[ZIP Download] Session ${sessionId}: Creating ZIP with ${files.length} files`)

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 6 } // Compression level
    })

    // Add all image files to the archive
    files.forEach(file => {
      const filePath = join(imagesDir, file)
      archive.file(filePath, { name: file })
    })

    // Finalize the archive
    archive.finalize()

    // Convert archive stream to Web ReadableStream
    const nodeStream = Readable.toWeb(archive as any) as ReadableStream

    // Return the ZIP file as a stream
    return new NextResponse(nodeStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="imagens-extraidas-${sessionId}.zip"`,
      },
    })

  } catch (error) {
    console.error('[ZIP Download] Error:', error)
    
    return NextResponse.json(
      { error: 'Erro ao criar arquivo ZIP' },
      { status: 500 }
    )
  }
}
