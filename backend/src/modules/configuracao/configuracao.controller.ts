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
import type { AppRequest } from '../../common/types/http-request.types';
import {
  parseCreateConfiguracaoBody,
  parseUpdateConfiguracaoBody,
} from './utils/parse-configuracao-multipart.util';

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
  async create(
    @Req() req: AppRequest,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    const body = parseCreateConfiguracaoBody(
      req.body as Record<string, unknown>,
    );
    const logo =
      file?.buffer && file.mimetype
        ? { buffer: file.buffer, mime: file.mimetype }
        : undefined;
    return this.configuracaoService.create(body, req.user?.id, logo);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar configuração' })
  async findOne() {
    return this.configuracaoService.findOneWithHasLogo();
  }

  @Get('logo')
  @ApiOperation({
    summary: 'Retorna a imagem do logo (para relatórios e preview)',
  })
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
    @Req() req: AppRequest,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    const previousConfig = await this.configuracaoService.findOne();
    req.previousUserData = previousConfig;

    const body = parseUpdateConfiguracaoBody(
      req.body as Record<string, unknown>,
    );
    const logo =
      file?.buffer && file.mimetype
        ? { buffer: file.buffer, mime: file.mimetype }
        : undefined;
    return this.configuracaoService.update(id, body, req.user?.id, logo);
  }
}
