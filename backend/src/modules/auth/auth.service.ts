import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditService } from '../../common/services/audit.service';
import { AuditAction } from '../../common/enums/audit.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Buscar usuário pelo email
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      await this.auditService.createLog({
        action: AuditAction.LOGIN_FAILED,
        description: `Tentativa de login falhou para o email: ${email}`,
        userId: undefined,
        metadata: { email },
      });
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Verificar se o usuário está ativo
    if (!user.isActive) {
      await this.auditService.createLog({
        action: AuditAction.LOGIN_FAILED,
        description: `Tentativa de login para usuário inativo: ${email}`,
        userId: user.id,
        metadata: { email },
      });
      throw new UnauthorizedException('Usuário inativo. Entre em contato com o administrador.');
    }

    // Verificar senha com bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.createLog({
        action: AuditAction.LOGIN_FAILED,
        description: `Tentativa de login com senha inválida para o email: ${email}`,
        userId: user.id,
        metadata: { email },
      });
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Gerar tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    await this.auditService.createLog({
      action: AuditAction.LOGIN,
      userId: user.id,
      description: `Usuário ${user.email} logado com sucesso.`,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hora em segundos
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        permissions: user.permissions || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken) as JwtPayload;
      const user = await this.userRepository.findOneBy({ id: payload.sub });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      return this.login({ email: user.email, password: user.password });
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async validateUserById(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (user && user.isActive) {
      return user;
    }
    return null;
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }
    return user;
  }
}