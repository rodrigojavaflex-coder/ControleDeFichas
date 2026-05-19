import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Perfil } from '../perfil/entities/perfil.entity';
import { Vendedor } from '../vendedores/entities/vendedor.entity';
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
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import {
  HOME_SHORTCUT_ID_SET,
  HOME_SHORTCUTS_MAX,
} from '../../common/constants/home-shortcut-ids';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Perfil)
    private readonly perfilRepository: Repository<Perfil>,
    @InjectRepository(Vendedor)
    private readonly vendedorRepository: Repository<Vendedor>,
  ) {}

  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
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

      const perfilIds = Array.from(
        new Set(createUsuarioDto.perfilIds || []),
      ).filter(Boolean);
      const perfis = await this.perfilRepository.find({
        where: { id: In(perfilIds) },
      });
      if (!perfis.length || perfis.length !== perfilIds.length) {
        throw new NotFoundException(
          'Um ou mais perfis informados não foram encontrados',
        );
      }

      // Buscar vendedor pelo ID se fornecido
      let vendedor: Vendedor | null = null;
      if (createUsuarioDto.vendedorId) {
        vendedor = await this.vendedorRepository.findOne({
          where: { id: createUsuarioDto.vendedorId },
        });
        if (!vendedor) {
          throw new NotFoundException(
            `Vendedor com ID ${createUsuarioDto.vendedorId} não encontrado`,
          );
        }
      }

      // Montar dados do usuário
      const userData = {
        nome: createUsuarioDto.nome,
        email: createUsuarioDto.email,
        senha: hashedPassword,
        ativo: createUsuarioDto.ativo ?? true,
        tema: createUsuarioDto.tema || 'Claro',
        unidade: createUsuarioDto.unidade,
        perfis,
        vendedor: vendedor || undefined,
      };


      const user = this.usuarioRepository.create(userData);

      const savedUser = await this.usuarioRepository.save(user);

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

    const queryBuilder = this.usuarioRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.perfis', 'perfis');

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
    // Carregar usuário incluindo a relação com Perfil e Vendedor
    const user = await this.usuarioRepository.findOne({
      where: { id },
      relations: ['perfis', 'vendedor'],
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
    if (updateUsuarioDto.perfilIds !== undefined) {
      const perfilIds = Array.from(
        new Set(updateUsuarioDto.perfilIds || []),
      ).filter(Boolean);
      const perfis = await this.perfilRepository.find({
        where: { id: In(perfilIds) },
      });
      if (!perfis.length || perfis.length !== perfilIds.length) {
        throw new NotFoundException(
          'Um ou mais perfis informados não foram encontrados',
        );
      }
      user.perfis = perfis;
    }
    if (updateUsuarioDto.tema !== undefined) user.tema = updateUsuarioDto.tema;
    if (updateUsuarioDto.unidade !== undefined) user.unidade = updateUsuarioDto.unidade;
    
    // Atualizar vendedor se fornecido
    if (updateUsuarioDto.vendedorId !== undefined) {
      if (updateUsuarioDto.vendedorId === null || updateUsuarioDto.vendedorId === '') {
        // Se vendedorId for null ou string vazia, remover o vendedor
        user.vendedor = null as any;
      } else {
        const vendedor = await this.vendedorRepository.findOne({
          where: { id: updateUsuarioDto.vendedorId },
        });
        if (!vendedor) {
          throw new NotFoundException(
            `Vendedor com ID ${updateUsuarioDto.vendedorId} não encontrado`,
          );
        }
        user.vendedor = vendedor;
      }
    }

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

  sanitizeAtalhosHomeIds(ids: string[] | null | undefined): string[] {
    if (!ids?.length) {
      return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const trimmed = id.trim();
      if (!trimmed || !HOME_SHORTCUT_ID_SET.has(trimmed) || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length >= HOME_SHORTCUTS_MAX) break;
    }
    return result;
  }

  async updateAtalhosHome(id: string, atalhosHome: string[]): Promise<Usuario> {
    const user = await this.findOne(id);
    user.atalhosHome = this.sanitizeAtalhosHomeIds(atalhosHome);

    try {
      return await this.usuarioRepository.save(user);
    } catch (error) {
      this.logger.error('Erro ao atualizar atalhos da home:', error);
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
  const userPermissions = getUsuarioPermissoes(user);
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
