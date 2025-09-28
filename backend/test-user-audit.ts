import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuditoriaService } from './src/common/services/auditoria.service';
import { Auditoria } from './src/modules/auditoria/entities/auditoria.entity';
import { AuditAction } from './src/common/enums/auditoria.enum';
import { AppDataSource } from './src/data-source';

async function testUserAudit() {
  console.log('🔍 Testando auditoria de operações de usuário...\n');

  // Verificar configuração de auditoria
  const dataSource = AppDataSource;
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const configuracaoRepo = dataSource.getRepository('Configuracao');
  const config = await configuracaoRepo.findOne({ where: {} });

  console.log('📋 Configuração atual de auditoria:');
  console.log(`  - auditarCriacao: ${config?.auditarCriacao}`);
  console.log(`  - auditarAlteracao: ${config?.auditarAlteracao}`);
  console.log(`  - auditarExclusao: ${config?.auditarExclusao}`);
  console.log(`  - auditarConsultas: ${config?.auditarConsultas}\n`);

  // Verificar logs existentes
  const auditoriaRepo = dataSource.getRepository(Auditoria);
  const logs = await auditoriaRepo.find({
    order: { criadoEm: 'DESC' },
    take: 10
  });

  console.log('📊 Últimos 10 logs de auditoria:');
  logs.forEach((log, index) => {
    console.log(`${index + 1}. [${log.criadoEm.toISOString()}] ${log.acao} - ${log.entidade} - ${log.usuario?.nome || 'Sistema'}`);
  });

  // Testar criação de usuário via API
  console.log('\n🚀 Testando criação de usuário via API...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const auditoriaService = app.get(AuditoriaService);

  try {
    // Simular uma operação de criação de usuário
    await auditoriaService.createLog({
      acao: AuditAction.CREATE,
      entidade: 'Usuario',
      entidadeId: 'test-user-id',
      dadosAnteriores: null,
      dadosNovos: { email: 'test@example.com', nome: 'Test User' },
      enderecoIp: '127.0.0.1',
      descricao: 'Teste manual de criação de usuário'
    });

    console.log('✅ Log de criação de usuário inserido manualmente');

    // Verificar se foi inserido
    const newLogs = await auditoriaRepo.find({
      where: { entidade: 'Usuario', acao: AuditAction.CREATE },
      order: { criadoEm: 'DESC' },
      take: 1
    });

    if (newLogs.length > 0) {
      console.log('✅ Log encontrado na base de dados');
    } else {
      console.log('❌ Log não encontrado na base de dados');
    }

  } catch (error) {
    console.error('❌ Erro ao testar auditoria:', error.message);
  }

  await app.close();
  await dataSource.destroy();
}

testUserAudit().catch(console.error);