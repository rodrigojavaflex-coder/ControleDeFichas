import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';
import { parseCrmNumero } from '../../common/utils/prescritor-crm.util';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import {
  RepararNomesMedicosDto,
  RepararNomesMedicosResponseDto,
  ReparoNomeMedicoItemDto,
} from './dto/reparar-nomes-medicos.dto';

/** Entrada do mapa ERP: um nome por CRM+UF, ou ambíguo se a base trouxer nomes distintos. */
interface ErpMedicoEntry {
  crm: string;
  uf: string;
  /** Nome padronizado único (null se ambíguo). */
  nome: string | null;
  /** Texto bruto preferido (melhor encoding) para o nome único. */
  nomeBruto: string | null;
  origem: string;
  ambiguo: boolean;
  /** Nomes padronizados distintos vistos para esta chave. */
  nomesDistintos: string[];
}

interface NestNomeRow {
  tabela: string;
  id: string;
  unidade: string | null;
  crm: string;
  uf: string;
  nome: string;
}

const HEURISTICA_SUSPEITO =
  /Ç[BCDFGHJKLMNPQRSTVXZ]|Ã[§£¡©]|Â|â€™|\uFFFD|ý|ÿ|Ý|JÉ(?=[A-ZÀ-Ú])/i;

const UNIDADE_AGENTE: Record<Unidade, string> = {
  [Unidade.INHUMAS]: 'inhumas',
  [Unidade.UBERABA]: 'uberaba',
  [Unidade.NERÓPOLIS]: 'neropolis',
};

/**
 * Reparo de nomes: sobrescreve apenas `prescritores.nome` (fonte canônica).
 * Satélites (painel/orçamentos/caixa) leem via JOIN CRM+UF.
 *
 * Garantia: o nome ERP usado é o da base para aquele CRM+UF.
 * Se o cadastro trouxer nomes distintos na mesma chave → pendente (ambíguo),
 * nunca escolhe “vencedor” por score.
 */
@Injectable()
export class RepararNomesMedicosService {
  private readonly logger = new Logger(RepararNomesMedicosService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
  ) {}

  async executar(
    dto: RepararNomesMedicosDto,
  ): Promise<RepararNomesMedicosResponseDto> {
    const aplicar = !!dto.aplicar;
    const unidadeFiltro = dto.unidade ?? null;
    const erros: string[] = [];
    const agentesConsultados: string[] = [];

    const erpMap = await this.carregarMapaErp(
      agentesConsultados,
      erros,
      unidadeFiltro,
    );
    const nestRows = await this.carregarNomesNest();

    const paraCorrigir: ReparoNomeMedicoItemDto[] = [];
    const pendentesRelatorio: ReparoNomeMedicoItemDto[] = [];
    const updatesPorTabela = new Map<
      string,
      Array<{ id: string; nomeNovo: string }>
    >();

    let semCrm = 0;
    let iguais = 0;
    let suspeitos = 0;

    for (const row of nestRows) {
      const crmNum = parseCrmNumero(row.crm);
      const uf = (row.uf || '').trim().toUpperCase();
      const crm = crmNum != null ? String(crmNum) : row.crm.trim();
      const nomeAtual = (row.nome || '').trim();
      const suspeitoHeuristica = this.nomeSuspeito(nomeAtual);

      if (crmNum == null || !uf) {
        semCrm++;
        if (suspeitoHeuristica) {
          suspeitos++;
          pendentesRelatorio.push({
            id: row.id,
            tabela: row.tabela,
            unidade: row.unidade,
            crm: crm || '—',
            uf: uf || '—',
            nomeAtual,
            nomeErp: null,
            motivo: 'Sem CRM ou UF no NEST',
            acao: 'sem_crm',
          });
        }
        continue;
      }

      const chave = this.chave(crm, uf);
      const erp = erpMap.get(chave);

      if (!erp) {
        if (suspeitoHeuristica) {
          suspeitos++;
          pendentesRelatorio.push({
            id: row.id,
            tabela: row.tabela,
            unidade: row.unidade,
            crm,
            uf,
            nomeAtual,
            nomeErp: null,
            motivo: 'Heurística suspeita sem match CRM+UF no ERP',
            acao: 'pendente',
          });
        } else {
          iguais++;
        }
        continue;
      }

      if (erp.ambiguo || !erp.nome) {
        if (suspeitoHeuristica) suspeitos++;
        pendentesRelatorio.push({
          id: row.id,
          tabela: row.tabela,
          unidade: row.unidade,
          crm,
          uf,
          nomeAtual: padronizarNomeDeSistemaLegado(nomeAtual) || nomeAtual,
          nomeErp: erp.nomesDistintos.join(' | '),
          origemErp: erp.origem,
          motivo: `CRM+UF ambíguo no ERP (${erp.nomesDistintos.length} nomes distintos) — não sobrescreve`,
          acao: 'pendente',
        });
        continue;
      }

      const nomeErp =
        padronizarNomeDeSistemaLegado(erp.nomeBruto || erp.nome) || erp.nome;
      if (!nomeErp) {
        pendentesRelatorio.push({
          id: row.id,
          tabela: row.tabela,
          unidade: row.unidade,
          crm,
          uf,
          nomeAtual,
          nomeErp: erp.nomeBruto,
          origemErp: erp.origem,
          motivo: 'Nome vazio no ERP após padronização',
          acao: 'pendente',
        });
        continue;
      }

      const nomeAtualPad = padronizarNomeDeSistemaLegado(nomeAtual) || nomeAtual;
      if (nomeAtualPad === nomeErp) {
        iguais++;
        continue;
      }

      if (suspeitoHeuristica) suspeitos++;

      if (!this.erpPareceValido(nomeErp) && this.erpPareceValido(nomeAtualPad)) {
        pendentesRelatorio.push({
          id: row.id,
          tabela: row.tabela,
          unidade: row.unidade,
          crm,
          uf,
          nomeAtual: nomeAtualPad,
          nomeErp,
          origemErp: erp.origem,
          motivo: 'ERP não parece íntegro; NEST mantido',
          acao: 'pendente',
        });
        continue;
      }

      const itemCorrigir: ReparoNomeMedicoItemDto = {
        id: row.id,
        tabela: row.tabela,
        unidade: row.unidade,
        crm,
        uf,
        nomeAtual: nomeAtualPad,
        nomeErp,
        origemErp: erp.origem,
        motivo: suspeitoHeuristica
          ? 'Nome diferente (NEST com encoding suspeito)'
          : 'Nome diferente',
        acao: 'corrigir',
      };
      paraCorrigir.push(itemCorrigir);

      const lista = updatesPorTabela.get(row.tabela) ?? [];
      lista.push({ id: row.id, nomeNovo: nomeErp });
      updatesPorTabela.set(row.tabela, lista);
    }

    let corrigidos = 0;
    if (aplicar) {
      const filtrado = this.filtrarUpdatesPorSelecao(
        updatesPorTabela,
        dto,
        paraCorrigir.length,
      );
      if (filtrado.size > 0) {
        corrigidos = await this.aplicarUpdates(filtrado, erros);
      }
    }

    const ambiguosErp = [...erpMap.values()].filter((e) => e.ambiguo).length;
    this.logger.log(
      `Reparo nomes médicos: unidade=${unidadeFiltro ?? 'TODAS'} analisado=${nestRows.length} aCorrigir=${paraCorrigir.length} corrigidos=${corrigidos} pendentes=${pendentesRelatorio.length} chavesAmbiguasErp=${ambiguosErp} aplicar=${aplicar}`,
    );

    return {
      aplicar,
      unidadeFiltro,
      totalAnalisado: nestRows.length,
      suspeitos,
      aCorrigir: paraCorrigir.length,
      corrigidos,
      pendentes: pendentesRelatorio.length,
      semCrm,
      iguais,
      agentesConsultados,
      erros,
      paraCorrigir,
      pendentesRelatorio,
    };
  }

