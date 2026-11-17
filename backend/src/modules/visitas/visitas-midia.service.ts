import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnviarMidiaDto } from './dto/enviar-midia.dto';
import { VisitaMidia } from './entities/visita-midia.entity';
import {
  MAX_FOTOS_VISITA,
  TipoMidiaVisita,
  limiteBytes,
  mensagemLimite,
  midiaPermitida,
  mimeBase,
  nomeArquivoSeguro,
} from './visita-midia.limits';
import { VisitasService } from './visitas.service';

export interface VisitaMidiaResumo {
  id: string;
  tipo: TipoMidiaVisita;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  duracaoMs: number | null;
}

export interface VisitaMidiaArquivo {
  buffer: Buffer;
  mimeType: string;
  nomeArquivo: string;
}

@Injectable()
export class VisitasMidiaService {
  constructor(
    @InjectRepository(VisitaMidia)
    private readonly midias: Repository<VisitaMidia>,
    private readonly visitas: VisitasService,
  ) {}

  async listar(
    usuarioId: string,
    visitaId: string,
  ): Promise<VisitaMidiaResumo[]> {
    await this.visitas.exigirVisitaLegivel(usuarioId, visitaId);
    const lista = await this.midias.find({
      where: { visitaId },
      order: { criadoEm: 'ASC' },
    });
    return lista.map((item) => this.toResumo(item));
  }

  async enviar(
    usuarioId: string,
    visitaId: string,
    arquivo: Express.Multer.File | undefined,
    dto: EnviarMidiaDto,
  ): Promise<VisitaMidiaResumo> {
    await this.visitas.exigirVisitaAbertaAlteravel(usuarioId, visitaId);
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo de mídia não enviado.');
    }
    if (dto.tipo !== 'imagem' && dto.tipo !== 'audio') {
      throw new BadRequestException(
        'Somente foto e áudio são permitidos na visita.',
      );
    }
    const nome = nomeArquivoSeguro(
      arquivo.originalname,
      dto.tipo === 'audio' ? 'audio.m4a' : 'foto.jpg',
    );
    const mime = mimeBase(arquivo.mimetype);
    if (!midiaPermitida(dto.tipo, mime || arquivo.mimetype, nome)) {
      throw new BadRequestException('Tipo de arquivo não permitido.');
    }
    if (arquivo.size > limiteBytes(dto.tipo)) {
      throw new BadRequestException(mensagemLimite(dto.tipo));
    }
    if (dto.tipo === 'imagem') {
      const fotos = await this.midias.count({
        where: { visitaId, tipo: 'imagem' },
      });
      if (fotos >= MAX_FOTOS_VISITA) {
        throw new BadRequestException('A visita aceita no máximo 10 fotos.');
      }
    }

    const salva = await this.midias.save(
      this.midias.create({
        visitaId,
        tipo: dto.tipo,
        nomeArquivo: nome,
        mimeType: mime || 'application/octet-stream',
        tamanho: arquivo.size,
        dadosBytea: arquivo.buffer,
        duracaoMs: dto.tipo === 'audio' ? (dto.duracaoMs ?? null) : null,
      }),
    );
    return this.toResumo(salva);
  }

  async ler(
    usuarioId: string,
    visitaId: string,
    midiaId: string,
  ): Promise<VisitaMidiaArquivo> {
    await this.visitas.exigirVisitaLegivel(usuarioId, visitaId);
    const midia = await this.midias
      .createQueryBuilder('m')
      .addSelect('m.dadosBytea')
      .where('m.id = :midiaId', { midiaId })
      .andWhere('m.visitaId = :visitaId', { visitaId })
      .getOne();
    if (!midia?.dadosBytea?.length) {
      throw new NotFoundException('Mídia não encontrada.');
    }
    return {
      buffer: midia.dadosBytea,
      mimeType: midia.mimeType,
      nomeArquivo: midia.nomeArquivo,
    };
  }

  async excluir(
    usuarioId: string,
    visitaId: string,
    midiaId: string,
  ): Promise<void> {
    await this.visitas.exigirVisitaAbertaAlteravel(usuarioId, visitaId);
    const midia = await this.midias.findOne({
      where: { id: midiaId, visitaId },
    });
    if (!midia) {
      throw new NotFoundException('Mídia não encontrada.');
    }
    await this.midias.delete(midia.id);
  }

  private toResumo(midia: VisitaMidia): VisitaMidiaResumo {
    return {
      id: midia.id,
      tipo: midia.tipo,
      nomeArquivo: midia.nomeArquivo,
      mimeType: midia.mimeType,
      tamanho: Number(midia.tamanho),
      duracaoMs: midia.duracaoMs,
    };
  }
}
