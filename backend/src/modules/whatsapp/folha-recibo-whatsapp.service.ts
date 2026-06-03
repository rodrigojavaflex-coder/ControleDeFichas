import { BadRequestException, Injectable } from '@nestjs/common';
import { Unidade } from '../../common/enums/unidade.enum';
import { AuditAction } from '../../common/enums/auditoria.enum';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { QueryFolhaCapaDto } from '../folha/dto/query-folha-capa.dto';
import { FolhaCapasService, FolhaCapaDetalheDto } from '../folha/folha-capas.service';
import { FolhaFechamentoService } from '../folha/folha-fechamento.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EnviarRecibosWhatsappDto } from '../folha/dto/enviar-recibos-whatsapp.dto';
import { FolhaReciboImagemService } from './folha-recibo-imagem.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappConversaService } from './whatsapp-conversa.service';
import { canonizarTelefoneWhatsappBR } from './utils/whatsapp-telefone.util';

type FalhaEnvioRecibo = {
  funcionarioId: string;
  nome: string;
  motivo: string;
};

export type EnviarRecibosMassaResultado = {
  enviados: number;
  ignorados: number;
  falhas: FalhaEnvioRecibo[];
};

@Injectable()
export class FolhaReciboWhatsappService {
  constructor(
    private readonly folhaCapasService: FolhaCapasService,
    private readonly folhaFechamentoService: FolhaFechamentoService,
    private readonly whatsappService: WhatsappService,
    private readonly reciboImagemService: FolhaReciboImagemService,
    private readonly auditoriaService: AuditoriaService,
    private readonly conversaService: WhatsappConversaService,
  ) {}

  async enviarReciboIndividual(
    usuario: Usuario,
    capaId: string,
    unidade: Unidade,
  ): Promise<{ ok: true; templateMessageId: string; imageMessageId: string }> {
    const detalhe = await this.folhaCapasService.buscarCompletaPorId(usuario, capaId, unidade);
    this.assertCompetenciaFechada(
      unidade,
      detalhe.capa.ano,
      detalhe.capa.mes,
      detalhe.capa.folhaTipo.id,
    );

    const result = await this.processarEnvio(usuario, detalhe);
    if (!result.enviado) {
      throw new BadRequestException(result.motivo ?? 'Não foi possível enviar o recibo por WhatsApp.');
    }
    return {
      ok: true,
      templateMessageId: result.templateMessageId,
      imageMessageId: result.imageMessageId,
    };
  }

  async enviarRecibosMassa(
    usuario: Usuario,
    dto: EnviarRecibosWhatsappDto,
  ): Promise<EnviarRecibosMassaResultado> {
    this.assertCompetenciaFechada(dto.unidade, dto.ano, dto.mes, dto.folhaTipoId);

    const filtros: QueryFolhaCapaDto = {
      unidade: dto.unidade,
      ano: dto.ano,
      mes: dto.mes,
      folhaTipoId: dto.folhaTipoId,
      comDetalhe: true,
    };
    const detalhes = (await this.folhaCapasService.listar(
      usuario,
      filtros,
    )) as FolhaCapaDetalheDto[];

    let enviados = 0;
    let ignorados = 0;
    const falhas: FalhaEnvioRecibo[] = [];

    for (const detalhe of detalhes) {
      const envio = await this.processarEnvio(usuario, detalhe);
      if (envio.enviado) {
        enviados += 1;
      } else {
        ignorados += 1;
        falhas.push({
          funcionarioId: detalhe.capa.funcionario?.id ?? '',
          nome: detalhe.capa.funcionario?.nome ?? 'Funcionário',
          motivo: envio.motivo ?? 'Falha no envio do recibo.',
        });
      }
      await this.delay(900);
    }

    return { enviados, ignorados, falhas };
  }

