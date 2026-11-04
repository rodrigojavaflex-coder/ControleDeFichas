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
import { ComercialAnaliseService } from './comercial-analise.service';
import {
  FindComercialAnaliseDto,
  FindComercialAnaliseOpcoesDto,
} from './dto/find-comercial-analise.dto';
import {
  ComercialAnaliseOpcoesResponseDto,
  ComercialAnaliseResponseDto,
} from './dto/comercial-analise-response.dto';
import { ComercialAnaliseHomeResponseDto } from './dto/comercial-analise-home.dto';

@ApiTags('Comercial — Análise')
@Controller('comercial/analise')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ComercialAnaliseController {
  constructor(private readonly service: ComercialAnaliseService) {}

  @Get('opcoes')
  @Permissions(Permission.COMERCIAL_ANALISE_READ)
  @ApiOperation({
    summary:
      'Competências com movimento, semanas da competência (padrão = última com valor) e vendedores',
  })
  @ApiResponse({ status: 200, type: ComercialAnaliseOpcoesResponseDto })
  opcoes(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialAnaliseOpcoesDto,
  ): Promise<ComercialAnaliseOpcoesResponseDto> {
    return this.service.opcoes(
      req.user,
      query.unidade,
      query.competenciaSemanas,
    );
  }

  @Get('home')
  @Permissions(Permission.COMERCIAL_ANALISE_HOME)
  @ApiOperation({
    summary:
      'Resumo da home: Δ das 2 últimas semanas fechadas (RN-COM-009)',
  })
  @ApiResponse({ status: 200, type: ComercialAnaliseHomeResponseDto })
  home(
    @Req() req: { user: Usuario },
  ): Promise<ComercialAnaliseHomeResponseDto> {
    return this.service.resumoHome(req.user);
  }

  @Get()
  @Permissions(Permission.COMERCIAL_ANALISE_READ)
  @ApiOperation({
    summary:
      'Análise comercial (dimensao vendedor|unidade): comparar, ranking, evolução ou semanas',
  })
  @ApiResponse({ status: 200, type: ComercialAnaliseResponseDto })
  analisar(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialAnaliseDto,
  ): Promise<ComercialAnaliseResponseDto> {
    return this.service.analisar(req.user, query);
  }
}
