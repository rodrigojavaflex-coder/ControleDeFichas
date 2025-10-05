import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Perfil } from '../perfil/entities/perfil.entity';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { FindUsuariosDto } from './dto/find-usuarios.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { PERMISSION_GROUPS } from '../../common/enums/permission.enum';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Perfil)
    private readonly perfilRepository: Repository<Perfil>,
  ) {}

  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    this.logger.debug('UserService.create called with:', createUsuarioDto);
    try {
      // Verificar se já existe um usuário com este email
      const existingUser = await this.usuarioRepository.findOneBy({
        email: createUsuarioDto.email,
      });
      if (existingUser) {
        throw new ConflictException(
          `Já existe um usuário cadastrado com este email: ${existingUser.nome} (${existingUser.email})`,
        );
      }

      // Hash da senha antes de salvar
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createUsuarioDto.senha || 'Ro112543*',
        saltRounds,
      );

      // Buscar perfil pelo ID
      const perfil = await this.perfilRepository.findOne({
        where: { id: createUsuarioDto.perfilId },
      });
      if (!perfil) {
        throw new NotFoundException(
          `Perfil com ID ${createUsuarioDto.perfilId} não encontrado`,
        );
      }
      // Montar dados do usuário
      const userData = {
        nome: createUsuarioDto.nome,
        email: createUsuarioDto.email,
        senha: hashedPassword,
        ativo: createUsuarioDto.ativo ?? true,
        tema: createUsuarioDto.tema || 'Claro',
        perfil,
      };

      this.logger.debug('Processed user data:', {
        ...userData,
        password: '[HASHED]',
      });

      const user = this.usuarioRepository.create(userData);
      this.logger.debug('User entity created:', {
        ...user,
        password: '[HASHED]',
      });

      const savedUser = await this.usuarioRepository.save(user);
      this.logger.log('User saved successfully:', {
        id: savedUser.id,
        name: savedUser.nome,
        email: savedUser.email,
      });

      return savedUser;
    } catch (error) {
      this.logger.error('Error creating user:', error);

      // Se já capturamos o erro de unicidade acima, re-lançar
      if (error instanceof ConflictException) {
        throw error;
      }

      // Verificar se é um erro de violação de constraint de unicidade do banco
      if (
        error.code === '23505' ||
        error.message?.includes(
          'duplicate key value violates unique constraint',
        )
      ) {
        // Buscar o usuário existente para mostrar informações na mensagem
        try {
          const existingUser = await this.usuarioRepository.findOneBy({
            email: createUsuarioDto.email,
          });
          if (existingUser) {
            throw new ConflictException(
              `Já existe um usuário cadastrado com este email: ${existingUser.nome} (${existingUser.email})`,
            );
          }
        } catch (findError) {
          // Se não conseguir buscar o usuário, usar mensagem genérica
          this.logger.warn(
            'Não foi possível buscar usuário existente:',
            findError,
          );
        }
        throw new ConflictException(
          'Já existe um usuário cadastrado com este email',
        );
      }

      this.logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async findAll(
    findUsuariosDto: FindUsuariosDto,
  ): Promise<PaginatedResponseDto<Usuario>> {
    const { page = 1, limit = 10, nome, email } = findUsuariosDto;

    const queryBuilder = this.usuarioRepository.createQueryBuilder('user');

    if (nome) {
      queryBuilder.andWhere('user.nome ILIKE :nome', { nome: `%${nome}%` });
    }

    if (email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }

    const [users, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.criadoEm', 'DESC')
      .getManyAndCount();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(users, meta);
  }

  async findOne(id: string): Promise<Usuario> {
    // Carregar usuário incluindo a relação com Perfil para que user.perfil esteja disponível
    const user = await this.usuarioRepository.findOne({
      where: { id },
      relations: ['perfil'],
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
    }

    return user;
  }

  async update(
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<Usuario> {
    const user = await this.findOne(id);

    // Se está alterando o email, verificar se já não existe outro usuário com esse email
    if (updateUsuarioDto.email && updateUsuarioDto.email !== user.email) {
      const existingUser = await this.usuarioRepository.findOneBy({
        email: updateUsuarioDto.email,
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          `Já existe um usuário cadastrado com este email: ${existingUser.nome} (${existingUser.email})`,
        );
      }
    }

    // Se está alterando a senha, fazer hash
    if (updateUsuarioDto.senha) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        updateUsuarioDto.senha,
        saltRounds,
      );
      user.senha = hashedPassword;
    }

    // Atualizar outras propriedades
    if (updateUsuarioDto.nome !== undefined) user.nome = updateUsuarioDto.nome;
    if (updateUsuarioDto.email !== undefined)
      user.email = updateUsuarioDto.email;
    if (updateUsuarioDto.ativo !== undefined)
      user.ativo = updateUsuarioDto.ativo;
    if (updateUsuarioDto.perfilId !== undefined) {
      const perfil = await this.perfilRepository.findOne({
        where: { id: updateUsuarioDto.perfilId },
      });
      if (!perfil) {
        throw new NotFoundException(
          `Perfil com ID ${updateUsuarioDto.perfilId} não encontrado`,
        );
      }
      user.perfil = perfil;
    }
    if (updateUsuarioDto.tema !== undefined) user.tema = updateUsuarioDto.tema;

    try {
      return await this.usuarioRepository.save(user);
    } catch (error) {
      // Verificar se é um erro de violação de constraint de unicidade do banco
      if (
        error.code === '23505' ||
        error.message?.includes(
          'duplicate key value violates unique constraint',
        )
      ) {
        // Buscar o usuário existente para mostrar informações na mensagem
        try {
          const existingUser = await this.usuarioRepository.findOneBy({
            email: updateUsuarioDto.email,
          });
          if (existingUser && existingUser.id !== id) {
            throw new ConflictException(
              `Já existe um usuário cadastrado com este email: ${existingUser.nome} (${existingUser.email})`,
            );
          }
        } catch (findError) {
          // Se não conseguir buscar o usuário, usar mensagem genérica
          this.logger.warn(
            'Não foi possível buscar usuário existente:',
            findError,
          );
        }
        throw new ConflictException(
          'Já existe um usuário cadastrado com este email',
        );
      }
      throw error;
    }
  }

  async updateTema(id: string, tema: string): Promise<Usuario> {
    const user = await this.findOne(id);

    // Validar tema
    if (!['Claro', 'Escuro'].includes(tema)) {
      throw new ConflictException('Tema deve ser Claro ou Escuro');
    }

    user.tema = tema;

    try {
      return await this.usuarioRepository.save(user);
    } catch (error) {
      this.logger.error('Erro ao atualizar tema do usuário:', error);
      throw error;
    }
  }

  async getPrintData(id: string) {
    const user = await this.findOne(id);

  // Formatar permissões para impressão (perfis)
  const userPermissions = user.perfil?.permissoes || [];
    const formattedPermissions: Array<{
      group: string;
      permissions: string[];
    }> = [];

    // Agrupar permissões por categoria
    for (const [groupName, permissions] of Object.entries(PERMISSION_GROUPS)) {
      const groupPermissions = permissions.filter((p) =>
        userPermissions.includes(p.key),
      );
      if (groupPermissions.length > 0) {
        formattedPermissions.push({
          group: groupName,
          permissions: groupPermissions.map((p) => p.label),
        });
      }
    }

    // Encontrar permissões que não estão em nenhum grupo
    const allGroupedPermissions = Object.values(PERMISSION_GROUPS)
      .flat()
      .map((p) => p.key);
    const ungroupedPermissions = userPermissions.filter(
      (p) => !allGroupedPermissions.includes(p),
    );

    if (ungroupedPermissions.length > 0) {
      formattedPermissions.push({
        group: 'Outras',
        permissions: ungroupedPermissions,
      });
    }

    return {
      id: user.id,
      name: user.nome,
      email: user.email,
      isActive: user.ativo,
      criadoEm: user.criadoEm,
      atualizadoEm: user.atualizadoEm,
      permissions: formattedPermissions,
      totalPermissions: userPermissions.length,
      printedAt: new Date().toISOString(),
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usuarioRepository.remove(user);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findOne(id);

    // Verificar se a senha atual está correta
    const isPasswordValid = await bcrypt.compare(currentPassword, user.senha);
    if (!isPasswordValid) {
      throw new ConflictException('Senha atual incorreta');
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha
    user.senha = hashedPassword;

    try {
      await this.usuarioRepository.save(user);
      this.logger.log('Senha atualizada com sucesso', { userId: user.id });
    } catch (error) {
      this.logger.error('Erro ao atualizar senha:', error);
      throw error;
    }
  }
  /**
   * Listar perfis disponíveis
   */
  async getProfiles(): Promise<Perfil[]> {
    return this.perfilRepository.find();
  }
}
