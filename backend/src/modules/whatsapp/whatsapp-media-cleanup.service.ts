import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappMensagem } from './entities/whatsapp-mensagem.entity';

@Injectable()
export class WhatsappMediaCleanupService {
  private readonly logger = new Logger(WhatsappMediaCleanupService.name);

  constructor(
    @InjectRepository(WhatsappMensagem)
    private readonly mensagemRepo: Repository<WhatsappMensagem>,
  ) {}

  /** Remove conteúdo binário expirado (metadados da mensagem permanecem). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarMidiaExpirada(): Promise<void> {
    const agora = new Date();
    try {
      const result = await this.mensagemRepo
        .createQueryBuilder()
        .update(WhatsappMensagem)
        .set({ arquivoConteudo: null, temArquivo: false })
        .where('"temArquivo" = :sim', { sim: true })
        .andWhere('"arquivoExpiraEm" IS NOT NULL')
        .andWhere('"arquivoExpiraEm" < :agora', { agora })
        .andWhere('"arquivoConteudo" IS NOT NULL')
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Mídia WhatsApp expirada removida do banco: ${result.affected} mensagem(ns).`,
        );
      }
    } catch (err) {
      this.logger.error('Erro ao purgar mídia WhatsApp expirada', err);
    }
  }
}
