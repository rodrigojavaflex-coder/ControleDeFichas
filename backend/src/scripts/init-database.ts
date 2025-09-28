import { AppDataSource } from '../data-source';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { Permission } from '../common/enums/permission.enum';
import * as bcrypt from 'bcrypt';

async function initDatabase() {
  try {
    // Inicializar conexão com o banco
    await AppDataSource.initialize();
    console.log('✅ Conexão com banco de dados estabelecida');

    const usuarioRepository = AppDataSource.getRepository(Usuario);

    // Verificar se já existe um administrador
    const adminExistente = await usuarioRepository.findOne({
      where: { email: 'admin@sistema.com' }
    });

    if (adminExistente) {
      console.log('ℹ️  Usuário administrador já existe');
      return;
    }

    // Criar hash da senha
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash('Ro112543*', saltRounds);

    // Criar usuário administrador
    const admin = new Usuario();
    admin.nome = 'Administrador';
    admin.email = 'admin@sistema.com';
    admin.senha = senhaHash;
    admin.ativo = true;
    admin.permissoes = [
      Permission.USER_CREATE,
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.USER_DELETE,
      Permission.USER_PRINT,
      Permission.ADMIN_FULL,
      Permission.SYSTEM_CONFIG,
      Permission.SYSTEM_LOGS,
      Permission.REPORTS_VIEW,
      Permission.REPORTS_EXPORT,
      Permission.CONFIGURACAO_ACCESS,
      Permission.FICHA_TECNICA_CREATE,
      Permission.FICHA_TECNICA_READ,
      Permission.FICHA_TECNICA_UPDATE,
      Permission.FICHA_TECNICA_DELETE,
      Permission.AUDIT_VIEW,
      Permission.AUDIT_MANAGE
    ];

    await usuarioRepository.save(admin);
    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('📧 Email: admin@sistema.com');
    console.log('🔑 Senha: Ro112543*');

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Executar script
initDatabase();