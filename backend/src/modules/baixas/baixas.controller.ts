import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BaixasService } from './baixas.service';
import { CreateBaixaDto } from './dto/create-baixa.dto';
import { UpdateBaixaDto } from './dto/update-baixa.dto';
import { FindBaixasDto } from './dto/find-baixas.dto';
import { Baixa } from './entities/baixa.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { ProcessarBaixasEmMassaDto } from './dto/processar-baixas-em-massa.dto';

@ApiTags('Baixas')
@Controller('baixas')
@ApiBearerAuth()
export class BaixasController {
  constructor(private readonly baixasService: BaixasService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_BAIXAR)
  @ApiOperation({ summary: 'Criar nova baixa' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Baixa criada com sucesso',
    type: Baixa,
  })
  create(@Body() createBaixaDto: CreateBaixaDto): Promise<Baixa> {
    return this.baixasService.create(createBaixaDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_BAIXAR)
  @ApiOperation({ summary: 'Listar baixas com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de baixas retornada com sucesso',
    type: PaginatedResponseDto<Baixa>,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'idvenda', required: false, type: String })
  @ApiQuery({ name: 'tipoDaBaixa', required: false, type: String })
  @ApiQuery({ name: 'dataInicial', required: false, type: String })
  @ApiQuery({ name: 'dataFinal', required: false, type: String })
  findAll(@Query() findBaixasDto: FindBaixasDto): Promise<PaginatedResponseDto<Baixa>> {
    return this.baixasService.findAll(findBaixasDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_BAIXAR)
  @ApiOperation({ summary: 'Buscar baixa por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Baixa encontrada',
    type: Baixa,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Baixa não encontrada',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Baixa> {
    return this.baixasService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_BAIXAR)
  @ApiOperation({ summary: 'Atualizar baixa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Baixa atualizada com sucesso',
    type: Baixa,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Baixa não encontrada',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBaixaDto: UpdateBaixaDto,
  ): Promise<Baixa> {
    return this.baixasService.update(id, updateBaixaDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_REMOVE_BAIXA)
  @ApiOperation({ summary: 'Remover baixa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Baixa removida com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Baixa não encontrada',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.baixasService.remove(id);
  }

  @Post('processamento-massa')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_BAIXAR)
  @ApiOperation({ summary: 'Processar baixas em massa para vendas selecionadas' })
  processarBaixasEmMassa(
    @Body() processarDto: ProcessarBaixasEmMassaDto,
  ): Promise<{
    sucesso: { idvenda: string; protocolo?: string; valorProcessado: number }[];
    falhas: { idvenda: string; protocolo?: string; motivo: string }[];
  }> {
    return this.baixasService.processarBaixasEmMassa(processarDto);
  }
}
