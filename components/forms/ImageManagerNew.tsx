"use client";
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Upload, RefreshCw, X } from 'lucide-react';

interface ProdutoImage {
  name: string;
  url: string;
  pos: number;
}

interface ImageManagerProps { 
  codigoInterno: string; 
  className?: string;
}

const MAX = 4;

export default function ImageManager({ codigoInterno, className = '' }: ImageManagerProps) {
  const [imagens, setImagens] = useState<ProdutoImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type:'success'|'error', text:string}|null>(null);
  const [arquivo, setArquivo] = useState<File|null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // React-Image-Crop state
  const [crop, setCrop] = useState<Crop>({ 
    unit: '%', 
    width: 90, 
    height: 90, 
    x: 5, 
    y: 5 
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => { carregar(); }, [codigoInterno]);
  useEffect(() => { 
    if(message) { 
      const t = setTimeout(() => setMessage(null), 4000); 
      return () => clearTimeout(t);
    } 
  }, [message]);

  async function carregar() {
    if (!codigoInterno) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens?_t=${timestamp}`);
      const j = await r.json();
      if (j.success) {
        const imagensComTimestamp = j.imagens.map((img: ProdutoImage) => ({
          ...img,
          url: `${img.url}?_t=${timestamp}`
        }));
        setImagens(imagensComTimestamp);
      } else {
        setMessage({type:'error', text: j.error || 'Erro carregando'});
      }
    } catch(e: any) { 
      setMessage({type:'error', text: 'Falha rede'});
    } finally { 
      setLoading(false);
    } 
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return; 
    if (f.size > 10*1024*1024) { 
      setMessage({type:'error', text: 'Arquivo >10MB'}); 
      return; 
    }
    if (!/image\/(png|jpeg|jpg|webp)/i.test(f.type)) { 
      setMessage({type:'error', text: 'Formato não suportado'}); 
      return; 
    }
    setArquivo(f); 
    const url = URL.createObjectURL(f); 
    setPreview(url);
    // Reset crop to default when new image loads
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
    setCompletedCrop(undefined);
  }

  function resetUpload() { 
    setArquivo(null); 
    if (preview) URL.revokeObjectURL(preview); 
    setPreview(null);
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
    setCompletedCrop(undefined);
  }

  async function remover(nome: string) {
    if (loading) return;
    if (!confirm('Remover imagem?')) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens?nome=${encodeURIComponent(nome)}`, { 
        method: 'DELETE'
      });
      const j = await r.json();
      if (j.success) { 
        setImagens(j.imagens); 
        setMessage({type:'success', text: 'Removida'});
      } else {
        setMessage({type:'error', text: j.error || 'Falha remover'});
      }
    } catch(e: any) { 
      setMessage({type:'error', text: 'Erro remover'});
    } finally { 
      setLoading(false); 
    }
  }

  async function upload() {
    if (!arquivo) return;
    
    const form = new FormData();
    form.append('file', arquivo);
    
    // Se há crop, converter para coordenadas reais
    if (completedCrop && imgRef.current) {
      const realCrop = {
        x: completedCrop.x,
        y: completedCrop.y, 
        w: completedCrop.width,
        h: completedCrop.height,
        scale
      };
      form.append('crop', JSON.stringify(realCrop));
    }
    
    setLoading(true);
    try {
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens`, { 
        method: 'POST', 
        body: form 
      });
      const j = await r.json();
      if (j.success) { 
        setMessage({type:'success', text: 'Imagem enviada'}); 
        resetUpload(); 
        await carregar(); 
      } else {
        setMessage({type:'error', text: j.error || 'Erro upload'});
      }
    } catch(e: any) { 
      setMessage({type:'error', text: 'Falha upload'});
    } finally { 
      setLoading(false);
    }
  }

  async function swap(pos: number, direction: 'left' | 'right') {
    if (loading) return;
    const from = pos;
    const to = direction === 'left' ? pos - 1 : pos + 1;
    if (to < 1 || to > imagens.length) return;
    
    setLoading(true);
    try {
      const payload = { acao: 'swap', from, to };
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens`, { 
        method: 'PATCH', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j.success) { 
        await carregar(); // Force reload to break cache
      } else { 
        setMessage({type:'error', text: j.error || 'Falha swap'}); 
      }
    } catch(e: any) { 
      setMessage({type:'error', text: 'Erro rede swap'});
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <div className={className}>
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}
      
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Imagens do Produto ({imagens.length}/{MAX})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Upload e Crop */}
            <div>
              <Label className="block mb-2">Upload com Redimensionamento</Label>
              <p className="text-xs text-gray-500 mb-2">
                Selecione uma imagem. Use a área de crop para ajustar o enquadramento e remover espaços indesejados.
              </p>
              
              <Input 
                type="file" 
                accept="image/*" 
                onChange={onFileChange} 
                disabled={loading || imagens.length >= MAX} 
                className="mb-4"
              />
              
              {preview && (
                <div className="space-y-4">
                  {/* React Image Crop */}
                  <div className="border rounded p-2 bg-gray-50">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={undefined} // Free aspect ratio
                      minWidth={20}
                      minHeight={20}
                    >
                      <img
                        ref={imgRef}
                        alt="Crop preview"
                        src={preview}
                        style={{ 
                          transform: `scale(${scale})`,
                          maxHeight: '300px',
                          maxWidth: '100%'
                        }}
                        onLoad={(e) => {
                          const { naturalWidth, naturalHeight } = e.currentTarget;
                          // Auto-set initial crop to cover most of the image
                          setCrop({
                            unit: '%',
                            width: 90,
                            height: 90,
                            x: 5,
                            y: 5
                          });
                        }}
                      />
                    </ReactCrop>
                  </div>
                  
                  {/* Scale Control */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Zoom:</Label>
                    <Input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="w-20"
                    />
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setScale(1)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Crop Info */}
                  {completedCrop && (
                    <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                      Área selecionada: {Math.round(completedCrop.width)}×{Math.round(completedCrop.height)}px
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 mt-4">
                <Button 
                  type="button" 
                  onClick={upload} 
                  disabled={!arquivo || loading}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Enviar
                </Button>
                {preview && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetUpload}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            
            {/* Galeria */}
            <div>
              <Label className="block mb-2">Galeria</Label>
              {imagens.length === 0 && (
                <p className="text-sm text-gray-500">Nenhuma imagem</p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {imagens.map(img => (
                  <div 
                    key={img.name}
                    className="relative group border rounded p-1 bg-white shadow-sm flex flex-col items-center text-center"
                  >
                    <div className="absolute left-1 top-1 text-xs text-gray-600">
                      #{img.pos}
                    </div>
                    
                    <img 
                      src={img.url.replace(/\.png$/, '_thumb.png')} 
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = img.url;
                      }} 
                      alt={img.name} 
                      className="h-24 w-24 object-contain mx-auto" 
                    />
                    
                    {img.pos === 1 && (
                      <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1 rounded">
                        Principal
                      </span>
                    )}
                    
                    <div className="flex gap-1 mt-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        disabled={img.pos === 1 || loading} 
                        onClick={() => swap(img.pos, 'left')}
                      >
                        {'<'}
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        disabled={img.pos === imagens.length || loading} 
                        onClick={() => swap(img.pos, 'right')}
                      >
                        {'>'}
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => remover(img.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Add Image Placeholder */}
                {imagens.length < MAX && (
                  <label className="border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-xs text-gray-500 cursor-pointer hover:border-gray-400 min-h-28" 
                         aria-label="Adicionar imagem">
                    <Upload className="h-5 w-5 mb-1" />
                    <span>Adicionar</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={onFileChange} 
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
