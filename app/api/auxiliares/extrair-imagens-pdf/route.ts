import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { resolveUploadDir as resolveUploadBase } from '@/lib/product-images'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes timeout

interface ExtractionOutput {
  success: boolean
  images: Array<{
    filename: string
    page: number
    index: number
    size?: number
  }>
  totalImages: number
  error?: string
}

export async function POST(request: NextRequest) {
  let sessionId: string | null = null
  
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    
    if (!pdfFile) {
      return NextResponse.json(
        { error: 'Nenhum arquivo PDF foi enviado' },
        { status: 400 }
      )
    }

    // Validate file type
    if (pdfFile.type !== 'application/pdf' && !pdfFile.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'O arquivo deve ser um PDF válido' },
        { status: 400 }
      )
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (pdfFile.size > maxSize) {
      return NextResponse.json(
        { error: 'O arquivo é muito grande. Tamanho máximo: 50MB' },
        { status: 400 }
      )
    }

    // Generate unique session ID
    sessionId = randomUUID()
    
    // Descobrir base de upload e criar diretórios temporários
    const baseUpload = await resolveUploadBase()
    if (!baseUpload) {
      return NextResponse.json(
        { error: 'Diretório de upload não encontrado no servidor' },
        { status: 500 }
      )
    }
    const uploadDir = join(baseUpload, 'temp', sessionId)
    const imagesDir = join(uploadDir, 'images')
    
    await mkdir(uploadDir, { recursive: true })
    await mkdir(imagesDir, { recursive: true })

    // Save PDF to temp directory
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    const pdfPath = join(uploadDir, 'input.pdf')
    await writeFile(pdfPath, pdfBuffer)

    console.log(`[PDF Extractor] Session ${sessionId}: PDF saved, starting extraction...`)

    // Call Python script to extract images
  const pythonScript = join(process.cwd(), 'scripts', 'extrair-imagens-pdf.py')
    
    // Check if Python script exists
    if (!existsSync(pythonScript)) {
      throw new Error('Script Python não encontrado. Execute a configuração do ambiente primeiro.')
    }

    const extractionResult = await runPythonExtraction(pythonScript, pdfPath, imagesDir)

    if (!extractionResult.success) {
      throw new Error(extractionResult.error || 'Erro desconhecido na extração')
    }

    console.log(`[PDF Extractor] Session ${sessionId}: Extracted ${extractionResult.totalImages} images`)

    // Generate image URLs
    const images = extractionResult.images.map(img => ({
      ...img,
      url: `/upload/temp/${sessionId}/images/${img.filename}`
    }))

    return NextResponse.json({
      success: true,
      sessionId,
      images,
      totalImages: extractionResult.totalImages
    })

  } catch (error) {
    console.error('[PDF Extractor] Error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao processar o PDF',
        sessionId 
      },
      { status: 500 }
    )
  }
}

function runPythonExtraction(scriptPath: string, pdfPath: string, outputDir: string): Promise<ExtractionOutput> {
  return new Promise((resolve, reject) => {
    // Detectar caminho do Python baseado no sistema operacional
    let pythonCommand: string
    
    if (process.platform === 'win32') {
      // Windows: tentar caminhos comuns de instalação
      const possiblePaths = [
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python312\\python.exe',
        process.env.LOCALAPPDATA + '\\Programs\\Python\\Python311\\python.exe',
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'python' // fallback para PATH
      ]
      
      // Usar o primeiro caminho que existir
      const { existsSync } = require('fs')
      pythonCommand = possiblePaths.find(p => p !== 'python' && existsSync(p)) || 'python'
    } else {
      // Linux/Mac: usar python3
      pythonCommand = 'python3'
    }
    
    console.log(`[PDF Extractor] Using Python: ${pythonCommand}`)
    
    const pythonProcess = spawn(pythonCommand, [
      scriptPath,
      pdfPath,
      outputDir
    ])

    let stdoutData = ''
    let stderrData = ''

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString()
      console.error('[Python stderr]:', data.toString())
    })

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script falhou (código ${code}): ${stderrData}`))
        return
      }

      try {
        // Parse JSON output from Python
        const result = JSON.parse(stdoutData) as ExtractionOutput
        resolve(result)
      } catch (parseError) {
        reject(new Error(`Erro ao processar saída do Python: ${parseError}`))
      }
    })

    pythonProcess.on('error', (error) => {
      reject(new Error(`Erro ao executar Python: ${error.message}. Certifique-se de que Python está instalado.`))
    })

    // Timeout after 4 minutes
    setTimeout(() => {
      pythonProcess.kill()
      reject(new Error('Tempo limite excedido ao processar o PDF'))
    }, 240000)
  })
}
