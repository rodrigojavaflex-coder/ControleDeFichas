import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { AuditAction } from '../../common/enums/auditoria.enum';
import { Configuracao } from '../configuracao/entities/configuracao.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly userRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditoriaService: AuditoriaService,
    @InjectRepository(Configuracao)
    private readonly configuracaoRepository: Repository<Configuracao>,
  ) {}

  /**
   * Verifica se uma ação deve ser auditada baseado nas configurações do sistema
   */
  private async shouldAuditAction(action: AuditAction): Promise<boolean> {
    try {
      const config = await this.configuracaoRepository.findOne({ where: {} });
      
      if (!config) {
        // Se não há configuração, auditar tudo por padrão
        return true;
      }

      switch (action) {
        case AuditAction.LOGIN:
        case AuditAction.LOGOUT:
        case AuditAction.LOGIN_FAILED:
          return config.auditarLoginLogOff;
        
        case AuditAction.CREATE:
          return config.auditarCriacao;
        
        case AuditAction.READ:
          return config.auditarConsultas;
        
        case AuditAction.UPDATE:
          return config.auditarAlteracao;
        
        case AuditAction.DELETE:
          return config.auditarExclusao;
        
        case AuditAction.CHANGE_PASSWORD:
          return config.auditarSenhaAlterada;
        
        default:
          return true; // Para ações não mapeadas, auditar por segurança
      }
    } catch (error) {
      console.error('Erro ao verificar configurações de auditoria', error);
      return true; // Em caso de erro, auditar por segurança
    }
  }

  async login(loginDto: LoginDto, req?: any): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Buscar usuário pelo email
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      if (await this.shouldAuditAction(AuditAction.LOGIN_FAILED)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.LOGIN_FAILED,
          descricao: `Tentativa de login falhou para o email: ${email}`,
          usuarioId: undefined,
          request: req,
        });
      }
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Verificar se o usuário está ativo
    if (!user.ativo) {
      if (await this.shouldAuditAction(AuditAction.LOGIN_FAILED)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.LOGIN_FAILED,
          descricao: `Tentativa de login para usuário inativo: ${email}`,
          usuarioId: user.id,
          request: req,
        });
      }
      throw new UnauthorizedException(
        'Usuário inativo. Entre em contato com o administrador.',
      );
    }

    // Verificar senha com bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.senha);
    if (!isPasswordValid) {
      if (await this.shouldAuditAction(AuditAction.LOGIN_FAILED)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.LOGIN_FAILED,
          descricao: `Tentativa de login com senha inválida para o email: ${email}`,
          usuarioId: user.id,
          request: req,
        });
      }
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

    if (await this.shouldAuditAction(AuditAction.LOGIN)) {
      await this.auditoriaService.createLog({
        acao: AuditAction.LOGIN,
        usuarioId: user.id,
        descricao: `Usuário ${user.email} logado com sucesso.`,
        request: req,
      });
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hora em segundos
      user: {
        id: user.id,
        name: user.nome,
        email: user.email,
        isActive: user.ativo,
        permissions: user.permissoes || [],
        tema: user.tema || 'Claro', // Incluir tema do usuário
        criadoEm: user.criadoEm,
        atualizadoEm: user.atualizadoEm,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findOneBy({ id: payload.sub });

      if (!user || !user.ativo) {
        // Auditar tentativa de refresh com token inválido
        if (await this.shouldAuditAction(AuditAction.READ)) {
          await this.auditoriaService.createLog({
            acao: AuditAction.READ,
            descricao: `Tentativa de refresh token falhou - usuário não encontrado ou inativo`,
            usuarioId: payload.sub,
            entidade: 'auth_refresh',
          });
        }
        throw new UnauthorizedException('Refresh token inválido');
      }

      // Auditar refresh token bem-sucedido
      if (await this.shouldAuditAction(AuditAction.READ)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.READ,
          descricao: `Token de acesso renovado para usuário ${user.email}`,
          usuarioId: user.id,
          entidade: 'auth_refresh',
        });
      }

      return this.login({ email: user.email, password: user.senha });
    } catch (error) {
      // Auditar falha geral no refresh
      if (await this.shouldAuditAction(AuditAction.READ)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.READ,
          descricao: `Falha no refresh token: ${error.message}`,
          entidade: 'auth_refresh',
        });
      }
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async validateUserById(userId: string): Promise<Usuario | null> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (user && user.ativo) {
      return user;
    }
    return null;
  }

  async getProfile(userId: string): Promise<Usuario> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      // Auditar tentativa de acesso a perfil inexistente
      if (await this.shouldAuditAction(AuditAction.READ)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.READ,
          descricao: `Tentativa de acesso ao perfil falhou - usuário não encontrado`,
          usuarioId: userId,
          entidade: 'auth_profile',
        });
      }
      throw new BadRequestException('Usuário não encontrado');
    }

    // Auditar acesso ao perfil
    if (await this.shouldAuditAction(AuditAction.READ)) {
      await this.auditoriaService.createLog({
        acao: AuditAction.READ,
        descricao: `Perfil do usuário ${user.email} acessado`,
        usuarioId: user.id,
        entidade: 'auth_profile',
      });
    }

    return user;
  }

  async logout(userId: string, request?: any): Promise<void> {
    // Buscar usuário para obter informações
    const user = await this.userRepository.findOneBy({ id: userId });
    
    // Auditar logout se configurado
    if (await this.shouldAuditAction(AuditAction.LOGOUT)) {
      await this.auditoriaService.createLog({
        acao: AuditAction.LOGOUT,
        usuarioId: userId,
        descricao: `Usuário ${user?.email || 'desconhecido'} fez logout`,
        request,
      });
    }
  }
}
