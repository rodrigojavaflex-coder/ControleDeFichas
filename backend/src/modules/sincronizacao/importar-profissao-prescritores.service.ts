import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  PF_CRM_PADRAO_VISITACAO,
  normalizarPfCrm,
  rotuloPfCrm,
} from '../../common/enums/pf-crm.enum';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';
import {
  parseCrmNumero,
  normalizarUfCrm,
} from '../../common/utils/prescritor-crm.util';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import {
  ImportarProfissaoPrescritoresDto,
  ImportarProfissaoPrescritoresResponseDto,
  ImportProfissaoItemDto,
} from './dto/importar-profissao-prescritores.dto';

const UNIDADE_AGENTE: Record<Unidade, string> = {
  [Unidade.INHUMAS]: 'inhumas',
  [Unidade.UBERABA]: 'uberaba',
  [Unidade.NERÓPOLIS]: 'neropolis',
};

interface ErpRow {
  pfcrm: string;
  crm: string;
  uf: string;
  nome: string;
  origem: string;
}

@Injectable()
export class ImportarProfissaoPrescritoresService {
  private readonly logger = new Logger(ImportarProfissaoPrescritoresService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
  ) {}

  async executar(
    dto: ImportarProfissaoPrescritoresDto,
  ): Promise<ImportarProfissaoPrescritoresResponseDto> {
    const aplicar = !!dto.aplicar;
    const unidadeFiltro = dto.unidade ?? null;
    const erros: string[] = [];
    const agentesConsultados: string[] = [];

    const erpRows = await this.carregarErp(
      agentesConsultados,
      erros,
      unidadeFiltro,
    );
    const nestRows = await this.prescritorRepository.find({
      select: ['id', 'nome', 'numeroCRM', 'UFCRM', 'pfcrm'],
    });

    const porCrmUf = new Map<string, Prescritor[]>();
    for (const p of nestRows) {
      if (p.numeroCRM == null || !p.UFCRM) continue;
      const k = `${p.numeroCRM}|${p.UFCRM.toUpperCase()}`;
      const list = porCrmUf.get(k) ?? [];
      list.push(p);
      porCrmUf.set(k, list);
    }

    /**
     * PFCRM faz parte da identidade (CRM+UF+PFCRM).
     * - Já existe a tríade → igual.
     * - Match CRM+UF+nome e a linha NEST ainda está no default da migration
     *   (`pfcrm='1'`) → ATIZAR para o PFCRM do ERP (ex.: Fernanda 1→6).
     * - Match com PFCRM “real” diferente → CRIAR nova linha (outra profissão;
     *   não sobrescrever nutricionista virando dentista).
     * - CRM+UF com outro nome (ex.: Ana Flávia vs Fernanda no mesmo CRM) → CRIAR.
     */
    const paraAplicar: ImportProfissaoItemDto[] = [];
    const pendentesRelatorio: ImportProfissaoItemDto[] = [];
    let iguais = 0;
    const padrao = PF_CRM_PADRAO_VISITACAO; // '1'

    for (const erp of erpRows) {
      const k = `${erp.crm}|${erp.uf}`;
      const candidatos = porCrmUf.get(k) ?? [];
      const jaComPf = candidatos.find(
        (c) => (c.pfcrm || '').toUpperCase() === erp.pfcrm,
      );

      if (jaComPf) {
        iguais++;
        continue;
      }

      const porNome = candidatos.filter((c) =>
        this.nomesCompativeis(c.nome, erp.nome),
      );

      if (porNome.length > 1) {
        pendentesRelatorio.push({
          id: null,
          crm: erp.crm,
          uf: erp.uf,
          pfcrm: erp.pfcrm,
          profissao: rotuloPfCrm(erp.pfcrm),
          nomeNest: porNome
            .map((p) => `${p.nome} [${p.pfcrm}]`)
            .join(' | '),
          nomeErp: erp.nome,
          origemErp: erp.origem,
          motivo:
            '5) Pendente — vários NEST com mesmo CRM+UF e nome compatível',
          acao: 'pendente',
        });
        continue;
      }

      if (porNome.length === 1) {
        const alvo = porNome[0];
        const pfcrmAtual = (alvo.pfcrm || '').toUpperCase() || padrao;
        // Default da migration ('1'): corrigir a linha existente em vez de duplicar
        if (pfcrmAtual === padrao) {
          paraAplicar.push({
            id: alvo.id,
            crm: erp.crm,
            uf: erp.uf,
            pfcrm: erp.pfcrm,
            profissao: rotuloPfCrm(erp.pfcrm),
            nomeNest: alvo.nome,
            nomeErp: erp.nome,
            pfcrmAtual: alvo.pfcrm,
            origemErp: erp.origem,
            motivo:
              '1) Match CRM+UF+nome — atualizar PFCRM (corrigir default 1)',
            acao: 'atualizar',
          });
        } else {
          paraAplicar.push({
            id: null,
            crm: erp.crm,
            uf: erp.uf,
            pfcrm: erp.pfcrm,
            profissao: rotuloPfCrm(erp.pfcrm),
            nomeNest: `${alvo.nome} [${alvo.pfcrm}]`,
            nomeErp: erp.nome,
            pfcrmAtual: alvo.pfcrm,
            origemErp: erp.origem,
            motivo:
              '2) Match CRM+UF+nome — criar outra profissão (NEST já tem PFCRM ≠ 1)',
            acao: 'criar',
          });
        }
        continue;
      }

      if (candidatos.length === 0) {
        paraAplicar.push({
          id: null,
          crm: erp.crm,
          uf: erp.uf,
          pfcrm: erp.pfcrm,
          profissao: rotuloPfCrm(erp.pfcrm),
          nomeNest: null,
          nomeErp: erp.nome,
          origemErp: erp.origem,
          motivo: '3) Sem prescritor NEST — criar com PFCRM',
          acao: 'criar',
        });
        continue;
      }

      paraAplicar.push({
        id: null,
        crm: erp.crm,
        uf: erp.uf,
        pfcrm: erp.pfcrm,
        profissao: rotuloPfCrm(erp.pfcrm),
        nomeNest: candidatos.map((c) => `${c.nome} [${c.pfcrm}]`).join(' | '),
        nomeErp: erp.nome,
        origemErp: erp.origem,
        motivo:
          '4) CRM+UF no NEST com outro nome — criar prescritor com PFCRM',
        acao: 'criar',
      });
    }

    let aplicados = 0;
    if (aplicar) {
      aplicados = await this.aplicarSelecao(dto, paraAplicar, erros);
    }

    // Reconta quantos candidatos ainda faltariam (só referência pós-apply)
    let aindaFaltam = paraAplicar.length;
    if (aplicar && aplicados > 0) {
      aindaFaltam = await this.contarAindaFaltam(paraAplicar);
    }

    this.logger.log(
      `Import PFCRM: unidade=${unidadeFiltro ?? 'TODAS'} erp=${erpRows.length} aAplicar=${paraAplicar.length} aplicados=${aplicados} aindaFaltam=${aindaFaltam} pend=${pendentesRelatorio.length} erros=${erros.length}`,
    );

    return {
      aplicar,
      unidadeFiltro,
      totalAnalisado: erpRows.length,
      aAplicar: paraAplicar.length,
      aplicados,
      pendentes: pendentesRelatorio.length,
      iguais,
      agentesConsultados,
      erros:
        aplicar && aindaFaltam > 0
          ? [
              ...erros,
              `Após apply: ${aplicados} gravado(s), ${aindaFaltam} tríade(s) ainda ausente(s) — rode dry-run de novo.`,
            ]
          : erros,
      paraAplicar,
      pendentesRelatorio,
    };
  }

