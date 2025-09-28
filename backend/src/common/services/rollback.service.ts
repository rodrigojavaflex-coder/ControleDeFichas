import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { AuditoriaService } from './auditoria.service';
import { Auditoria } from '../../modules/auditoria/entities/auditoria.entity';
import { AuditAction } from '../enums/auditoria.enum';
import { UsuariosService } from '../../modules/usuarios/usuarios.service';
import { FichaTecnicaService } from '../../modules/ficha-tecnica/ficha-tecnica.service';
import { ConfiguracaoService } from '../../modules/configuracao/configuracao.service';

export interface RollbackResult {
  success: boolean;
  message: string;
  rolledBackData?: any;
}

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    private readonly auditoriaService: AuditoriaService,
    @InjectRepository(Auditoria)
    private readonly auditLogRepository: Repository<Auditoria>,
    private readonly usuariosService: UsuariosService,
    private readonly fichaTecnicaService: FichaTecnicaService,
    private readonly configuracaoService: ConfiguracaoService,
  ) {}

  /**
   * Verifica se uma ação deve ser auditada baseado nas configurações do sistema
   */
  private async shouldAuditAction(action: AuditAction): Promise<boolean> {
    try {
      const config = await this.configuracaoService.findOne();
      if (!config) return true; // Se não há configuração, audita por padrão

      switch (action) {
        case AuditAction.READ:
          return config.auditarConsultas;
        case AuditAction.CREATE:
          return config.auditarCriacao;
        case AuditAction.UPDATE:
          return config.auditarAlteracao;
        case AuditAction.DELETE:
          return config.auditarExclusao;
        case AuditAction.LOGIN:
        case AuditAction.LOGOUT:
          return config.auditarLoginLogOff;
        case AuditAction.CHANGE_PASSWORD:
          return config.auditarSenhaAlterada;
        default:
          return true; // Para ações não configuráveis, sempre audita
      }
    } catch (error) {
      this.logger.error('Erro ao verificar configurações de auditoria:', error);
      return true; // Em caso de erro, audita por padrão
    }
  }

  /**
   * Desfaz uma alteração baseada no log de auditoria
   */
  async undoChange(logId: string, userId: string): Promise<RollbackResult> {
    try {
      // Buscar o log
      const log = await this.auditLogRepository.findOne({
        where: { id: logId },
        relations: ['usuario'],
      });

      if (!log) {
        throw new BadRequestException('Log de auditoria não encontrado');
      }

      // Validações de segurança
      if (!this.canUndo(log, userId)) {
        throw new ForbiddenException('Não é possível desfazer esta alteração');
      }

      // Executar rollback baseado no tipo de entidade
      const result = await this.executeRollback(log);

      // Registrar o rollback na auditoria
      if (await this.shouldAuditAction(AuditAction.READ)) {
        await this.auditoriaService.createLog({
          acao: AuditAction.READ,
          descricao: `Rollback executado: ${log.descricao}`,
          usuarioId: userId,
          entidade: log.entidade || undefined,
          entidadeId: log.entidadeId || undefined,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Erro no rollback do log ${logId}:`, error);
      throw error;
    }
  }

  /**
   * Verifica se a alteração pode ser desfeita
   */
  private canUndo(log: Auditoria, userId: string): boolean {
    // Só permite undo para o próprio usuário ou admin
    if (log.usuario?.id !== userId) {
      // TODO: Verificar se usuário é admin
      return false;
    }

    // Só permite undo para operações de CREATE, UPDATE, DELETE
    if (
      ![
        AuditAction.CREATE,
        AuditAction.UPDATE,
        AuditAction.DELETE,
      ].includes(log.acao)
    ) {
      return false;
    }

    // Limitação temporal: só últimas 24 horas
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (log.criadoEm < twentyFourHoursAgo) {
      return false;
    }

    // Verificar se já foi feito rollback desta operação
    // TODO: Implementar verificação de rollback duplicado

    return true;
  }

  /**
   * Executa o rollback baseado no tipo de entidade
   */
  private async executeRollback(log: Auditoria): Promise<RollbackResult> {
    switch (log.entidade) {
      case 'usuarios':
        return this.rollbackUser(log);
      case 'fichas_tecnicas':
        return this.rollbackFichaTecnica(log);
      case 'configuracoes':
        return this.rollbackConfiguracao(log);
      default:
        throw new BadRequestException(
          `Rollback não suportado para entidade: ${log.entidade}`,
        );
    }
  }

  /**
   * Rollback para usuários
   */
  private async rollbackUser(log: Auditoria): Promise<RollbackResult> {
    if (!log.entidadeId) {
      throw new Error('ID da entidade é obrigatório para rollback');
    }

    switch (log.acao) {
      case AuditAction.CREATE:
        // Para CREATE, deletar o usuário criado
        await this.usuariosService.remove(log.entidadeId);
        return {
          success: true,
          message: `Usuário ${log.entidadeId} removido (rollback de criação)`,
        };

      case AuditAction.UPDATE:
        // Para UPDATE, restaurar dados anteriores
        if (log.dadosAnteriores) {
          await this.usuariosService.update(log.entidadeId, log.dadosAnteriores);
          return {
            success: true,
            message: `Usuário ${log.entidadeId} restaurado para versão anterior`,
            rolledBackData: log.dadosAnteriores,
          };
        }
        break;

      case AuditAction.DELETE:
        // Para DELETE, recriar com dados anteriores
        if (log.dadosAnteriores) {
          // TODO: Implementar recreate no UsuariosService
          return {
            success: false,
            message: 'Rollback de exclusão de usuário não implementado',
          };
        }
        break;
    }

    return {
      success: false,
      message: 'Não foi possível executar rollback para esta operação',
    };
  }

  /**
   * Rollback para fichas técnicas
   */
  private async rollbackFichaTecnica(log: Auditoria): Promise<RollbackResult> {
    if (!log.entidadeId) {
      throw new Error('ID da entidade é obrigatório para rollback');
    }

    switch (log.acao) {
      case AuditAction.CREATE:
        await this.fichaTecnicaService.remove(log.entidadeId);
        return {
          success: true,
          message: `Ficha técnica ${log.entidadeId} removida (rollback de criação)`,
        };

      case AuditAction.UPDATE:
        if (log.dadosAnteriores) {
          await this.fichaTecnicaService.update(
            log.entidadeId,
            log.dadosAnteriores,
          );
          return {
            success: true,
            message: `Ficha técnica ${log.entidadeId} restaurada para versão anterior`,
            rolledBackData: log.dadosAnteriores,
          };
        }
        break;

      case AuditAction.DELETE:
        if (log.dadosAnteriores) {
          // TODO: Implementar recreate no FichaTecnicaService
          return {
            success: false,
            message: 'Rollback de exclusão de ficha técnica não implementado',
          };
        }
        break;
    }

    return {
      success: false,
      message: 'Não foi possível executar rollback para esta operação',
    };
  }

  /**
   * Rollback para configurações
   */
  private async rollbackConfiguracao(log: Auditoria): Promise<RollbackResult> {
    switch (log.acao) {
      case AuditAction.UPDATE:
        if (log.dadosAnteriores) {
          await this.configuracaoService.update('1', log.dadosAnteriores); // ID fixo para configuração
          return {
            success: true,
            message: 'Configuração restaurada para versão anterior',
            rolledBackData: log.dadosAnteriores,
          };
        }
        break;
    }

    return {
      success: false,
      message: 'Não foi possível executar rollback para esta operação',
    };
  }

  /**
   * Lista alterações que podem ser desfeitas pelo usuário
   */
  async getUndoableChanges(userId: string): Promise<Auditoria[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.auditLogRepository.find({
      where: {
        usuario: { id: userId },
        acao: In([
          AuditAction.CREATE,
          AuditAction.UPDATE,
          AuditAction.DELETE,
        ]),
        criadoEm: MoreThanOrEqual(twentyFourHoursAgo),
      },
      order: { criadoEm: 'DESC' },
      take: 10, // Últimas 10 operações
    });
  }
}
