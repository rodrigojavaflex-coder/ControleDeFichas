import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { mkdtemp, readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Mensagem funcional ao usuário — sem detalhes técnicos de infraestrutura. */
const MSG_AUDIO_INDISPONIVEL =
  'Envio de áudio gravado temporariamente indisponível. Tente novamente em instantes ou envie texto, imagem ou documento.';

const MSG_AUDIO_FALHA_ENVIO =
  'Não foi possível enviar o áudio gravado. Tente gravar novamente.';

export type AudioGravacaoStatusDto = {
  disponivel: boolean;
  motivo: string | null;
};

@Injectable()
export class WhatsappAudioConvertService {
  private readonly logger = new Logger(WhatsappAudioConvertService.name);
  private ffmpegDisponivelCache: boolean | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Caminho do conversor (env > pacote embutido > PATH). Uso interno — não expor ao usuário. */
  getFfmpegPath(): string {
    const fromEnv = this.config.get<string>('WHATSAPP_FFMPEG_PATH')?.trim();
    if (fromEnv) return fromEnv;
    if (typeof ffmpegStatic === 'string' && ffmpegStatic.trim()) {
      return ffmpegStatic;
    }
    return 'ffmpeg';
  }

  precisaConverter(mimeType: string): boolean {
    const m = mimeType.toLowerCase().split(';')[0].trim();
    return m === 'audio/webm' || m === 'video/webm';
  }

  async obterStatusGravacao(): Promise<AudioGravacaoStatusDto> {
    const disponivel = await this.ffmpegInstalado();
    return {
      disponivel,
      motivo: disponivel ? null : MSG_AUDIO_INDISPONIVEL,
    };
  }

  async assertFfmpegDisponivel(): Promise<void> {
    if (!(await this.ffmpegInstalado())) {
      throw new BadRequestException(MSG_AUDIO_INDISPONIVEL);
    }
  }

  async converterParaOggOpus(input: Buffer, mimeType: string): Promise<Buffer> {
    if (!this.precisaConverter(mimeType)) {
      return input;
    }

    await this.assertFfmpegDisponivel();

    const ffmpeg = this.getFfmpegPath();
    const dir = await mkdtemp(join(tmpdir(), 'wa-audio-'));
    const entrada = join(dir, 'entrada.webm');
    const saida = join(dir, 'saida.ogg');

    try {
      await writeFile(entrada, input);
      await execFileAsync(
        ffmpeg,
        ['-y', '-i', entrada, '-c:a', 'libopus', '-b:a', '64k', saida],
        { timeout: 120_000 },
      );
      return await readFile(saida);
    } catch (err) {
      this.logger.error(
        `Falha ao converter áudio gravado (conversor: ${ffmpeg})`,
        err,
      );
      throw new BadRequestException(this.mapConversionError(err));
    } finally {
      await unlink(entrada).catch(() => undefined);
      await unlink(saida).catch(() => undefined);
    }
  }

  private async ffmpegInstalado(): Promise<boolean> {
    if (this.ffmpegDisponivelCache !== null) {
      return this.ffmpegDisponivelCache;
    }
    const ffmpeg = this.getFfmpegPath();
    try {
      await execFileAsync(ffmpeg, ['-version'], { timeout: 10_000 });
      this.ffmpegDisponivelCache = true;
    } catch (err) {
      this.logger.error(`Conversor de áudio indisponível (${ffmpeg})`, err);
      this.ffmpegDisponivelCache = false;
    }
    return this.ffmpegDisponivelCache;
  }

  private mapConversionError(err: unknown): string {
    if (
      !!err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      this.ffmpegDisponivelCache = false;
      return MSG_AUDIO_INDISPONIVEL;
    }
    return MSG_AUDIO_FALHA_ENVIO;
  }
}
