import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ComercialAcompanhamentoService } from './comercial-acompanhamento.service';
import {
  ComercialAcompanhamentoDetalheDto,
  ComercialAcompanhamentoListResponseDto,
  ComercialAcompanhamentoMeuCardDto,
  ComercialAcompanhamentoVendedorOpcaoDto,
  FindComercialAcompanhamentoDetalheDto,
  FindComercialAcompanhamentoDto,
} from './dto/comercial-acompanhamento.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class FindComercialVendedoresOpcoesDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;
}

@ApiTags('Comercial — Acompanhamento')
@Controller('comercial/acompanhamento')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ComercialAcompanhamentoController {
  constructor(private readonly service: ComercialAcompanhamentoService) {}

  @Get()
  @Permissions(Permission.COMERCIAL_ACOMPANHAMENTO_READ)
  @ApiOperation({ summary: 'Acompanhamento de vendas por vendedor' })
  @ApiResponse({ status: 200, type: ComercialAcompanhamentoListResponseDto })
  findAll(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialAcompanhamentoDto,
  ): Promise<ComercialAcompanhamentoListResponseDto> {
    return this.service.findAll(req.user, query);
  }

  @Get('meu')
  @Permissions(Permission.COMERCIAL_ACOMPANHAMENTO_HOME)
  @ApiOperation({
    summary: 'Card comercial do vendedor logado na competência atual',
  })
  @ApiResponse({ status: 200, type: ComercialAcompanhamentoMeuCardDto })
  findMeu(
    @Req() req: { user: Usuario },
  ): Promise<ComercialAcompanhamentoMeuCardDto> {
    return this.service.findMeuCard(req.user);
  }

  @Get('meu/detalhe')
  @Permissions(Permission.COMERCIAL_ACOMPANHAMENTO_HOME)
  @ApiOperation({
    summary:
      'Movimentos do vendedor logado na competência atual (card da tela inicial)',
  })
  @ApiResponse({ status: 200, type: ComercialAcompanhamentoDetalheDto })
  findMeuDetalhe(
    @Req() req: { user: Usuario },
  ): Promise<ComercialAcompanhamentoDetalheDto> {
    return this.service.findMeuDetalhe(req.user);
  }

  @Get('vendedores')
  @Permissions(Permission.COMERCIAL_ACOMPANHAMENTO_READ)
  @ApiOperation({ summary: 'Opções de vendedores vinculados para filtro' })
  @ApiResponse({ status: 200, type: [ComercialAcompanhamentoVendedorOpcaoDto] })
  listarVendedores(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialVendedoresOpcoesDto,
  ): Promise<ComercialAcompanhamentoVendedorOpcaoDto[]> {
    return this.service.listarVendedoresOpcoes(req.user, query.unidade);
  }

  @Get('detalhe')
  @Permissions(Permission.COMERCIAL_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary:
      'Movimentos do vendedor ou do TOTAL da unidade na competência (omita funcionarioId para a unidade)',
  })
  @ApiResponse({ status: 200, type: ComercialAcompanhamentoDetalheDto })
  detalhe(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialAcompanhamentoDetalheDto,
  ): Promise<ComercialAcompanhamentoDetalheDto> {
    return this.service.detalhe(req.user, query);
  }
}
