import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FolhaWhatsappAtendimentoService } from './folha-whatsapp-atendimento.service';
import { ResponderWhatsappDto } from './dto/responder-whatsapp.dto';
import { WHATSAPP_UPLOAD_MAX_BYTES } from './utils/whatsapp-media.constants';

@ApiTags('Folha — Atendimento WhatsApp')
@Controller('folha/whatsapp')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaWhatsappController {
  constructor(private readonly atendimento: FolhaWhatsappAtendimentoService) {}

  @Get('audio-gravacao/disponivel')
  @Permissions(Permission.FOLHA_WHATSAPP_READ)
  @ApiOperation({
    summary: 'Verifica se o envio de áudio gravado está disponível',
  })
  statusGravacaoAudio() {
    return this.atendimento.obterStatusGravacaoAudio();
  }

  @Get('conversas')
  @Permissions(Permission.FOLHA_WHATSAPP_READ)
  @ApiOperation({ summary: 'Inbox de conversas WhatsApp (escopo RN-007)' })
  listar(@Req() req: { user: Usuario }) {
    return this.atendimento.listarConversas(req.user);
  }

  @Get('conversas/:id')
  @Permissions(Permission.FOLHA_WHATSAPP_READ)
  @ApiOperation({ summary: 'Thread da conversa' })
  detalhe(@Req() req: { user: Usuario }, @Param('id') id: string) {
    return this.atendimento.obterConversa(req.user, id);
  }

  @Patch('conversas/:id/lida')
  @Permissions(Permission.FOLHA_WHATSAPP_READ)
  @ApiOperation({ summary: 'Marcar conversa como lida' })
  marcarLida(@Req() req: { user: Usuario }, @Param('id') id: string) {
    return this.atendimento.marcarComoLida(req.user, id);
  }

  @Post('conversas/:id/responder')
  @Permissions(Permission.FOLHA_WHATSAPP_REPLY)
  @ApiOperation({ summary: 'Enviar resposta manual de texto (janela 24h)' })
  responder(
    @Req() req: { user: Usuario },
    @Param('id') id: string,
    @Body() dto: ResponderWhatsappDto,
  ) {
    return this.atendimento.responder(req.user, id, dto.texto);
  }

  @Post('conversas/:id/anexo')
  @Permissions(Permission.FOLHA_WHATSAPP_REPLY)
  @ApiOperation({
    summary: 'Enviar imagem, áudio ou documento (janela 24h, máx. 16 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: WHATSAPP_UPLOAD_MAX_BYTES },
    }),
  )
  enviarAnexo(
    @Req() req: { user: Usuario },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('legenda') legenda?: string,
  ) {
    return this.atendimento.enviarAnexo(req.user, id, file, legenda);
  }

  @Get('mensagens/:mensagemId/arquivo')
  @Permissions(Permission.FOLHA_WHATSAPP_READ)
  @ApiOperation({ summary: 'Baixar/visualizar arquivo de uma mensagem' })
  async baixarArquivo(
    @Req() req: { user: Usuario },
    @Param('mensagemId') mensagemId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mimeType, nomeArquivo } =
      await this.atendimento.obterArquivoMensagem(req.user, mensagemId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${nomeArquivo.replace(/"/g, '')}"`,
    );
    return stream;
  }
}
