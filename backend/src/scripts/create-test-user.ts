import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CreateUserDto } from '../modules/users/dto/create-user.dto';
import { Permission } from '../common/enums/permission.enum';

async function createTestUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const usersService = app.get(UsersService);
    
    // Dados do usuário de teste (sem permissão de DELETE)
    const createUserDto: CreateUserDto = {
      name: 'Usuário Teste',
      email: 'teste@test.com',
      password: '123456',
      isActive: true,
      permissions: [
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        // Propositalmente SEM Permission.USER_DELETE
      ]
    };
    
    console.log('🚀 Criando usuário de teste...');
    console.log(`📧 Email: ${createUserDto.email}`);
    console.log(`🔑 Senha: ${createUserDto.password}`);
    console.log(`🎯 Permissões: ${createUserDto.permissions?.join(', ') || 'Nenhuma'}`);
    console.log(`❌ SEM permissão: ${Permission.USER_DELETE}`);
    
    // Verificar se já existe um usuário com esse email
    try {
      const existingUser = await usersService.findAll({ email: createUserDto.email, page: 1, limit: 1 });
      if (existingUser.data.length > 0) {
        console.log('⚠️  Usuário já existe! Use estas credenciais para testar:');
        console.log(`📧 Email: ${createUserDto.email}`);
        console.log(`🔑 Senha: ${createUserDto.password}`);
        console.log('');
        console.log('🧪 Como testar:');
        console.log('1. Faça login com este usuário');
        console.log('2. Vá para a lista de usuários');
        console.log('3. Observe que o botão "Excluir" não aparece');
        console.log('4. Se tentar fazer DELETE via API diretamente, receberá 403 Forbidden');
        return;
      }
    } catch (error) {
      // Usuário não existe, pode criar
    }
    
    const user = await usersService.create(createUserDto);
    
    console.log('✅ Usuário de teste criado com sucesso!');
    console.log(`👤 ID: ${user.id}`);
    console.log(`📧 Email: ${createUserDto.email}`);
    console.log(`🔑 Senha: ${createUserDto.password}`);
    console.log('');
    console.log('🧪 Como testar:');
    console.log('1. Faça login com este usuário');
    console.log('2. Vá para a lista de usuários');
    console.log('3. Observe que o botão "Excluir" não aparece');
    console.log('4. Se tentar fazer DELETE via API diretamente, receberá 403 Forbidden');
    console.log('');
    console.log('🌐 Acesse: http://localhost:4201');
    console.log('');
    
  } catch (error) {
    if (error.message?.includes('Já existe um usuário cadastrado')) {
      console.log('⚠️  Usuário já existe! Use estas credenciais:');
      console.log(`📧 Email: teste@test.com`);
      console.log(`🔑 Senha: 123456`);
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
    }
  } finally {
    await app.close();
  }
}

// Executar o script
createTestUser();