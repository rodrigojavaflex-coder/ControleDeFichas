import { DataSource } from 'typeorm';
import { User } from './modules/users/entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'nestjs_angular_db',
  entities: [User],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
});