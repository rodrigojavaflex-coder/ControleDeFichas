import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CreateUserDto } from '../modules/users/dto/create-user.dto';
import { Permission } from '../common/enums/permission.enum';

async function createInitialUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const usersService = app.get(UsersService);
    
    // Dados do usuário inicial
    const createUserDto: CreateUserDto = {
      name: 'Administrador',
      email: 'admin@test.com',
      password: '123456',
      isActive: true,
      permissions: [
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
      ]
    };
    
    console.log('🚀 Criando usuário inicial...');
    console.log(`📧 Email: ${createUserDto.email}`);
    console.log(`🔑 Senha: ${createUserDto.password}`);
    
    // Verificar se já existe um usuário com esse email
    try {
      const existingUser = await usersService.findAll({ email: createUserDto.email, page: 1, limit: 1 });
      if (existingUser.data.length > 0) {
        console.log('⚠️  Usuário já existe! Dados para login:');
        console.log(`📧 Email: ${createUserDto.email}`);
        console.log(`🔑 Senha: ${createUserDto.password}`);
        return;
      }
    } catch (error) {
      // Usuário não existe, pode criar
    }
    
    const user = await usersService.create(createUserDto);
    
    console.log('✅ Usuário criado com sucesso!');
    console.log(`👤 ID: ${user.id}`);
    console.log(`📧 Email: ${createUserDto.email}`);
    console.log(`🔑 Senha: ${createUserDto.password}`);
    console.log(`🎯 Permissões: ${user.permissions.join(', ')}`);
    console.log('');
    console.log('🌐 Acesse: http://localhost:4200');
    console.log('');
    
  } catch (error) {
    if (error.message?.includes('Já existe um usuário cadastrado')) {
      console.log('⚠️  Usuário já existe! Use estas credenciais:');
      console.log(`📧 Email: admin@test.com`);
      console.log(`🔑 Senha: 123456`);
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
    }
  } finally {
    await app.close();
  }
}

// Executar o script
createInitialUser();