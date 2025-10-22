'use client'

import { useState, useEffect } from 'react'
import { ProdutoCompleto, SecoesProduto, CAMPO_LABELS } from '@/types/produto'
import { ChevronDownIcon, ChevronUpIcon, CloudIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import ComposicaoForm from './ComposicaoForm'
import GradeManagerFixed from './GradeManagerFixed'
import ImageManager from './ImageManager'
import { useRouter } from 'next/navigation'
// import GradeForm from './GradeForm' // Substituído pelo novo GradeManager
// import { useFornecedores } from '../../hooks/useFornecedores'
// import { useCategorias } from '../../hooks/useCategorias'
import FornecedorSelect from '../ui/FornecedorSelect'
import GrupoSelect from '../ui/GrupoSelect'
import CategoriaSelect from '../ui/CategoriaSelect'
import SubgrupoSelect from '../ui/SubgrupoSelect'

interface ProductEditFormProps {
  produto: ProdutoCompleto | null
  onSave: (produto: Partial<ProdutoCompleto>) => void
  onCancel: () => void
}

interface SectionState {
  [key: string]: boolean
}

type ComposicaoItem = {
  id: string;
  produto_id: string;
  codigo_gtin: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  custo: string;
  observacao?: string;
};

export function ProductEditForm({ produto, onSave, onCancel }: ProductEditFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<ProdutoCompleto>>(() => {
    if (!produto) return {
      // IPI/PIS/COFINS defaults
      ipi_reducao_bc: '0',
      aliquota_ipi: 0,
      ipi_reducao_bc_st: '0',
      aliquota_ipi_st: '0',
      cst_ipi: '',
      calculo_ipi: '',
      pis_reducao_bc: '0',
      aliquota_pis: '0',
      pis_reducao_bc_st: '0',
      aliquota_pis_st: '0',
      cst_pis: '',
      calculo_pis: '',
      cofins_reducao_bc: '0',
      aliquota_cofins: 0,
      cofins_reducao_bc_st: '0',
      aliquota_cofins_st: '0',
      cst_cofins: '',
      calculo_cofins: '',
      // Modalidade BC ICMS ST
      mod_deter_bc_icms_st: '',
      // Grade defaults
      tem_grade: false,
      grade_obrigatoria: false,
      sequencia_grade: '',
      tipo_grade: '',
      // Imagens defaults
      imagem_principal: '',
      redimensionar_imagem: 'nao',
      qualidade_imagem: '80',
      gerar_thumbnail: false,
    };
    
    // Ensure composicao has the correct type
    if (produto.composicao) {
      return {
        ...produto,
        composicao: produto.composicao.map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          codigo_gtin: item.codigo_gtin || '',
          descricao: item.descricao || '',
          quantidade: item.quantidade || '0',
          unidade: item.unidade || 'UN',
          custo: item.custo || '0.00',
          observacao: item.observacao
        }))
      };
    }
    
    return produto;
  });
  
  const [loading, setLoading] = useState(false)
  const [gtinCheckBusy, setGtinCheckBusy] = useState(false)
  const [confirmExists, setConfirmExists] = useState<{ open: boolean; codigo_interno?: string; descricao?: string }>({ open: false })
  const [parentCodigoInterno, setParentCodigoInterno] = useState<string>(produto?.codigo_interno || '')
  // Removido debounce onChange para GTIN; validação será apenas no onBlur
  const [gtinDebounce, setGtinDebounce] = useState<NodeJS.Timeout | null>(null)
  const [showCreateParentModal, setShowCreateParentModal] = useState<{ open: boolean; text: string }>({ open: false, text: '' })
  const [expandedSections, setExpandedSections] = useState<SectionState>({
    // Informações Básicas com subseções
    informacoesBasicas: true,
    identificacaoProduto: true,
    categorizacao: false,
    precosCustos: false,
    tributacaoBasica: false,
    controlesConfiguracoes: false,
    
    // Composição
    composicao: false,
    
    // Outros
    outros: false,
    classificacaoCliente: false,
    outrosControles: false,
    estoquesDimensoes: false,
    
    // IPI/PIS/COFINS
    ipiPisCofins: false,
    
    // Grade
    grade: false,
    
    // Imagens
    imagens: false
  })

  // Modal de Categorias E-commerce
  const [showEcomCats, setShowEcomCats] = useState(false)
  const [ecomSource, setEcomSource] = useState<'nuvemshop'|'mercadolivre'|null>(null)
  const [nsCatTree, setNsCatTree] = useState<any[]>([])
  const [nsLoading, setNsLoading] = useState(false)
  const [nsError, setNsError] = useState<string|null>(null)
  const [nsSelectedPath, setNsSelectedPath] = useState<number[]>([]) // armazena ids do caminho

  // Hooks para fornecedores e categorias - TEMPORARIAMENTE COMENTADO
  // const { fornecedores, loading: loadingFornecedores, criarFornecedor } = useFornecedores()
  // const { buscarCategorias, loading: loadingCategorias } = useCategorias()

  useEffect(() => {
    if (produto) {
      // Converter codfor para fornecedor_id para compatibilidade do form
      const formDataFromProduto = { ...produto }
      if (produto.codfor) {
        formDataFromProduto.fornecedor_id = produto.codfor.toString()
      }
      
      setFormData(formDataFromProduto)
      setParentCodigoInterno(produto.codigo_interno || '')
    } else {
      setFormData({
        // Identificação
        codigo_interno: '',
        codigo_gtin: '',
        descricao: '',
        status: 'Ativo',
        
        // Fornecedor
        fornecedor_id: '',
        fornecedor_nome: '',
        
        // Preços e custos
        preco_venda: '0',
        preco_compra: '0',
        perc_lucro: '0',
        preco_gelado: '0',
        
        // Estoque
        qtde: '0',
        qtde_min: '0',
        
        // Dimensões e pesos
        peso_bruto: '0',
        peso_liquido: '0',
        comprimento: '0',
        largura: '0',
        altura: '0',
        peso: '0',
        
        // Tributação básica
        aliquota_icms: 0,
        aliquota_ipi: 0,
        aliquota_pis: '0',
        aliquota_cofins: 0,
        situacao_tributaria: 0,
        origem: 0,
        
        // Valores padrão para arrays
        estados_tributarios: [],
        grade: [],
        imagens: [],
        composicao: []
      })
      setParentCodigoInterno('')
    }
  }, [produto])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    // Handle different input types
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      // For number inputs, convert to number but keep as string for compatibility
      setFormData(prev => ({ 
        ...prev, 
        [name]: value === '' ? '0' : value 
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
      // Intencionalmente não valida GTIN durante a digitação; apenas no onBlur
      if (name === 'codigo_gtin' && gtinDebounce) clearTimeout(gtinDebounce)
    }
  }

  // Checar GTIN existente quando usuário sair do campo
  const handleGtinBlur = async () => {
    const gtin = (formData.codigo_gtin || '').trim()
    if (!gtin) return
    // Se está no modo edição (produto existe), não precisamos bloquear, só quando for novo
    if (!!produto?.codigo_interno) return
    try {
      setGtinCheckBusy(true)
      const r = await fetch(`/api/produtos/buscar-por-gtin?gtin=${encodeURIComponent(gtin)}`)
      if (r.ok) {
        const data = await r.json()
        if (data?.success && data?.data?.codigo_interno) {
          setConfirmExists({ open: true, codigo_interno: String(data.data.codigo_interno), descricao: data.data.descricao })
        }
      }
    } catch (e) {
      console.warn('Falha ao checar GTIN:', e)
    } finally {
      setGtinCheckBusy(false)
    }
  }

  // Handle changes in composition items
  const handleComponentChange = (index: number, field: keyof ComposicaoItem, value: string) => {
    setFormData(prev => {
      // Get the current composicao array or initialize as empty array
      const currentComposicao = Array.isArray(prev.composicao) 
        ? [...prev.composicao] 
        : [];
      
      // Create or update the component at the specified index
      const updatedComposicao = [...currentComposicao];
      const currentItem = updatedComposicao[index] || {
        id: Date.now().toString(),
        produto_id: '',
        codigo_gtin: '',
        descricao: '',
        quantidade: '0',
        unidade: 'UN',
        custo: '0.00',
        observacao: ''
      };
      
      // Update the specific field
      updatedComposicao[index] = {
        ...currentItem,
        [field]: value
      };
      
      // Return the updated form data
      return {
        ...prev,
        composicao: updatedComposicao
      };
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Converter fornecedor_id para codfor para compatibilidade com a API
      const apiData: any = { ...formData }
      if (formData.fornecedor_id) {
        apiData.codfor = parseInt(formData.fornecedor_id)
        // Remover fornecedor_id do payload da API
        delete apiData.fornecedor_id
      }
      // Mapeamentos de nomenclatura para alinhamento com produtos_tb
      if (apiData.perc_credito_icms !== undefined) apiData.aliquota_calculo_credito = apiData.perc_credito_icms
      if (apiData.modalidade_bc_icms !== undefined) apiData.modalidade_deter_bc_icms = apiData.modalidade_bc_icms
      if (apiData.reducao_bc_icms !== undefined) apiData.icms_reducao_bc = apiData.reducao_bc_icms
      if (apiData.perc_fcp !== undefined) apiData.aliquota_fcp = apiData.perc_fcp
      if (apiData.perc_fcp_st !== undefined) apiData.aliquota_fcp_st = apiData.perc_fcp_st
      if (apiData.perc_diferimento !== undefined) apiData.perc_dif = apiData.perc_diferimento
      
      await onSave(apiData)
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setLoading(false)
    }
  }

  // Garante criação do produto pai para permitir operações de grade no modo "novo"
  const ensureParent = async (): Promise<string | null> => {
    const already = (parentCodigoInterno || '').toString().trim()
    if (already) return already
    try {
      // Mostrar modal de criação do pai
      setShowCreateParentModal({ open: true, text: 'Criando produto pai atual, para prosseguir com a grade.' })
      setLoading(true)
      // Converter fornecedor_id para codfor
      const apiData: any = { ...formData }
      if (formData.fornecedor_id) {
        apiData.codfor = parseInt(formData.fornecedor_id)
        delete apiData.fornecedor_id
      }
      // Mapear aliases tributários para a API
      if (apiData.perc_credito_icms !== undefined) apiData.aliquota_calculo_credito = apiData.perc_credito_icms
      if (apiData.modalidade_bc_icms !== undefined) apiData.modalidade_deter_bc_icms = apiData.modalidade_bc_icms
      if (apiData.reducao_bc_icms !== undefined) apiData.icms_reducao_bc = apiData.reducao_bc_icms
      if (apiData.perc_fcp !== undefined) apiData.aliquota_fcp = apiData.perc_fcp
      if (apiData.perc_fcp_st !== undefined) apiData.aliquota_fcp_st = apiData.perc_fcp_st
      if (apiData.perc_diferimento !== undefined) apiData.perc_dif = apiData.perc_diferimento

      // Evitar erro de GTIN já existente: verificar antes e redirecionar
      const gtin = String(apiData.codigo_gtin || '').trim()
      if (gtin) {
        try {
          const r = await fetch(`/api/produtos/buscar-por-gtin?gtin=${encodeURIComponent(gtin)}`)
          if (r.ok) {
            const data = await r.json()
            if (data?.success && data?.data?.codigo_interno) {
              const codExistente = String(data.data.codigo_interno)
              setParentCodigoInterno(codExistente)
              router.push(`/cadastros/produtos/${codExistente}/editar`)
              return null
            }
          }
        } catch {}
      }

      // Chamar a API de criação diretamente aqui
      const resp = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      })
      const data = await resp.json().catch(()=>null)
      if (!resp.ok) {
        // Se duplicado, redireciona para editar
        if (resp.status === 409 && data?.codigo_interno) {
          const cod = String(data.codigo_interno)
          setParentCodigoInterno(cod)
          router.push(`/cadastros/produtos/${cod}/editar`)
          return null
        }
        throw new Error(data?.error || 'Falha ao criar produto antes de vincular grade')
      }
      const novoCodigo = String(data?.data?.codigo_interno || '')
      if (!novoCodigo) throw new Error('Código interno não retornado')
      setParentCodigoInterno(novoCodigo)
      // Redireciona para edição para continuar a grade
      router.push(`/cadastros/produtos/${novoCodigo}/editar`)
      return null
    } catch (e) {
      console.error('ensureParent falhou:', e)
      return null
    } finally {
      setLoading(false)
      setShowCreateParentModal({ open: false, text: '' })
    }
  }

  const renderSection = (title: string, sectionKey: string, children: React.ReactNode) => {
    const isExpanded = expandedSections[sectionKey]
    
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-xl"
        >
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {isExpanded && (
          <div className="px-6 pb-6 border-t border-gray-100">
            {children}
          </div>
        )}
      </div>
    )
  }

  // Função para renderizar subseção
  const renderSubsection = (title: string, children: React.ReactNode, isFirst = false) => (
    <div className={`${!isFirst ? 'mt-6' : ''}`}>
      <h4 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  )

  function NsNode({ node, path }: { node: any, path: number[] }) {
    const hasChildren = (node.children?.length || 0) > 0
    const label = node.name?.pt || `#${node.id}`
    const currentPath = [...path, node.id]
    const selected = JSON.stringify(currentPath) === JSON.stringify(nsSelectedPath)
    return (
      <div className="ml-2">
        <label className="flex items-center gap-2 py-1">
          <input
            type="radio"
            name="ns-cat-path"
            checked={selected}
            onChange={() => setNsSelectedPath(currentPath)}
          />
          <span className="text-sm text-gray-800">{label}</span>
          <span className="text-[11px] text-gray-500">#{node.id}</span>
        </label>
        {hasChildren && (
          <div className="ml-5 border-l pl-3 border-gray-200">
            {node.children.map((child: any) => (
              <NsNode key={child.id} node={child} path={currentPath} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. INFORMAÇÕES BÁSICAS */}
      {renderSection('📋 INFORMAÇÕES BÁSICAS', 'informacoesBasicas', (
        <div className="space-y-8">
          
          {/* IDENTIFICAÇÃO DO PRODUTO */}
          {renderSubsection('🏷️ Identificação do Produto', (
            <>
              <div className="col-span-1">
                <label htmlFor="codigo_gtin" className="block text-sm font-medium text-gray-700 mb-1">
                  Código GTIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="codigo_gtin"
                  name="codigo_gtin"
                  value={formData.codigo_gtin || ''}
                  onChange={handleInputChange}
                  onBlur={handleGtinBlur}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Ex: 7891234567890"
                />
                {gtinCheckBusy && (
                  <div className="text-xs text-gray-500 mt-1">Verificando GTIN...</div>
                )}
              </div>
              
              <div className="col-span-2">
                <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="descricao"
                  name="descricao"
                  value={formData.descricao || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Nome do produto"
                />
              </div>
              
              <div className="col-span-3">
                <label htmlFor="descricao_detalhada" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição Detalhada
                </label>
                <textarea
                  id="descricao_detalhada"
                  name="descricao_detalhada"
                  value={formData.descricao_detalhada || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Descrição completa do produto..."
                />
              </div>
            </>
          ), true)}

          {/* CATEGORIZAÇÃO */}
          {renderSubsection('📂 Categorização', (
            <>
              <div>
                <label htmlFor="grupo" className="block text-sm font-medium text-gray-700 mb-1">
                  Grupo
                </label>
                <GrupoSelect
                  value={formData.grupo || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, grupo: value }))}
                />
              </div>
              
              <div>
                <CategoriaSelect
                  value={formData.categoria || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                />
              </div>
              
              <div>
                <label htmlFor="subgrupo" className="block text-sm font-medium text-gray-700 mb-1">
                  Subgrupo
                </label>
                <SubgrupoSelect
                  value={formData.subgrupo || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, subgrupo: value }))}
                />
              </div>

              {/* Botão Categorias e-commerce */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <button type="button" className="btn-secondary" onClick={()=>{ setShowEcomCats(true); setEcomSource(null); }}>
                  Categorias e-commerce
                </button>
                <div className="text-[11px] text-gray-500 mt-1">Preencha com base nas categorias atuais da Nuvemshop (somente leitura). Não altera categorias na Nuvemshop.</div>
              </div>
              
              <div>
                <label htmlFor="unidade" className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <select
                    id="unidade"
                    name="unidade"
                    value={formData.unidade || ''}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Selecione uma unidade</option>
                    <option value="UN">Unidade</option>
                    <option value="KG">Quilograma</option>
                    <option value="LT">Litro</option>
                    <option value="MT">Metro</option>
                    <option value="CX">Caixa</option>
                    <option value="PC">Peça</option>
                  </select>
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    title="Adicionar nova unidade"
                  >
                    ➕
                  </button>
                </div>
              </div>
              
              <div>
                <label htmlFor="fornecedor_nome" className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor
                </label>
                <FornecedorSelect
                  value={formData.fornecedor_id || ''}
                  onChange={(codigo, nome) => {
                    if (codigo && nome) {
                      setFormData(prev => ({ 
                        ...prev, 
                        fornecedor_id: codigo.toString(),
                        fornecedor_nome: nome
                      }))
                    } else {
                      setFormData(prev => ({ 
                        ...prev, 
                        fornecedor_id: '',
                        fornecedor_nome: ''
                      }))
                    }
                  }}
                />
              </div>
            </>
          ))}

          {/* PREÇOS E CUSTOS */}
          {renderSubsection('💰 Preços e Custos', (
            <>
              <div>
                <label htmlFor="preco_venda" className="block text-sm font-medium text-gray-700 mb-1">
                  Preço de Venda <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">R$</span>
                  </div>
                  <input
                    type="text"
                    id="preco_venda"
                    name="preco_venda"
                    value={formData.preco_venda || ''}
                    onChange={handleInputChange}
                    required
                    className="pl-10 mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="preco_compra" className="block text-sm font-medium text-gray-700 mb-1">
                  Preço de Compra <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">R$</span>
                  </div>
                  <input
                    type="text"
                    id="preco_compra"
                    name="preco_compra"
                    value={formData.preco_compra || ''}
                    onChange={handleInputChange}
                    required
                    className="pl-10 mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="perc_lucro" className="block text-sm font-medium text-gray-700 mb-1">
                  % Lucro
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="perc_lucro"
                    name="perc_lucro"
                    value={formData.perc_lucro || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
            </>
          ))}

          {/* TRIBUTAÇÃO BÁSICA */}
          {renderSubsection('📊 Tributação Básica', (
            <>
              <div>
                <label htmlFor="ncm" className="block text-sm font-medium text-gray-700 mb-1">
                  NCM
                </label>
                <input
                  type="text"
                  id="ncm"
                  name="ncm"
                  value={formData.ncm || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="12345678"
                />
              </div>
              
              <div>
                <label htmlFor="cfop" className="block text-sm font-medium text-gray-700 mb-1">
                  CFOP
                </label>
                <input
                  type="text"
                  id="cfop"
                  name="cfop"
                  value={formData.cfop || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="1234"
                />
              </div>
              
              <div>
                <label htmlFor="cest" className="block text-sm font-medium text-gray-700 mb-1">
                  CEST
                </label>
                <input
                  type="text"
                  id="cest"
                  name="cest"
                  value={formData.cest || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="1234567"
                />
              </div>
              
              <div>
                <label htmlFor="situacao_tributaria" className="block text-sm font-medium text-gray-700 mb-1">
                  Situação Tributária
                </label>
                <select
                  id="situacao_tributaria"
                  name="situacao_tributaria"
                  value={formData.situacao_tributaria || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="0">00 - Tributada integralmente</option>
                  <option value="10">10 - Tributada e com cobrança do ICMS por substituição tributária</option>
                  <option value="20">20 - Com redução de base de cálculo</option>
                  <option value="30">30 - Isenta ou não tributada e com cobrança do ICMS por substituição tributária</option>
                  <option value="40">40 - Isenta</option>
                  <option value="41">41 - Não tributada</option>
                  <option value="50">50 - Suspensão</option>
                  <option value="51">51 - Diferimento</option>
                  <option value="60">60 - ICMS cobrado anteriormente por substituição tributária</option>
                  <option value="70">70 - Com redução de base de cálculo e cobrança do ICMS por substituição tributária</option>
                  <option value="90">90 - Outras</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="aliquota_icms" className="block text-sm font-medium text-gray-700 mb-1">
                  % ICMS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="aliquota_icms"
                    name="aliquota_icms"
                    value={formData.aliquota_icms || ''}
                    onChange={handleInputChange}
                    step="0.01"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
            </>
          ))}

          {/* CONTROLES E CONFIGURAÇÕES */}
          {renderSubsection('⚙️ Controles e Configurações', (
            <>
              <div className="col-span-3 grid grid-cols-3 gap-4">
                <div className="flex items-center">
                  <input
                    id="produto_balanca"
                    name="produto_balanca"
                    type="checkbox"
                    checked={formData.produto_balanca || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="produto_balanca" className="ml-2 block text-sm text-gray-900">
                    Produto Balança
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="vender_ecommerce"
                    name="vender_ecommerce"
                    type="checkbox"
                    checked={formData.vender_ecommerce || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="vender_ecommerce" className="ml-2 block text-sm text-gray-900">
                    Vender no E-commerce
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="produto_producao"
                    name="produto_producao"
                    type="checkbox"
                    checked={formData.produto_producao || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="produto_producao" className="ml-2 block text-sm text-gray-900">
                    Produto de Produção
                  </label>
                </div>
              </div>
              
              <div>
                <label htmlFor="validade" className="block text-sm font-medium text-gray-700 mb-1">
                  Validade
                </label>
                <input
                  type="text"
                  id="validade"
                  name="validade"
                  value={formData.validade || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="dias"
                />
              </div>
              
              <div>
                <label htmlFor="data_cadastro" className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Cadastro
                </label>
                <input
                  type="date"
                  id="data_cadastro"
                  name="data_cadastro"
                  value={formData.data_cadastro || ''}
                  onChange={handleInputChange}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm bg-gray-100 text-gray-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="data_alteracao" className="block text-sm font-medium text-gray-700 mb-1">
                  Data da Última Alteração
                </label>
                <input
                  type="date"
                  id="data_alteracao"
                  name="data_alteracao"
                  value={formData.data_alteracao || ''}
                  onChange={handleInputChange}
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm bg-gray-100 text-gray-500 sm:text-sm"
                />
              </div>
            </>
          ))}
        </div>
      ))}

      {/* 2. COMPOSIÇÃO */}
      {renderSection('🧪 COMPOSIÇÃO', 'composicao', (
        <div className="space-y-6">
          {/* Formulário para adicionar componentes */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-4">Adicionar Componente</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código GTIN
                </label>
                <input
                  type="text"
                  id="comp_codigo_gtin"
                  placeholder="Código do componente"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  onBlur={async (e) => {
                    const gtin = e.target.value.trim();
                    if (gtin) {
                      try {
                        const response = await fetch(`/api/produtos/buscar-gtin?gtin=${encodeURIComponent(gtin)}`);
                        if (response.ok) {
                          const result = await response.json();
                          if (result.success) {
                            const produto = result.data;
                            const descricaoInput = document.getElementById('comp_descricao') as HTMLInputElement;
                            if (descricaoInput) {
                              descricaoInput.value = produto.descricao || '';
                            }
                            console.log('✅ Produto encontrado automaticamente:', produto.descricao);
                          }
                        } else {
                          console.log('⚠️ Produto não encontrado com GTIN:', gtin);
                        }
                      } catch (error) {
                        console.error('❌ Erro ao buscar produto por GTIN:', error);
                      }
                    }
                  }}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  id="comp_descricao"
                  placeholder="Nome do componente"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade
                </label>
                <input
                  type="text"
                  id="comp_quantidade"
                  placeholder="0,00"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const codigoGtin = (document.getElementById('comp_codigo_gtin') as HTMLInputElement)?.value || '';
                  const descricao = (document.getElementById('comp_descricao') as HTMLInputElement)?.value || '';
                  const quantidade = (document.getElementById('comp_quantidade') as HTMLInputElement)?.value || '0';
                  
                  if (codigoGtin && descricao) {
                    const newComponent: ComposicaoItem = {
                      id: Date.now().toString(),
                      produto_id: codigoGtin,
                      codigo_gtin: codigoGtin,
                      descricao: descricao,
                      quantidade: quantidade,
                      unidade: 'UN',
                      custo: '0.00',
                      observacao: ''
                    };
                    
                    setFormData(prev => ({
                      ...prev,
                      composicao: [...(prev.composicao || []), newComponent]
                    }));
                    
                    // Limpar campos
                    (document.getElementById('comp_codigo_gtin') as HTMLInputElement).value = '';
                    (document.getElementById('comp_descricao') as HTMLInputElement).value = '';
                    (document.getElementById('comp_quantidade') as HTMLInputElement).value = '';
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                ➕ Adicionar
              </button>
            </div>
          </div>

          {/* Tabela de componentes */}
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.composicao?.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.codigo_gtin}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.descricao}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="text"
                        value={item.quantidade}
                        onChange={(e) => handleComponentChange(index, 'quantidade', e.target.value)}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        title="Quantidade do componente"
                        placeholder="0"
                        aria-label="Quantidade"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            composicao: (prev.composicao || []).filter((_, i) => i !== index)
                          }));
                        }}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {(!formData.composicao || formData.composicao.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center">
                        <div className="text-3xl mb-2">📦</div>
                        <p>Nenhum componente adicionado</p>
                        <p className="text-xs text-gray-400 mt-1">Use o formulário acima para adicionar componentes</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 3. OUTROS */}
      {renderSection('🔧 OUTROS', 'outros', (
        <div className="space-y-8">
          
          {/* CLASSIFICAÇÃO CLIENTE */}
          {renderSubsection('👥 Classificação Cliente', (
            <>
              <div className="col-span-3">
                <h5 className="text-sm font-medium text-gray-900 mb-4">Desconto por Percentual</h5>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">A %</label>
                    <input
                      type="text"
                      name="perc_desc_a"
                      value={formData.perc_desc_a || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">B %</label>
                    <input
                      type="text"
                      name="perc_desc_b"
                      value={formData.perc_desc_b || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">C %</label>
                    <input
                      type="text"
                      name="perc_desc_c"
                      value={formData.perc_desc_c || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">D %</label>
                    <input
                      type="text"
                      name="perc_desc_d"
                      value={formData.perc_desc_d || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">E %</label>
                    <input
                      type="text"
                      name="perc_desc_e"
                      value={formData.perc_desc_e || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="col-span-3">
                <h5 className="text-sm font-medium text-gray-900 mb-4">Desconto por Valor (R$)</h5>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">R$ A</label>
                    <input
                      type="text"
                      name="val_desc_a"
                      value={formData.val_desc_a || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">R$ B</label>
                    <input
                      type="text"
                      name="val_desc_b"
                      value={formData.val_desc_b || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">R$ C</label>
                    <input
                      type="text"
                      name="val_desc_c"
                      value={formData.val_desc_c || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">R$ D</label>
                    <input
                      type="text"
                      name="val_desc_d"
                      value={formData.val_desc_d || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">R$ E</label>
                    <input
                      type="text"
                      name="val_desc_e"
                      value={formData.val_desc_e || '0'}
                      onChange={handleInputChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
              
              <div className="col-span-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  ⚙️ Reclassificar Percentual
                </button>
              </div>
            </>
          ), true)}

          {/* CONTROLES ADICIONAIS */}
          {renderSubsection('⚙️ Controles Adicionais', (
            <>
              <div>
                <label htmlFor="perc_credito_icms" className="block text-sm font-medium text-gray-700 mb-1">
                  % Cálculo de Crédito
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="perc_credito_icms"
                    name="perc_credito_icms"
                    value={formData.perc_credito_icms || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="perc_diferimento" className="block text-sm font-medium text-gray-700 mb-1">
                  % Diferimento
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="perc_diferimento"
                    name="perc_diferimento"
                    value={formData.perc_diferimento || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="modalidade_bc_icms" className="block text-sm font-medium text-gray-700 mb-1">
                  Modalidade BC ICMS
                </label>
                <select
                  id="modalidade_bc_icms"
                  name="modalidade_bc_icms"
                  value={formData.modalidade_bc_icms || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="0">0 - Margem Valor Agregado (%)</option>
                  <option value="1">1 - Pauta (Valor)</option>
                  <option value="2">2 - Preço Tabelado Máx. (valor)</option>
                  <option value="3">3 - Valor da operação</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="mod_deter_bc_icms_st" className="block text-sm font-medium text-gray-700 mb-1">
                  Modalidade BC ICMS ST
                </label>
                <select
                  id="mod_deter_bc_icms_st"
                  name="mod_deter_bc_icms_st"
                  value={formData.mod_deter_bc_icms_st || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="Preco tabelado ou max sugerido">Preco tabelado ou max sugerido</option>
                  <option value="Lista negativa">Lista negativa</option>
                  <option value="Lista positiva">Lista positiva</option>
                  <option value="Lista neutra">Lista neutra</option>
                  <option value="Margem valor agregado">Margem valor agregado</option>
                  <option value="Pauta">Pauta</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="reducao_bc_icms" className="block text-sm font-medium text-gray-700 mb-1">
                  Redução BC ICMS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="reducao_bc_icms"
                    name="reducao_bc_icms"
                    value={formData.reducao_bc_icms || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="perc_fcp" className="block text-sm font-medium text-gray-700 mb-1">
                  % FCP
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="perc_fcp"
                    name="perc_fcp"
                    value={formData.perc_fcp || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="perc_fcp_st" className="block text-sm font-medium text-gray-700 mb-1">
                  %FCP ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="perc_fcp_st"
                    name="perc_fcp_st"
                    value={formData.perc_fcp_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="tamanho" className="block text-sm font-medium text-gray-700 mb-1">
                  Tamanho
                </label>
                <input
                  type="text"
                  id="tamanho"
                  name="tamanho"
                  value={formData.tamanho || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="P, M, G, etc."
                />
              </div>
              
              <div>
                <label htmlFor="preco_gelado" className="block text-sm font-medium text-gray-700 mb-1">
                  Preço Gelado
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">R$</span>
                  </div>
                  <input
                    type="text"
                    id="preco_gelado"
                    name="preco_gelado"
                    value={formData.preco_gelado || '0'}
                    onChange={handleInputChange}
                    className="pl-10 mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="descricao_etiqueta" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição Etiqueta
                </label>
                <input
                  type="text"
                  id="descricao_etiqueta"
                  name="descricao_etiqueta"
                  value={formData.descricao_etiqueta || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Descrição para etiqueta"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="inativo"
                  name="inativo"
                  type="checkbox"
                  checked={formData.inativo || false}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="inativo" className="ml-2 block text-sm text-gray-900">
                  Produto Inativo
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="descricao_personalizada"
                  name="descricao_personalizada"
                  type="checkbox"
                  checked={Boolean(formData.descricao_personalizada)}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="descricao_personalizada" className="ml-2 block text-sm text-gray-900">
                  Descrição personalizada
                </label>
              </div>
            </>
          ))}

          {/* ESTOQUE E DIMENSÕES */}
          {renderSubsection('📦 Estoque e Dimensões', (
            <>
              <div>
                <label htmlFor="qtde" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade
                </label>
                <input
                  type="text"
                  id="qtde"
                  name="qtde"
                  value={formData.qtde || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="qtde_min" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade Mínima
                </label>
                <input
                  type="text"
                  id="qtde_min"
                  name="qtde_min"
                  value={formData.qtde_min || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="comprimento" className="block text-sm font-medium text-gray-700 mb-1">
                  Comprimento (cm)
                </label>
                <input
                  type="text"
                  id="comprimento"
                  name="comprimento"
                  value={formData.comprimento || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="largura" className="block text-sm font-medium text-gray-700 mb-1">
                  Largura (cm)
                </label>
                <input
                  type="text"
                  id="largura"
                  name="largura"
                  value={formData.largura || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="altura" className="block text-sm font-medium text-gray-700 mb-1">
                  Altura (cm)
                </label>
                <input
                  type="text"
                  id="altura"
                  name="altura"
                  value={formData.altura || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label htmlFor="peso" className="block text-sm font-medium text-gray-700 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="text"
                  id="peso"
                  name="peso"
                  value={formData.peso || '0'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="0,000"
                />
              </div>
            </>
          ))}
        </div>
      ))}

      {/* 4. IPI/PIS/COFINS */}
      {renderSection('🧾 IPI/PIS/COFINS', 'ipiPisCofins', (
        <div className="space-y-8">
          
          {/* IPI */}
          {renderSubsection('📊 IPI', (
            <>
              <div>
                <label htmlFor="ipi_reducao_bc" className="block text-sm font-medium text-gray-700 mb-1">
                  % Redução BC IPI
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="ipi_reducao_bc"
                    name="ipi_reducao_bc"
                    value={formData.ipi_reducao_bc || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_ipi" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota IPI
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="aliquota_ipi"
                    name="aliquota_ipi"
                    value={formData.aliquota_ipi || '0'}
                    onChange={handleInputChange}
                    step="0.01"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="ipi_reducao_bc_st" className="block text-sm font-medium text-gray-700 mb-1">
                  % Red BC IPI ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="ipi_reducao_bc_st"
                    name="ipi_reducao_bc_st"
                    value={formData.ipi_reducao_bc_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_ipi_st" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota IPI ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="aliquota_ipi_st"
                    name="aliquota_ipi_st"
                    value={formData.aliquota_ipi_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="cst_ipi" className="block text-sm font-medium text-gray-700 mb-1">
                  CST IPI
                </label>
                <select
                  id="cst_ipi"
                  name="cst_ipi"
                  value={formData.cst_ipi || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="0">00-Entrada com Recuperação de Crédito</option>
                  <option value="1">01-Entrada Tributável com Alíquota Zero</option>
                  <option value="2">02-Entrada Isenta</option>
                  <option value="3">03-Entrada Não-Tributada</option>
                  <option value="4">04-Entrada Imune</option>
                  <option value="5">05-Entrada com Suspensão</option>
                  <option value="49">49-Outras Entradas</option>
                  <option value="50">50-Saída Tributada</option>
                  <option value="51">51-Saída Tributável com Alíquota Zero</option>
                  <option value="52">52-Saída Isenta</option>
                  <option value="53">53-Saída Não-Tributada</option>
                  <option value="54">54-Saída Imune</option>
                  <option value="55">55-Saída com Suspensão</option>
                  <option value="99">99-Outras Saídas</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="calculo_ipi" className="block text-sm font-medium text-gray-700 mb-1">
                  Calcular por
                </label>
                <select
                  id="calculo_ipi"
                  name="calculo_ipi"
                  value={formData.calculo_ipi || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="Aliquota">Alíquota</option>
                  <option value="Valor Unid.">Valor Unid.</option>
                </select>
              </div>
            </>
          ), true)}

          {/* PIS */}
          {renderSubsection('📈 PIS', (
            <>
              <div>
                <label htmlFor="pis_reducao_bc" className="block text-sm font-medium text-gray-700 mb-1">
                  % Redução BC PIS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="pis_reducao_bc"
                    name="pis_reducao_bc"
                    value={formData.pis_reducao_bc || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_pis" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota PIS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="aliquota_pis"
                    name="aliquota_pis"
                    value={formData.aliquota_pis || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="pis_reducao_bc_st" className="block text-sm font-medium text-gray-700 mb-1">
                  % Red BC PIS ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="pis_reducao_bc_st"
                    name="pis_reducao_bc_st"
                    value={formData.pis_reducao_bc_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_pis_st" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota PIS ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="aliquota_pis_st"
                    name="aliquota_pis_st"
                    value={formData.aliquota_pis_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="cst_pis" className="block text-sm font-medium text-gray-700 mb-1">
                  CST PIS
                </label>
                <select
                  id="cst_pis"
                  name="cst_pis"
                  value={formData.cst_pis || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="1">01-Operação Tributável com Alíquota Básica</option>
                  <option value="2">02-Operação Tributável com Alíquota Diferenciada</option>
                  <option value="3">03-Operação Tributável com Alíquota por Unidade de Medida de Produto</option>
                  <option value="4">04-Operação Tributável Monofásica - Revenda de Alíquota Zero</option>
                  <option value="5">05-Operação Tributável por Substituição Tributária</option>
                  <option value="6">06-Operação Tributável a Alíquota Zero</option>
                  <option value="7">07-Operação Isenta da Contribuição</option>
                  <option value="8">08-Operação sem incidência da Contribuição</option>
                  <option value="9">09-Operação com Suspensão da Contribuição</option>
                  <option value="49">49-Outras Operações de Saída</option>
                  <option value="50">50-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno</option>
                  <option value="51">51-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Não Tributada no Mercado Interno</option>
                  <option value="52">52-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação</option>
                  <option value="53">53-Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="54">54-Operação com Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação</option>
                  <option value="55">55-Operação com Direito a Crédito - Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="56">56-Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="60">60-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno</option>
                  <option value="61">61-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno</option>
                  <option value="62">62-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita de Exportação</option>
                  <option value="63">63-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="64">64-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação</option>
                  <option value="65">65-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="66">66-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="67">67-Crédito Presumido - Outras Operações</option>
                  <option value="70">70-Operação de Aquisição sem Direito a Crédito</option>
                  <option value="71">71-Operação de Aquisição com Isenção</option>
                  <option value="72">72-Operação de Aquisição com Suspensão</option>
                  <option value="73">73-Operação de Aquisição com Alíquota Zero</option>
                  <option value="74">74-Operação de Aquisição sem Incidência da Contribuição</option>
                  <option value="75">75-Operação de Aquisição por Substituição Tributária</option>
                  <option value="98">98-Outras Operações de Entrada</option>
                  <option value="99">99-Outras Operações</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="calculo_pis" className="block text-sm font-medium text-gray-700 mb-1">
                  Calcular por
                </label>
                <select
                  id="calculo_pis"
                  name="calculo_pis"
                  value={formData.calculo_pis || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="Aliquota">Alíquota</option>
                  <option value="Valor Unid.">Valor Unid.</option>
                </select>
              </div>
            </>
          ))}

          {/* COFINS */}
          {renderSubsection('📉 COFINS', (
            <>
              <div>
                <label htmlFor="cofins_reducao_bc" className="block text-sm font-medium text-gray-700 mb-1">
                  % Redução BC COFINS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="cofins_reducao_bc"
                    name="cofins_reducao_bc"
                    value={formData.cofins_reducao_bc || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_cofins" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota COFINS
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="aliquota_cofins"
                    name="aliquota_cofins"
                    value={formData.aliquota_cofins || '0'}
                    onChange={handleInputChange}
                    step="0.01"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="cofins_reducao_bc_st" className="block text-sm font-medium text-gray-700 mb-1">
                  % Red BC COFINS ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="cofins_reducao_bc_st"
                    name="cofins_reducao_bc_st"
                    value={formData.cofins_reducao_bc_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="aliquota_cofins_st" className="block text-sm font-medium text-gray-700 mb-1">
                  Alíquota COFINS ST
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="aliquota_cofins_st"
                    name="aliquota_cofins_st"
                    value={formData.aliquota_cofins_st || '0'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="0,00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="cst_cofins" className="block text-sm font-medium text-gray-700 mb-1">
                  CST COFINS
                </label>
                <select
                  id="cst_cofins"
                  name="cst_cofins"
                  value={formData.cst_cofins || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="1">01-Operação Tributável com Alíquota Básica</option>
                  <option value="2">02-Operação Tributável com Alíquota Diferenciada</option>
                  <option value="3">03-Operação Tributável com Alíquota por Unidade de Medida de Produto</option>
                  <option value="4">04-Operação Tributável Monofásica - Revenda de Alíquota Zero</option>
                  <option value="5">05-Operação Tributável por Substituição Tributária</option>
                  <option value="6">06-Operação Tributável a Alíquota Zero</option>
                  <option value="7">07-Operação Isenta da Contribuição</option>
                  <option value="8">08-Operação sem incidência da Contribuição</option>
                  <option value="9">09-Operação com Suspensão da Contribuição</option>
                  <option value="49">49-Outras Operações de Saída</option>
                  <option value="50">50-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Tributada no Mercado Interno</option>
                  <option value="51">51-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita Não Tributada no Mercado Interno</option>
                  <option value="52">52-Operação com Direito a Crédito - Vinculada Exclusivamente a Receita de Exportação</option>
                  <option value="53">53-Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="54">54-Operação com Direito a Crédito - Vinculada a Receitas Tributadas no Mercado Interno e de Exportação</option>
                  <option value="55">55-Operação com Direito a Crédito - Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="56">56-Operação com Direito a Crédito - Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="60">60-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Tributada no Mercado Interno</option>
                  <option value="61">61-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno</option>
                  <option value="62">62-Crédito Presumido - Operação de Aquisição Vinculada Exclusivamente a Receita de Exportação</option>
                  <option value="63">63-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="64">64-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas no Mercado Interno e de Exportação</option>
                  <option value="65">65-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Não-Tributadas no Mercado Interno e de Exportação</option>
                  <option value="66">66-Crédito Presumido - Operação de Aquisição Vinculada a Receitas Tributadas e Não-Tributadas no Mercado Interno</option>
                  <option value="67">67-Crédito Presumido - Outras Operações</option>
                  <option value="70">70-Operação de Aquisição sem Direito a Crédito</option>
                  <option value="71">71-Operação de Aquisição com Isenção</option>
                  <option value="72">72-Operação de Aquisição com Suspensão</option>
                  <option value="73">73-Operação de Aquisição com Alíquota Zero</option>
                  <option value="74">74-Operação de Aquisição sem Incidência da Contribuição</option>
                  <option value="75">75-Operação de Aquisição por Substituição Tributária</option>
                  <option value="98">98-Outras Operações de Entrada</option>
                  <option value="99">99-Outras Operações</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="calculo_cofins" className="block text-sm font-medium text-gray-700 mb-1">
                  Calcular por
                </label>
                <select
                  id="calculo_cofins"
                  name="calculo_cofins"
                  value={formData.calculo_cofins || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione</option>
                  <option value="Aliquota">Alíquota</option>
                  <option value="Valor Unid.">Valor Unid.</option>
                </select>
              </div>
            </>
          ))}
        </div>
      ))}

      {/* 5. GRADE */}
      {renderSection('📏 GRADE', 'grade', (
        <GradeManagerFixed codigoInterno={parentCodigoInterno || ''} ensureParent={ensureParent} />
      ))}

      {/* 6. IMAGENS */}
      {renderSection('🖼️ IMAGENS', 'imagens', (
        <div className="space-y-8">
          <ImageManager 
            codigoInterno={produto?.codigo_interno || ''} 
            forceSync={!!(produto?.vender_ecommerce)}
          />
        </div>
      ))}

      {/* Botões */}
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Salvando...' : produto ? 'Atualizar Produto' : 'Criar Produto'}
        </button>
      </div>
    </form>

    {/* Modal de criação do produto pai (loading) */}
    {showCreateParentModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <div className="flex items-center justify-center mb-3">
            <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-lg font-medium text-gray-900">{showCreateParentModal.text}</span>
          </div>
          <p className="text-sm text-gray-600">Você será redirecionado para a tela de edição em instantes...</p>
        </div>
      </div>
    )}

  {/* Modal Categorias E-commerce */}
    {showEcomCats && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="text-lg font-semibold text-gray-900">Categorias e-commerce</div>
            <button className="text-gray-500 hover:text-gray-700" onClick={()=>setShowEcomCats(false)}>Fechar</button>
          </div>
          {!ecomSource && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                className="card hover:shadow-md transition flex items-center gap-3 p-4"
                onClick={async()=>{
                  setEcomSource('nuvemshop');
                  setNsLoading(true); setNsError(null); setNsCatTree([]); setNsSelectedPath([]);
                  try {
                    const r = await fetch('/api/nuvemshop/categories');
                    const j = await r.json();
                    if (j.success) setNsCatTree(j.data?.tree || []);
                    else setNsError(j.error || 'Erro ao buscar categorias');
                  } catch (e:any) { setNsError(e?.message||'Erro ao buscar categorias'); }
                  finally { setNsLoading(false); }
                }}
              >
                <CloudIcon className="w-6 h-6 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Nuvemshop</div>
                  <div className="text-sm text-gray-600">Buscar categorias atuais</div>
                </div>
              </button>
              <button className="card opacity-60 cursor-not-allowed flex items-center gap-3 p-4" title="Em breve">
                <ShoppingBagIcon className="w-6 h-6 text-yellow-500" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Mercado Livre</div>
                  <div className="text-sm text-gray-600">Em breve</div>
                </div>
              </button>
            </div>
          )}
          {ecomSource === 'nuvemshop' && (
            <div className="p-6">
              {nsLoading && <div className="text-sm text-gray-500">Carregando categorias...</div>}
              {nsError && <div className="text-sm text-red-600">{nsError}</div>}
              {!nsLoading && !nsError && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border rounded-md p-3 max-h-96 overflow-auto">
                    {nsCatTree.length === 0 ? (
                      <div className="text-sm text-gray-500">Nenhuma categoria encontrada na Nuvemshop.</div>
                    ) : (
                      nsCatTree.map((n)=> <NsNode key={n.id} node={n} path={[]} />)
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Categoria</div>
                      <input
                        type="text"
                        className="input-field w-full"
                        aria-label="Categoria e-commerce"
                        placeholder="Categoria"
                        value={formData.categoria||''}
                        onChange={(e)=>setFormData(prev=>({...prev, categoria: e.target.value}))}
                      />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Grupo</div>
                      <input
                        type="text"
                        className="input-field w-full"
                        aria-label="Grupo e-commerce"
                        placeholder="Grupo"
                        value={formData.grupo||''}
                        onChange={(e)=>setFormData(prev=>({...prev, grupo: e.target.value}))}
                      />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Subgrupo</div>
                      <input
                        type="text"
                        className="input-field w-full"
                        aria-label="Subgrupo e-commerce"
                        placeholder="Subgrupo"
                        value={formData.subgrupo||''}
                        onChange={(e)=>setFormData(prev=>({...prev, subgrupo: e.target.value}))}
                      />
                    </div>
                    <div className="text-[11px] text-gray-500">Dica: marque a categoria folha para autopreencher toda a trilha ou desmarque o último nível para preencher apenas parte do caminho.</div>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          // Transformar nsSelectedPath (ids) em nomes usando a árvore
                          const idToName = new Map<number,string>();
                          const walk = (nodes: any[]) => {
                            for (const n of nodes) {
                              idToName.set(n.id, n.name?.pt || `#${n.id}`)
                              if (n.children?.length) walk(n.children)
                            }
                          }
                          walk(nsCatTree)
                          const names = nsSelectedPath.map(id => idToName.get(id) || '').filter(Boolean)
                          const [categoria, grupo, subgrupo] = names
                          setFormData(prev => ({ ...prev, categoria: categoria || '', grupo: grupo || '', subgrupo: subgrupo || '' }))
                          setShowEcomCats(false)
                        }}
                      >Aplicar</button>
                      <button type="button" className="btn-secondary" onClick={()=>setShowEcomCats(false)}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}

    {/* Modal simples para GTIN existente */}
    {confirmExists.open && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <h3 className="text-lg font-semibold mb-2">GTIN já cadastrado</h3>
          <p className="text-sm text-gray-700 mb-4">
            O código GTIN informado já existe para o produto:
            <br />
            <span className="font-medium">{confirmExists.descricao}</span>
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-gray-300"
              onClick={() => {
                // Limpa GTIN e fecha
                setFormData(prev => ({ ...prev, codigo_gtin: '' }))
                setConfirmExists({ open: false })
              }}
            >
              Digitar outro
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white"
              onClick={() => {
                if (confirmExists.codigo_interno) {
                  try { window.location.href = `/cadastros/produtos/${confirmExists.codigo_interno}/editar` } catch {}
                }
                setConfirmExists({ open: false })
              }}
            >
              Editar produto
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
