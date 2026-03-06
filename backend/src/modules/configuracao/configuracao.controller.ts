import {
  Controller,
  Post,
  Get,
  Param,
  Put,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import * as express from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfiguracaoService } from './configuracao.service';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiTags('configuracao')
@Controller('configuracao')
export class ConfiguracaoController {
  constructor(private readonly configuracaoService: ConfiguracaoService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('logoRelatorio', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateConfiguracaoDto })
  async create(@UploadedFile() file?: { buffer: Buffer; mimetype: string }, @Req() req?: any) {
    const body: CreateConfiguracaoDto = {
      nomeCliente: req.body.nomeCliente,
      farmaceuticoResponsavel: req.body.farmaceuticoResponsavel,
      auditarConsultas: req.body.auditarConsultas != null ? req.body.auditarConsultas === 'true' : true,
      auditarLoginLogOff: req.body.auditarLoginLogOff != null ? req.body.auditarLoginLogOff === 'true' : true,
      auditarCriacao: req.body.auditarCriacao != null ? req.body.auditarCriacao === 'true' : true,
      auditarAlteracao: req.body.auditarAlteracao != null ? req.body.auditarAlteracao === 'true' : true,
      auditarExclusao: req.body.auditarExclusao != null ? req.body.auditarExclusao === 'true' : true,
      auditarSenhaAlterada: req.body.auditarSenhaAlterada != null ? req.body.auditarSenhaAlterada === 'true' : true,
    };
    const logo =
      file?.buffer && file.mimetype
        ? { buffer: file.buffer, mime: file.mimetype }
        : undefined;
    return this.configuracaoService.create(body, req?.user?.id, logo);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar configuração' })
  async findOne() {
    return this.configuracaoService.findOneWithHasLogo();
  }

  @Get('logo')
  @ApiOperation({ summary: 'Retorna a imagem do logo (para relatórios e preview)' })
  async getLogo(@Res() res: express.Response) {
    const logo = await this.configuracaoService.getLogo();
    if (!logo) throw new NotFoundException('Logo não configurado');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.type(logo.mime).send(logo.buffer);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('logoRelatorio', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateConfiguracaoDto })
  async update(
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
    @Req() req?: any,
  ) {
    const previousConfig = await this.configuracaoService.findOne();
    (req as any).previousUserData = previousConfig;

    const body: UpdateConfiguracaoDto = {
      nomeCliente: req.body.nomeCliente,
      farmaceuticoResponsavel: req.body.farmaceuticoResponsavel,
      auditarConsultas: req.body.auditarConsultas === 'true' ? true : undefined,
      auditarLoginLogOff: req.body.auditarLoginLogOff === 'true' ? true : undefined,
      auditarCriacao: req.body.auditarCriacao === 'true' ? true : undefined,
      auditarAlteracao: req.body.auditarAlteracao === 'true' ? true : undefined,
      auditarExclusao: req.body.auditarExclusao === 'true' ? true : undefined,
      auditarSenhaAlterada: req.body.auditarSenhaAlterada === 'true' ? true : undefined,
    };
    const logo =
      file?.buffer && file.mimetype
        ? { buffer: file.buffer, mime: file.mimetype }
        : undefined;
    return this.configuracaoService.update(id, body, req?.user?.id, logo);
  }
}
