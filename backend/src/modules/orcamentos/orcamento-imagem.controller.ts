import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type * as express from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  GerarOrcamentoImagemDto,
  OrcamentoImagemResponseDto,
} from './dto/gerar-orcamento-imagem.dto';
import { OrcamentoImagemService } from './orcamento-imagem.service';

@ApiTags('Orçamentos')
@Controller('orcamentos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class OrcamentoImagemController {
  constructor(private readonly service: OrcamentoImagemService) {}

  @Post('imagem')
  @Permissions(Permission.ORCAMENTO_IMAGEM_GERAR)
  @ApiOperation({
    summary: 'Monta os dados da imagem do orçamento a partir do ERP',
  })
  @ApiResponse({ status: 200, type: OrcamentoImagemResponseDto })
  gerar(
    @Body() dto: GerarOrcamentoImagemDto,
    @Req() req: { user: Usuario },
  ): Promise<OrcamentoImagemResponseDto> {
    return this.service.gerar(dto, req.user);
  }

  @Get('imagem-faixa')
  @Permissions(Permission.ORCAMENTO_IMAGEM_GERAR)
  @ApiOperation({ summary: 'PNG de topo ou rodapé da imagem do orçamento' })
  async obterFaixa(
    @Query('unidade') unidade: string,
    @Query('tipo') tipo: string,
    @Req() req: { user: Usuario },
    @Res() res: express.Response,
  ): Promise<void> {
    const faixa = await this.service.obterFaixa(req.user, unidade, tipo);
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(faixa.mime).send(faixa.buffer);
  }

  @Put('imagem-faixa')
  @Permissions(Permission.ORCAMENTO_IMAGEM_UPDATE)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        unidade: { type: 'string' },
        tipo: { type: 'string', enum: ['TOPO', 'RODAPE'] },
        arquivo: { type: 'string', format: 'binary' },
      },
      required: ['unidade', 'tipo', 'arquivo'],
    },
  })
  @ApiOperation({ summary: 'Grava o PNG de topo ou rodapé da unidade' })
  salvarFaixa(
    @Body('unidade') unidade: string,
    @Body('tipo') tipo: string,
    @UploadedFile() arquivo: { buffer: Buffer; mimetype: string } | undefined,
    @Req() req: { user: Usuario },
  ): Promise<{ unidade: string; tipo: string }> {
    return this.service.salvarFaixa(req.user, unidade, tipo, arquivo);
  }
}
