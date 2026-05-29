import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversa } from './entities/whatsapp-conversa.entity';
import {
  WhatsappMensagem,
  WhatsappMensagemDirecao,
} from './entities/whatsapp-mensagem.entity';
import { WhatsappConversaService } from './whatsapp-conversa.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMediaStorageService } from './whatsapp-media-storage.service';
import { WhatsappAudioConvertService } from './whatsapp-audio-convert.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  getUsuarioPermissoes,
  usuarioTemAdminFull,
} from '../../common/utils/usuario-permissoes.util';
import { Permission } from '../../common/enums/permission.enum';
import { unidadeEscopoUsuarioFolha } from '../folha/utils/folha-unidade-scope.util';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  WHATSAPP_UPLOAD_MAX_BYTES,
  categoriaPorMime,
  extensaoSegura,
  mimePermitidoParaEnvio,
  rotuloPreviewTipo,
  WHATSAPP_EXT_DOCUMENT,
} from './utils/whatsapp-media.constants';
import { WHATSAPP_MENSAGEM_SELECT_THREAD } from './utils/whatsapp-mensagem-select.util';
import { formatarTelefoneExibicaoBR } from './utils/whatsapp-telefone.util';

const JANELA_24H_MS = 24 * 60 * 60 * 1000;

export type WhatsappConversaListaDto = {
  id: string;
  telefoneMascarado: string;
  telefoneExibicao: string;
  nomeExibicao: string;
  identificado: boolean;
  unidade: Unidade | null;
  naoLida: boolean;
  ultimaMensagemEm: string | null;
  ultimaMensagemPreview: string | null;
  janela24hAberta: boolean;
};

export type WhatsappMensagemDto = {
  id: string;
  direcao: WhatsappMensagemDirecao;
  tipo: string;
  conteudoTexto: string | null;
  nomeArquivo: string | null;
  mimeType: string | null;
  legenda: string | null;
  arquivoDisponivel: boolean;
  status: string | null;
  metaTimestamp: string;
  folhaCapaId: string | null;
  usuarioRespostaNome: string | null;
};

export type WhatsappConversaDetalheDto = {
  conversa: WhatsappConversaListaDto;
  mensagens: WhatsappMensagemDto[];
};

@Injectable()
export class FolhaWhatsappAtendimentoService {
  constructor(
    @InjectRepository(WhatsappConversa)
    private readonly conversaRepo: Repository<WhatsappConversa>,
    @InjectRepository(WhatsappMensagem)
    private readonly mensagemRepo: Repository<WhatsappMensagem>,
    private readonly conversaService: WhatsappConversaService,
    private readonly whatsappService: WhatsappService,
    private readonly mediaStorage: WhatsappMediaStorageService,
    private readonly audioConvert: WhatsappAudioConvertService,
  ) {}

  async listarConversas(usuario: Usuario): Promise<WhatsappConversaListaDto[]> {
    const qb = this.conversaRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.funcionario', 'f')
      .orderBy('c.naoLida', 'DESC')
      .addOrderBy('c.ultimaMensagemEm', 'DESC', 'NULLS LAST');

    this.aplicarEscopoConversas(usuario, qb);

    const conversas = await qb.getMany();
    const resultado: WhatsappConversaListaDto[] = [];
    for (const c of conversas) {
      resultado.push(await this.mapConversaLista(c));
    }
    return resultado;
  }

  async obterConversa(
    usuario: Usuario,
    conversaId: string,
  ): Promise<WhatsappConversaDetalheDto> {
    const conversa = await this.buscarConversaComEscopo(usuario, conversaId);
    const mensagens = await this.mensagemRepo.find({
      where: { conversaId: conversa.id },
      relations: ['usuarioResposta'],
      order: { metaTimestamp: 'ASC' },
      select: WHATSAPP_MENSAGEM_SELECT_THREAD,
    });
    return {
      conversa: await this.mapConversaLista(conversa),
      mensagens: mensagens.map((m) => this.mapMensagem(m)),
    };
  }

  async marcarComoLida(usuario: Usuario, conversaId: string): Promise<void> {
    const conversa = await this.buscarConversaComEscopo(usuario, conversaId);
    conversa.naoLida = false;
    await this.conversaRepo.save(conversa);
  }

  obterStatusGravacaoAudio() {
    return this.audioConvert.obterStatusGravacao();
  }

