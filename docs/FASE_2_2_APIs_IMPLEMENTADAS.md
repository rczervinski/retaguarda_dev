# FASE 2.2 - IMPLEMENTAÇÃO DAS APIs NEXT.JS

## ✅ APIs IMPLEMENTADAS

### **1. GET /api/produtos/combos**
Carregamento de dados para combos (categorias, grupos, fornecedores, etc.)

**Parâmetros:**
- `?tipo=categorias` - Busca categorias distintas
- `?tipo=grupos&categoria_filtro=X` - Busca grupos (pode filtrar por categoria)
- `?tipo=subgrupos` - Busca subgrupos distintos  
- `?tipo=unidades` - Busca unidades distintas
- `?tipo=fornecedores` - Busca fornecedores

**Exemplo de uso:**
```javascript
// Carregar categorias
const response = await fetch('/api/produtos/combos?tipo=categorias');
const categorias = await response.json();

// Carregar grupos filtrados por categoria
const response = await fetch('/api/produtos/combos?tipo=grupos&categoria_filtro=CATEGORIA_X');
const grupos = await response.json();
```

### **2. GET /api/produtos/[id]**
Buscar produto específico com todas as tabelas relacionadas

**Retorna:**
- Produto principal (produtos)
- Informações básicas (produtos_ib)
- Outros dados (produtos_ou) 
- Tributação (produtos_tb)
- Grade do produto (produtos_gd)

### **3. PUT /api/produtos/[id]** 
Atualizar produto existente

**Features implementadas:**
- ✅ Conversão automática vírgula → ponto para campos numéricos
- ✅ Conversão boolean string → "0"/"1"
- ✅ Validação de vencimento (mínimo 2099-01-01)
- ✅ Campos NULL especiais (fornecedor, dimensões)
- ✅ Upper case automático para strings
- ✅ Transação para garantir integridade
- ✅ Mantém campo `aliquita_pis` conforme sistema original

### **4. POST /api/produtos**
Criar novo produto completo

**Features implementadas:**
- ✅ Validação de código GTIN único
- ✅ Criação em todas as 4 tabelas (produtos, produtos_ib, produtos_ou, produtos_tb)
- ✅ Sequência automática para codigo_interno
- ✅ Mesmas validações e conversões do PUT
- ✅ Transação para rollback em caso de erro

### **5. GET /api/produtos**
Listagem de produtos com filtros e paginação

**Filtros suportados:**
- `desc_pesquisa` - Por GTIN (numérico) ou descrição (texto)
- `categoria` - Filtro por categoria
- `grupo` - Filtro por grupo  
- `nuvem_normal`, `nuvem_vitrine`, `nuvem_variante` - Status NS específicos
- `nuvemshop` - Todos os status da Nuvemshop
- `apenas_locais` - Produtos não exportados
- `pagina` - Paginação (LIMIT 50 por página)

### **6. POST /api/fornecedores**
Criar novo fornecedor

**Features:**
- ✅ Sequência automática para código
- ✅ Upper case automático
- ✅ CEP padrão '83005410'

### **7. GET /api/produtos/[id]/grade**
Buscar grade completa do produto

### **8. POST /api/produtos/[id]/grade**
Salvar grade do produto

**Features:**
- ✅ Delete + Insert para substituir grade completa
- ✅ Transação para garantir integridade
- ✅ Validação de produto existente

### **9. GET /api/produtos/codigo/[codigo]**
Consultar se código GTIN já existe

**Retorna:**
```json
{
  "exists": true/false,
  "codigo_interno": "123" ou "0"
}
```

## 🔧 FUNÇÕES UTILITÁRIAS IMPLEMENTADAS

### **convertNumeric()**
```typescript
const convertNumeric = (value: string | null | undefined): string => {
  if (!value || value === '') return '0';
  return value.toString().replace(',', '.');
};
```

### **convertBoolean()**
```typescript
const convertBoolean = (value: string | boolean): string => {
  if (typeof value === 'boolean') return value ? '1' : '0';
  return value === 'true' || value === '1' ? '1' : '0';
};
```

## ⚡ TRANSAÇÕES IMPLEMENTADAS

Todas as operações críticas usam `prisma.$transaction()`:

1. **Criar produto** - 4 INSERTs sequenciais
2. **Atualizar produto** - 4 UPDATEs sequenciais  
3. **Salvar grade** - DELETE + múltiplos INSERTs

## 🔍 VALIDAÇÕES IMPLEMENTADAS

### **Código GTIN único:**
- Verificação antes de inserir novo produto
- Retorno de erro específico se já existe

### **Campos obrigatórios:**
- `codigo_gtin` não pode ser vazio/zero
- `razao_social` obrigatória para fornecedores

### **Formatação automática:**
- Strings → UPPER CASE
- Números → vírgula → ponto  
- Booleans → "0" ou "1"
- Vencimento inválido → "2099-01-01"

## 📊 ESTRUTURA DE RESPOSTA

### **Sucesso:**
```json
{
  "success": true,
  "codigo_interno": "123",
  "message": "Produto criado com sucesso!"
}
```

### **Erro:**
```json
{
  "success": false,  
  "error": "Código GTIN já cadastrado. Por favor, use outro código."
}
```

### **Listagem:**
```json
{
  "produtos": [...],
  "total": 150,
  "pagina": 0
}
```

---

## 🎯 PRÓXIMO PASSO: FASE 2.3
**Integração Completa** - Conectar o ProductEditForm.tsx com essas APIs para funcionamento completo do CRUD.

**✅ FASE 2.2 COMPLETA** - 9 APIs implementadas com validações, transações e compatibilidade total com sistema PHP original.
