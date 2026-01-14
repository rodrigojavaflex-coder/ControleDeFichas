import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SincronizacaoConfigService } from './sincronizacao-config.service';
import { CreateSincronizacaoConfigDto } from './dto/create-sincronizacao-config.dto';
import { UpdateSincronizacaoConfigDto } from './dto/update-sincronizacao-config.dto';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';

@ApiTags('sincronizacao-config')
@Controller('sincronizacao-config')
export class SincronizacaoConfigController {
  constructor(
    private readonly configService: SincronizacaoConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar configuração de sincronização' })
  @ApiResponse({ status: 201, description: 'Configuração criada com sucesso', type: SincronizacaoConfig })
  @ApiResponse({ status: 409, description: 'Já existe configuração para este agente' })
  create(@Body() createDto: CreateSincronizacaoConfigDto) {
    return this.configService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as configurações de sincronização' })
  @ApiResponse({ status: 200, description: 'Lista de configurações', type: [SincronizacaoConfig] })
  findAll() {
    return this.configService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar configuração por ID' })
  @ApiResponse({ status: 200, description: 'Configuração encontrada', type: SincronizacaoConfig })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar configuração de sincronização' })
  @ApiResponse({ status: 200, description: 'Configuração atualizada com sucesso', type: SincronizacaoConfig })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSincronizacaoConfigDto,
  ) {
    return this.configService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover configuração de sincronização' })
  @ApiResponse({ status: 204, description: 'Configuração removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
