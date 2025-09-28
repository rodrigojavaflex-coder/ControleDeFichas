import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Req,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { RollbackService } from '../../common/services/rollback.service';
import { AuditAction } from '../../common/enums/auditoria.enum';
import { FindAuditoriaDto } from './dto/find-auditoria.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracao } from '../configuracao/entities/configuracao.entity';
import { Auditoria } from './entities/auditoria.entity';

@ApiTags('auditoria')
@Controller('auditoria')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AuditoriaController {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly rollbackService: RollbackService,
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

  @Get()
  @ApiOperation({
    summary: 'Buscar logs de auditoria',
    description:
      'Consulta os logs de auditoria do sistema (requer permissões administrativas)',
  })
  @ApiResponse({
    status: 200,
    description: 'Logs de auditoria retornados com sucesso',
  })
  async findAll(@Query() findDto: FindAuditoriaDto, @Req() req: Request & { user: Usuario }): Promise<any> {
    // Auditar acesso aos logs de auditoria
    if (await this.shouldAuditAction(AuditAction.READ)) {
      await this.auditoriaService.createLog({
        acao: AuditAction.READ,
        descricao: `Consulta aos logs de auditoria realizada`,
        usuarioId: req.user?.id,
        entidade: 'audit_logs',
      });
    }

    return this.auditoriaService.findLogs(findDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar log de auditoria por ID',
    description:
      'Consulta um log específico de auditoria (requer permissões administrativas)',
  })
  @ApiResponse({
    status: 200,
    description: 'Log de auditoria encontrado',
  })
  async findOne(@Param('id') id: string, @Req() req: Request & { user: Usuario }): Promise<Auditoria | null> {
    // Auditar acesso aos logs de auditoria
    if (await this.shouldAuditAction(AuditAction.READ)) {
      await this.auditoriaService.createLog({
        acao: AuditAction.READ,
        descricao: `Consulta ao log de auditoria ${id} realizada`,
        usuarioId: req.user?.id,
        entidade: 'audit_logs',
      });
    }

    return this.auditoriaService.findLogById(id);
  }

  @Get('undoable')
  @ApiOperation({
    summary: 'Listar alterações que podem ser desfeitas',
    description:
      'Retorna as últimas alterações do usuário que podem ser desfeitas (últimas 24h)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de alterações que podem ser desfeitas',
  })
  async getUndoableChanges(@Req() req: Request & { user: Usuario }): Promise<any> {
    return this.rollbackService.getUndoableChanges(req.user?.id);
  }

  @Post(':id/undo')
  @ApiOperation({
    summary: 'Desfazer uma alteração',
    description:
      'Executa rollback de uma alteração baseada no log de auditoria',
  })
  @ApiResponse({
    status: 200,
    description: 'Rollback executado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Log não encontrado ou rollback não possível',
  })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para desfazer esta alteração',
  })
  async undoChange(@Param('id') logId: string, @Req() req: Request & { user: Usuario }): Promise<any> {
    return this.rollbackService.undoChange(logId, req.user?.id);
  }
}
