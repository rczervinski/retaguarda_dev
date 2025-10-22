'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  preco_venda: number;
  estoque: number;
  dimensoes: Dimensoes;
}

interface GradeManagerProps {
  codigoInterno: string;
  className?: string;
}

export default function GradeManager({ codigoInterno, className = '' }: GradeManagerProps) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [novaVariante, setNovaVariante] = useState<Partial<Variante>>({
    codigo_gtin: '',
    descricao: '',
    variacao: '',
    caracteristica: '',
    preco_venda: 0,
    estoque: 0,
    dimensoes: { comprimento: 0, largura: 0, altura: 0, peso: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [buscandoProduto, setBuscandoProduto] = useState(false);

  // Carregar grade existente
  useEffect(() => {
    if (codigoInterno && codigoInterno !== '0') {
      carregarGrade();
    }
  }, [codigoInterno]);

  const carregarGrade = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando grade para produto:', codigoInterno);
      
      const response = await fetch(`/api/produtos/${codigoInterno}/grade`);
      const data = await response.json();
      
      if (data.success) {
        setVariantes(data.data || []);
        console.log('✅ Grade carregada:', data.data?.length, 'variantes');
      } else {
        console.error('❌ Erro ao carregar grade:', data.error);
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar grade:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar grade' });
    } finally {
      setLoading(false);
    }
  };

  // Buscar informações do produto quando GTIN é preenchido
  const buscarProdutoPorGtin = async (gtin: string) => {
    if (!gtin || gtin.length < 3) return;
    
    try {
      setBuscandoProduto(true);
      console.log('🔍 Buscando produto por GTIN:', gtin);
      
      const response = await fetch(`/api/produtos/buscar-completo?gtin=${gtin}`);
      const data = await response.json();
      
      if (data.success) {
        const produto: ProdutoInfo = data.data;
        console.log('✅ Produto encontrado:', produto);
        
        // Preencher dados automaticamente
        setNovaVariante(prev => ({
          ...prev,
          codigo_gtin: gtin,
          descricao: produto.descricao,
          preco_venda: produto.preco_venda,
          estoque: produto.estoque,
          dimensoes: produto.dimensoes
        }));
        
        setMessage({ 
          type: 'success', 
          text: `Produto encontrado: ${produto.descricao}` 
        });
      } else {
        console.log('ℹ️ Produto não encontrado para GTIN:', gtin);
        setMessage({ 
          type: 'error', 
          text: 'Produto não encontrado. Verifique o código GTIN.' 
        });
      }
    } catch (error) {
      console.error('❌ Erro ao buscar produto:', error);
      setMessage({ type: 'error', text: 'Erro ao buscar produto' });
    } finally {
      setBuscandoProduto(false);
    }
  };

  // Adicionar nova variante
  const adicionarVariante = () => {
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
      codigo_gtin: novaVariante.codigo_gtin!,
      descricao: novaVariante.descricao || '',
      variacao: novaVariante.variacao || '',
      caracteristica: novaVariante.caracteristica || '',
      preco_venda: novaVariante.preco_venda || 0,
      estoque: novaVariante.estoque || 0,
      dimensoes: novaVariante.dimensoes || { comprimento: 0, largura: 0, altura: 0, peso: 0 }
    };

    setVariantes(prev => [...prev, variante]);
    
    // Limpar formulário
    setNovaVariante({
      codigo_gtin: '',
      descricao: '',
      variacao: '',
      caracteristica: '',
      preco_venda: 0,
      estoque: 0,
      dimensoes: { comprimento: 0, largura: 0, altura: 0, peso: 0 }
    });
    
    setMessage({ type: 'success', text: 'Variante adicionada à grade' });
  };

  // Remover variante
  const removerVariante = (index: number) => {
    setVariantes(prev => prev.filter((_, i) => i !== index));
    setMessage({ type: 'success', text: 'Variante removida da grade' });
  };

  // Salvar grade
  const salvarGrade = async () => {
    if (!codigoInterno || codigoInterno === '0') {
      setMessage({ type: 'error', text: 'Salve o produto primeiro antes de gerenciar a grade' });
      return;
    }

    if (variantes.length === 0) {
      setMessage({ type: 'error', text: 'Adicione pelo menos uma variante à grade' });
      return;
    }

    try {
      setLoading(true);
      console.log('💾 Salvando grade com', variantes.length, 'variantes');
      
      const response = await fetch(`/api/produtos/${codigoInterno}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variantes }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Grade salva com sucesso!' });
        carregarGrade(); // Recarregar para pegar os códigos gerados
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('❌ Erro ao salvar grade:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar grade' });
    } finally {
      setLoading(false);
    }
  };

  // Atualizar variante existente
  const atualizarVariante = (index: number, campo: keyof Variante, valor: any) => {
    setVariantes(prev => prev.map((variante, i) => {
      if (i === index) {
        if (campo === 'dimensoes') {
          return { ...variante, dimensoes: { ...variante.dimensoes, ...valor } };
        }
        return { ...variante, [campo]: valor };
      }
      return variante;
    }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Grade de Produtos</h2>
          <p className="text-gray-600">Gerencie variações, preços, estoque e dimensões</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {variantes.length} variante{variantes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Mensagens */}
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Formulário para nova variante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            + Adicionar Nova Variante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: GTIN e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="novo-gtin">Código GTIN *</Label>
              <div className="flex gap-2">
                <Input
                  id="novo-gtin"
                  value={novaVariante.codigo_gtin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, codigo_gtin: e.target.value }))}
                  onBlur={() => buscarProdutoPorGtin(novaVariante.codigo_gtin || '')}
                  placeholder="Digite o código GTIN"
                  className="flex-1"
                />
                {buscandoProduto && (
                  <Button variant="outline" size="icon" disabled>
                    🔍
                  </Button>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nova-descricao">Descrição</Label>
              <Input
                id="nova-descricao"
                value={novaVariante.descricao}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição do produto"
              />
            </div>
          </div>

          {/* Linha 2: Variação e Característica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nova-variacao">Variação *</Label>
              <Input
                id="nova-variacao"
                value={novaVariante.variacao}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, variacao: e.target.value }))}
                placeholder="Ex: Tamanho, Cor, etc."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nova-caracteristica">Característica *</Label>
              <Input
                id="nova-caracteristica"
                value={novaVariante.caracteristica}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, caracteristica: e.target.value }))}
                placeholder="Ex: GG, Azul, etc."
              />
            </div>
          </div>

          {/* Linha 3: Preço e Estoque */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="novo-preco">Preço de Venda</Label>
              <div className="flex items-center gap-2">
                💰
                <Input
                  id="novo-preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVariante.preco_venda}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, preco_venda: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="novo-estoque">Estoque</Label>
              <div className="flex items-center gap-2">
                📦
                <Input
                  id="novo-estoque"
                  type="number"
                  min="0"
                  value={novaVariante.estoque}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ ...prev, estoque: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          {/* Linha 4: Dimensões */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              📏 Dimensões
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="novo-comprimento" className="text-xs text-gray-600">Comprimento (cm)</Label>
                <Input
                  id="novo-comprimento"
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVariante.dimensoes?.comprimento || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ 
                    ...prev, 
                    dimensoes: { 
                      ...prev.dimensoes!, 
                      comprimento: parseFloat(e.target.value) || 0 
                    } 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="nova-largura" className="text-xs text-gray-600">Largura (cm)</Label>
                <Input
                  id="nova-largura"
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVariante.dimensoes?.largura || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ 
                    ...prev, 
                    dimensoes: { 
                      ...prev.dimensoes!, 
                      largura: parseFloat(e.target.value) || 0 
                    } 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="nova-altura" className="text-xs text-gray-600">Altura (cm)</Label>
                <Input
                  id="nova-altura"
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVariante.dimensoes?.altura || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ 
                    ...prev, 
                    dimensoes: { 
                      ...prev.dimensoes!, 
                      altura: parseFloat(e.target.value) || 0 
                    } 
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="novo-peso" className="text-xs text-gray-600 flex items-center gap-1">
                  ⚖️ Peso (kg)
                </Label>
                <Input
                  id="novo-peso"
                  type="number"
                  step="0.01"
                  min="0"
                  value={novaVariante.dimensoes?.peso || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovaVariante(prev => ({ 
                    ...prev, 
                    dimensoes: { 
                      ...prev.dimensoes!, 
                      peso: parseFloat(e.target.value) || 0 
                    } 
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Botão adicionar */}
          <Button 
            onClick={adicionarVariante}
            className="w-full"
            disabled={buscandoProduto}
          >
            + Adicionar à Grade
          </Button>
        </CardContent>
      </Card>

      {/* Lista de variantes */}
      {variantes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Variantes da Grade</span>
              <Button 
                onClick={salvarGrade} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                💾 {loading ? 'Salvando...' : 'Salvar Grade'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {variantes.map((variante, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{variante.codigo_gtin}</Badge>
                      <span className="font-medium">{variante.descricao}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removerVariante(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      🗑️
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">Variação</Label>
                      <Input
                        value={variante.variacao}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'variacao', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Característica</Label>
                      <Input
                        value={variante.caracteristica}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'caracteristica', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Preço</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variante.preco_venda}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'preco_venda', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Estoque</Label>
                      <Input
                        type="number"
                        value={variante.estoque}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'estoque', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Dimensões editáveis */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600">Comprimento</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variante.dimensoes.comprimento}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'dimensoes', { comprimento: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Largura</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variante.dimensoes.largura}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'dimensoes', { largura: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Altura</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variante.dimensoes.altura}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'dimensoes', { altura: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Peso</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variante.dimensoes.peso}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => atualizarVariante(index, 'dimensoes', { peso: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  {/* Placeholder para futura funcionalidade de imagem */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    🖼️ <span>Imagem: (Sistema de imagens será implementado)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