  async responder(
    usuario: Usuario,
    conversaId: string,
    texto: string,
  ): Promise<WhatsappMensagemDto> {
    if (
      !usuarioTemAdminFull(usuario) &&
      !getUsuarioPermissoes(usuario).includes(Permission.FOLHA_WHATSAPP_READ)
    ) {
      throw new ForbiddenException(
        'Permissão folha-whatsapp:read necessária para responder.',
      );
    }
    const conversa = await this.buscarConversaComEscopo(usuario, conversaId);
    const corpo = texto?.trim();
    if (!corpo) {
      throw new BadRequestException('Informe o texto da mensagem.');
    }
    if (corpo.length > 4096) {
      throw new BadRequestException('Mensagem excede o limite de 4096 caracteres.');
    }

    const janelaAberta = await this.calcularJanela24hAberta(conversa.id);
    if (!janelaAberta) {
      throw new BadRequestException(
        'Janela de 24 horas encerrada. Aguarde nova mensagem do funcionário para responder (RN-016.11).',
      );
    }

    const wamid = await this.whatsappService.sendTextMessage(
      conversa.telefoneOrigem,
      corpo,
    );

    const mensagem = await this.conversaService.registrarMensagem({
      telefoneOrigem: conversa.telefoneOrigem,
      wamid,
      direcao: WhatsappMensagemDirecao.OUTBOUND,
      tipo: 'text',
      conteudoTexto: corpo,
      status: 'sent',
      usuarioRespostaId: usuario.id,
      metaTimestamp: new Date(),
      marcarNaoLida: false,
    });

    if (!mensagem) {
      throw new BadRequestException('Não foi possível registrar a resposta.');
    }

    mensagem.usuarioResposta = usuario;
    return this.mapMensagem(mensagem);
  }

  async enviarAnexo(
    usuario: Usuario,
    conversaId: string,
    file: Express.Multer.File,
    legenda?: string,
  ): Promise<WhatsappMensagemDto> {
    this.exigirPermissaoReply(usuario);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Selecione um arquivo para enviar.');
    }
    if (file.size > WHATSAPP_UPLOAD_MAX_BYTES) {
      throw new BadRequestException('Arquivo excede o limite de 16 MB.');
    }