  private filtrarUpdatesPorSelecao(
    updatesPorTabela: Map<string, Array<{ id: string; nomeNovo: string }>>,
    dto: RepararNomesMedicosDto,
    totalCorrigir: number,
  ): Map<string, Array<{ id: string; nomeNovo: string }>> {
    const selecao = dto.itensSelecionados;
    if (selecao && selecao.length > 0) {
      const keys = new Set(selecao.map((s) => `${s.tabela}|${s.id}`));
      const out = new Map<string, Array<{ id: string; nomeNovo: string }>>();
      for (const [tabela, lista] of updatesPorTabela) {
        const filtrados = lista.filter((item) =>
          keys.has(`${tabela}|${item.id}`),
        );
        if (filtrados.length) out.set(tabela, filtrados);
      }
      if (out.size === 0) {
        throw new BadRequestException(
          'Nenhum item selecionado corresponde aos candidatos a corrigir.',
        );
      }
      return out;
    }

    if (dto.aplicarTodos) {
      return updatesPorTabela;
    }

    if (totalCorrigir === 0) {
      return new Map();
    }

    throw new BadRequestException(
      'Selecione os itens a corrigir (itensSelecionados) ou envie aplicarTodos=true.',
    );
  }

  private async carregarMapaErp(
    agentesConsultados: string[],
    erros: string[],
    unidadeFiltro: Unidade | null,
  ): Promise<Map<string, ErpMedicoEntry>> {
    const mapa = new Map<string, ErpMedicoEntry>();
    const configs = await this.configRepository.find({
      where: { ativo: true },
      order: { agente: 'ASC' },
    });
    const agentesConfig = this.configService.get('agentes') as Record<
      string,
      { url?: string; token?: string }
    >;

    const agenteAlvo = unidadeFiltro
      ? UNIDADE_AGENTE[unidadeFiltro]
      : null;

    for (const config of configs) {
      if (agenteAlvo && config.agente !== agenteAlvo) {
        continue;
      }

      const agenteCfg = agentesConfig?.[config.agente];
      if (!agenteCfg?.url || !agenteCfg?.token) {
        erros.push(`Agente ${config.agente}: URL/token ausente`);
        continue;
      }

      try {
        const url = `${agenteCfg.url.replace(/\/$/, '')}/api/v1/prescritores/cadastro`;
        const response = await fetchAgenteComRetry(
          url,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${agenteCfg.token}`,
              'Content-Type': 'application/json',
            },
          },
          {
            timeoutMs: 180000,
            logger: this.logger,
            rotulo: `[${config.agente}] prescritores/cadastro`,
          },
        );
        const data = (await response.json()) as Array<{
          nrcrm?: number | string;
          ufcrm?: string;
          nomemed?: string;
        }>;
        agentesConsultados.push(config.agente);

        for (const row of data || []) {
          const crmNum = parseCrmNumero(row.nrcrm);
          const uf = String(row.ufcrm ?? '')
            .trim()
            .toUpperCase();
          const nomeBruto = String(row.nomemed ?? '').trim();
          if (crmNum == null || !uf || !nomeBruto) continue;

          const crm = String(crmNum);
          const nomePad =
            padronizarNomeDeSistemaLegado(nomeBruto) || nomeBruto;
          const chave = this.chave(crm, uf);
          this.registrarNomeErp(
            mapa,
            chave,
            {
              crm,
              uf,
              nome: nomePad,
              nomeBruto,
              origem: config.agente,
              ambiguo: false,
              nomesDistintos: [nomePad],
            },
            nomePad,
            nomeBruto,
            config.agente,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`Agente ${config.agente}: ${msg}`);
        this.logger.error(
          `Falha ao buscar cadastro de prescritores (${config.agente}): ${msg}`,
        );
      }
    }

    const ambiguos = [...mapa.values()].filter((e) => e.ambiguo);
    if (ambiguos.length > 0) {
      this.logger.warn(
        `Cadastro ERP com ${ambiguos.length} chave(s) CRM+UF ambígua(s) (nomes distintos na mesma chave)`,
      );
    }

    return mapa;
  }

  /**
   * Acumula nomes por CRM+UF. Mesmo nome (após padronizar) = ok (fica o bruto com melhor encoding).
   * Nomes distintos = ambíguo (não escolhe vencedor).
   */
  private registrarNomeErp(
    mapa: Map<string, ErpMedicoEntry>,
    chave: string,
    seed: ErpMedicoEntry,
    nomePad: string,
    nomeBruto: string,
    origem: string,
  ): void {
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, seed);
      return;
    }

    if (!existente.nomesDistintos.includes(nomePad)) {
      existente.nomesDistintos.push(nomePad);
      existente.ambiguo = true;
      existente.nome = null;
      existente.nomeBruto = null;
      existente.origem = `${existente.origem}+${origem}`;
      return;
    }

    // Mesmo nome padronizado: preferir bruto com melhor encoding (acentos).
    if (
      !existente.ambiguo &&
      existente.nomeBruto &&
      this.scoreEncoding(nomeBruto) > this.scoreEncoding(existente.nomeBruto)
    ) {
      existente.nomeBruto = nomeBruto;
      existente.nome = nomePad;
      existente.origem = origem;
    }
  }

  private async carregarNomesNest(): Promise<NestNomeRow[]> {
    const prescritores = await this.prescritorRepository
      .createQueryBuilder('p')
      .select(['p.id', 'p.nome', 'p.numeroCRM', 'p.UFCRM'])
      .getMany();

    return prescritores.map((p) => ({
      tabela: 'prescritores',
      id: p.id,
      unidade: null,
      crm: p.numeroCRM != null ? String(p.numeroCRM) : '',
      uf: p.UFCRM || '',
      nome: p.nome || '',
    }));
  }

  private async aplicarUpdates(
    updatesPorTabela: Map<string, Array<{ id: string; nomeNovo: string }>>,
    erros: string[],
  ): Promise<number> {
    let total = 0;
    const lista = updatesPorTabela.get('prescritores') ?? [];
    const porNome = new Map<string, string[]>();
    for (const item of lista) {
      const ids = porNome.get(item.nomeNovo) ?? [];
      ids.push(item.id);
      porNome.set(item.nomeNovo, ids);
    }
    for (const [nome, ids] of porNome) {
      try {
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const r = await this.prescritorRepository
            .createQueryBuilder()
            .update(Prescritor)
            .set({ nome })
            .whereInIds(chunk)
            .execute();
          total += r.affected ?? 0;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`prescritores: ${msg}`);
        this.logger.error(`Falha ao aplicar reparo em prescritores: ${msg}`);
      }
    }
    return total;
  }

  private chave(crm: string, uf: string): string {
    return `${crm}|${uf.toUpperCase()}`;
  }

  private nomeSuspeito(nome: string): boolean {
    return HEURISTICA_SUSPEITO.test(nome);
  }

  private erpPareceValido(nome: string): boolean {
    return !this.nomeSuspeito(nome) && !!nome.trim();
  }

  /** Só para escolher variante de encoding do *mesmo* nome — nunca entre pessoas diferentes. */
  private scoreEncoding(nome: string): number {
    let score = 0;
    if (this.nomeSuspeito(nome)) score -= 1000;
    if (/[ÁÉÍÓÚÂÊÔÃÕÇ]/i.test(nome)) score += 50;
    return score;
  }
}
