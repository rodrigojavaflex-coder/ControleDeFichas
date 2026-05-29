import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { WhatsappMensagem } from './entities/whatsapp-mensagem.entity';

export type PersistenciaArquivoDto = {
  arquivoConteudo: Buffer;
  arquivoExpiraEm: Date;
  temArquivo: true;
};

@Injectable()
export class WhatsappMediaStorageService {
  private readonly logger = new Logger(WhatsappMediaStorageService.name);

  constructor(private readonly config: ConfigService) {}

  /** Dias de retenção da mídia no banco (padrão 30). */
  calcularExpiraEm(): Date {
    const diasRaw = this.config.get<string>('WHATSAPP_MEDIA_RETENCAO_DIAS');
    const dias = Math.max(1, Number(diasRaw ?? 30) || 30);
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  }

  prepararPersistencia(buffer: Buffer): PersistenciaArquivoDto {
    if (!buffer?.length) {
      throw new InternalServerErrorException('Arquivo de mídia vazio.');
    }
    return {
      arquivoConteudo: buffer,
      arquivoExpiraEm: this.calcularExpiraEm(),
      temArquivo: true,
    };
  }

  arquivoDisponivel(
    m: Pick<WhatsappMensagem, 'temArquivo' | 'arquivoExpiraEm' | 'arquivoPath'>,
  ): boolean {
    if (m.temArquivo) {
      if (m.arquivoExpiraEm && m.arquivoExpiraEm.getTime() < Date.now()) {
        return false;
      }
      return true;
    }
    return !!m.arquivoPath?.trim();
  }

  async lerArquivoMensagem(m: WhatsappMensagem): Promise<Buffer | null> {
    if (!this.arquivoDisponivel(m)) {
      return null;
    }
    if (m.arquivoConteudo?.length) {
      return m.arquivoConteudo;
    }
    if (m.arquivoPath?.trim()) {
      try {
        return await readFile(
          join(process.cwd(), 'uploads', m.arquivoPath.replace(/^\//, '')),
        );
      } catch (err) {
        this.logger.warn(
          `Arquivo legado em disco não encontrado: ${m.arquivoPath}`,
          err,
        );
        return null;
      }
    }
    return null;
  }
}
