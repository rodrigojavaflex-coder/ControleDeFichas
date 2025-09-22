import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CreateUserDto } from '../modules/users/dto/create-user.dto';
import { Permission } from '../common/enums/permission.enum';

async function initializeDatabase() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const usersService = app.get(UsersService);
    
    console.log('🚀 Criando usuário administrador...');
    console.log('');
    
    // Criar usuário administrador com todas as permissões
    const adminUserDto: CreateUserDto = {
      name: 'Administrador',
      email: 'admin@sistema.com',
      password: 'Ro112543*',
      isActive: true,
      permissions: [
        // Permissões de usuários
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        
        // Permissão administrativa completa
        Permission.ADMIN_FULL,
        
        // Permissões de sistema
        Permission.SYSTEM_CONFIG,
        Permission.SYSTEM_LOGS,
        
        // Permissões de relatórios
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
      ]
    };
    
    console.log('👤 Verificando se usuário administrador já existe...');
    
    // Verificar se já existe um usuário com este email
    try {
      const existingUsers = await usersService.findAll({ email: adminUserDto.email, page: 1, limit: 1 });
      if (existingUsers.data.length > 0) {
        console.log('⚠️  Usuário administrador já existe!');
        console.log(`👤 Nome: ${existingUsers.data[0].name}`);
        console.log(`📧 Email: ${existingUsers.data[0].email}`);
        console.log('');
        console.log('📋 Credenciais para login:');
        console.log(`   📧 Email: ${adminUserDto.email}`);
        console.log(`   🔑 Senha: ${adminUserDto.password}`);
        console.log('');
        console.log('🌐 Acesse o sistema em: http://localhost:4201');
        return;
      }
    } catch (error) {
      // Usuário não existe, pode criar
    }
    
    console.log(`📧 Email: ${adminUserDto.email}`);
    console.log(`🔑 Senha: ${adminUserDto.password}`);
    console.log(`🎯 Permissões: ${adminUserDto.permissions?.join(', ')}`);
    console.log('');
    
    const adminUser = await usersService.create(adminUserDto);
    
    console.log('✅ Usuário administrador criado com sucesso!');
    console.log(`👤 ID: ${adminUser.id}`);
    console.log(`👑 Nome: ${adminUser.name}`);
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`🔐 Senha: ${adminUserDto.password} (criptografada no banco)`);
    console.log('');
    
    // Resumo da criação
    console.log('🎉 Usuário administrador configurado com sucesso!');
    console.log('');
    console.log('📋 Credenciais do Administrador:');
    console.log(`   📧 Email: ${adminUserDto.email}`);
    console.log(`   🔑 Senha: ${adminUserDto.password}`);
    console.log('');
    console.log('🌐 Acesse o sistema em: http://localhost:4201');
    console.log('');
    console.log('🛡️  Permissões do Administrador:');
    console.log('   ✅ Criar, visualizar, editar e excluir usuários');
    console.log('   ✅ Administração completa do sistema');
    console.log('   ✅ Configurações do sistema');
    console.log('   ✅ Visualização de logs');
    console.log('   ✅ Visualização e exportação de relatórios');
    console.log('');
    
  } catch (error) {
    if (error.message?.includes('Já existe um usuário cadastrado')) {
      console.log('⚠️  Usuário administrador já existe!');
      console.log('');
      console.log('📋 Credenciais para login:');
      console.log(`   📧 Email: admin@sistema.com`);
      console.log(`   🔑 Senha: Ro112543*`);
      console.log('');
      console.log('🌐 Acesse o sistema em: http://localhost:4201');
    } else {
      console.error('❌ Erro ao criar usuário administrador:', error.message);
      console.error('');
      console.error('💡 Dicas para resolver:');
      console.error('   1. Verifique se o PostgreSQL está rodando');
      console.error('   2. Confirme as configurações de conexão no .env');
      console.error('   3. Verifique se o banco de dados existe');
      console.error('');
    }
  } finally {
    await app.close();
  }
}

// Executar o script
initializeDatabase();