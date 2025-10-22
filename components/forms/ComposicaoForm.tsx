import React, { useState } from 'react';
import { useProdutoGtin } from '../../hooks/useProdutoGtin';

interface ComposicaoItem {
  codigo_interno: number;
  codigo_gtin: string;
  qtde: number;
  nome?: string; // Campo adicional para exibição
}

interface ComposicaoFormProps {
  codigoProdutoPai: number;
  composicaoInicial?: ComposicaoItem[];
  onComposicaoChange: (composicao: ComposicaoItem[]) => void;
}

export default function ComposicaoForm({ codigoProdutoPai, composicaoInicial = [], onComposicaoChange }: ComposicaoFormProps) {
  const [composicao, setComposicao] = useState<ComposicaoItem[]>(composicaoInicial);
  const [novoItem, setNovoItem] = useState<Partial<ComposicaoItem & { nome: string }>>({
    codigo_interno: codigoProdutoPai,
    codigo_gtin: '',
    qtde: 1,
    nome: ''
  });

  const { buscarProduto, loading } = useProdutoGtin();

  const handleGtinBlur = async (gtin: string) => {
    if (!gtin) return;

    const produto = await buscarProduto(gtin);
    if (produto) {
      setNovoItem(prev => ({
        ...prev,
        nome: produto.descricao
      }));
    }
  };

  const adicionarItem = () => {
    if (!novoItem.codigo_gtin || !novoItem.qtde || !novoItem.nome) {
      alert('GTIN, Quantidade e Nome são obrigatórios');
      return;
    }

    const item: ComposicaoItem = {
      codigo_interno: codigoProdutoPai,
      codigo_gtin: novoItem.codigo_gtin || '',
      qtde: Number(novoItem.qtde) || 1,
      nome: novoItem.nome || ''
    };

    const novaComposicao = [...composicao, item];
    setComposicao(novaComposicao);
    onComposicaoChange(novaComposicao);

    // Limpar formulário
    setNovoItem({
      codigo_interno: codigoProdutoPai,
      codigo_gtin: '',
      qtde: 1,
      nome: ''
    });
  };

  const removerItem = (index: number) => {
    const novaComposicao = composicao.filter((_, i) => i !== index);
    setComposicao(novaComposicao);
    onComposicaoChange(novaComposicao);
  };

  const atualizarQuantidade = (index: number, novaQtde: number) => {
    const novaComposicao = composicao.map((item, i) => 
      i === index ? { ...item, qtde: novaQtde } : item
    );
    setComposicao(novaComposicao);
    onComposicaoChange(novaComposicao);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-800">🧪 Composição do Produto</h4>
      
      {/* Formulário para adicionar item */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-700 mb-3">Adicionar Componente</h5>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código GTIN *
            </label>
            <input
              type="text"
              value={novoItem.codigo_gtin || ''}
              onChange={(e) => setNovoItem(prev => ({ ...prev, codigo_gtin: e.target.value }))}
              onBlur={(e) => handleGtinBlur(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite o GTIN do componente"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome {loading && '(Carregando...)'}
            </label>
            <input
              type="text"
              value={novoItem.nome || ''}
              onChange={(e) => setNovoItem(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
              placeholder="Nome será preenchido automaticamente"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={novoItem.qtde || ''}
              onChange={(e) => setNovoItem(prev => ({ ...prev, qtde: parseFloat(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Quantidade"
            />
          </div>
        </div>

        <button
          onClick={adicionarItem}
          disabled={loading || !novoItem.codigo_gtin || !novoItem.nome || !novoItem.qtde}
          className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          ➕ Adicionar Componente
        </button>
      </div>

      {/* Lista de itens da composição */}
      {composicao.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">GTIN</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nome do Componente</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Quantidade</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {composicao.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{item.codigo_gtin}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.nome}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.qtde}
                      onChange={(e) => atualizarQuantidade(index, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Quantidade do componente"
                      placeholder="Qtde"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removerItem(index)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      🗑️ Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {composicao.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum componente adicionado
        </div>
      )}
    </div>
  );
}
