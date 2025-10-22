import React, { useState } from 'react';
import { useProdutoGtin } from '../../hooks/useProdutoGtin';

interface GradeItem {
  codigo: string;
  nome: string;
  variacao: string;
  caracteristica: string;
  codigo_gtin: string;
  codigo_interno: string;
}

interface GradeFormProps {
  codigoProdutoPai: number;
  gradeInicial?: GradeItem[];
  onGradeChange: (grade: GradeItem[]) => void;
}

export default function GradeForm({ codigoProdutoPai, gradeInicial = [], onGradeChange }: GradeFormProps) {
  const [grade, setGrade] = useState<GradeItem[]>(gradeInicial);
  const [novoItem, setNovoItem] = useState<Partial<GradeItem>>({
    codigo: codigoProdutoPai.toString(),
    nome: '',
    variacao: '',
    caracteristica: '',
    codigo_gtin: '',
    codigo_interno: ''
  });

  const { buscarProduto, loading } = useProdutoGtin();

  const handleGtinBlur = async (gtin: string) => {
    if (!gtin) return;

    const produto = await buscarProduto(gtin);
    if (produto) {
      setNovoItem(prev => ({
        ...prev,
        nome: produto.descricao,
        codigo_interno: produto.codigo_interno.toString()
      }));
    }
  };

  const adicionarItem = () => {
    if (!novoItem.codigo_gtin || !novoItem.nome) {
      alert('GTIN e Nome são obrigatórios');
      return;
    }

    const item: GradeItem = {
      codigo: codigoProdutoPai.toString(),
      nome: novoItem.nome || '',
      variacao: (novoItem.variacao || '').toUpperCase(),
      caracteristica: (novoItem.caracteristica || '').toUpperCase(),
      codigo_gtin: novoItem.codigo_gtin || '',
      codigo_interno: novoItem.codigo_interno || ''
    };

    const novaGrade = [...grade, item];
    setGrade(novaGrade);
    onGradeChange(novaGrade);

    // Limpar formulário
    setNovoItem({
      codigo: codigoProdutoPai.toString(),
      nome: '',
      variacao: '',
      caracteristica: '',
      codigo_gtin: '',
      codigo_interno: ''
    });
  };

  const removerItem = (index: number) => {
    const novaGrade = grade.filter((_, i) => i !== index);
    setGrade(novaGrade);
    onGradeChange(novaGrade);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-800">📏 Grade do Produto</h4>
      
      {/* Formulário para adicionar item */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-700 mb-3">Adicionar Variação</h5>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              placeholder="Digite o GTIN"
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
              Variação
            </label>
            <input
              type="text"
              value={novoItem.variacao || ''}
              onChange={(e) => setNovoItem(prev => ({ ...prev, variacao: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: COR, TAMANHO"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Característica
            </label>
            <input
              type="text"
              value={novoItem.caracteristica || ''}
              onChange={(e) => setNovoItem(prev => ({ ...prev, caracteristica: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: AZUL, GRANDE"
            />
          </div>
        </div>

        <button
          onClick={adicionarItem}
          disabled={loading || !novoItem.codigo_gtin || !novoItem.nome}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          ➕ Adicionar Variação
        </button>
      </div>

      {/* Lista de itens da grade */}
      {grade.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">GTIN</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Variação</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Característica</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grade.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{item.codigo_gtin}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.nome}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.variacao}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.caracteristica}</td>
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

      {grade.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhuma variação adicionada
        </div>
      )}
    </div>
  );
}
