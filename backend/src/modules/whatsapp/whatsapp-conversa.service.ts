import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WhatsappConversa } from './entities/whatsapp-conversa.entity';
import {
  WhatsappMensagem,
  WhatsappMensagemDirecao,
} from './entities/whatsapp-mensagem.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import {
  canonizarTelefoneWhatsappBR,
  mascararTelefone,
  telefonesEquivalentes,
  variantesTelefoneConversa,
} from './utils/whatsapp-telefone.util';

export type RegistrarMensagemParams = {
  telefoneOrigem: string;
  wamid?: string | null;
  direcao: WhatsappMensagemDirecao;
  tipo: string;
  conteudoTexto?: string | null;
  nomeArquivo?: string | null;
  mimeType?: string | null;
  metaMediaId?: string | null;
  arquivoPath?: string | null;
  arquivoConteudo?: Buffer | null;
  arquivoExpiraEm?: Date | null;
  temArquivo?: boolean;
  legenda?: string | null;
  status?: string | null;
  nomePerfil?: string | null;
  metaTimestamp: Date;
  usuarioRespostaId?: string | null;
  folhaCapaId?: string | null;
  marcarNaoLida?: boolean;
};

@Injectable()
export class WhatsappConversaService {
  private readonly logger = new Logger(WhatsappConversaService.name);

  constructor(
    @InjectRepository(WhatsappConversa)
    private readonly conversaRepo: Repository<WhatsappConversa>,
    @InjectRepository(WhatsappMensagem)
    private readonly mensagemRepo: Repository<WhatsappMensagem>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
  ) {}

  async buscarFuncionarioPorTelefone(
    telefoneE164: string,
  ): Promise<Funcionario | null> {
    const candidatos = await this.funcionarioRepo
      .createQueryBuilder('f')
      .where('f.telefone IS NOT NULL')
      .andWhere("TRIM(f.telefone) <> ''")
      .getMany();
    return (
      candidatos.find((f) =>
        telefonesEquivalentes(telefoneE164, f.telefone ?? ''),
      ) ?? null
    );
  }

  private resolverTelefoneCanonico(telefoneRaw: string): string {
    return (
      canonizarTelefoneWhatsappBR(telefoneRaw) ??
      telefoneRaw.replace(/\D/g, '')
    );
  }

  private async buscarConversaExistente(
    telefoneCanon: string,
  ): Promise<WhatsappConversa | null> {
    const variantes = variantesTelefoneConversa(telefoneCanon);
    const encontradas = await this.conversaRepo.find({
      where: { telefoneOrigem: In(variantes) },
      order: { criadoEm: 'ASC' },
    });
    if (!encontradas.length) {
      return null;
    }
    // Preferir conversa já identificada ou com mais histórico
    return (
      encontradas.find((c) => c.funcionarioId) ??
      encontradas.sort(
        (a, b) =>
          (b.ultimaMensagemEm?.getTime() ?? 0) -
          (a.ultimaMensagemEm?.getTime() ?? 0),
      )[0]
    );
  }

  private async mesclarConversasDuplicadas(
    principal: WhatsappConversa,
    duplicatas: WhatsappConversa[],
  ): Promise<void> {
    for (const dup of duplicatas) {
      if (dup.id === principal.id) continue;
      await this.mensagemRepo.update(
        { conversaId: dup.id },
        { conversaId: principal.id },
      );
      if (!principal.funcionarioId && dup.funcionarioId) {
        principal.funcionarioId = dup.funcionarioId;
      }
      if (!principal.nomePerfil?.trim() && dup.nomePerfil?.trim()) {
        principal.nomePerfil = dup.nomePerfil.trim();
      }
      if (dup.naoLida) {
        principal.naoLida = true;
      }
      if (
        dup.ultimaMensagemEm &&
        (!principal.ultimaMensagemEm ||
          dup.ultimaMensagemEm > principal.ultimaMensagemEm)
      ) {
        principal.ultimaMensagemEm = dup.ultimaMensagemEm;
      }
      await this.conversaRepo.remove(dup);
      this.logger.log(
        `Conversa WhatsApp duplicada mesclada: ${dup.telefoneOrigem} → ${principal.telefoneOrigem}`,
      );
    }
  }

  private async normalizarChaveConversa(
    conversa: WhatsappConversa,
    telefoneCanon: string,
  ): Promise<WhatsappConversa> {
    if (conversa.telefoneOrigem === telefoneCanon) {
      return conversa;
    }
    const variantes = variantesTelefoneConversa(telefoneCanon);
    const outras = await this.conversaRepo.find({
      where: { telefoneOrigem: In(variantes) },
    });
    const duplicatas = outras.filter((c) => c.id !== conversa.id);
    if (duplicatas.length) {
      await this.mesclarConversasDuplicadas(conversa, duplicatas);
    }
    conversa.telefoneOrigem = telefoneCanon;
    conversa.telefoneMascarado = mascararTelefone(telefoneCanon);
    await this.conversaRepo.save(conversa);
    return conversa;
  }