    const mime = (file.mimetype ?? '').toLowerCase().split(';')[0].trim();
    if (!mimePermitidoParaEnvio(mime)) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Envie imagem (JPEG/PNG), áudio ou documento (PDF, DOCX, XLSX).',
      );
    }

    const categoria = categoriaPorMime(mime)!;
    if (categoria === 'document') {
      const ext = extensaoSegura(file.originalname ?? '');
      if (!WHATSAPP_EXT_DOCUMENT.has(ext)) {
        throw new BadRequestException(
          'Documento deve ser PDF, DOC, DOCX, XLS ou XLSX.',
        );
      }
    }

    const conversa = await this.buscarConversaComEscopo(usuario, conversaId);
    const janelaAberta = await this.calcularJanela24hAberta(conversa.id);
    if (!janelaAberta) {
      throw new BadRequestException(
        'Janela de 24 horas encerrada. Aguarde nova mensagem do funcionário para responder (RN-016).',
      );
    }

    if (categoria === 'audio' && this.audioConvert.precisaConverter(mime)) {
      await this.audioConvert.assertFfmpegDisponivel();
    }

    let buffer = file.buffer;
    let mimeEnvio = mime;
    let nomeArquivo = this.sanitizarNomeArquivo(file.originalname ?? 'arquivo');

    if (categoria === 'audio') {
      buffer = await this.audioConvert.converterParaOggOpus(buffer, mime);
      mimeEnvio = 'audio/ogg';
      if (!nomeArquivo.toLowerCase().endsWith('.ogg')) {
        nomeArquivo = `${nomeArquivo.replace(/\.[^.]+$/, '') || 'audio'}.ogg`;
      }
    }

    const persistencia = this.mediaStorage.prepararPersistencia(buffer);
    const metaMediaId = await this.whatsappService.uploadMedia(
      nomeArquivo,
      buffer,
      mimeEnvio,
    );

    const legendaLimpa = legenda?.trim().slice(0, 1024) || null;
    let wamid: string;
    if (categoria === 'image') {
      wamid = await this.whatsappService.sendImageMessage(
        conversa.telefoneOrigem,
        metaMediaId,
        legendaLimpa ?? undefined,
      );
    } else if (categoria === 'audio') {
      wamid = await this.whatsappService.sendAudioMessage(
        conversa.telefoneOrigem,
        metaMediaId,
      );
    } else {
      wamid = await this.whatsappService.sendDocumentMessage(
        conversa.telefoneOrigem,
        metaMediaId,
        nomeArquivo,
        legendaLimpa ?? undefined,
      );
    }

    const mensagem = await this.conversaService.registrarMensagem({
      telefoneOrigem: conversa.telefoneOrigem,
      wamid,
      direcao: WhatsappMensagemDirecao.OUTBOUND,
      tipo: categoria,
      conteudoTexto: legendaLimpa,
      legenda: legendaLimpa,
      nomeArquivo,
      mimeType: mimeEnvio,
      metaMediaId,
      ...persistencia,
      status: 'sent',
      usuarioRespostaId: usuario.id,
      metaTimestamp: new Date(),
      marcarNaoLida: false,
    });

    if (!mensagem) {
      throw new BadRequestException('Não foi possível registrar o anexo.');
    }

    mensagem.usuarioResposta = usuario;
    return this.mapMensagem(mensagem);
  }

  async obterArquivoMensagem(
    usuario: Usuario,
    mensagemId: string,
  ): Promise<{ stream: StreamableFile; mimeType: string; nomeArquivo: string }> {
    const mensagem = await this.mensagemRepo.findOne({
      where: { id: mensagemId },
      relations: ['conversa', 'conversa.funcionario'],
    });
    if (!mensagem || !this.mediaStorage.arquivoDisponivel(mensagem)) {
      throw new NotFoundException('Arquivo da mensagem não encontrado ou expirado.');
    }

    await this.buscarConversaComEscopo(usuario, mensagem.conversaId);
    const buffer = await this.mediaStorage.lerArquivoMensagem(mensagem);
    if (!buffer?.length) {
      throw new NotFoundException('Arquivo da mensagem não encontrado ou expirado.');
    }
    const mimeType = mensagem.mimeType ?? 'application/octet-stream';
    const nomeArquivo = mensagem.nomeArquivo ?? 'arquivo';
    return {
      stream: new StreamableFile(buffer, {
        type: mimeType,
        disposition: `inline; filename="${nomeArquivo.replace(/"/g, '')}"`,
      }),
      mimeType,
      nomeArquivo,
    };
  }

  private exigirPermissaoReply(usuario: Usuario): void {
    if (
      !usuarioTemAdminFull(usuario) &&
      !getUsuarioPermissoes(usuario).includes(Permission.FOLHA_WHATSAPP_REPLY)
    ) {
      throw new ForbiddenException(
        'Permissão folha-whatsapp:reply necessária para enviar anexos.',
      );
    }
  }

  private sanitizarNomeArquivo(nome: string): string {
    const base = nome.split(/[/\\]/).pop()?.trim() || 'arquivo';
    return base.replace(/[^\w.\-() áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_').slice(0, 200);
  }

  private aplicarEscopoConversas(
    usuario: Usuario,
    qb: ReturnType<Repository<WhatsappConversa>['createQueryBuilder']>,
  ): void {
    if (usuarioTemAdminFull(usuario)) {
      return;
    }
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    if (!escopo) {
      return;
    }
    qb.andWhere('(c.funcionarioId IS NULL OR f.unidade = :escopo)', { escopo });
  }

  private async buscarConversaComEscopo(
    usuario: Usuario,
    conversaId: string,
  ): Promise<WhatsappConversa> {
    const qb = this.conversaRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.funcionario', 'f')
      .where('c.id = :conversaId', { conversaId });

    this.aplicarEscopoConversas(usuario, qb);
    const conversa = await qb.getOne();
    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada ou sem permissão.');
    }
    return conversa;
  }

  private async calcularJanela24hAberta(conversaId: string): Promise<boolean> {
    const ultimaInbound = await this.mensagemRepo.findOne({
      where: { conversaId, direcao: WhatsappMensagemDirecao.INBOUND },
      order: { metaTimestamp: 'DESC' },
    });
    if (!ultimaInbound) {
      return false;
    }
    return Date.now() - ultimaInbound.metaTimestamp.getTime() <= JANELA_24H_MS;
  }

  private async mapConversaLista(
    conversa: WhatsappConversa,
  ): Promise<WhatsappConversaListaDto> {
    const ultima = await this.mensagemRepo.findOne({
      where: { conversaId: conversa.id },
      order: { metaTimestamp: 'DESC' },
    });
    const janela24hAberta = await this.calcularJanela24hAberta(conversa.id);
    const nomeFunc =
      conversa.funcionario?.nome?.trim() ||
      conversa.nomePerfil?.trim() ||
      null;

    return {
      id: conversa.id,
      telefoneMascarado: conversa.telefoneMascarado,
      telefoneExibicao: formatarTelefoneExibicaoBR(conversa.telefoneOrigem),
      nomeExibicao: nomeFunc ?? 'Não identificado',
      identificado: !!conversa.funcionarioId,
      unidade: (conversa.funcionario?.unidade as Unidade) ?? null,
      naoLida: conversa.naoLida,
      ultimaMensagemEm: conversa.ultimaMensagemEm?.toISOString() ?? null,
      ultimaMensagemPreview:
        ultima?.tipo && ultima.tipo !== 'text'
          ? rotuloPreviewTipo(ultima.tipo, ultima.nomeArquivo, ultima.legenda) ||
            ultima.conteudoTexto?.slice(0, 120) ||
            null
          : ultima?.conteudoTexto?.slice(0, 120) ?? null,
      janela24hAberta,
    };
  }

  private mapMensagem(m: WhatsappMensagem): WhatsappMensagemDto {
    return {
      id: m.id,
      direcao: m.direcao,
      tipo: m.tipo,
      conteudoTexto: m.conteudoTexto ?? null,
      nomeArquivo: m.nomeArquivo ?? null,
      mimeType: m.mimeType ?? null,
      legenda: m.legenda ?? null,
      arquivoDisponivel: this.mediaStorage.arquivoDisponivel(m),
      status: m.status ?? null,
      metaTimestamp: m.metaTimestamp.toISOString(),
      folhaCapaId: m.folhaCapaId ?? null,
      usuarioRespostaNome: m.usuarioResposta?.nome?.trim() ?? null,
    };
  }
}
