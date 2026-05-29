import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappMensagem } from './entities/whatsapp-mensagem.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMediaStorageService } from './whatsapp-media-storage.service';

@Injectable()
export class WhatsappMediaInboundService {
  private readonly logger = new Logger(WhatsappMediaInboundService.name);

  constructor(
    @InjectRepository(WhatsappMensagem)
    private readonly mensagemRepo: Repository<WhatsappMensagem>,
    private readonly whatsappService: WhatsappService,
    private readonly storage: WhatsappMediaStorageService,
  ) {}

  async baixarEPersistir(mensagemId: string, metaMediaId: string): Promise<void> {
    try {
      const { buffer, mimeType } =
        await this.whatsappService.downloadMediaBuffer(metaMediaId);
      const mime = mimeType.toLowerCase().split(';')[0].trim();
      const persistencia = this.storage.prepararPersistencia(buffer);
      await this.mensagemRepo.update(mensagemId, {
        mimeType: mime,
        ...persistencia,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao baixar mídia inbound mensagem=${mensagemId} media=${metaMediaId}`,
        err,
      );
    }
  }
}