  private async processarEnvio(
    usuario: Usuario,
    detalhe: FolhaCapaDetalheDto,
  ): Promise<{
    enviado: boolean;
    motivo?: string;
    templateMessageId: string;
    imageMessageId: string;
  }> {
    const funcionario = detalhe.capa.funcionario;
    if (funcionario?.naoReceberReciboWhatsapp) {
      const motivo =
        'Funcionário marcado para não receber recibo pelo WhatsApp.';
      await this.registrarAuditoriaTentativa(usuario, detalhe, null, false, motivo);
      return {
        enviado: false,
        motivo,
        templateMessageId: '',
        imageMessageId: '',
      };
    }
    const telefoneNormalizado = canonizarTelefoneWhatsappBR(funcionario?.telefone ?? null);
    if (!telefoneNormalizado) {
      await this.registrarAuditoriaTentativa(usuario, detalhe, null, false, 'Telefone não cadastrado/ inválido');
      return {
        enviado: false,
        motivo: 'Telefone não cadastrado ou inválido (E.164).',
        templateMessageId: '',
        imageMessageId: '',
      };
    }

    try {
      const saudacao = this.saudacaoAtual();
      const nome = funcionario?.nome?.trim() || 'Funcionário';
      const contatoDuvidasNome = this.whatsappService.getContatoDuvidasNome();
      const contatoDuvidasNumero = this.whatsappService.getContatoDuvidasNumero();

      const png = this.reciboImagemService.gerarReciboPng(
        detalhe,
        usuario.nome?.trim() || 'Usuário',
      );
      const arquivo = this.reciboImagemService.gerarNomeArquivo(
        nome,
        detalhe.capa.mes,
        detalhe.capa.ano,
      );
      const mediaId = await this.whatsappService.uploadPngMedia(arquivo, png);
      const bodyParams = [nome, saudacao, contatoDuvidasNome, contatoDuvidasNumero];

      // Um único template: cabeçalho Imagem (recibo) + corpo com 4 variáveis (RN-015).
      const messageId = await this.whatsappService.sendTemplateWithHeaderImage({
        to: telefoneNormalizado,
        templateName: this.whatsappService.getTemplateName(),
        languageCode: this.whatsappService.getTemplateLang(),
        headerImageMediaId: mediaId,
        bodyParams,
      });
      const templateMessageId = messageId;
      const imageMessageId = messageId;

      await this.registrarAuditoriaTentativa(
        usuario,
        detalhe,
        telefoneNormalizado,
        true,
        'Recibo enviado por WhatsApp.',
        templateMessageId,
      );
      await this.conversaService.registrarEnvioRecibo({
        telefone: telefoneNormalizado,
        wamid: templateMessageId,
        folhaCapaId: detalhe.capa.id,
      });
      return { enviado: true, templateMessageId, imageMessageId };
    } catch (error: any) {
      let motivo =
        error?.response?.data?.error?.message || error?.message || 'Erro ao enviar WhatsApp.';
      const details =
        error?.response?.data?.error?.error_data?.details ??
        (typeof motivo === 'string' && motivo.includes('header') ? motivo : '');
      if (
        String(details).includes('header') ||
        String(motivo).includes('132018') ||
        String(motivo).includes('Template does not contain')
      ) {
        motivo =
          'Template do recibo inválido ou não aprovado na Meta. O modelo configurado em ' +
          `WHATSAPP_TEMPLATE_RECIBO_NAME (${this.whatsappService.getTemplateName()}) precisa ` +
          'ter cabeçalho Imagem e corpo com 4 variáveis (Utilidade).';
      }
      await this.registrarAuditoriaTentativa(usuario, detalhe, telefoneNormalizado, false, motivo);
      return {
        enviado: false,
        motivo,
        templateMessageId: '',
        imageMessageId: '',
      };
    }
  }

  private async assertCompetenciaFechada(
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
  ): Promise<void> {
    const status = await this.folhaFechamentoService.getStatus(unidade, ano, mes, folhaTipoId);
    if (!status.registrada || !status.fechado) {
      throw new BadRequestException(
        'Envio permitido apenas com lote fechado para esta competência (RN-015).',
      );
    }
  }

  private saudacaoAtual(): string {
    const nowSp = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );
    const h = nowSp.getHours();
    if (h >= 5 && h <= 11) return 'Bom dia';
    if (h >= 12 && h <= 17) return 'Boa tarde';
    return 'Boa noite';
  }

  private async registrarAuditoriaTentativa(
    usuario: Usuario,
    detalhe: FolhaCapaDetalheDto,
    telefone: string | null,
    sucesso: boolean,
    descricao: string,
    wamid?: string | null,
  ): Promise<void> {
    await this.auditoriaService.createLog({
      acao: AuditAction.UPDATE,
      usuarioId: usuario.id,
      entidade: 'folha_recibo_whatsapp_envio',
      entidadeId: detalhe.capa.id,
      descricao,
      dadosNovos: {
        folhaCapaId: detalhe.capa.id,
        funcionarioId: detalhe.capa.funcionario?.id ?? null,
        unidade: detalhe.capa.funcionario?.unidade ?? null,
        ano: detalhe.capa.ano,
        mes: detalhe.capa.mes,
        folhaTipoId: detalhe.capa.folhaTipo?.id ?? null,
        sucesso,
        telefoneMascarado: this.mascararTelefone(telefone),
        wamid: wamid ?? null,
      },
    });
  }

  private mascararTelefone(telefone: string | null): string | null {
    if (!telefone) return null;
    if (telefone.length <= 6) return '***';
    return `${telefone.slice(0, 4)}***${telefone.slice(-3)}`;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
