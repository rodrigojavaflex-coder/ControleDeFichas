import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappConversaService } from './whatsapp-conversa.service';
import { WhatsappMensagemDirecao } from './entities/whatsapp-mensagem.entity';
import { WhatsappMediaInboundService } from './whatsapp-media-inbound.service';
import { validarAssinaturaWebhook } from './utils/whatsapp-webhook-signature.util';
import { canonizarTelefoneWhatsappBR } from './utils/whatsapp-telefone.util';

type MetaMediaPayload = {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
};

type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: MetaMediaPayload;
  audio?: MetaMediaPayload;
  document?: MetaMediaPayload;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: MetaInboundMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
};

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly conversaService: WhatsappConversaService,
    private readonly mediaInbound: WhatsappMediaInboundService,
  ) {}

  verificarHandshake(mode: string, token: string): boolean {
    const verifyToken = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN')?.trim();
    return mode === 'subscribe' && !!verifyToken && token === verifyToken;
  }

  validarAssinaturaPost(
    rawBody: Buffer | undefined,
    assinaturaHeader: string | undefined,
  ): void {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET')?.trim();
    if (!appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET ausente — assinatura do webhook não validada (somente dev).',
      );
      return;
    }
    if (!rawBody?.length) {
      throw new ForbiddenException('Corpo da requisição inválido.');
    }
    if (!validarAssinaturaWebhook(rawBody, assinaturaHeader, appSecret)) {
      throw new ForbiddenException('Assinatura do webhook inválida.');
    }
  }

  webhookHabilitado(): boolean {
    return (
      (this.config.get<string>('WHATSAPP_WEBHOOK_ENABLED') ?? 'false') === 'true'
    );
  }

  processarPayload(payload: MetaWebhookPayload): void {
    if (!this.webhookHabilitado()) {
      this.logger.debug('Webhook desabilitado (WHATSAPP_WEBHOOK_ENABLED=false).');
      return;
    }
    const phoneNumberIdEsperado = this.config
      .get<string>('WHATSAPP_PHONE_NUMBER_ID')
      ?.trim();

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (
          phoneNumberIdEsperado &&
          phoneNumberId &&
          phoneNumberId !== phoneNumberIdEsperado
        ) {
          this.logger.warn(
            `Webhook ignorado: phone_number_id ${phoneNumberId} ≠ configurado.`,
          );
          continue;
        }

        const nomeContato = value.contacts?.[0]?.profile?.name ?? null;

        for (const msg of value.messages ?? []) {
          void this.processarMensagemEntrada(msg, nomeContato).catch((err) =>
            this.logger.error('Erro ao persistir mensagem inbound', err),
          );
        }

        for (const st of value.statuses ?? []) {
          void this.processarStatus(st).catch((err) =>
            this.logger.error('Erro ao atualizar status', err),
          );
        }
      }
    }
  }

  private async processarMensagemEntrada(
    msg: MetaInboundMessage,
    nomePerfil: string | null,
  ): Promise<void> {
    const tiposSuportados = new Set(['text', 'image', 'audio', 'document']);
    if (!tiposSuportados.has(msg.type)) {
      this.logger.log(`Mensagem inbound tipo ${msg.type} ignorada.`);
      return;
    }

    const telefone =
      canonizarTelefoneWhatsappBR(msg.from) ?? msg.from.replace(/\D/g, '');
    const metaTimestamp = new Date(Number(msg.timestamp) * 1000);

    let conteudoTexto: string | null = null;
    let legenda: string | null = null;
    let nomeArquivo: string | null = null;
    let mimeType: string | null = null;
    let metaMediaId: string | null = null;

    if (msg.type === 'text') {
      conteudoTexto = msg.text?.body ?? null;
    } else if (msg.type === 'image') {
      metaMediaId = msg.image?.id ?? null;
      mimeType = msg.image?.mime_type ?? null;
      legenda = msg.image?.caption?.trim() || null;
      conteudoTexto = legenda;
    } else if (msg.type === 'audio') {
      metaMediaId = msg.audio?.id ?? null;
      mimeType = msg.audio?.mime_type ?? null;
      nomeArquivo = 'audio.ogg';
    } else if (msg.type === 'document') {
      metaMediaId = msg.document?.id ?? null;
      mimeType = msg.document?.mime_type ?? null;
      nomeArquivo = msg.document?.filename?.trim() || 'documento';
      legenda = msg.document?.caption?.trim() || null;
      conteudoTexto = legenda;
    }

    const mensagem = await this.conversaService.registrarMensagem({
      telefoneOrigem: telefone,
      wamid: msg.id,
      direcao: WhatsappMensagemDirecao.INBOUND,
      tipo: msg.type,
      conteudoTexto,
      legenda,
      nomeArquivo,
      mimeType,
      metaMediaId,
      nomePerfil,
      metaTimestamp,
      marcarNaoLida: true,
    });

    if (mensagem && metaMediaId) {
      void this.mediaInbound.baixarEPersistir(mensagem.id, metaMediaId);
    }
  }

  private async processarStatus(st: {
    id: string;
    status: string;
    timestamp: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }): Promise<void> {
    const metaTimestamp = new Date(Number(st.timestamp) * 1000);
    const erro = st.errors?.[0];
    await this.conversaService.atualizarStatusPorWamid(
      st.id,
      st.status,
      metaTimestamp,
      erro?.code ?? null,
      erro?.message ?? erro?.title ?? null,
    );
  }
}
