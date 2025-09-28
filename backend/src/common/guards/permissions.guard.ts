import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../enums/permission.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(Usuario)
    private userRepository: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new ForbiddenException('Token de acesso não fornecido');
    }

    try {
      // Usar a mesma configuração de secret que a JwtStrategy
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET', 'default-secret-key'),
      });
      const user = await this.userRepository.findOneBy({ id: payload.sub });

      if (!user) {
        throw new ForbiddenException('Usuário não encontrado');
      }

      if (!user.ativo) {
        throw new ForbiddenException('Usuário inativo');
      }

      // Verificar se o usuário tem pelo menos uma das permissões necessárias
      const hasPermission = requiredPermissions.some((permission) =>
        user.permissoes.includes(permission),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Acesso negado. Permissões necessárias: ${requiredPermissions.join(', ')}`,
        );
      }

      // Adicionar usuário ao request para uso posterior
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Log do erro para debug
      this.logger.error('Erro na verificação do token:', error.message);
      throw new ForbiddenException('Token inválido');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
