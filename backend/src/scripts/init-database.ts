import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PerfilService } from '../modules/perfil/perfil.service';
import { UsuariosService } from '../modules/usuarios/usuarios.service';
import { Permission } from '../common/enums/permission.enum';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const perfilService = app.get(PerfilService);
  const usuarioService = app.get(UsuariosService);
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@sistema.com';
  const adminPassword =
    process.env.ADMIN_DEFAULT_PASSWORD || 'TroqueEssaSenha123!';
  const adminName = process.env.ADMIN_DEFAULT_NAME || 'Administrador';

  try {
    // Verificar se já existe um perfil ADMIN
    const perfisExistentes = await perfilService.findAll();
    const perfilAdmin = perfisExistentes.find(p => p.nomePerfil === 'ADMIN');

    let perfilId: string;

    if (perfilAdmin) {
      console.log('✅ Perfil ADMIN já existe');
      perfilId = perfilAdmin.id;
    } else {
      // Criar perfil ADMIN com todas as permissões
      const todasPermissoes = Object.values(Permission);
      const novoPerfil = await perfilService.create({
        nomePerfil: 'ADMIN',
        permissoes: todasPermissoes
      });
      console.log('✅ Perfil ADMIN criado com sucesso');
      perfilId = novoPerfil.id;
    }

    // Verificar se já existe usuário admin
    const usuariosResponse = await usuarioService.findAll({});
    const adminExistente = usuariosResponse.data.find(
      (u) => u.email === adminEmail,
    );

    if (adminExistente) {
      console.log('✅ Usuário admin já existe');
    } else {
      // Criar usuário admin
      await usuarioService.create({
        nome: adminName,
        email: adminEmail,
        senha: adminPassword,
        ativo: true,
        perfilIds: [perfilId],
        tema: 'Claro',
      });
      console.log('✅ Usuário admin criado com sucesso');
      console.log(`📧 Email: ${adminEmail}`);
      console.log('🔐 Defina uma senha segura via variável de ambiente antes do uso em produção.');
    }

    console.log('🎉 Inicialização do banco concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante inicialização:', error);
  } finally {
    await app.close();
  }
}

bootstrap();