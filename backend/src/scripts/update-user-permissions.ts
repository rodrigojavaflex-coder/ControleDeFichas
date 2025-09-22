import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Permission, ALL_PERMISSIONS } from '../common/enums/permission.enum';

async function updateUserPermissions() {
  // Configuração do banco de dados
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'nestjs_angular_db',
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado ao banco de dados');

    const userRepository = dataSource.getRepository(User);
    
    // Buscar usuário admin
    const adminUser = await userRepository.findOne({
      where: { email: 'admin@sistema.com' }
    });

    if (!adminUser) {
      console.log('❌ Usuário admin não encontrado');
      return;
    }

    console.log('👤 Usuário admin encontrado:', {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      permissionsCount: adminUser.permissions?.length || 0
    });

    // Adicionar a nova permissão USER_PRINT se ainda não existir
    const currentPermissions = adminUser.permissions || [];
    
    if (!currentPermissions.includes(Permission.USER_PRINT)) {
      adminUser.permissions = [...currentPermissions, Permission.USER_PRINT];
      
      await userRepository.save(adminUser);
      
      console.log('✅ Permissão USER_PRINT adicionada com sucesso!');
      console.log('📝 Permissões atuais:', adminUser.permissions);
    } else {
      console.log('ℹ️ Usuário admin já possui a permissão USER_PRINT');
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar permissões:', error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// Executar se este arquivo for chamado diretamente
if (require.main === module) {
  updateUserPermissions()
    .then(() => {
      console.log('🎉 Script executado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro na execução:', error);
      process.exit(1);
    });
}

export default updateUserPermissions;