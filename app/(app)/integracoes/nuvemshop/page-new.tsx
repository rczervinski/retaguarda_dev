"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2, Plus, Store, Settings, Zap, ExternalLink } from 'lucide-react'

interface NuvemshopConfig {
  codigo: number
  descricao: string
  store_id: string
  url_checkout?: string
  ativo: number
  tem_token: string
}

interface StoreTestResult {
  success: boolean
  storeInfo?: {
    id: string
    name: string
    url: string
    domain: string
    email: string
  }
  error?: string
}

export default function NuvemshopIntegrationPage() {
  const [configs, setConfigs] = useState<NuvemshopConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [testingStores, setTestingStores] = useState<Set<number>>(new Set())
  const [storeResults, setStoreResults] = useState<Map<number, StoreTestResult>>(new Map())
  const [showTokenForm, setShowTokenForm] = useState(false)
  const [storeUrl, setStoreUrl] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    access_token: '',
    user_id: '',
    url_checkout: ''
  })

  // Carregar dados ao inicializar
  useEffect(() => {
    loadConfigurations()
  }, [])

  /**
   * Carrega as configurações existentes
   */
  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/nuvemshop/config/list')
      const data = await response.json()

      if (data.success) {
        setConfigs(data.configs)
      } else {
        console.error('Erro ao carregar configurações:', data.error)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  /**
   * Gera a URL de autorização da NuvemShop
   */
  const generateAuthUrl = () => {
    if (!storeUrl.trim()) {
      alert('Por favor, insira a URL da sua loja')
      return
    }
    
    const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const authUrl = `https://${cleanUrl}/admin/apps/17589/authorize`
    
    // Abre em nova aba
    window.open(authUrl, '_blank')
    
    // Mostra o formulário para inserir os dados
    setShowTokenForm(true)
  }

  /**
   * Testa uma configuração específica
   */
  const testStoreConnection = async (codigo: number) => {
    setTestingStores(prev => new Set(prev).add(codigo))
    
    try {
      const response = await fetch(`/api/nuvemshop/connection/test?codigo=${codigo}`)
      const data = await response.json()
      
      setStoreResults(prev => new Map(prev).set(codigo, {
        success: data.success,
        storeInfo: data.store_info,
        error: data.error
      }))
      
    } catch (error) {
      console.error('Erro ao testar conexão:', error)
      setStoreResults(prev => new Map(prev).set(codigo, {
        success: false,
        error: 'Erro de conexão'
      }))
    } finally {
      setTestingStores(prev => {
        const newSet = new Set(prev)
        newSet.delete(codigo)
        return newSet
      })
    }
  }

  /**
   * Salva o token manualmente
   */
  const saveToken = async () => {
    if (!formData.access_token || !formData.user_id) {
      alert('Access Token e User ID são obrigatórios')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/nuvemshop/auth/save-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        alert('Token salvo com sucesso!')
        setFormData({ access_token: '', user_id: '', url_checkout: '' })
        setShowTokenForm(false)
        await loadConfigurations()
      } else {
        alert(`Erro: ${data.error}`)
      }
    } catch (error) {
      console.error('Erro ao salvar token:', error)
      alert('Erro ao salvar token')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Testa a conexão manualmente
   */
  const testConnection = async () => {
    setLoading(true)
    // Testa todas as configurações ativas
    for (const config of configs.filter(c => c.ativo === 1)) {
      await testStoreConnection(config.codigo)
    }
    setLoading(false)
  }

  /**
   * Remove uma configuração
   */
  const deleteConfig = async (codigo: number) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) {
      return
    }

    try {
      const response = await fetch(`/api/nuvemshop/config/list?codigo=${codigo}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        alert('Configuração excluída com sucesso!')
        await loadConfigurations()
        // Remove dos resultados de teste
        setStoreResults(prev => {
          const newMap = new Map(prev)
          newMap.delete(codigo)
          return newMap
        })
      } else {
        alert(`Erro: ${data.error}`)
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir configuração')
    }
  }

  /**
   * Atualiza o status de uma configuração
   */
  const toggleConfigStatus = async (codigo: number, currentStatus: number) => {
    try {
      const response = await fetch('/api/nuvemshop/config/list', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codigo,
          status: currentStatus === 0 ? 1 : 0
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Status atualizado com sucesso!')
        await loadConfigurations()
      } else {
        alert(`Erro: ${data.error}`)
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status')
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Integração NuvemShop
        </h1>
        <p className="text-muted-foreground">
          Configure a integração com a plataforma NuvemShop para sincronizar produtos e pedidos.
        </p>
      </div>

      {/* Card de Autorização */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-blue-700">
            <Store className="w-6 h-6" />
            Autorizar Nova Loja
          </CardTitle>
          <CardDescription>
            Insira a URL da sua loja NuvemShop para iniciar o processo de autorização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="store_url" className="text-sm font-medium text-blue-700">
              URL da Loja NuvemShop
            </label>
            <div className="flex gap-2">
              <Input
                id="store_url"
                type="url"
                placeholder="Ex: minhaloja.mitiendanube.com"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                className="border-blue-300 focus:border-blue-500"
              />
              <Button 
                onClick={generateAuthUrl}
                disabled={!storeUrl.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Autorizar
              </Button>
            </div>
          </div>
          
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              Após clicar em "Autorizar", você será redirecionado para autorizar o app na NuvemShop. 
              Depois disso, o formulário aparecerá para você inserir o token e user ID obtidos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Cards das Lojas Configuradas */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Lojas Conectadas</h2>
        
        {configs.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">Nenhuma loja configurada</p>
              <p className="text-gray-500 text-sm">Configure sua primeira loja usando o formulário acima</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => {
              const testResult = storeResults.get(config.codigo)
              const isTesting = testingStores.has(config.codigo)
              
              return (
                <Card 
                  key={config.codigo} 
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    config.ativo === 1 
                      ? 'border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg' 
                      : 'border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
                    testResult?.success 
                      ? 'bg-green-500 animate-pulse' 
                      : testResult?.error 
                      ? 'bg-red-500' 
                      : config.ativo === 1 
                      ? 'bg-yellow-500' 
                      : 'bg-gray-400'
                  }`} title={
                    testResult?.success 
                      ? 'Conectado com sucesso' 
                      : testResult?.error 
                      ? `Erro: ${testResult.error}` 
                      : config.ativo === 1 
                      ? 'Ativo (não testado)' 
                      : 'Inativo'
                  } />
                  
                  <CardHeader className="pb-3">
                    <CardTitle className={`flex items-center gap-3 ${
                      config.ativo === 1 ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      <Store className="w-5 h-5" />
                      {config.descricao}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      ID da Loja: {config.store_id}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {testResult?.success && testResult.storeInfo && (
                      <div className="bg-white/50 rounded-lg p-3 space-y-2">
                        <h4 className="font-medium text-green-700 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {typeof testResult.storeInfo.name === 'string' ? testResult.storeInfo.name : 'Nome da loja'}
                        </h4>
                        <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                          <div>Domínio: {typeof testResult.storeInfo.domain === 'string' ? testResult.storeInfo.domain : 'N/A'}</div>
                          <div>Email: {typeof testResult.storeInfo.email === 'string' ? testResult.storeInfo.email : 'N/A'}</div>
                        </div>
                        <a 
                          href={testResult.storeInfo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Visitar loja
                        </a>
                      </div>
                    )}
                    
                    {testResult?.error && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-700 text-sm">
                          {typeof testResult.error === 'string' ? testResult.error : 'Erro na conexão'}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={config.tem_token === 'SIM' ? 'default' : 'secondary'} className="text-xs">
                        {config.tem_token === 'SIM' ? 'Token ✓' : 'Sem Token'}
                      </Badge>
                      <Badge variant={config.ativo === 1 ? 'default' : 'secondary'} className="text-xs">
                        {config.ativo === 1 ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => testStoreConnection(config.codigo)}
                        disabled={isTesting || config.tem_token !== 'SIM'}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                      >
                        {isTesting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        {isTesting ? 'Testando...' : 'Testar'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleConfigStatus(config.codigo, config.ativo)}
                        className="border-gray-300"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteConfig(config.codigo)}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Formulário de Token */}
      {showTokenForm && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-purple-700">
              <Settings className="w-6 h-6" />
              Inserir Dados da Autorização
            </CardTitle>
            <CardDescription>
              Insira os dados obtidos após autorizar o app na NuvemShop
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="access_token" className="text-sm font-medium text-purple-700">
                Access Token *
              </label>
              <Input
                id="access_token"
                type="password"
                placeholder="Digite o access token obtido da NuvemShop"
                value={formData.access_token}
                onChange={(e) => setFormData(prev => ({...prev, access_token: e.target.value}))}
                className="border-purple-300 focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="user_id" className="text-sm font-medium text-purple-700">
                User ID (Store ID) *
              </label>
              <Input
                id="user_id"
                type="text"
                placeholder="Digite o user ID da loja"
                value={formData.user_id}
                onChange={(e) => setFormData(prev => ({...prev, user_id: e.target.value}))}
                className="border-purple-300 focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="url_checkout" className="text-sm font-medium text-purple-700">
                URL Checkout (opcional)
              </label>
              <Input
                id="url_checkout"
                type="url"
                placeholder="URL de checkout personalizada (opcional)"
                value={formData.url_checkout}
                onChange={(e) => setFormData(prev => ({...prev, url_checkout: e.target.value}))}
                className="border-purple-300 focus:border-purple-500"
              />
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={saveToken}
                disabled={loading || !formData.access_token || !formData.user_id}
                className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Salvar Configuração
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => {
                  setShowTokenForm(false)
                  setFormData({ access_token: '', user_id: '', url_checkout: '' })
                }}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Cancelar
              </Button>
            </div>

            <Alert className="bg-purple-50 border-purple-200">
              <AlertCircle className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-700 text-sm">
                <strong>Importante:</strong> Estes dados são obtidos após autorizar o app na NuvemShop. 
                O access_token é fornecido na URL de retorno e o user_id corresponde ao ID da loja que autorizou.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Informações do App */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-orange-700">
            <AlertCircle className="w-6 h-6" />
            Informações do Aplicativo
          </CardTitle>
          <CardDescription>
            Detalhes técnicos da integração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="bg-white/50 rounded-lg p-4">
                <h4 className="font-medium text-orange-700 mb-2">Configurações do App</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div><span className="font-medium">ID do App:</span> 17589</div>
                  <div><span className="font-medium">Callback URL:</span> https://render-webhooks.onrender.com/auth/callback</div>
                  <div><span className="font-medium">Permissões:</span> Produtos, Pedidos, Webhooks</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="bg-white/50 rounded-lg p-4">
                <h4 className="font-medium text-orange-700 mb-2">Como Obter os Dados</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>1. Clique em "Autorizar" na loja desejada</div>
                  <div>2. Autorize o app no painel da NuvemShop</div>
                  <div>3. Copie o access_token da URL de retorno</div>
                  <div>4. O user_id é o ID da loja (numérico)</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
