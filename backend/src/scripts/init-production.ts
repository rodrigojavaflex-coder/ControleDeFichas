import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CreateUserDto } from '../modules/users/dto/create-user.dto';
import { Permission } from '../common/enums/permission.enum';

async function initializeProductionDatabase() {
  let app;
  
  try {
    console.log('🚀 Inicializando sistema em ambiente de produção...');
    console.log(`📅 Data/Hora: ${new Date().toLocaleString()}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    
    // Criar contexto da aplicação
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // Reduzir logs em produção
    });
    
    const usersService = app.get(UsersService);
    
    // Configurações do administrador
    const adminUserDto: CreateUserDto = {
      name: 'Administrador',
      email: 'admin@sistema.com',
      password: 'Ro112543*',
      isActive: true,
      permissions: [
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.ADMIN_FULL,
        Permission.SYSTEM_CONFIG,
        Permission.SYSTEM_LOGS,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
      ]
    };
    
    console.log('👤 Verificando usuário administrador...');
    
    // Verificar se usuário administrador já existe
    let adminExists = false;
    try {
      const existingUsers = await usersService.findAll({ 
        email: adminUserDto.email, 
        page: 1, 
        limit: 1 
      });
      
      if (existingUsers.data.length > 0) {
        adminExists = true;
        console.log('✅ Usuário administrador já existe na base de dados');
        console.log(`👤 Nome: ${existingUsers.data[0].name}`);
        console.log(`📧 Email: ${existingUsers.data[0].email}`);
        console.log(`🔄 Última atualização: ${existingUsers.data[0].updatedAt}`);
      }
    } catch (findError) {
      console.log('🔍 Usuário administrador não encontrado, será criado...');
    }
    
    // Criar usuário se não existir
    if (!adminExists) {
      console.log('🔧 Criando usuário administrador...');
      console.log(`📧 Email: ${adminUserDto.email}`);
      console.log(`🎯 Permissões: ${adminUserDto.permissions?.length} permissões atribuídas`);
      
      const adminUser = await usersService.create(adminUserDto);
      
      console.log('✅ Usuário administrador criado com sucesso!');
      console.log(`🆔 ID: ${adminUser.id}`);
      console.log(`👑 Nome: ${adminUser.name}`);
      console.log(`📧 Email: ${adminUser.email}`);
      console.log(`📅 Criado em: ${adminUser.createdAt}`);
      console.log('🔐 Senha criptografada e armazenada com segurança');
    }
    
    console.log('');
    console.log('🎉 Sistema inicializado com sucesso!');
    console.log('');
    console.log('📋 Informações do Administrador:');
    console.log(`   📧 Email: ${adminUserDto.email}`);
    console.log(`   🔑 Senha: ${adminUserDto.password}`);
    console.log('');
    console.log('🛡️  Segurança:');
    console.log('   ✅ Senha criptografada com bcrypt');
    console.log('   ✅ Todas as permissões administrativas');
    console.log('   ✅ Usuário ativo no sistema');
    console.log('');
    console.log('🚀 Sistema pronto para uso!');
    
  } catch (error) {
    console.error('❌ Erro durante inicialização do sistema:', error.message);
    console.error('');
    
    // Diagnóstico de problemas comuns
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      console.error('🔧 Problemas de Conexão com Banco de Dados:');
      console.error('   1. Verifique se o PostgreSQL está rodando');
      console.error('   2. Confirme as variáveis de ambiente:');
      console.error('      - DATABASE_HOST');
      console.error('      - DATABASE_PORT');
      console.error('      - DATABASE_USERNAME');
      console.error('      - DATABASE_PASSWORD');
      console.error('      - DATABASE_NAME');
      console.error('   3. Verifique se o banco de dados existe');
      console.error('   4. Teste a conectividade de rede');
    } else if (error.message?.includes('Já existe um usuário cadastrado')) {
      console.log('ℹ️  Usuário administrador já existe no sistema');
      console.log('📋 Credenciais para login:');
      console.log(`   📧 Email: admin@sistema.com`);
      console.log(`   🔑 Senha: Ro112543*`);
    } else {
      console.error('💡 Dicas para resolução:');
      console.error('   1. Verifique os logs detalhados acima');
      console.error('   2. Confirme as configurações do ambiente');
      console.error('   3. Verifique as permissões do banco de dados');
      console.error('   4. Contate o suporte técnico se necessário');
    }
    
    console.error('');
    process.exit(1); // Falha na inicialização
    
  } finally {
    // Fechar conexão com o banco
    if (app) {
      await app.close();
    }
  }
}

// Executar inicialização
initializeProductionDatabase();