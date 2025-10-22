'use client'

import { useState, useRef, useEffect } from 'react'
import { PhotoIcon, ArrowDownTrayIcon, DocumentArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ExtractedImage {
  filename: string
  page: number
  index: number
  url: string
  size?: number
}

interface ExtractionResult {
  success: boolean
  sessionId: string
  images: ExtractedImage[]
  totalImages: number
}

export default function ExtratorPDFPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Limpar sessão quando o usuário sair da página ou fechar o navegador
  useEffect(() => {
    const cleanupSession = async () => {
      if (extractionResult?.sessionId) {
        try {
          // Usar sendBeacon para garantir que a requisição seja enviada mesmo ao fechar
          const apiUrl = `/api/auxiliares/cleanup-session/${extractionResult.sessionId}`
          
          // Tentar com fetch first (mais confiável quando a aba ainda está aberta)
          if (navigator.sendBeacon) {
            navigator.sendBeacon(apiUrl, JSON.stringify({ method: 'DELETE' }))
          } else {
            // Fallback para fetch
            fetch(apiUrl, { 
              method: 'DELETE',
              keepalive: true // Mantém a requisição mesmo ao fechar
            }).catch(() => {}) // Ignorar erros silenciosamente
          }
        } catch (err) {
          // Ignorar erros de limpeza
          console.log('Cleanup silencioso')
        }
      }
    }

    // Limpar ao desmontar componente (navegar para outra página)
    return () => {
      cleanupSession()
    }
  }, [extractionResult?.sessionId])

  // Limpar ao fechar aba/navegador
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (extractionResult?.sessionId) {
        const apiUrl = `/api/auxiliares/cleanup-session/${extractionResult.sessionId}`
        navigator.sendBeacon(apiUrl)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [extractionResult?.sessionId])

  const handleFileSelect = (file: File) => {
    // Validar tipo de arquivo
    if (file.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF válido.')
      return
    }

    // Validar tamanho (máximo 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      setError('O arquivo é muito grande. Tamanho máximo: 50MB.')
      return
    }

    setSelectedFile(file)
    setError(null)
    setExtractionResult(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleExtract = async () => {
    if (!selectedFile) return

    setIsExtracting(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('pdf', selectedFile)

    try {
      // Simular progresso (já que a extração pode demorar)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      const response = await fetch('/api/auxiliares/extrair-imagens-pdf', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao extrair imagens')
      }

      const result: ExtractionResult = await response.json()
      setExtractionResult(result)
    } catch (err) {
      console.error('Erro na extração:', err)
      setError(err instanceof Error ? err.message : 'Erro ao extrair imagens do PDF')
    } finally {
      setIsExtracting(false)
      setProgress(0)
    }
  }

  const handleDownloadAll = async () => {
    if (!extractionResult?.sessionId) return

    try {
      const response = await fetch(`/api/auxiliares/download-zip/${extractionResult.sessionId}`)
      
      if (!response.ok) {
        throw new Error('Erro ao baixar arquivo ZIP')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `imagens-extraidas-${extractionResult.sessionId}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Erro ao baixar ZIP:', err)
      setError('Erro ao baixar arquivo ZIP')
    }
  }

  const handleDownloadSingle = (imageUrl: string, filename: string) => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setExtractionResult(null)
    setError(null)
    setProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <PhotoIcon className="w-8 h-8 text-blue-600" />
          GUTTY - Extrator de Imagens PDF
        </h1>
        <p className="mt-2 text-gray-600">
          Extraia todas as imagens de um arquivo PDF de forma rápida e fácil.
        </p>
      </div>

      {/* Upload Area */}
      {!extractionResult && (
        <div className="mb-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${selectedFile ? 'bg-gray-50' : 'bg-white'}
            `}
          >
            {!selectedFile ? (
              <>
                <DocumentArrowDownIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Arraste um arquivo PDF aqui
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  ou clique para selecionar
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Selecionar Arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                  aria-label="Selecionar arquivo PDF"
                />
                <p className="mt-4 text-xs text-gray-400">
                  Tamanho máximo: 50MB
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center">
                    <DocumentArrowDownIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Remover arquivo"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {selectedFile && !isExtracting && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleExtract}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                Extrair Imagens
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {isExtracting && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Extraindo imagens...</span>
            <span className="text-sm font-medium text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` } as React.CSSProperties}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Erro:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {extractionResult && (
        <div className="space-y-6">
          {/* Header with download all */}
          <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Imagens Extraídas ({extractionResult.totalImages})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Clique em uma imagem para baixar individualmente
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadAll}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Baixar Todas (ZIP)
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm"
              >
                Novo PDF
              </button>
            </div>
          </div>

          {/* Images Grid */}
          {extractionResult.totalImages === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Nenhuma imagem encontrada</p>
              <p className="text-sm">Este PDF não contém imagens extraíveis.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {extractionResult.images.map((image, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow group"
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    <img
                      src={`${image.url}?t=${Date.now()}`}
                      alt={`Imagem ${idx + 1}`}
                      className="w-full h-full object-contain p-2"
                      loading="lazy"
                      onError={(e) => {
                        console.error('Erro ao carregar imagem:', image.url)
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EErro%3C/text%3E%3C/svg%3E'
                      }}
                    />
                    <button
                      onClick={() => handleDownloadSingle(image.url, image.filename)}
                      className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      title="Baixar imagem"
                    >
                      <ArrowDownTrayIcon className="w-8 h-8 text-white" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-900 truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Página {image.page + 1}
                      {image.size && ` • ${formatFileSize(image.size)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
