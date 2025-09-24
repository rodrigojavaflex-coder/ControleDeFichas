import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { Repository } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Permission } from '../common/enums/permission.enum';

async function createInitialUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const userRepository = app.get<Repository<User>>('UserRepository');

    const email = 'admin@admin.com';
    const name = 'Administrador';
    const password = 'admin123';
    const permissions = [
      Permission.USER_CREATE,
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.USER_DELETE
    ];

    const exists = await userRepository.findOne({ where: { email } });
    if (exists) {
      console.log('Usuário inicial já existe.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = userRepository.create({
      name,
      email,
      password: hashedPassword,
      isActive: true,
      permissions
    });
    await userRepository.save(user);
    console.log('Usuário inicial criado com sucesso:', email);
  } catch (error) {
    console.error('Erro ao criar usuário inicial:', error);
  } finally {
    await app.close();
  }
}

createInitialUser();
