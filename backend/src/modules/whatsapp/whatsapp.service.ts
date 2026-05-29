import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendTemplateWithHeaderImageParams {
  to: string;
  templateName: string;
  languageCode: string;
  headerImageMediaId: string;
  bodyParams: string[];
}

@Injectable()
export class WhatsappService {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (this.config.get<string>('WHATSAPP_ENABLED') ?? 'false') === 'true';
  }

  getTemplateName(): string {
    return this.requiredEnv('WHATSAPP_TEMPLATE_RECIBO_NAME');
  }

  getTemplateLang(): string {
    return this.requiredEnv('WHATSAPP_TEMPLATE_RECIBO_LANG');
  }

  getContatoDuvidasNome(): string {
    return this.requiredEnv('WHATSAPP_CONTATO_DUVIDAS_NOME');
  }

  getContatoDuvidasNumero(): string {
    return this.requiredEnv('WHATSAPP_CONTATO_DUVIDAS_NUMERO');
  }

  /** Template utilitário: cabeçalho Imagem (recibo PNG) + corpo com variáveis. */
  async sendTemplateWithHeaderImage(params: SendTemplateWithHeaderImageParams): Promise<string> {
    if (!params.headerImageMediaId?.trim()) {
      throw new BadRequestException('Mídia do recibo não foi carregada no WhatsApp.');
    }

    const components: Array<Record<string, unknown>> = [
      {
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { id: params.headerImageMediaId },
          },
        ],
      },
    ];

    if (!params.bodyParams.length) {
      throw new BadRequestException('Parâmetros do corpo do template são obrigatórios.');
    }
    components.push({
      type: 'body',
      parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
    });

    const body = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        components,
      },
    };
    const data = await this.postJson('/messages', body);
    const messageId = data?.messages?.[0]?.id ?? '';
    if (!messageId) {
      throw new BadRequestException('WhatsApp não retornou ID da mensagem com imagem do recibo.');
    }
    return messageId;
  }

  /** Mensagem de texto livre (atendimento manual na janela 24h — RN-016). */
  async sendTextMessage(to: string, text: string): Promise<string> {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };
    return this.extractMessageId(await this.postJson('/messages', body));
  }

  async sendImageMessage(to: string, mediaId: string, caption?: string): Promise<string> {
    const image: Record<string, string> = { id: mediaId };
    if (caption?.trim()) {
      image.caption = caption.trim().slice(0, 1024);
    }
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image,
    };
    return this.extractMessageId(await this.postJson('/messages', body));
  }

  async sendAudioMessage(to: string, mediaId: string): Promise<string> {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: { id: mediaId },
    };
    return this.extractMessageId(await this.postJson('/messages', body));
  }

  async sendDocumentMessage(
    to: string,
    mediaId: string,
    filename: string,
    caption?: string,
  ): Promise<string> {
    const document: Record<string, string> = {
      id: mediaId,
      filename: filename.slice(0, 255),
    };
    if (caption?.trim()) {
      document.caption = caption.trim().slice(0, 1024);
    }
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document,
    };
    return this.extractMessageId(await this.postJson('/messages', body));
  }

  async uploadPngMedia(filename: string, content: Buffer): Promise<string> {
    return this.uploadMedia(filename, content, 'image/png');
  }

  async uploadMedia(filename: string, content: Buffer, mimeType: string): Promise<string> {
    if (!content?.length) {
      throw new BadRequestException('Arquivo de mídia está vazio.');
    }
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    const bytes = new Uint8Array(content);
    form.append('file', new Blob([bytes], { type: mimeType }), filename);
    const data = await this.postFormData('/media', form);
    const mediaId = data?.id ?? '';
    if (!mediaId) {
      throw new BadRequestException('WhatsApp não retornou ID da mídia.');
    }
    return mediaId;
  }

  async downloadMediaBuffer(
    mediaId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const meta = await this.getJson(`/${mediaId}`);
    const url = meta?.url as string | undefined;
    const mimeType = (meta?.mime_type as string | undefined) ?? 'application/octet-stream';
    if (!url) {
      throw new BadRequestException('WhatsApp não retornou URL da mídia.');
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.requiredEnv('WHATSAPP_ACCESS_TOKEN')}`,
      },
    });
    if (!response.ok) {
      throw new BadRequestException('Falha ao baixar mídia do WhatsApp.');
    }
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }

  private async getJson(path: string): Promise<any> {
    if (!this.isEnabled()) {
      throw new BadRequestException('Envio WhatsApp desativado (WHATSAPP_ENABLED=false).');
    }
    const version = this.config.get<string>('WHATSAPP_API_VERSION') ?? 'v21.0';
    const response = await fetch(
      `https://graph.facebook.com/${version}${path.startsWith('/') ? path : `/${path}`}`,
      {
        headers: {
          Authorization: `Bearer ${this.requiredEnv('WHATSAPP_ACCESS_TOKEN')}`,
        },
      },
    );
    const data = await this.parseResponse(response);
    if (!response.ok) {
      throw new BadRequestException(this.extractMetaErrorMessage(data));
    }
    return data;
  }

  private extractMessageId(data: any): string {
    const messageId = data?.messages?.[0]?.id ?? '';
    if (!messageId) {
      throw new BadRequestException('WhatsApp não retornou ID da mensagem.');
    }
    return messageId;
  }

  private async postJson(path: string, payload: unknown): Promise<any> {
    if (!this.isEnabled()) {
      throw new BadRequestException('Envio WhatsApp desativado (WHATSAPP_ENABLED=false).');
    }
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requiredEnv('WHATSAPP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await this.parseResponse(response);
    if (!response.ok) {
      throw new BadRequestException(this.extractMetaErrorMessage(data));
    }
    return data;
  }

  private async postFormData(path: string, payload: FormData): Promise<any> {
    if (!this.isEnabled()) {
      throw new BadRequestException('Envio WhatsApp desativado (WHATSAPP_ENABLED=false).');
    }
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requiredEnv('WHATSAPP_ACCESS_TOKEN')}`,
      },
      body: payload,
    });
    const data = await this.parseResponse(response);
    if (!response.ok) {
      throw new BadRequestException(this.extractMetaErrorMessage(data));
    }
    return data;
  }

  private buildUrl(path: string): string {
    const version = this.config.get<string>('WHATSAPP_API_VERSION') ?? 'v21.0';
    const phoneNumberId = this.requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
    return `https://graph.facebook.com/${version}/${phoneNumberId}${path}`;
  }

  private requiredEnv(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`Configuração ausente: ${name}`);
    }
    return value;
  }

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private extractMetaErrorMessage(data: any): string {
    const base =
      data?.error?.message ??
      data?.raw ??
      'Falha ao enviar mensagem pelo WhatsApp Business API.';
    const details = data?.error?.error_data?.details;
    if (typeof details === 'string' && details.trim()) {
      return `${base} (${details})`;
    }
    return base;
  }
}
