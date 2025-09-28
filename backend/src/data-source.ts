import { DataSource } from 'typeorm';
import { Usuario } from './modules/usuarios/entities/usuario.entity';
import { Auditoria } from './modules/auditoria/entities/auditoria.entity';
import { FichaTecnica } from './modules/ficha-tecnica/entities/ficha-tecnica.entity';
import { Configuracao } from './modules/configuracao/entities/configuracao.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'Ro112543*',
  database: process.env.DATABASE_NAME || 'metrobus',
  entities: [Usuario, Auditoria, FichaTecnica, Configuracao],
  synchronize: true, // Habilitado para desenvolvimento
  logging: true,
});
