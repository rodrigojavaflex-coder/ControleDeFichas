import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/paginated-response.dto';
import { PERMISSION_GROUPS } from '../../common/enums/permission.enum';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.debug('UserService.create called with:', createUserDto);
    try {
      // Verificar se já existe um usuário com este email
      const existingUser = await this.userRepository.findOneBy({ email: createUserDto.email });
      if (existingUser) {
        throw new ConflictException(`Já existe um usuário cadastrado com este email: ${existingUser.name} (${existingUser.email})`);
      }

      // Hash da senha antes de salvar
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(createUserDto.password || 'default-password', saltRounds);

      // Garantir que password seja o hash
      const userData = {
        ...createUserDto,
        password: hashedPassword,
        isActive: createUserDto.isActive ?? true
      };
      
      this.logger.debug('Processed user data:', { ...userData, password: '[HASHED]' });
      
      const user = this.userRepository.create(userData);
      this.logger.debug('User entity created:', { ...user, password: '[HASHED]' });
      
      const savedUser = await this.userRepository.save(user);
      this.logger.log('User saved successfully:', { id: savedUser.id, name: savedUser.name, email: savedUser.email });
      
      return savedUser;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      
      // Se já capturamos o erro de unicidade acima, re-lançar
      if (error instanceof ConflictException) {
        throw error;
      }
      
      // Verificar se é um erro de violação de constraint de unicidade do banco
      if (error.code === '23505' || error.message?.includes('duplicate key value violates unique constraint')) {
        // Buscar o usuário existente para mostrar informações na mensagem
        try {
          const existingUser = await this.userRepository.findOneBy({ email: createUserDto.email });
          if (existingUser) {
            throw new ConflictException(`Já existe um usuário cadastrado com este email: ${existingUser.name} (${existingUser.email})`);
          }
        } catch (findError) {
          // Se não conseguir buscar o usuário, usar mensagem genérica
          this.logger.warn('Não foi possível buscar usuário existente:', findError);
        }
        throw new ConflictException('Já existe um usuário cadastrado com este email');
      }
      
      this.logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async findAll(findUsersDto: FindUsersDto): Promise<PaginatedResponseDto<User>> {
    const { page = 1, limit = 10, name, email } = findUsersDto;
    
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (name) {
      queryBuilder.andWhere('user.name ILIKE :name', { name: `%${name}%` });
    }

    if (email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }

    const [users, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(users, meta);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    
    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    // Se está alterando o email, verificar se já não existe outro usuário com esse email
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneBy({ email: updateUserDto.email });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(`Já existe um usuário cadastrado com este email: ${existingUser.name} (${existingUser.email})`);
      }
    }
    
    // Se está alterando a senha, fazer hash
    if (updateUserDto.password) {
      const saltRounds = 10;
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }
    
    Object.assign(user, updateUserDto);
    
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      // Verificar se é um erro de violação de constraint de unicidade do banco
      if (error.code === '23505' || error.message?.includes('duplicate key value violates unique constraint')) {
        // Buscar o usuário existente para mostrar informações na mensagem
        try {
          const existingUser = await this.userRepository.findOneBy({ email: updateUserDto.email });
          if (existingUser && existingUser.id !== id) {
            throw new ConflictException(`Já existe um usuário cadastrado com este email: ${existingUser.name} (${existingUser.email})`);
          }
        } catch (findError) {
          // Se não conseguir buscar o usuário, usar mensagem genérica
          this.logger.warn('Não foi possível buscar usuário existente:', findError);
        }
        throw new ConflictException('Já existe um usuário cadastrado com este email');
      }
      throw error;
    }
  }

  async updateTema(id: string, tema: string): Promise<User> {
    const user = await this.findOne(id);
    
    // Validar tema
    if (!['Claro', 'Escuro'].includes(tema)) {
      throw new ConflictException('Tema deve ser Claro ou Escuro');
    }
    
    user.tema = tema;
    
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.logger.error('Erro ao atualizar tema do usuário:', error);
      throw error;
    }
  }

  async getPrintData(id: string) {
    const user = await this.findOne(id);
    
    // Formatar permissões para impressão
    const userPermissions = user.permissions || [];
    const formattedPermissions: Array<{ group: string; permissions: string[] }> = [];
    
    // Agrupar permissões por categoria
    for (const [groupName, permissions] of Object.entries(PERMISSION_GROUPS)) {
      const groupPermissions = permissions.filter(p => userPermissions.includes(p.key));
      if (groupPermissions.length > 0) {
        formattedPermissions.push({
          group: groupName,
          permissions: groupPermissions.map(p => p.label)
        });
      }
    }
    
    // Encontrar permissões que não estão em nenhum grupo
    const allGroupedPermissions = Object.values(PERMISSION_GROUPS).flat().map(p => p.key);
    const ungroupedPermissions = userPermissions.filter(p => !allGroupedPermissions.includes(p));
    
    if (ungroupedPermissions.length > 0) {
      formattedPermissions.push({
        group: 'Outras',
        permissions: ungroupedPermissions
      });
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions: formattedPermissions,
      totalPermissions: userPermissions.length,
      printedAt: new Date().toISOString()
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }
}
