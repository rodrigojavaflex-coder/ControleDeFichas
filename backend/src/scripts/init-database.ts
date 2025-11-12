import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PerfilService } from '../modules/perfil/perfil.service';
import { UsuariosService } from '../modules/usuarios/usuarios.service';
import { Permission } from '../common/enums/permission.enum';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const perfilService = app.get(PerfilService);
  const usuarioService = app.get(UsuariosService);

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
    const adminExistente = usuariosResponse.data.find(u => u.email === 'admin@sistema.com');

    if (adminExistente) {
      console.log('✅ Usuário admin já existe');
    } else {
      // Criar usuário admin
      await usuarioService.create({
        nome: 'Administrador',
        email: 'admin@sistema.com',
        senha: 'Ro112543*',
        ativo: true,
        perfilId: perfilId,
        tema: 'Claro'
      });
      console.log('✅ Usuário admin criado com sucesso');
      console.log('📧 Email: admin@sistema.com');
      console.log('🔑 Senha: Ro112543*');
    }

    console.log('🎉 Inicialização do banco concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante inicialização:', error);
  } finally {
    await app.close();
  }
}

bootstrap();