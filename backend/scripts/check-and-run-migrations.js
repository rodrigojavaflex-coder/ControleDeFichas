const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'scripts', 'run-migrations.js');

if (fs.existsSync(distPath)) {
  console.log('🔄 Executando migrations...');
  try {
    require(distPath);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  }
} else {
  console.log('⚠️  Arquivo de migrations não encontrado. Pulando execução.');
  console.log('   Caminho esperado:', distPath);
  process.exit(0);
}
