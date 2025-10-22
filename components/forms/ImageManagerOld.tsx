"use client";
import React, { useState, useRef, useEffect, DragEvent } from 'react';
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

interface ImageManagerProps { codigoInterno: string; className?: string }

const MAX = 4;

export default function ImageManager({ codigoInterno, className = '' }: ImageManagerProps) {
  const [imagens, setImagens] = useState<ProdutoImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type:'success'|'error', text:string}|null>(null);
  const [arquivo, setArquivo] = useState<File|null>(null);
  const [preview, setPreview] = useState<string| null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgNatural, setImgNatural] = useState<{w:number;h:number}>({w:0,h:0});

  useEffect(()=>{ carregar(); }, [codigoInterno]);
  useEffect(()=>{ if(message){ const t=setTimeout(()=>setMessage(null),4000); return ()=>clearTimeout(t);} },[message]);

  async function carregar(){
    if(!codigoInterno) return;
    setLoading(true);
    try {
      // Adicionar timestamp para evitar cache
      const timestamp = Date.now();
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens?_t=${timestamp}`);
      const j = await r.json();
      if(j.success) {
        // Forçar reload das URLs com timestamp para quebrar cache
        const imagensComTimestamp = j.imagens.map((img: ProdutoImage) => ({
          ...img,
          url: `${img.url}?_t=${timestamp}`
        }));
        console.log('📷 LOAD DEBUG - Imagens carregadas com timestamp:', imagensComTimestamp);
        setImagens(imagensComTimestamp);
      } else {
        setMessage({type:'error', text:j.error||'Erro carregando'});
      }
    } catch(e:any){ 
      setMessage({type:'error', text:'Falha rede'});
    } finally { 
      setLoading(false);
    } 
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if(!f) return; 
    if(f.size > 10*1024*1024){ setMessage({type:'error', text:'Arquivo >10MB'}); return; }
    if(!/image\/(png|jpeg|jpg|webp)/i.test(f.type)){ setMessage({type:'error', text:'Formato não suportado'}); return; }
    setArquivo(f); 
    const url=URL.createObjectURL(f); 
    setPreview(url); 
    // Reset crop to cover 90% of image
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 }); 
  }

  function resetUpload(){ 
    setArquivo(null); 
    if(preview) URL.revokeObjectURL(preview); 
    setPreview(null); 
    setCompletedCrop(undefined);
  }

  async function remover(nome: string){
    if(loading) return;
    if(!confirm('Remover imagem?')) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens?nome=${encodeURIComponent(nome)}`, { method:'DELETE'});
      const j = await r.json();
      if(j.success){ setImagens(j.imagens); setMessage({type:'success', text:'Removida'});} else setMessage({type:'error', text:j.error||'Falha remover'});
    } catch(e:any){ setMessage({type:'error', text:'Erro remover'});} finally { setLoading(false); }
  }

  // Ajustar natural size
  function onImageLoaded(){ 
    if(imgRef.current){ 
      setImgNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight }); 
    } 
  }

  async function upload(){
    if(!arquivo) return;
    const form = new FormData(); 
    form.append('file', arquivo);
    
    // Se temos completedCrop (crop finalizado), usar as coordenadas
    if(completedCrop && completedCrop.width && completedCrop.height && imgRef.current){
      const scaleX = imgNatural.w / imgRef.current.width;
      const scaleY = imgNatural.h / imgRef.current.height;
      const cropData = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        w: completedCrop.width * scaleX,
        h: completedCrop.height * scaleY,
        scale: 1
      };
      console.log('📐 CROP DEBUG - Enviando crop:', cropData);
      form.append('crop', JSON.stringify(cropData));
    }
    
    setLoading(true);
    try {
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens`, { method:'POST', body: form });
      const j = await r.json();
      if(j.success){ 
        setMessage({type:'success', text:'Imagem enviada'}); 
        resetUpload(); 
        await carregar(); 
      } else {
        setMessage({type:'error', text:j.error||'Erro upload'});
      }
    } catch(e:any){ 
      setMessage({type:'error', text:'Falha upload'});
    } finally { 
      setLoading(false);
    }
  }

  // Função de swap por botões
  async function swap(pos: number, direction: 'left'|'right'){
    console.log('🔄 SWAP DEBUG - Iniciando swap:', { pos, direction, loading, totalImagens: imagens.length });
    if(loading) return;
    const from = pos;
    const to = direction==='left'? pos-1 : pos+1;
    console.log('🔄 SWAP DEBUG - Calculado:', { from, to });
    if(to < 1 || to > imagens.length) {
      console.log('❌ SWAP DEBUG - Fora dos limites, cancelando');
      return;
    }
    // Chamar endpoint PATCH swap
    setLoading(true);
    console.log('📡 SWAP DEBUG - Enviando requisição PATCH...');
    try {
      const payload = { acao:'swap', from, to };
      console.log('📡 SWAP DEBUG - Payload:', payload);
      const r = await fetch(`/api/produtos/${codigoInterno}/imagens`, { 
        method:'PATCH', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify(payload)
      });
      console.log('📡 SWAP DEBUG - Response status:', r.status);
      const j = await r.json();
      console.log('📡 SWAP DEBUG - Response data:', j);
      if(j.success){ 
        // Forçar reload após swap para quebrar cache das imagens
        console.log('✅ SWAP DEBUG - Success, recarregando para quebrar cache...');
        await carregar();
      } else { 
        console.log('❌ SWAP DEBUG - Erro do servidor:', j.error);
        setMessage({type:'error', text:j.error||'Falha swap'}); 
      }
    } catch(e:any){ 
      console.log('❌ SWAP DEBUG - Erro de rede:', e);
      setMessage({type:'error', text:'Erro rede swap'});
    } finally { 
      setLoading(false); 
      console.log('🔄 SWAP DEBUG - Finalizado');
    }
  }

  return (
    <div className={className}>
      {message && (
        <Alert className={message.type==='success'? 'border-green-200 bg-green-50':'border-red-200 bg-red-50'}>
          <AlertDescription className={message.type==='success'? 'text-green-800':'text-red-800'}>{message.text}</AlertDescription>
        </Alert>
      )}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Imagens do Produto ({imagens.length}/{MAX})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload / Crop */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label className="block mb-2">Upload & Redimensionamento</Label>
              <p className="text-xs text-gray-500 mb-2">
                Selecione a imagem e ajuste a área de recorte. Inicia cobrindo 90% da imagem - você pode redimensionar.
              </p>
              <Input type="file" accept="image/*" onChange={onFileChange} disabled={loading || imagens.length>=MAX} />
              {preview && (
                <div className="mt-4 space-y-4">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={undefined}
                    className="max-w-full"
                  >
                    <img 
                      ref={imgRef}
                      onLoad={onImageLoaded}
                      src={preview} 
                      alt="Preview para crop" 
                      className="max-h-80 max-w-full"
                    />
                  </ReactCrop>
                  
                  <div className="text-[11px] text-gray-500 space-y-1">
                    <p>• Arraste os cantos/bordas para redimensionar a área</p>
                    <p>• Arraste o centro para mover a seleção</p>
                    <p>• Área selecionada será recortada e salva</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="button" onClick={upload} disabled={!arquivo || loading}>
                      <Upload className="h-4 w-4 mr-1"/> Enviar
                    </Button>
                    <Button type="button" variant="outline" onClick={resetUpload}>
                      <X className="h-4 w-4 mr-1"/>Cancelar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 })}>
                      <RefreshCw className="h-4 w-4 mr-1"/>Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {/* Lista / Grid */}
            <div>
              <Label className="block mb-2">Galeria</Label>
              {imagens.length === 0 && <p className="text-sm text-gray-500">Nenhuma imagem</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {imagens.map(img => (
                  <div key={img.name}
                       className="relative group border rounded p-1 bg-white shadow-sm flex flex-col items-center text-center">
                    <div className="absolute left-1 top-1 text-xs text-gray-600">#{img.pos}</div>
                    <img src={img.url.replace(/\.png$/, '_thumb.png')} onError={(e)=>{(e.currentTarget as HTMLImageElement).src = img.url;}} alt={img.name} className="h-24 w-24 object-contain mx-auto" />
                    {img.pos===1 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1 rounded">Principal</span>}
                    <div className="flex gap-1 mt-2">
                      <Button type="button" size="sm" variant="outline" disabled={img.pos===1 || loading} onClick={()=>swap(img.pos,'left')}>{'<'}</Button>
                      <Button type="button" size="sm" variant="outline" disabled={img.pos===imagens.length || loading} onClick={()=>swap(img.pos,'right')}>{'>'}</Button>
                      <Button type="button" size="sm" variant="destructive" onClick={()=>remover(img.name)}><Trash2 className="h-3 w-3"/></Button>
                    </div>
                  </div>
                ))}

                {imagens.length < MAX && (
                  <label className="border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-xs text-gray-500 cursor-pointer hover:border-gray-400 min-h-28" aria-label="Adicionar imagem">
                    <Upload className="h-5 w-5 mb-1"/>
                    <span>Adicionar</span>
                    <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
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
