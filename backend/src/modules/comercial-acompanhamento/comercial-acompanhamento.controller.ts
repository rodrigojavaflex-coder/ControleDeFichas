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
  ComercialAcompanhamentoListResponseDto,
  ComercialAcompanhamentoVendedorOpcaoDto,
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
}
