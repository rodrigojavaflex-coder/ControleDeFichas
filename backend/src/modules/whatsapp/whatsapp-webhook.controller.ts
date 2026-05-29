import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { RawBodyRequest } from '@nestjs/common/interfaces/http/raw-body-request.interface';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@ApiTags('WhatsApp — Webhook')
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(private readonly webhookService: WhatsappWebhookService) {}

  @Get()
  @ApiOperation({ summary: 'Verificação do webhook Meta (hub.challenge)' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    if (this.webhookService.verificarHandshake(mode, token)) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    throw new ForbiddenException('Token de verificação inválido.');
  }

  @Post()
  @ApiOperation({ summary: 'Recebimento de eventos Meta (mensagens e status)' })
  handlePost(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') assinatura: string | undefined,
  ): { ok: true } {
    this.webhookService.validarAssinaturaPost(req.rawBody, assinatura);
    this.webhookService.processarPayload(req.body);
    return { ok: true };
  }
}
