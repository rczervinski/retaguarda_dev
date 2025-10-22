'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, X, Save, Trash2, Image as ImageIcon } from 'lucide-react';

interface Dimensoes {
  comprimento: number;
  largura: number;
  altura: number;
  peso: number;
}

interface Variante {
  codigo?: string;
  codigo_gtin: string;
  descricao: string;
  variacao: string;
  caracteristica: string;
  preco_venda: number;
  estoque: number;
  dimensoes: Dimensoes;
}

interface ProdutoInfo {
  codigo_interno: string;
  codigo_gtin: string;
  descricao: string;
}

interface GradeManagerProps {
  codigoInterno: string;
  className?: string;
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
          <Button variant="outline" size="sm" onClick={onClose}>
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
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GradeManagerImproved({ codigoInterno, className = '' }: GradeManagerProps) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  
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

  const carregarGrade = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/produtos/${codigoInterno}/grade`);
      const data = await response.json();
      
      if (data.success) {
        setVariantes(data.grade || []);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar grade:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarProdutoPorGtin = async (gtin: string) => {
    if (!gtin || gtin.length < 8) return;
    
    try {
      setBuscandoProduto(true);
      const response = await fetch(`/api/produtos/buscar-por-gtin?gtin=${gtin}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setNovaVariante(prev => ({
          ...prev,
          descricao: data.data.descricao
        }));
        setMessage({ type: 'success', text: 'Produto encontrado e dados preenchidos!' });
      } else {
        setMessage({ type: 'error', text: 'Produto não encontrado. Digite manualmente.' });
      }
    } catch (error) {
      console.error('❌ Erro ao buscar produto:', error);
      setMessage({ type: 'error', text: 'Erro ao buscar produto' });
    } finally {
      setBuscandoProduto(false);
    }
  };

  const adicionarVariante = async (e?: React.FormEvent) => {
    // Prevenir reload da página se for um submit de formulário
    if (e) {
      e.preventDefault();
    }

    if (!novaVariante.codigo_gtin || !novaVariante.variacao || !novaVariante.caracteristica) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios' });
      return;
    }

    // Verificar se GTIN já existe
    const gtinExiste = variantes.some(v => v.codigo_gtin === novaVariante.codigo_gtin);
    if (gtinExiste) {
      setMessage({ type: 'error', text: 'Este GTIN já existe na grade' });
      return;
    }

    const variante: Variante = {
      codigo_gtin: novaVariante.codigo_gtin,
      descricao: novaVariante.descricao || '',
      variacao: novaVariante.variacao,
      caracteristica: novaVariante.caracteristica,
      preco_venda: 0,
      estoque: 0,
      dimensoes: { comprimento: 0, largura: 0, altura: 0, peso: 0 }
    };

    try {
      setLoading(true);
      
      // Salvar automaticamente na tabela
      const response = await fetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variantes: [...variantes, variante] }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Atualizar estado local
        setVariantes(prev => [...prev, variante]);
        
        // Limpar formulário
        setNovaVariante({
          codigo_gtin: '',
          descricao: '',
          variacao: '',
          caracteristica: ''
        });
        
        setMessage({ type: 'success', text: 'Variante adicionada e salva automaticamente!' });
        
        // Recarregar grade para pegar possíveis códigos gerados pelo servidor
        await carregarGrade();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar variante' });
      }
    } catch (error) {
      console.error('❌ Erro ao salvar variante:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar variante' });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEdicao = (variante: Variante) => {
    setVarianteEditando(variante);
    setModalEditarAberto(true);
  };

  const salvarEdicaoVariante = async (varianteEditada: Variante) => {
    try {
      setLoading(true);
      
      // Atualizar lista de variantes
      const variantesAtualizadas = variantes.map(v => 
        v.codigo_gtin === varianteEditada.codigo_gtin ? varianteEditada : v
      );
      
      // Salvar automaticamente na tabela
      const response = await fetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variantes: variantesAtualizadas }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setVariantes(variantesAtualizadas);
        setMessage({ type: 'success', text: 'Variante atualizada e salva automaticamente!' });
        await carregarGrade(); // Recarregar para sincronizar
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar alterações' });
      }
    } catch (error) {
      console.error('❌ Erro ao salvar edição:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações' });
    } finally {
      setLoading(false);
    }
  };

  const removerVariante = async (index: number) => {
    if (confirm('Tem certeza que deseja remover esta variante?')) {
      try {
        setLoading(true);
        
        const variantesAtualizadas = variantes.filter((_, i) => i !== index);
        
        // Salvar automaticamente na tabela
        const response = await fetch(`/api/produtos/${codigoInterno}/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ variantes: variantesAtualizadas }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          setVariantes(variantesAtualizadas);
          setMessage({ type: 'success', text: 'Variante removida automaticamente!' });
          await carregarGrade(); // Recarregar para sincronizar
        } else {
          setMessage({ type: 'error', text: data.error || 'Erro ao remover variante' });
        }
      } catch (error) {
        console.error('❌ Erro ao remover variante:', error);
        setMessage({ type: 'error', text: 'Erro ao remover variante' });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Mensagens */}
      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Formulário para adicionar nova variante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Nova Variante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={adicionarVariante}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="novo-gtin">GTIN *</Label>
                <div className="flex gap-2">
                  <Input
                    id="novo-gtin"
                    value={novaVariante.codigo_gtin}
                    onChange={(e) => setNovaVariante(prev => ({ ...prev, codigo_gtin: e.target.value }))}
                    onBlur={(e) => buscarProdutoPorGtin(e.target.value)}
                    placeholder="Digite o GTIN"
                    required
                  />
                  {buscandoProduto && (
                    <Button variant="outline" size="icon" disabled type="button">
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
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="nova-caracteristica">Característica *</Label>
                <Input
                  id="nova-caracteristica"
                  value={novaVariante.caracteristica}
                  onChange={(e) => setNovaVariante(prev => ({ ...prev, caracteristica: e.target.value }))}
                  placeholder="Ex: AZUL"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Adicionando...' : 'Adicionar Variante'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de variantes */}
      <Card>
        <CardHeader>
          <CardTitle>Variantes da Grade ({variantes.length})</CardTitle>
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
                  <div className="grid grid-cols-4 gap-4 flex-1">
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
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalEdicao(variante)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removerVariante(index)}
                      className="text-red-600 hover:text-red-700"
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
