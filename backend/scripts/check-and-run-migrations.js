const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'scripts', 'run-migrations.js');

if (fs.existsSync(distPath)) {
  console.log('🔄 Executando migrations...');
  
  const migrationProcess = spawn('node', [distPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env
  });

  migrationProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Migrations falharam com código ${code}`);
      process.exit(1);
    }
    process.exit(0);
  });

  migrationProcess.on('error', (error) => {
    console.error('❌ Erro ao executar migrations:', error.message);
    process.exit(1);
  });
} else {
  console.log('⚠️  Migrations não encontradas - pulando execução');
  process.exit(0);
}
