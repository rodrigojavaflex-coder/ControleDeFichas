import { AppDataSource } from '../data-source';

async function runMigrations() {
  try {
    console.log('🔄 Iniciando execução de migrations...');
    
    // Inicializar DataSource
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ DataSource inicializado');
    }

    // Executar migrations (o TypeORM já verifica quais são pendentes)
    const executedMigrations = await AppDataSource.runMigrations();
    
    if (executedMigrations && executedMigrations.length > 0) {
      console.log(`✅ ${executedMigrations.length} migration(s) executada(s) com sucesso:`);
      executedMigrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    } else {
      console.log('✅ Nenhuma migration pendente');
    }
    
    console.log('🎉 Processo de migrations concluído');
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exit(1);
  } finally {
    // Fechar conexão se estiver aberta
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Conexão com banco de dados fechada');
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

export { runMigrations };
