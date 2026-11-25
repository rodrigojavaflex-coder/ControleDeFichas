import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import { unidadeEscopoUsuarioFolha } from '../folha/utils/folha-unidade-scope.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import {
  isMensagemErroConexaoAgente,
  mensagemErroChamadaAgente,
} from '../../common/utils/formatar-erro-agente.util';
import {
  GerarOrcamentoImagemDto,
  OrcamentoImagemResponseDto,
} from './dto/gerar-orcamento-imagem.dto';
import {
  OrcamentoImagemFaixaTipo,
  OrcamentoImagemUnidade,
} from './entities/orcamento-imagem-unidade.entity';

interface AgenteUnidadeConfig {
  url?: string;
  token?: string;
  unit?: number;
}

interface ComposicaoAgente {
  paciente: string;
  cdfil: number;
  nrorc: number;
  numero: string;
  formulas: OrcamentoImagemResponseDto['formulas'];
  subtotal: number;
  desconto: number;
  total: number;
}

const UNIDADE_AGENTE: Record<Unidade, string> = {
  [Unidade.INHUMAS]: 'inhumas',
  [Unidade.UBERABA]: 'uberaba',
  [Unidade.NERÓPOLIS]: 'neropolis',
};

@Injectable()
export class OrcamentoImagemService {
  private readonly logger = new Logger(OrcamentoImagemService.name);

  constructor(
    @InjectRepository(OrcamentoImagemUnidade)
    private readonly faixaRepo: Repository<OrcamentoImagemUnidade>,
    private readonly configService: ConfigService,
  ) {}

  async gerar(
    dto: GerarOrcamentoImagemDto,
    usuario: Usuario,
  ): Promise<OrcamentoImagemResponseDto> {
    this.assertUnidade(usuario, dto.unidade);
    await this.assertFaixasConfiguradas(dto.unidade);

    const inicio = Date.now();
    const composicao = await this.buscarComposicaoNoAgente(
      dto.unidade,
      dto.nrorc,
      dto.serieo,
    );

    this.logger.log(
      `Imagem de orçamento ${composicao.numero} unidade=${dto.unidade} fórmulas=${composicao.formulas.length} em ${Date.now() - inicio}ms`,
    );

    return {
      ...composicao,
      geradoEm: dataHojeBrasilia(),
      diasValidade: dto.diasValidade,
    };
  }

  async obterFaixa(
    usuario: Usuario,
    unidadeInformada: string,
    tipoInformado: string,
  ): Promise<{ buffer: Buffer; mime: string }> {
    const unidade = this.parseUnidade(unidadeInformada);
    const tipo = this.parseTipo(tipoInformado);
    this.assertUnidade(usuario, unidade);

    const faixa = await this.faixaRepo
      .createQueryBuilder('faixa')
      .addSelect('faixa.imagem')
      .addSelect('faixa.mime')
      .where('faixa.unidade = :unidade', { unidade })
      .andWhere('faixa.tipo = :tipo', { tipo })
      .getOne();

    if (!faixa?.imagem) {
      throw new NotFoundException('Imagem da faixa não configurada.');
    }

    return {
      buffer: faixa.imagem,
      mime: faixa.mime || 'image/png',
    };
  }

  async salvarFaixa(
    usuario: Usuario,
    unidadeInformada: string,
    tipoInformado: string,
    arquivo?: { buffer: Buffer; mimetype: string },
  ): Promise<{ unidade: Unidade; tipo: OrcamentoImagemFaixaTipo }> {
    const unidade = this.parseUnidade(unidadeInformada);
    const tipo = this.parseTipo(tipoInformado);
    this.assertUnidade(usuario, unidade);
    this.assertPng(arquivo);

    const existente = await this.faixaRepo
      .createQueryBuilder('faixa')
      .addSelect('faixa.imagem')
      .addSelect('faixa.mime')
      .where('faixa.unidade = :unidade', { unidade })
      .andWhere('faixa.tipo = :tipo', { tipo })
      .getOne();

    const faixa = existente ?? this.faixaRepo.create({ unidade, tipo });
    faixa.imagem = arquivo.buffer;
    faixa.mime = 'image/png';
    await this.faixaRepo.save(faixa);

    this.logger.log(
      `Faixa ${tipo} da imagem de orçamento gravada para ${unidade}`,
    );

    return { unidade, tipo };
  }

