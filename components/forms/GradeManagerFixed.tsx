// ADIÇÕES PRINCIPAIS:
// 1. Impede submit / reload (Enter, submit bubbling).
// 2. Usa origin absoluto pra evitar porta errada.
// 3. Só atualiza estado após sucesso (remove otimista que podia "sumir").
// 4. Recarrega grade após POST confirmando inserção.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, X, Trash2, Image as ImageIcon, SortAsc } from 'lucide-react';

interface Dimensoes {
  comprimento: number;
  largura: number;
  altura: number;
  peso: number;
}

interface Variante {
  codigo?: number;
  codigo_gtin: string;
  descricao: string;
  variacao: string;
  caracteristica: string;
  preco_venda: number;
  estoque: number;
  dimensoes: Dimensoes;
}

interface GradeManagerProps {
  codigoInterno: string;
  className?: string;
  ensureParent?: () => Promise<string | null>;
}

interface ModalEditarProps {
  variante: Variante;
  isOpen: boolean;
  onClose: () => void;
  onSave: (variante: Variante) => void;
}

// Modal para edição detalhada da variante
function ModalEditarVariante({ variante, isOpen, onClose, onSave }: ModalEditarProps) {
  const [editVariante, setEditVariante] = useState<Variante>(variante);

  useEffect(() => {
    setEditVariante(variante);
  }, [variante]);

  const handleSave = () => {
    onSave(editVariante);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Editar Variante</h3>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Informações básicas (readonly) */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <Label>GTIN</Label>
              <Input value={editVariante.codigo_gtin} disabled />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={editVariante.descricao} disabled />
            </div>
            <div>
              <Label>Variação</Label>
              <Input value={editVariante.variacao} disabled />
            </div>
            <div>
              <Label>Característica</Label>
              <Input value={editVariante.caracteristica} disabled />
            </div>
          </div>

          {/* Preço e Estoque */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preco">Preço de Venda (R$)</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={editVariante.preco_venda}
                onChange={(e) => setEditVariante(prev => ({ 
                  ...prev, 
                  preco_venda: parseFloat(e.target.value) || 0 
                }))}
              />
            </div>
            <div>
              <Label htmlFor="estoque">Estoque</Label>
              <Input
                id="estoque"
                type="number"
                value={editVariante.estoque}
                onChange={(e) => setEditVariante(prev => ({ 
                  ...prev, 
                  estoque: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
          </div>

          {/* Dimensões */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Dimensões</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="comprimento">Comprimento (cm)</Label>
                <Input
                  id="comprimento"
                  type="number"
                  step="0.01"
                  value={editVariante.dimensoes.comprimento}
                  onChange={(e) => setEditVariante(prev => ({
                    ...prev,
                    dimensoes: {
                      ...prev.dimensoes,
                      comprimento: parseFloat(e.target.value) || 0
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="largura">Largura (cm)</Label>
                <Input
                  id="largura"
                  type="number"
                  step="0.01"
                  value={editVariante.dimensoes.largura}
                  onChange={(e) => setEditVariante(prev => ({
                    ...prev,
                    dimensoes: {
                      ...prev.dimensoes,
                      largura: parseFloat(e.target.value) || 0
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="altura">Altura (cm)</Label>
                <Input
                  id="altura"
                  type="number"
                  step="0.01"
                  value={editVariante.dimensoes.altura}
                  onChange={(e) => setEditVariante(prev => ({
                    ...prev,
                    dimensoes: {
                      ...prev.dimensoes,
                      altura: parseFloat(e.target.value) || 0
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="peso">Peso (g)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.01"
                  value={editVariante.dimensoes.peso}
                  onChange={(e) => setEditVariante(prev => ({
                    ...prev,
                    dimensoes: {
                      ...prev.dimensoes,
                      peso: parseFloat(e.target.value) || 0
                    }
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Imagens (placeholder) */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 mb-2">Sistema de imagens</p>
            <p className="text-xs text-gray-400">Upload e crop de imagens (em desenvolvimento)</p>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GradeManagerFixed({ codigoInterno, className = '', ensureParent }: GradeManagerProps) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [customSeq, setCustomSeq] = useState('');
  
  // Estados para modal de edição
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [varianteEditando, setVarianteEditando] = useState<Variante | null>(null);

  // Estados para nova variante (apenas campos básicos)
  const [novaVariante, setNovaVariante] = useState({
    codigo_gtin: '',
    descricao: '',
    variacao: '',
    caracteristica: ''
  });

  useEffect(() => {
    if (codigoInterno && codigoInterno !== '0') {
      carregarGrade();
    }
  }, [codigoInterno]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // PREVENIR SUBMIT / RELOAD
  useEffect(() => {
    const preventSubmit = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-grade-manager="true"]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('submit', preventSubmit, true);
    return () => document.removeEventListener('submit', preventSubmit, true);
  }, []);

  const baseFetch = useCallback((path: string, init?: RequestInit) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return fetch(`${origin}${path}`, init);
  }, []);

  const carregarGrade = async () => {
    try {
      setLoading(true);
      const response = await baseFetch(`/api/produtos/${codigoInterno}/grade`);
      const data = await response.json();
      if (data.success) {
        const normalizadas = (data.grade || []).map((v: any) => ({
          codigo: typeof v.codigo !== 'undefined' ? Number(v.codigo) : undefined,
          codigo_gtin: v.codigo_gtin || '',
          descricao: v.descricao || v.nome || '',
            variacao: v.variacao || '',
          caracteristica: v.caracteristica || '',
          preco_venda: parseFloat(v.preco_venda) || 0,
          estoque: parseInt(v.estoque) || 0,
          dimensoes: {
            comprimento: parseFloat(v.comprimento) || 0,
            largura: parseFloat(v.largura) || 0,
            altura: parseFloat(v.altura) || 0,
            peso: parseFloat(v.peso) || 0
          }
        }));
  // Normaliza exibição de CARACTERÍSTICA em maiúsculo
  setVariantes((normalizadas as Variante[]).map((v: Variante) => ({ ...v, caracteristica: (v.caracteristica || '').toUpperCase() })));
      } else {
        console.warn('⚠️ Falha carregar grade:', data.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar grade:', error);
    } finally {
      setLoading(false);
    }
  };

  // Removido: função de testes de API da UI

  const buscarProdutoPorGtin = async (gtin: string) => {
    if (!gtin || gtin.length < 1) {
      console.log('🚫 buscarProdutoPorGtin abortado: length < 1');
      return;
    }
    
    try {
      setBuscandoProduto(true);
      console.log('🔍 Buscando produto por GTIN:', gtin);
      const response = await fetch(`/api/produtos/buscar-gtin?gtin=${gtin}`);
      const data = await response.json();
      
      console.log('📦 Resposta da API:', data);
      if (data.success && data.data) {
        setNovaVariante(prev => ({
          ...prev,
          descricao: data.data.descricao
        }));
        setMessage({ type: 'success', text: 'Produto encontrado!' });
      } else {
        setMessage({ type: 'error', text: 'Produto não encontrado.' });
      }
    } catch (error) {
      console.error('❌ Erro ao buscar produto:', error);
      setMessage({ type: 'error', text: 'Erro ao buscar produto' });
    } finally {
      setBuscandoProduto(false);
    }
  };

  const handleGtinChange = (gtin: string) => {
    console.log('🔍 handleGtinChange chamado com GTIN:', gtin);
    setNovaVariante(prev => ({ ...prev, codigo_gtin: gtin, descricao: '' }));

    // Validar tamanho máximo (ex: aceitar até 15)
    if (gtin.length > 15) {
      console.log('⚠️ GTIN > 15 chars, ignorando excesso');
      return;
    }

    // Limpa timeout anterior
    if (timeoutId) clearTimeout(timeoutId);

    // Busca após 400ms se houver pelo menos 1 char (permitir 1..15)
    const newTimeoutId = setTimeout(() => {
      console.log('⏰ Timeout GTIN disparou. length=', gtin.length);
      if (gtin.length >= 1) {
        buscarProdutoPorGtin(gtin);
      } else {
        console.log('🚫 Não busca: length < 1');
      }
    }, 400);

    setTimeoutId(newTimeoutId);
  };

  const adicionarVariante = async () => {
    let parent = codigoInterno
    if (!parent || String(parent).trim() === '' || String(parent) === '0') {
      // Solicitar criação automática do produto pai
      if (ensureParent) {
        setMessage({ type: 'success', text: 'Criando produto antes de vincular a variante...' })
        const novo = await ensureParent()
        // ensureParent agora redireciona para /editar; interromper fluxo aqui
        return
      } else {
        setMessage({ type: 'error', text: 'Crie e salve o produto primeiro para gerar o código interno. Depois adicione as variantes.' })
        return
      }
    }
    if (!novaVariante.codigo_gtin || !novaVariante.variacao || !novaVariante.caracteristica) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' });
      return;
    }
    if (variantes.some(v => v.codigo_gtin === novaVariante.codigo_gtin)) {
      setMessage({ type: 'error', text: 'GTIN já existe na grade' });
      return;
    }

    const novaLista = [
      ...variantes,
      {
        codigo_gtin: novaVariante.codigo_gtin,
        descricao: novaVariante.descricao || '',
        variacao: novaVariante.variacao,
        caracteristica: (novaVariante.caracteristica || '').toUpperCase(),
        preco_venda: 0,
        estoque: 0,
        dimensoes: { comprimento: 0, largura: 0, altura: 0, peso: 0 }
      }
    ];

    try {
      setLoading(true);
      const resp = await baseFetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantes: novaLista })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Variante salva' });
        // Limpa form
        setNovaVariante({ codigo_gtin: '', descricao: '', variacao: '', caracteristica: '' });
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de edição (faltando após últimos merges)
  const abrirModalEdicao = (variante: Variante) => {
    const segura: Variante = {
      ...variante,
      dimensoes: variante.dimensoes || { comprimento: 0, largura: 0, altura: 0, peso: 0 }
    };
    setVarianteEditando(segura);
    setModalEditarAberto(true);
  };

  const salvarEdicaoVariante = async (varianteEditada: Variante) => {
    const novaLista = variantes.map(v => v.codigo_gtin === varianteEditada.codigo_gtin ? varianteEditada : v);
    try {
      setLoading(true);
      const resp = await baseFetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantes: novaLista })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Variante atualizada' });
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao atualizar' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Erro ao atualizar' });
    } finally {
      setLoading(false);
    }
  };

  const removerVariante = async (index: number) => {
    if (!confirm('Remover esta variante?')) return;
    const novaLista = variantes.filter((_, i) => i !== index);
    try {
      setLoading(true);
      const resp = await baseFetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantes: novaLista })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Variante removida' });
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao remover' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Erro ao remover' });
    } finally {
      setLoading(false);
    }
  };

  // ===== ORDENACAO SIMPLIFICADA =====
  const ordenar = async (mode: 'numeric' | 'alphabetic' | 'sizes') => {
    try {
      setLoading(true);
      const resp = await baseFetch(`/api/produtos/${codigoInterno}/grade/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Ordenação aplicada' });
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Falha ao ordenar' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Erro ao ordenar' });
    } finally {
      setLoading(false);
    }
  };

  const ordenarCustom = async () => {
    const seq = customSeq
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (!seq.length) {
      setMessage({ type: 'error', text: 'Informe a sequência personalizada separada por vírgulas' });
      return;
    }
    try {
      setLoading(true);
      const resp = await baseFetch(`/api/produtos/${codigoInterno}/grade/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', sequence: seq })
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Ordenação personalizada aplicada' });
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Falha ao ordenar' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Erro ao ordenar' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-grade-manager="true"
      className={`space-y-6 ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => { e.stopPropagation(); }}
    >
      {/* Mensagens */}
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Formulário para adicionar nova variante - SEM FORM TAG */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Nova Variante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="novo-gtin">GTIN *</Label>
              <div className="flex gap-2">
                <Input
                  id="novo-gtin"
                  value={novaVariante.codigo_gtin}
                  onChange={(e) => handleGtinChange(e.target.value)}
                  placeholder="Digite o GTIN"
                />
                {buscandoProduto && (
                  <Button type="button" variant="outline" size="icon" disabled>
                    <Search className="h-4 w-4 animate-spin" />
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="nova-descricao">Descrição</Label>
              <Input
                id="nova-descricao"
                value={novaVariante.descricao}
                onChange={(e) => setNovaVariante(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Auto-preenchido ou digite"
              />
            </div>
            
            <div>
              <Label htmlFor="nova-variacao">Variação *</Label>
              <Input
                id="nova-variacao"
                value={novaVariante.variacao}
                onChange={(e) => setNovaVariante(prev => ({ ...prev, variacao: e.target.value }))}
                placeholder="Ex: COR"
              />
            </div>
            
            <div>
              <Label htmlFor="nova-caracteristica">Característica *</Label>
              <Input
                id="nova-caracteristica"
                value={novaVariante.caracteristica}
                onChange={(e) => setNovaVariante(prev => ({ ...prev, caracteristica: e.target.value }))}
                placeholder="Ex: AZUL"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" onClick={adicionarVariante} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Adicionando...' : 'Adicionar Variante'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de variantes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Variantes da Grade ({variantes.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => ordenar('numeric')} disabled={loading}>
                <SortAsc className="h-4 w-4 mr-1" /> Ordenar por Número
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => ordenar('alphabetic')} disabled={loading}>
                <SortAsc className="h-4 w-4 mr-1" /> Ordenar A → Z
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => ordenar('sizes')} disabled={loading}>
                <SortAsc className="h-4 w-4 mr-1" /> Medidas (PP…G4)
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Sequência personalizada (ex: PP,P,M,G,GG)"
                  value={customSeq}
                  onChange={(e) => setCustomSeq(e.target.value)}
                  className="w-72"
                />
                <Button type="button" variant="outline" size="sm" onClick={ordenarCustom} disabled={loading}>
                  <SortAsc className="h-4 w-4 mr-1" /> Aplicar personalizada
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {variantes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma variante cadastrada
            </div>
          ) : (
            <div className="space-y-3">
              {variantes.map((variante, index) => (
                <div key={index} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="grid grid-cols-5 gap-4 flex-1">
                    <div>
                      <Label className="text-xs text-gray-500">Código</Label>
                      <p className="font-mono text-xs">{typeof variante.codigo !== 'undefined' ? String(variante.codigo) : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">GTIN</Label>
                      <p className="font-mono text-sm">{variante.codigo_gtin}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Descrição</Label>
                      <p className="text-sm">{variante.descricao}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Variação</Label>
                      <Badge variant="outline">{variante.variacao}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Característica</Label>
                      <Badge variant="secondary">{variante.caracteristica}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirModalEdicao(variante) }}
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removerVariante(index) }}
                      className="text-red-600 hover:text-red-700"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de edição */}
      {varianteEditando && (
        <ModalEditarVariante
          variante={varianteEditando}
          isOpen={modalEditarAberto}
          onClose={() => {
            setModalEditarAberto(false);
            setVarianteEditando(null);
          }}
          onSave={salvarEdicaoVariante}
        />
      )}
    </div>
  );
}
