const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'scripts', 'run-migrations.js');

if (fs.existsSync(distPath)) {
  console.log('🔄 Executando migrations...');
  
  // Executar o script como um processo separado para garantir que a lógica assíncrona funcione
  const migrationProcess = spawn('node', [distPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  migrationProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Migrations falharam com código ${code}`);
      process.exit(1);
    } else {
      console.log('✅ Migrations executadas com sucesso');
      process.exit(0);
    }
  });

  migrationProcess.on('error', (error) => {
    console.error('❌ Erro ao executar migrations:', error);
    process.exit(1);
  });
} else {
  console.log('⚠️  Arquivo de migrations não encontrado. Pulando execução.');
  console.log('   Caminho esperado:', distPath);
  process.exit(0);
}