  /** Confere no banco se as tríades dos candidatos já existem. */
  private async contarAindaFaltam(
    candidatos: ImportProfissaoItemDto[],
  ): Promise<number> {
    let faltam = 0;
    for (const item of candidatos) {
      const crm = parseCrmNumero(item.crm);
      const uf = normalizarUfCrm(item.uf);
      const pfcrm = normalizarPfCrm(item.pfcrm);
      if (crm == null || !uf || !pfcrm) {
        faltam++;
        continue;
      }
      const exists = await this.prescritorRepository.findOne({
        where: { numeroCRM: crm, UFCRM: uf, pfcrm },
        select: ['id'],
      });
      if (!exists) faltam++;
    }
    return faltam;
  }

  private async aplicarSelecao(
    dto: ImportarProfissaoPrescritoresDto,
    paraAplicar: ImportProfissaoItemDto[],
    erros: string[],
  ): Promise<number> {
    let lista = paraAplicar;
    if (dto.itensSelecionados?.length) {
      const keys = new Set(
        dto.itensSelecionados.map(
          (s) => `${s.acao}|${s.crm}|${s.uf}|${s.pfcrm}|${s.id ?? ''}`,
        ),
      );
      lista = paraAplicar.filter((i) =>
        keys.has(`${i.acao}|${i.crm}|${i.uf}|${i.pfcrm}|${i.id ?? ''}`),
      );
      if (!lista.length) {
        // Compat: seleção de dry-run antigo ainda com acao=atualizar
        const keysLegacy = new Set(
          dto.itensSelecionados.map(
            (s) => `${s.crm}|${s.uf}|${s.pfcrm}`,
          ),
        );
        lista = paraAplicar.filter((i) =>
          keysLegacy.has(`${i.crm}|${i.uf}|${i.pfcrm}`),
        );
      }
      if (!lista.length) {
        throw new BadRequestException(
          'Nenhum item selecionado corresponde aos candidatos. Rode o dry-run de novo e selecione.',
        );
      }
    } else if (!dto.aplicarTodos) {
      if (!paraAplicar.length) return 0;
      throw new BadRequestException(
        'Selecione itens (itensSelecionados) ou enviar aplicarTodos=true.',
      );
    }

    let n = 0;
    for (const item of lista) {
      try {
        const crm = parseCrmNumero(item.crm);
        const uf = normalizarUfCrm(item.uf);
        const pfcrm = normalizarPfCrm(item.pfcrm);
        if (crm == null || !uf || !pfcrm) {
          erros.push(`${item.crm}/${item.uf}/${item.pfcrm}: CRM/UF/PFCRM inválido`);
          continue;
        }

        if (item.acao === 'atualizar' && item.id) {
          const conflito = await this.prescritorRepository.findOne({
            where: { numeroCRM: crm, UFCRM: uf, pfcrm },
          });
          if (conflito && conflito.id !== item.id) {
            erros.push(
              `${item.crm}/${item.uf}/${item.pfcrm}: já existe outra linha com essa tríade (${conflito.id})`,
            );
            continue;
          }
          await this.prescritorRepository.update(
            { id: item.id },
            { pfcrm },
          );
          n++;
          this.logger.debug(
            `PFCRM atualizado: id=${item.id} → ${crm}/${uf}/${pfcrm}`,
          );
          continue;
        }

        const exists = await this.prescritorRepository.findOne({
          where: { numeroCRM: crm, UFCRM: uf, pfcrm },
        });
        if (exists) {
          n++;
          continue;
        }
        await this.prescritorRepository.save(
          this.prescritorRepository.create({
            numeroCRM: crm,
            UFCRM: uf,
            pfcrm,
            nome: item.nomeErp,
          }),
        );
        n++;
        this.logger.debug(
          `PFCRM criado: ${crm}/${uf}/${pfcrm} (${item.nomeErp})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `PFCRM falha ${item.crm}/${item.uf}/${item.pfcrm}: ${msg}`,
        );
        erros.push(`${item.crm}/${item.uf}/${item.pfcrm}: ${msg}`);
      }
    }
    return n;
  }

  private nomesCompativeis(a: string, b: string): boolean {
    const na = padronizarNomeDeSistemaLegado(a) || a.trim().toUpperCase();
    const nb = padronizarNomeDeSistemaLegado(b) || b.trim().toUpperCase();
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const ta = new Set(na.split(/\s+/).filter((t) => t.length > 2));
    const tb = nb.split(/\s+/).filter((t) => t.length > 2);
    if (!tb.length) return false;
    const hit = tb.filter((t) => ta.has(t)).length;
    return hit / tb.length >= 0.6;
  }

  private async carregarErp(
    agentesConsultados: string[],
    erros: string[],
    unidadeFiltro: Unidade | null,
  ): Promise<ErpRow[]> {
    const out: ErpRow[] = [];
    const visto = new Set<string>();
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

    if (!configs.length) {
      erros.push(
        'Nenhuma configuração de sincronização ativa. Em Configuração → Sincronização, ative o(s) agente(s).',
      );
      return out;
    }

    const configsEscopo = agenteAlvo
      ? configs.filter((c) => c.agente === agenteAlvo)
      : configs;

    if (!configsEscopo.length) {
      erros.push(
        `Sem config ativa para o agente "${agenteAlvo}" (unidade ${unidadeFiltro}). Ative em Configuração → Sincronização.`,
      );
      return out;
    }

    for (const config of configsEscopo) {
      const agenteCfg = agentesConfig?.[config.agente];
      if (!agenteCfg?.url || !agenteCfg?.token) {
        erros.push(
          `Agente ${config.agente}: URL/token ausente no ambiente (AGENTE_*_URL / AGENTE_*_TOKEN)`,
        );
        continue;
      }
      try {
        const url = `${agenteCfg.url.replace(/\/$/, '')}/api/v1/prescritores/cadastro`;
        this.logger.log(`[${config.agente}] GET ${url}`);
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
          pfcrm?: string;
          nrcrm?: number | string;
          ufcrm?: string;
          nomemed?: string;
        }>;
        agentesConsultados.push(config.agente);

        let aceitos = 0;
        let ignorados = 0;
        for (const row of data || []) {
          const crmNum = parseCrmNumero(row.nrcrm);
          const uf = normalizarUfCrm(row.ufcrm);
          const pfcrm = normalizarPfCrm(row.pfcrm);
          const nome =
            padronizarNomeDeSistemaLegado(String(row.nomemed ?? '')) ||
            String(row.nomemed ?? '').trim();
          if (crmNum == null || !uf || !pfcrm || !nome) {
            ignorados++;
            continue;
          }
          const chave = `${crmNum}|${uf}|${pfcrm}`;
          if (visto.has(chave)) continue;
          visto.add(chave);
          aceitos++;
          out.push({
            pfcrm,
            crm: String(crmNum),
            uf,
            nome,
            origem: config.agente,
          });
        }
        this.logger.log(
          `[${config.agente}] cadastro: ${Array.isArray(data) ? data.length : 0} linha(s), ${aceitos} aceita(s), ${ignorados} ignorada(s)`,
        );
        if (Array.isArray(data) && data.length > 0 && aceitos === 0) {
          erros.push(
            `Agente ${config.agente}: ${data.length} linha(s) no cadastro, nenhuma com CRM+UF+PFCRM+nome válidos`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`Agente ${config.agente}: ${msg}`);
      }
    }
    return out;
  }
}
