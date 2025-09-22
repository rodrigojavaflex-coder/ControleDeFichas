import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

async function hashExistingPasswords() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const userRepository = app.get<Repository<User>>('UserRepository');
    
    // Buscar todos os usuários
    const users = await userRepository.find();
    console.log(`Encontrados ${users.length} usuários para verificar`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      // Verificar se a senha já está hasheada (senhas bcrypt começam com $2)
      if (user.password && !user.password.startsWith('$2')) {
        console.log(`Criptografando senha do usuário: ${user.email}`);
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(user.password, saltRounds);
        
        await userRepository.update(user.id, { password: hashedPassword });
        updatedCount++;
      }
    }
    
    console.log(`✅ ${updatedCount} senhas foram criptografadas com sucesso!`);
    
  } catch (error) {
    console.error('❌ Erro ao criptografar senhas:', error);
  } finally {
    await app.close();
  }
}

// Executar o script
hashExistingPasswords();