  private async assertFaixasConfiguradas(unidade: Unidade): Promise<void> {
    const faltando: string[] = [];
    const topo = await this.faixaRepo.count({
      where: { unidade, tipo: OrcamentoImagemFaixaTipo.TOPO },
    });
    const rodape = await this.faixaRepo.count({
      where: { unidade, tipo: OrcamentoImagemFaixaTipo.RODAPE },
    });
    if (topo === 0) {
      faltando.push('topo');
    }
    if (rodape === 0) {
      faltando.push('rodapé');
    }
    if (faltando.length > 0) {
      throw new BadRequestException(
        `Configure o ${faltando.join(' e o ')} da unidade antes de gerar a imagem.`,
      );
    }
  }

  private async buscarComposicaoNoAgente(
    unidade: Unidade,
    nrorc: number,
    serieo?: string,
  ): Promise<ComposicaoAgente> {
    const chave = UNIDADE_AGENTE[unidade];
    const agentes = this.configService.get<Record<string, AgenteUnidadeConfig>>(
      'agentes',
    );
    const agente = agentes?.[chave];
    if (!agente?.url || !agente.token || !agente.unit) {
      throw new BadRequestException(
        'Agente da unidade não está configurado.',
      );
    }

    const url = `${agente.url.replace(/\/$/, '')}/api/v1/orcamentos/composicao`;
    try {
      const response = await fetchAgenteComRetry(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${agente.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            unit: agente.unit,
            nrorc,
            serieo: serieo ?? '',
          }),
        },
        {
          timeoutMs: 60000,
          logger: this.logger,
          rotulo: `[${chave}] composição do orçamento`,
        },
      );
      return (await response.json()) as ComposicaoAgente;
    } catch (error: unknown) {
      const mensagem = mensagemFuncionalAgente(error);
      if (isMensagemErroConexaoAgente(mensagem)) {
        throw new BadRequestException(mensagem);
      }
      if (/não encontrad/i.test(mensagem)) {
        throw new NotFoundException(mensagem);
      }
      throw new BadRequestException(mensagem);
    }
  }

  private assertUnidade(usuario: Usuario, unidade: Unidade): void {
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    if (escopo && escopo !== unidade) {
      throw new ForbiddenException('Acesso negado para a unidade informada.');
    }
  }

  private parseUnidade(valor: string): Unidade {
    const texto = String(valor ?? '').trim() as Unidade;
    if (!Object.values(Unidade).includes(texto)) {
      throw new BadRequestException('Unidade inválida.');
    }
    return texto;
  }

  private parseTipo(valor: string): OrcamentoImagemFaixaTipo {
    const texto = String(valor ?? '').trim().toUpperCase();
    if (
      texto !== OrcamentoImagemFaixaTipo.TOPO &&
      texto !== OrcamentoImagemFaixaTipo.RODAPE
    ) {
      throw new BadRequestException('Tipo da imagem deve ser TOPO ou RODAPE.');
    }
    return texto;
  }

  private assertPng(
    arquivo?: { buffer: Buffer; mimetype: string },
  ): asserts arquivo is { buffer: Buffer; mimetype: string } {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo PNG.');
    }
    const png =
      arquivo.mimetype === 'image/png' &&
      arquivo.buffer.length >= 8 &&
      arquivo.buffer[0] === 0x89 &&
      arquivo.buffer[1] === 0x50 &&
      arquivo.buffer[2] === 0x4e &&
      arquivo.buffer[3] === 0x47;
    if (!png) {
      throw new BadRequestException('Envie um arquivo PNG.');
    }
  }
}

function dataHojeBrasilia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function mensagemFuncionalAgente(error: unknown): string {
  const mensagem = mensagemErroChamadaAgente(error);
  const extraida = mensagem.match(/Erro ao consultar agente \(\d+\): ([\s\S]+)$/);
  return extraida?.[1]?.trim() || mensagem;
}
