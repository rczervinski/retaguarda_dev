const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Lista de possíveis caminhos do Python no Windows
const pythonPaths = [
  'C:\\Users\\ondyd\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  'C:\\Users\\ondyd\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
  'C:\\Python312\\python.exe',
  'C:\\Python311\\python.exe',
  'python',
  'python3',
];

function findPython() {
  for (const pythonPath of pythonPaths) {
    try {
      execSync(`"${pythonPath}" --version`, { stdio: 'pipe' });
      console.log(`✓ Python encontrado: ${pythonPath}`);
      return pythonPath;
    } catch (e) {
      // Continua tentando
    }
  }
  throw new Error('❌ Python não encontrado! Instale Python 3.11+ e tente novamente.');
}

function installDependencies() {
  const pythonPath = findPython();
  const requirementsPath = path.join(__dirname, '..', 'requirements.txt');
  
  if (!fs.existsSync(requirementsPath)) {
    console.log('⚠️  requirements.txt não encontrado, pulando instalação Python');
    return;
  }
  
  console.log('📦 Instalando dependências Python...');
  try {
    execSync(`"${pythonPath}" -m pip install -q -r "${requirementsPath}"`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✓ Dependências Python instaladas com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao instalar dependências Python:', e.message);
    process.exit(1);
  }
}

installDependencies();