  async obterOuCriarConversa(
    telefoneRaw: string,
    nomePerfil?: string | null,
  ): Promise<WhatsappConversa> {
    const telefoneOrigem = this.resolverTelefoneCanonico(telefoneRaw);
    let conversa = await this.buscarConversaExistente(telefoneOrigem);

    if (!conversa) {
      const funcionario = await this.buscarFuncionarioPorTelefone(telefoneOrigem);
      conversa = this.conversaRepo.create({
        telefoneOrigem,
        telefoneMascarado: mascararTelefone(telefoneOrigem),
        funcionarioId: funcionario?.id ?? null,
        nomePerfil: nomePerfil ?? null,
        naoLida: false,
        ultimaMensagemEm: null,
      });
      await this.conversaRepo.save(conversa);
      return conversa;
    }

    conversa = await this.normalizarChaveConversa(conversa, telefoneOrigem);

    let alterou = false;
    if (nomePerfil?.trim() && conversa.nomePerfil !== nomePerfil.trim()) {
      conversa.nomePerfil = nomePerfil.trim();
      alterou = true;
    }
    if (!conversa.funcionarioId) {
      const funcionario = await this.buscarFuncionarioPorTelefone(telefoneOrigem);
      if (funcionario) {
        conversa.funcionarioId = funcionario.id;
        alterou = true;
      }
    }
    if (alterou) {
      await this.conversaRepo.save(conversa);
    }
    return conversa;
  }

  async registrarMensagem(
    params: RegistrarMensagemParams,
  ): Promise<WhatsappMensagem | null> {
    if (params.wamid) {
      const existente = await this.mensagemRepo.findOne({
        where: { wamid: params.wamid },
      });
      if (existente) {
        return existente;
      }
    }

    const conversa = await this.obterOuCriarConversa(
      params.telefoneOrigem,
      params.nomePerfil,
    );

    const mensagem = this.mensagemRepo.create({
      conversaId: conversa.id,
      wamid: params.wamid ?? null,
      direcao: params.direcao,
      tipo: params.tipo,
      conteudoTexto: params.conteudoTexto ?? null,
      nomeArquivo: params.nomeArquivo ?? null,
      mimeType: params.mimeType ?? null,
      metaMediaId: params.metaMediaId ?? null,
      arquivoPath: params.arquivoPath ?? null,
      arquivoConteudo: params.arquivoConteudo ?? null,
      arquivoExpiraEm: params.arquivoExpiraEm ?? null,
      temArquivo: params.temArquivo ?? false,
      legenda: params.legenda ?? null,
      status: params.status ?? null,
      usuarioRespostaId: params.usuarioRespostaId ?? null,
      folhaCapaId: params.folhaCapaId ?? null,
      metaTimestamp: params.metaTimestamp,
    });
    await this.mensagemRepo.save(mensagem);

    conversa.ultimaMensagemEm = params.metaTimestamp;
    if (params.direcao === WhatsappMensagemDirecao.INBOUND) {
      conversa.naoLida = params.marcarNaoLida !== false;
    }
    await this.conversaRepo.save(conversa);

    return mensagem;
  }

  async atualizarStatusPorWamid(
    wamid: string,
    status: string,
    timestamp: Date,
    erroCodigo?: number | null,
    erroMensagem?: string | null,
  ): Promise<void> {
    const mensagem = await this.mensagemRepo.findOne({ where: { wamid } });
    if (!mensagem) {
      this.logger.debug(`Status webhook sem mensagem local: wamid=${wamid}`);
      return;
    }
    mensagem.status = status;
    if (erroCodigo != null) mensagem.erroCodigo = erroCodigo;
    if (erroMensagem != null) mensagem.erroMensagem = erroMensagem;
    if (timestamp > mensagem.metaTimestamp) {
      mensagem.metaTimestamp = timestamp;
    }
    await this.mensagemRepo.save(mensagem);
  }

  async registrarEnvioRecibo(params: {
    telefone: string;
    wamid: string;
    folhaCapaId: string;
    enviadoEm?: Date;
  }): Promise<void> {
    await this.registrarMensagem({
      telefoneOrigem: params.telefone,
      wamid: params.wamid,
      direcao: WhatsappMensagemDirecao.OUTBOUND,
      tipo: 'template',
      conteudoTexto: 'Recibo de pagamento (template)',
      status: 'sent',
      folhaCapaId: params.folhaCapaId,
      metaTimestamp: params.enviadoEm ?? new Date(),
      marcarNaoLida: false,
    });
  }
}
