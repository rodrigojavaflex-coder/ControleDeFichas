import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Put,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfiguracaoService } from './configuracao.service';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('configuracao')
@Controller('configuracao')
export class ConfiguracaoController {
  constructor(private readonly configuracaoService: ConfiguracaoService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('logoRelatorio', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateConfiguracaoDto })
  async create(
    @UploadedFile() file?: any,
    @Req() req?: any,
  ) {
    // Processar FormData manualmente
    const body: CreateConfiguracaoDto = {
      nomeCliente: req.body.nomeCliente,
      farmaceuticoResponsavel: req.body.farmaceuticoResponsavel,
      logoRelatorio: file ? `/uploads/${file.filename}` : undefined,
      // Processar campos booleanos - converter strings para booleanos
      auditarConsultas: req.body.auditarConsultas ? req.body.auditarConsultas === 'true' : true,
      auditarLoginLogOff: req.body.auditarLoginLogOff ? req.body.auditarLoginLogOff === 'true' : true,
      auditarCriacao: req.body.auditarCriacao ? req.body.auditarCriacao === 'true' : true,
      auditarAlteracao: req.body.auditarAlteracao ? req.body.auditarAlteracao === 'true' : true,
      auditarExclusao: req.body.auditarExclusao ? req.body.auditarExclusao === 'true' : true,
      auditarSenhaAlterada: req.body.auditarSenhaAlterada ? req.body.auditarSenhaAlterada === 'true' : true,
    };

    return this.configuracaoService.create(body, req?.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar configuração' })
  async findOne() {
    return this.configuracaoService.findOne();
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('logoRelatorio', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateConfiguracaoDto })
  async update(
    @Param('id') id: string,
    @UploadedFile() file?: any,
    @Req() req?: any,
  ) {
    // Capturar dados anteriores para auditoria
    const previousConfig = await this.configuracaoService.findOne();
    (req as any).previousUserData = previousConfig;
    
    // Processar FormData manualmente
    const body: UpdateConfiguracaoDto = {
      nomeCliente: req.body.nomeCliente,
      farmaceuticoResponsavel: req.body.farmaceuticoResponsavel,
      logoRelatorio: file ? `/uploads/${file.filename}` : undefined,
      // Processar campos booleanos - converter strings para booleanos
      auditarConsultas: req.body.auditarConsultas ? req.body.auditarConsultas === 'true' : undefined,
      auditarLoginLogOff: req.body.auditarLoginLogOff ? req.body.auditarLoginLogOff === 'true' : undefined,
      auditarCriacao: req.body.auditarCriacao ? req.body.auditarCriacao === 'true' : undefined,
      auditarAlteracao: req.body.auditarAlteracao ? req.body.auditarAlteracao === 'true' : undefined,
      auditarExclusao: req.body.auditarExclusao ? req.body.auditarExclusao === 'true' : undefined,
      auditarSenhaAlterada: req.body.auditarSenhaAlterada ? req.body.auditarSenhaAlterada === 'true' : undefined,
    };

    return this.configuracaoService.update(id, body, req?.user?.id);
  }
}
