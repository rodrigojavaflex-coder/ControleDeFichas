import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitacaoAnaliseService } from './visitacao-analise.service';
import {
  FindVisitacaoAnaliseDto,
  FindVisitacaoAnaliseOpcoesDto,
} from './dto/find-visitacao-analise.dto';
import {
  VisitacaoAnaliseOpcoesResponseDto,
  VisitacaoAnaliseResponseDto,
} from './dto/visitacao-analise-response.dto';

@ApiTags('Visitação — Análise')
@Controller('visitacao/analise')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoAnaliseController {
  constructor(private readonly service: VisitacaoAnaliseService) {}

  @Get('opcoes')
  @Permissions(Permission.VISITACAO_ANALISE_READ)
  @ApiOperation({
    summary:
      'Competências fechadas (todos os anos) e representantes para o filtro',
  })
  @ApiResponse({ status: 200, type: VisitacaoAnaliseOpcoesResponseDto })
  opcoes(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoAnaliseOpcoesDto,
  ): Promise<VisitacaoAnaliseOpcoesResponseDto> {
    return this.service.opcoes(req.user, query);
  }

  @Get()
  @Permissions(Permission.VISITACAO_ANALISE_READ)
  @ApiOperation({
    summary:
      'Análise: comparar (c1×c2 YYYY-MM) ou ranking (competências; total/média)',
  })
  @ApiResponse({ status: 200, type: VisitacaoAnaliseResponseDto })
  analisar(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoAnaliseDto,
  ): Promise<VisitacaoAnaliseResponseDto> {
    return this.service.analisar(req.user, query);
  }
}
