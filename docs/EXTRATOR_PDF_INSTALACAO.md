# Instalação e Configuração do Extrator de Imagens PDF

## Pré-requisitos

### 1. Python (Obrigatório)

O extrator de imagens PDF requer Python 3.8 ou superior instalado no sistema.

#### Windows

**Opção 1: Instalador Oficial (Recomendado)**
1. Baixe o instalador do Python em: https://www.python.org/downloads/
2. Execute o instalador
3. **IMPORTANTE**: Marque a opção "Add Python to PATH"
4. Clique em "Install Now"
5. Após a instalação, abra um novo PowerShell e verifique:
   ```powershell
   python --version
   ```

**Opção 2: Microsoft Store**
1. Execute: `python` no PowerShell
2. Será aberto a Microsoft Store
3. Instale "Python 3.12" (ou versão mais recente)

#### Linux/Mac

```bash
# Verificar se Python já está instalado
python3 --version

# Se não estiver instalado:
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip

# Mac (com Homebrew)
brew install python3
```

### 2. Dependências Python

Após instalar o Python, instale as bibliotecas necessárias:

```powershell
# Windows (PowerShell)
cd c:\Users\ondyd\Documents\retaguarda\retaguarda_new
pip install -r requirements.txt

# Ou instalar manualmente:
pip install pikepdf>=8.0.0 Pillow>=10.0.0
```

```bash
# Linux/Mac
cd /caminho/para/retaguarda_new
pip3 install -r requirements.txt

# Ou instalar manualmente:
pip3 install pikepdf>=8.0.0 Pillow>=10.0.0
```

### 3. Dependências Node.js

As dependências Node já foram instaladas (archiver e @types/archiver).

## Estrutura de Arquivos

```
retaguarda_new/
├── app/
│   ├── auxiliares/
│   │   └── extrator-pdf/
│   │       └── page.tsx                    # Interface do usuário
│   └── api/
│       └── auxiliares/
│           ├── extrair-imagens-pdf/
│           │   └── route.ts                # API de extração
│           └── download-zip/
│               └── [sessionId]/
│                   └── route.ts            # API de download ZIP
├── scripts/
│   └── extrair-imagens-pdf.py              # Script Python
├── upload/
│   └── temp/
│       └── {sessionId}/                    # Arquivos temporários por sessão
│           ├── input.pdf
│           └── images/
│               ├── page_1_img_1.png
│               └── ...
└── requirements.txt                        # Dependências Python
```

## Como Usar

1. **Acesse o sistema**: http://localhost:3000
2. **Navegue para**: Menu → Auxiliares → Extrator de Imagem PDF
3. **Faça upload** de um arquivo PDF (máximo 50MB)
4. **Aguarde** a extração (pode demorar alguns segundos/minutos dependendo do tamanho)
5. **Baixe**:
   - Clique em uma imagem para baixar individualmente
   - Clique em "Baixar Todas (ZIP)" para baixar todas de uma vez

## Formatos Suportados

O extrator suporta as seguintes codificações de imagem no PDF:
- JPEG
- PNG
- TIFF
- JBIG2
- CCITTFaxDecode
- Imagens indexadas (convertidas para PNG)

## Limpeza de Arquivos Temporários

**✅ Limpeza Automática Configurada** - Arquivos são removidos de 3 formas:

### 1. Limpeza ao Sair da Página (Imediata)

Quando o usuário:
- **Navega para outra página** → Sessão limpa imediatamente
- **Fecha a aba** → Sessão limpa via `beforeunload`
- **Fecha o navegador** → Sessão limpa via `sendBeacon`

A API `/api/auxiliares/cleanup-session/{sessionId}` é chamada automaticamente.

### 2. Limpeza Automática via PM2 (A cada 15 minutos)

O sistema executa limpeza automática a cada 15 minutos via PM2:

```javascript
// ecosystem.config.js - JÁ CONFIGURADO
{
  name: 'pdf-temp-cleanup',
  script: 'scripts/cleanup-pdf-temp.js',
  cron_restart: '*/15 * * * *', // A cada 15 minutos
}
```

**Remove arquivos com mais de 15 minutos de idade.**

### 3. Limpeza Manual

Se precisar limpar manualmente:

```bash
# Via npm script
npm run cleanup:pdf-temp

# Ou direto
node scripts/cleanup-pdf-temp.js
```

### Como Funciona a Limpeza Automática?

O script `cleanup-pdf-temp.js`:
1. Lista todas as sessões em `upload/temp/`
2. Verifica a data de modificação de cada diretório
3. Se tiver **mais de 15 minutos** → Deleta completamente
4. Se tiver **menos de 15 minutos** → Mantém

**Exemplo de log:**
```
[Cleanup] Encontradas 5 sessões
[Cleanup] ✅ Deletada sessão abc123... (idade: 20 min)
[Cleanup] ⏳ Mantida sessão def456... (idade: 5 min)
[Cleanup] Deletadas: 1 | Mantidas: 4
```

### Limpeza via PowerShell (Windows)

```powershell
# Deletar arquivos temporários com mais de 1 hora
$path = "c:\Users\ondyd\Documents\retaguarda\retaguarda_new\upload\temp"
Get-ChildItem -Path $path -Directory | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-1) } | Remove-Item -Recurse -Force
```

### Limpeza via Bash (Linux)

```bash
# Deletar arquivos temporários com mais de 1 hora
find /caminho/para/retaguarda_new/upload/temp -type d -mmin +60 -exec rm -rf {} +
```

## Troubleshooting

### Erro: "Python script não encontrado"
- Verifique se o arquivo `scripts/extrair-imagens-pdf.py` existe
- Verifique permissões de leitura do arquivo

### Erro: "Biblioteca necessária não instalada"
- Execute: `pip install pikepdf Pillow`
- Verifique se pip está instalado: `pip --version`

### Erro: "Erro ao executar Python"
- Verifique se Python está no PATH: `python --version`
- No Linux/Mac, tente trocar `python` por `python3` no código

### Erro: "Tempo limite excedido"
- O PDF é muito grande ou tem muitas imagens
- Considere aumentar o timeout em `route.ts` (linha 152)

### Erro: "Nenhuma imagem encontrada"
- O PDF pode não ter imagens extraíveis
- Algumas imagens podem estar incorporadas de forma não padrão
- Tente usar outro PDF para testar

## Limitações

- Tamanho máximo de arquivo: 50MB
- Timeout de processamento: 4 minutos
- Imagens vetoriais (desenhos) não são extraídas, apenas imagens raster
- Alguns formatos proprietários podem não ser suportados

## Performance

Para melhor performance:
- PDFs menores processam mais rápido
- PDFs com poucas imagens de alta resolução são mais rápidos que muitas imagens pequenas
- A primeira extração pode ser mais lenta devido ao carregamento das bibliotecas Python

## Próximos Passos

- [ ] Implementar limpeza automática de arquivos temporários (cron job)
- [ ] Adicionar visualização de metadados das imagens (DPI, dimensões)
- [ ] Suporte para processamento em lote (múltiplos PDFs)
- [ ] Progress bar real (websocket) ao invés de simulada
