import React from 'react';
import GradeManagerNew from '@/components/forms/GradeManagerNew';

// Exemplo de como usar o componente GradeManager
export default function ExemploGradePage() {
  // Em uma aplicação real, você pegaria o codigoInterno do produto atual
  const codigoInterno = "123"; // Substitua pelo código interno real

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Grade de Produtos</h1>
        <p className="text-gray-600 mt-2">
          Interface moderna para gerenciar variações de produtos com preços, estoque e dimensões individuais.
        </p>
      </div>

      {/* Componente de Grade */}
      <GradeManagerNew 
        codigoInterno={codigoInterno}
        className="bg-white rounded-lg shadow-sm"
      />

      {/* Informações adicionais */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Como usar:</h3>
        <ul className="text-blue-800 space-y-1">
          <li>1. Digite o código GTIN da variante</li>
          <li>2. O sistema buscará automaticamente as informações do produto</li>
          <li>3. Preencha a variação e característica (ex: "Tamanho" e "GG")</li>
          <li>4. Ajuste preço, estoque e dimensões se necessário</li>
          <li>5. Clique em "Adicionar à Grade" e depois "Salvar Grade"</li>
        </ul>
      </div>

      <div className="mt-4 p-6 bg-green-50 rounded-lg">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Recursos implementados:</h3>
        <ul className="text-green-800 space-y-1">
          <li>✅ Busca automática de produto por GTIN</li>
          <li>✅ Preenchimento automático de descrição, preço e dimensões</li>
          <li>✅ Edição de preço, estoque e dimensões por variante</li>
          <li>✅ Validação de campos obrigatórios</li>
          <li>✅ Consulta SQL otimizada com JOINs</li>
          <li>✅ Interface responsiva e moderna</li>
          <li>🔄 Sistema de imagens (será implementado)</li>
        </ul>
      </div>
    </div>
  );
}
