import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { normalizarPfCrm } from '../../common/enums/pf-crm.enum';
import {
  parseCrmNumero,
  normalizarUfCrm,
} from '../../common/utils/prescritor-crm.util';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import {
  AtualizarDataNascimentoItemDto,
  AtualizarDataNascimentoPrescritoresDto,
  AtualizarDataNascimentoPrescritoresResponseDto,
} from './dto/atualizar-data-nascimento-prescritores.dto';

const UNIDADE_AGENTE: Record<Unidade, string> = {
  [Unidade.INHUMAS]: 'inhumas',
  [Unidade.UBERABA]: 'uberaba',
  [Unidade.NERÓPOLIS]: 'neropolis',
};

interface ErpData {
  data: string | null;
  ambiguo: boolean;
}

@Injectable()
export class AtualizarDataNascimentoPrescritoresService {
  private readonly logger = new Logger(
    AtualizarDataNascimentoPrescritoresService.name,
  );

  constructor(
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
    private readonly configService: ConfigService,
  ) {}

  async executar(
    dto: AtualizarDataNascimentoPrescritoresDto,
  ): Promise<AtualizarDataNascimentoPrescritoresResponseDto> {
    const unidadeFiltro = dto.unidade ?? null;
    const erros: string[] = [];
    const agentesConsultados: string[] = [];
    const erp = await this.carregarErp(
      agentesConsultados,
      erros,
      unidadeFiltro,
    );

    const nest = await this.prescritorRepository.find({
      select: [
        'id',
        'nome',
        'numeroCRM',
        'UFCRM',
        'pfcrm',
        'unidade',
        'dataNascimento',
      ],
    });

    let totalNest = 0;
    let iguais = 0;
    let semDataErp = 0;
    let semCrm = 0;
    let semUnidade = 0;
    let semCadastroErp = 0;
    const itens: AtualizarDataNascimentoItemDto[] = [];
    const ambiguosDescricao: string[] = [];

    for (const prescritor of nest) {
      if (unidadeFiltro && prescritor.unidade !== unidadeFiltro) {
        continue;
      }
      totalNest++;
      if (prescritor.numeroCRM == null || !prescritor.UFCRM?.trim()) {
        semCrm++;
        continue;
      }
      if (!prescritor.unidade) {
        semUnidade++;
        continue;
      }
      const uf = normalizarUfCrm(prescritor.UFCRM);
      const pfcrm = normalizarPfCrm(prescritor.pfcrm);
      if (!uf || !pfcrm) {
        semCrm++;
        continue;
      }
      const chave = `${prescritor.unidade}|${prescritor.numeroCRM}|${uf}|${pfcrm}`;
      const origem = erp.get(chave);
      if (!origem) {
        semCadastroErp++;
        continue;
      }
      if (origem.ambiguo) {
        ambiguosDescricao.push(
          `${prescritor.unidade} CRM ${prescritor.numeroCRM}/${uf} PFCRM ${pfcrm}: datas diferentes no ERP`,
        );
        continue;
      }
      if (!origem.data) {
        semDataErp++;
        continue;
      }
      const atual = this.dataIso(prescritor.dataNascimento) ?? null;
      if (atual === origem.data) {
        iguais++;
        continue;
      }
      itens.push({
        id: prescritor.id,
        unidade: prescritor.unidade,
        crm: String(prescritor.numeroCRM),
        uf,
        pfcrm,
        nome: prescritor.nome,
        dataAtual: atual,
        dataErp: origem.data,
      });
    }

    let atualizados = 0;
    if (dto.aplicar) {
      for (const item of itens) {
        await this.prescritorRepository.query(
          `UPDATE prescritores
           SET "dataNascimento" = $1, "atualizadoEm" = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [item.dataErp, item.id],
        );
        atualizados++;
      }
      this.logger.log(
        `Data de nascimento aplicada em ${atualizados} prescritor(es)` +
          (unidadeFiltro ? ` (${unidadeFiltro})` : ''),
      );
    }

    return {
      aplicar: dto.aplicar,
      unidadeFiltro,
      totalNest,
      paraAtualizar: itens.length,
      atualizados,
      iguais,
      semDataErp,
      semCrm,
      semUnidade,
      semCadastroErp,
      ambiguos: ambiguosDescricao.length,
      agentesConsultados,
      erros,
      itens,
      ambiguosDescricao,
    };
  }

  private async carregarErp(
    agentesConsultados: string[],
    erros: string[],
    unidadeFiltro: Unidade | null,
  ): Promise<Map<string, ErpData>> {
    const mapa = new Map<string, ErpData>();
    const configs = await this.configRepository.find({
      where: { ativo: true },
      order: { agente: 'ASC' },
    });
    const agentesConfig = this.configService.get('agentes') as Record<
      string,
      { url?: string; token?: string }
    >;
    const agenteAlvo = unidadeFiltro ? UNIDADE_AGENTE[unidadeFiltro] : null;

    if (!configs.length) {
      erros.push(
        'Nenhuma configuração de sincronização ativa. Em Configuração → Sincronização, ative o(s) agente(s).',
      );
      return mapa;
    }

    const configsEscopo = agenteAlvo
      ? configs.filter((c) => c.agente === agenteAlvo)
      : configs;

    if (!configsEscopo.length) {
      erros.push(
        `Sem config ativa para o agente "${agenteAlvo}" (unidade ${unidadeFiltro}). Ative em Configuração → Sincronização.`,
      );
      return mapa;
    }

    for (const config of configsEscopo) {
      const agenteCfg = agentesConfig?.[config.agente];
      if (!agenteCfg?.url || !agenteCfg?.token) {
        erros.push(
          `Agente ${config.agente}: URL/token ausente no ambiente (AGENTE_*_URL / AGENTE_*_TOKEN)`,
        );
        continue;
      }
      const unidadeErp = (Object.keys(UNIDADE_AGENTE) as Unidade[]).find(
        (u) => UNIDADE_AGENTE[u] === config.agente,
      );
      if (!unidadeErp) {
        erros.push(`Agente ${config.agente}: sem unidade mapeada`);
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
          dtnas?: string;
        }>;
        agentesConsultados.push(config.agente);
        for (const row of data || []) {
          const crmNum = parseCrmNumero(row.nrcrm);
          const uf = normalizarUfCrm(row.ufcrm);
          const pfcrm = normalizarPfCrm(row.pfcrm) || '1';
          if (crmNum == null || !uf) continue;
          const chave = `${unidadeErp}|${crmNum}|${uf}|${pfcrm}`;
          const dataIso = this.dataIso(row.dtnas) ?? null;
          const atual = mapa.get(chave);
          if (!atual) {
            mapa.set(chave, { data: dataIso, ambiguo: false });
            continue;
          }
          if (atual.data !== dataIso) {
            atual.ambiguo = true;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`Agente ${config.agente}: ${msg}`);
      }
    }
    return mapa;
  }

  private dataIso(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return undefined;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const texto =
      typeof value === 'string'
        ? value.trim()
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value).trim()
          : '';
    const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : undefined;
  }
}
