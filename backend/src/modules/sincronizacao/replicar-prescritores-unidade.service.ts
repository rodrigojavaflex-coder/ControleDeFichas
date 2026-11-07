import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { PF_CRM_PADRAO_VISITACAO, normalizarPfCrm } from '../../common/enums/pf-crm.enum';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';
import {
  normalizarUfCrm,
  parseCrmNumero,
} from '../../common/utils/prescritor-crm.util';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import {
  ReplicarPrescritorAmostraDto,
  ReplicarPrescritoresUnidadeDto,
  ReplicarPrescritoresUnidadeResponseDto,
  ReplicarPrescritoresUnidadeStatusDto,
} from './dto/replicar-prescritores-unidade.dto';

const AGENTE_UNIDADE: Record<string, Unidade> = {
  inhumas: Unidade.INHUMAS,
  uberaba: Unidade.UBERABA,
  neropolis: Unidade.NERÓPOLIS,
};

const ORDEM_UNIDADE = [Unidade.INHUMAS, Unidade.NERÓPOLIS, Unidade.UBERABA];

interface PrescritorRow {
  id: string;
  nome: string;
  numeroCRM: number;
  UFCRM: string;
  pfcrm: string;
  unidade: string | null;
}

interface PlanoLinha {
  id: string;
  chave: string;
  unidade: Unidade;
  crm: number;
  uf: string;
  pfcrm: string;
  nome: string;
  origem: 'erp' | 'nest';
  acao: 'criar' | 'atribuir' | 'atualizar' | 'ok';
  nomeAnterior: string | null;
}

interface UsoBruto {
  unidade: Unidade;
  crm: number;
  uf: string;
  pfcrm: string | null;
  producao: boolean;
}

interface HerancaPf {
  unidade: string;
  crm: number;
  uf: string;
  pfcrm: string;
  nome: string;
}

interface PlanoSemChave {
  id: string;
  prescritorAtualId: string;
  unidade: Unidade;
  nome: string;
  pfcrm: string;
  acao: 'atribuir' | 'criar';
  vendas: number;
}

@Injectable()
export class ReplicarPrescritoresUnidadeService {
  private readonly logger = new Logger(ReplicarPrescritoresUnidadeService.name);
  private aplicarEmCurso = false;
  private status: ReplicarPrescritoresUnidadeStatusDto = {
    emAndamento: false,
    etapa: 'ocioso',
    mensagem: '',
    iniciadoEm: null,
    atualizadoEm: null,
    erro: null,
  };

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
  ) {}

  lerStatus(): ReplicarPrescritoresUnidadeStatusDto {
    return { ...this.status };
  }

  private iniciarAplicacao(): void {
    const agora = new Date().toISOString();
    this.aplicarEmCurso = true;
    this.status = {
      emAndamento: true,
      etapa: 'agentes',
      mensagem: 'Consultando o FC04000 de cada agente…',
      iniciadoEm: agora,
      atualizadoEm: agora,
      erro: null,
    };
    this.logger.log(`Réplica status [agentes] ${this.status.mensagem}`);
  }

  private publicar(etapa: string, mensagem: string): void {
    if (!this.aplicarEmCurso) return;
    this.status = {
      ...this.status,
      emAndamento: true,
      etapa,
      mensagem,
      atualizadoEm: new Date().toISOString(),
      erro: null,
    };
    this.logger.log(`Réplica status [${etapa}] ${mensagem}`);
  }

  private encerrarAplicacao(
    etapa: 'concluido' | 'erro',
    mensagem: string,
    erro: string | null = null,
  ): void {
    this.aplicarEmCurso = false;
    this.status = {
      ...this.status,
      emAndamento: false,
      etapa,
      mensagem,
      atualizadoEm: new Date().toISOString(),
      erro,
    };
    if (etapa === 'erro') {
      this.logger.error(`Réplica status [erro] ${mensagem}`);
    } else {
      this.logger.log(`Réplica status [concluido] ${mensagem}`);
    }
  }

  async executar(
    dto: ReplicarPrescritoresUnidadeDto,
  ): Promise<ReplicarPrescritoresUnidadeResponseDto> {
    const aplicar = !!dto.aplicar;
    if (aplicar) {
      if (this.aplicarEmCurso) {
        throw new ConflictException('Já existe uma réplica em andamento.');
      }
      this.iniciarAplicacao();
    }
    try {
      return await this.montarEAplicar(aplicar);
    } catch (err) {
      if (aplicar && this.aplicarEmCurso) {
        const msg = err instanceof Error ? err.message : String(err);
        this.encerrarAplicacao('erro', msg, msg);
      }
      throw err;
    }
  }

  private async montarEAplicar(
    aplicar: boolean,
  ): Promise<ReplicarPrescritoresUnidadeResponseDto> {
    const erros: string[] = [];
    const agentesConsultados: string[] = [];
    const erp = await this.carregarErp(agentesConsultados, erros);

    this.publicar(
      'uso',
      'Lendo orçamento, caixa, produção, visitação e vendas…',
    );
    const profissoes = this.profissoesPorCrmUf(erp);
    const brutos = await this.carregarUso();
    const prescritores = await this.carregarPrescritores();
    const vendasAgg = await this.carregarVendasAgg();
    const vendasSemUnidade = await this.contarVendasSemUnidade();
    const nestPorCrmUf = new Map<string, Set<string>>();
    for (const p of prescritores) {
      const k = `${p.numeroCRM}|${p.UFCRM}`;
      const set = nestPorCrmUf.get(k) ?? new Set<string>();
      set.add(p.pfcrm);
      nestPorCrmUf.set(k, set);
    }
    const uso = new Map<string, Set<Unidade>>();
    const herdadas = new Set<string>();
    const ambiguas = new Set<string>();
    const producaoAlvo = new Map<string, HerancaPf>();
    const adicionarUso = (unidade: Unidade, crm: number, uf: string, pfcrm: string): void => {
      const k = this.chave(crm, uf, pfcrm);
      const set = uso.get(k) ?? new Set<Unidade>();
      set.add(unidade);
      uso.set(k, set);
    };
    for (const row of brutos) {
      const base = `${row.unidade}|${row.crm}|${row.uf}`;
      const lista = profissoes.get(base) ?? [];
      if (row.producao) {
        const pf1 = lista.find((item) => item.pfcrm === '1') ?? null;
        const escolhido = pf1 ?? (lista.length === 1 ? lista[0] : null);
        if (!escolhido) continue;
        adicionarUso(row.unidade, row.crm, row.uf, escolhido.pfcrm);
        if (!pf1 && escolhido.pfcrm !== '1') herdadas.add(base);
        producaoAlvo.set(base, {
          unidade: row.unidade,
          crm: row.crm,
          uf: row.uf,
          pfcrm: escolhido.pfcrm,
          nome: escolhido.nome,
        });
        continue;
      }
      if (row.pfcrm) {
        adicionarUso(row.unidade, row.crm, row.uf, row.pfcrm);
        continue;
      }
      if (lista.length === 1) {
        adicionarUso(row.unidade, row.crm, row.uf, lista[0].pfcrm);
        if (lista[0].pfcrm !== '1') herdadas.add(base);
        continue;
      }
      if (lista.length > 1) {
        ambiguas.add(base);
        continue;
      }
      const nest = nestPorCrmUf.get(`${row.crm}|${row.uf}`);
      if (nest?.size === 1) {
        adicionarUso(row.unidade, row.crm, row.uf, [...nest][0]);
      }
    }
    const herancas: HerancaPf[] = [];
    for (const [base, lista] of profissoes) {
      if (lista.length !== 1) continue;
      const [unidade, crmTxt, uf] = base.split('|');
      herancas.push({
        unidade,
        crm: Number(crmTxt),
        uf,
        pfcrm: lista[0].pfcrm,
        nome: lista[0].nome,
      });
    }

    const porChave = new Map<string, PrescritorRow[]>();
    for (const p of prescritores) {
      const k = this.chave(p.numeroCRM, p.UFCRM, p.pfcrm);
      const list = porChave.get(k) ?? [];
      list.push(p);
      porChave.set(k, list);
    }

    this.publicar('plano', 'Montando cópias, atribuições e herança de profissão…');
    const plano: PlanoLinha[] = [];
    let semCadastroErp = 0;
    let semNomeIgnorados = 0;
    const chavesUsadas = new Set<string>();

    for (const [chave, unidades] of uso) {
      chavesUsadas.add(chave);
      const rows = porChave.get(chave) ?? [];
      const nullRow = rows.find((r) => !r.unidade) ?? null;
      const units = [...unidades];
      const keeper = this.escolherKeeper(nullRow?.id ?? null, units, vendasAgg);
      let nullConsumido = false;

      for (const unidade of units) {
        const existente = rows.find((r) => r.unidade === unidade) ?? null;
        const nomeErp = erp.get(`${unidade}|${chave}`) ?? null;
        const nomeNest = existente?.nome || nullRow?.nome || '';
        if (!nomeErp && !nomeNest) {
          semNomeIgnorados++;
          continue;
        }
        const nome = nomeErp || nomeNest;
        if (!nomeErp) semCadastroErp++;
        const origem: 'erp' | 'nest' = nomeErp ? 'erp' : 'nest';

        if (existente) {
          plano.push({
            id: existente.id,
            chave,
            unidade,
            crm: existente.numeroCRM,
            uf: existente.UFCRM,
            pfcrm: existente.pfcrm,
            nome,
            origem,
            acao: existente.nome !== nome ? 'atualizar' : 'ok',
            nomeAnterior: existente.nome,
          });
          continue;
        }

        if (nullRow && unidade === keeper && !nullConsumido) {
          nullConsumido = true;
          plano.push({
            id: nullRow.id,
            chave,
            unidade,
            crm: nullRow.numeroCRM,
            uf: nullRow.UFCRM,
            pfcrm: nullRow.pfcrm,
            nome,
            origem,
            acao: 'atribuir',
            nomeAnterior: nullRow.nome,
          });
          continue;
        }

        const [crmTxt, uf, pfcrm] = chave.split('|');
        plano.push({
          id: randomUUID(),
          chave,
          unidade,
          crm: Number(crmTxt),
          uf,
          pfcrm,
          nome,
          origem,
          acao: 'criar',
          nomeAnterior: null,
        });
      }
    }

    const idPorUnidadeChave = new Map<string, string>();
    for (const linha of plano) {
      idPorUnidadeChave.set(`${linha.unidade}|${linha.chave}`, linha.id);
    }
    const idParaChave = new Map<string, string>();
    for (const p of prescritores) {
      idParaChave.set(p.id, this.chave(p.numeroCRM, p.UFCRM, p.pfcrm));
    }

    let vendasRepontadas = 0;
    for (const [key, n] of vendasAgg) {
      const [unidade, prescritorId] = key.split('|');
      if (!unidade) continue;
      const chave = idParaChave.get(prescritorId);
      if (!chave) continue;
      const alvo = idPorUnidadeChave.get(`${unidade}|${chave}`);
      if (alvo && alvo !== prescritorId) vendasRepontadas += n;
    }

    const planoSemChave = await this.montarPlanoSemChave(vendasAgg);
    for (const linha of planoSemChave) {
      if (linha.acao === 'criar') vendasRepontadas += linha.vendas;
    }

    this.publicar(
      'plano',
      'Contando retrato, carteira, histórico e produção…',
    );
    const refs = await this.contarReferencias(plano, herancas, [...producaoAlvo.values()]);
    const prescritoresSemUnidade = prescritores.filter((p) => {
      if (p.unidade) return false;
      const k = this.chave(p.numeroCRM, p.UFCRM, p.pfcrm);
      if (!chavesUsadas.has(k)) return true;
      const ficou = plano.some((l) => l.id === p.id);
      return !ficou;
    }).length;

    const resposta: ReplicarPrescritoresUnidadeResponseDto = {
      aplicar,
      triadesComUso: uso.size,
      copiasCriadas: plano.filter((p) => p.acao === 'criar').length,
      atribuicoes: plano.filter((p) => p.acao === 'atribuir').length,
      nomesCadastroAtualizados: plano.filter(
        (p) =>
          (p.acao === 'atualizar' || p.acao === 'atribuir') &&
          p.nomeAnterior !== p.nome,
      ).length,
      semCadastroErp,
      profissoesHerdadas: herdadas.size,
      profissoesAmbiguas: ambiguas.size,
      semNomeIgnorados,
      prescritoresVendaTerceiro: planoSemChave.filter((p) => p.acao === 'atribuir').length,
      copiasVendaTerceiro: planoSemChave.filter((p) => p.acao === 'criar').length,
      prescritoresSemUnidade,
      vendasRepontadas,
      vendasSemUnidade,
      retratoMedico: refs.medico,
      retratoCarteira: refs.carteira,
      historicoPainel: refs.historico,
      producao: refs.producao,
      agentesConsultados,
      erros,
      amostra: this.amostra(plano),
    };

    if (!aplicar) {
      this.logger.log(
        `Réplica prescritores prévia triades=${resposta.triadesComUso} criar=${resposta.copiasCriadas} atribuir=${resposta.atribuicoes} herdadas=${resposta.profissoesHerdadas} ambiguas=${resposta.profissoesAmbiguas} semNome=${resposta.semNomeIgnorados}`,
      );
      return resposta;
    }

    if (!agentesConsultados.length) {
      throw new BadRequestException(
        erros[0] ||
          'Nenhum agente consultado. A réplica não grava sem o cadastro do ERP.',
      );
    }

    await this.aplicar(plano, herancas, [...producaoAlvo.values()], planoSemChave);
    this.encerrarAplicacao(
      'concluido',
      `Réplica aplicada: ${resposta.copiasCriadas} cópias, ${resposta.atribuicoes} atribuições, ${resposta.vendasRepontadas} vendas.`,
    );
    this.logger.log(
      `Réplica prescritores aplicada criar=${resposta.copiasCriadas} atribuir=${resposta.atribuicoes} vendas=${resposta.vendasRepontadas}`,
    );
    return resposta;
  }

  private async aplicar(
    plano: PlanoLinha[],
    herancas: HerancaPf[],
    producao: HerancaPf[],
    planoSemChave: PlanoSemChave[],
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const gravar = plano.filter((linha) => linha.acao !== 'ok');
      let gravados = 0;
      this.publicar(
        'prescritores',
        `Gravando prescritores: 0 de ${gravar.length}…`,
      );
      for (const linha of plano) {
        if (linha.acao === 'ok') continue;
        gravados++;
        if (gravados === 1 || gravados % 100 === 0 || gravados === gravar.length) {
          this.publicar(
            'prescritores',
            `Gravando prescritores: ${gravados} de ${gravar.length}…`,
          );
        }
        if (linha.acao === 'criar') {
          await qr.query(
            `
            INSERT INTO prescritores
              (id, nome, "numeroCRM", "UFCRM", pfcrm, unidade, "criadoEm", "atualizadoEm")
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            `,
            [linha.id, linha.nome, linha.crm, linha.uf, linha.pfcrm, linha.unidade],
          );
        } else if (linha.acao === 'atribuir' || linha.acao === 'atualizar') {
          await qr.query(
            `
            UPDATE prescritores
            SET unidade = $2, nome = $3, "atualizadoEm" = NOW()
            WHERE id = $1
            `,
            [linha.id, linha.unidade, linha.nome],
          );
        }
      }

      this.publicar(
        'terceiro',
        'Ajustando prescritores sem CRM ou UF pela venda de terceiro…',
      );
      await this.aplicarSemChave(qr, planoSemChave);
      this.publicar('pfcrm', 'Preenchendo profissão vazia nos movimentos…');
      await this.preencherPfcrmVazio(qr, herancas);

      this.publicar('vendas', 'Repontando vendas para o prescritor da unidade…');
      await qr.query(`
        UPDATE vendas v
        SET "prescritorId" = alvo.id, "atualizadoEm" = NOW()
        FROM prescritores atual
        JOIN prescritores alvo
          ON alvo."numeroCRM" = atual."numeroCRM"
         AND UPPER(BTRIM(alvo."UFCRM")) = UPPER(BTRIM(atual."UFCRM"))
         AND UPPER(BTRIM(alvo.pfcrm)) = UPPER(BTRIM(atual.pfcrm))
        WHERE v."prescritorId" = atual.id
          AND v.unidade IS NOT NULL
          AND alvo.unidade = v.unidade::text
          AND alvo.id <> atual.id
      `);

      const paramsHeranca = this.paramsHeranca(herancas);
      this.publicar('retrato', 'Atualizando nomes do retrato de visitação…');
      await qr.query(
        `
        UPDATE visitacao_fechamento_medico m
        SET nome_medico = p.nome, "atualizadoEm" = NOW()
        FROM prescritores p
        LEFT JOIN unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[])
          AS her(unidade, crm, uf, pfcrm)
          ON her.unidade = p.unidade
         AND her.crm = p."numeroCRM"
         AND her.uf = UPPER(BTRIM(p."UFCRM"))
        WHERE p.unidade = m.unidade
          AND p."numeroCRM" = NULLIF(regexp_replace(BTRIM(m.crm_medico), '\\D', '', 'g'), '')::int
          AND UPPER(BTRIM(p."UFCRM")) = UPPER(BTRIM(m.uf_crm_medico))
          AND UPPER(BTRIM(p.pfcrm)) = CASE
            WHEN NULLIF(BTRIM(m.pfcrm), '') IS NULL THEN her.pfcrm
            ELSE UPPER(BTRIM(m.pfcrm))
          END
          AND UPPER(BTRIM(COALESCE(m.nome_medico, ''))) IS DISTINCT FROM UPPER(BTRIM(p.nome))
        `,
        paramsHeranca,
      );

      this.publicar('carteira', 'Atualizando nomes da carteira…');
      await qr.query(
        `
        UPDATE visitacao_fechamento_carteira c
        SET nome_medico = p.nome, "atualizadoEm" = NOW()
        FROM visitacao_fechamento f
        JOIN prescritores p ON p.unidade = f.unidade
        LEFT JOIN unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[])
          AS her(unidade, crm, uf, pfcrm)
          ON her.unidade = p.unidade
         AND her.crm = p."numeroCRM"
         AND her.uf = UPPER(BTRIM(p."UFCRM"))
        WHERE f.id = c.fechamento_id
          AND p."numeroCRM" = NULLIF(regexp_replace(BTRIM(c.crm_medico), '\\D', '', 'g'), '')::int
          AND UPPER(BTRIM(p."UFCRM")) = UPPER(BTRIM(c.uf_crm_medico))
          AND UPPER(BTRIM(p.pfcrm)) = CASE
            WHEN NULLIF(BTRIM(c.pfcrm), '') IS NULL THEN her.pfcrm
            ELSE UPPER(BTRIM(c.pfcrm))
          END
          AND UPPER(BTRIM(COALESCE(c.nome_medico, ''))) IS DISTINCT FROM UPPER(BTRIM(p.nome))
        `,
        paramsHeranca,
      );

      this.publicar('historico', 'Atualizando nomes do histórico do painel…');
      await qr.query(
        `
        UPDATE painel_medicos_representantes_historico h
        SET "nomeMedico" = p.nome, "atualizadoEm" = NOW()
        FROM prescritores p
        LEFT JOIN unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[])
          AS her(unidade, crm, uf, pfcrm)
          ON her.unidade = p.unidade
         AND her.crm = p."numeroCRM"
         AND her.uf = UPPER(BTRIM(p."UFCRM"))
        WHERE p.unidade = h.unidade
          AND p."numeroCRM" = NULLIF(regexp_replace(BTRIM(h."crmMedico"), '\\D', '', 'g'), '')::int
          AND UPPER(BTRIM(p."UFCRM")) = UPPER(BTRIM(h."ufCrmMedico"))
          AND UPPER(BTRIM(p.pfcrm)) = CASE
            WHEN NULLIF(BTRIM(h.pfcrm), '') IS NULL THEN her.pfcrm
            ELSE UPPER(BTRIM(h.pfcrm))
          END
          AND UPPER(BTRIM(COALESCE(h."nomeMedico", ''))) IS DISTINCT FROM UPPER(BTRIM(p.nome))
        `,
        paramsHeranca,
      );

      this.publicar(
        'producao',
        producao.length
          ? 'Atualizando nomes da produção…'
          : 'Produção sem nome para regravar.',
      );
      if (producao.length) {
        await qr.query(
          `
          UPDATE producao_etapas_resumo e
          SET "nomePrescritor" = t.nome, "atualizadoEm" = NOW()
          FROM unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[])
            AS t(unidade, crm, uf, nome)
          WHERE t.unidade = e.unidade
            AND t.crm = NULLIF(regexp_replace(BTRIM(e.crf), '\\D', '', 'g'), '')::int
            AND t.uf = UPPER(BTRIM(e."ufCrf"))
            AND UPPER(BTRIM(COALESCE(e."nomePrescritor", ''))) IS DISTINCT FROM UPPER(BTRIM(t.nome))
          `,
          this.paramsProducao(producao),
        );
      }

      this.publicar('commit', 'Confirmando a transação…');
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async contarReferencias(
    plano: PlanoLinha[],
    herancas: HerancaPf[],
    producaoAlvo: HerancaPf[],
  ): Promise<{ medico: number; carteira: number; historico: number; producao: number }> {
    const vazio = { medico: 0, carteira: 0, historico: 0, producao: 0 };
    let medico = 0;
    let carteira = 0;
    let historico = 0;
    if (plano.length) {
      const params = [
        plano.map((p) => p.unidade),
        plano.map((p) => p.crm),
        plano.map((p) => p.uf),
        plano.map((p) => p.pfcrm),
        plano.map((p) => p.nome),
        ...this.paramsHeranca(herancas),
      ];
      const join = `
        JOIN unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[], $5::varchar[])
          AS t(unidade, crm, uf, pfcrm, nome)
      `;
      const her = `
        LEFT JOIN unnest($6::varchar[], $7::int[], $8::varchar[], $9::varchar[])
          AS her(unidade, crm, uf, pfcrm)
      `;
      medico = await this.contar(`
        SELECT COUNT(*)::int AS n
        FROM visitacao_fechamento_medico m
        ${join}
          ON t.unidade = m.unidade
         AND t.crm = NULLIF(regexp_replace(BTRIM(m.crm_medico), '\\D', '', 'g'), '')::int
         AND t.uf = UPPER(BTRIM(m.uf_crm_medico))
        ${her}
          ON her.unidade = m.unidade AND her.crm = t.crm AND her.uf = t.uf
        WHERE t.pfcrm = CASE
          WHEN NULLIF(BTRIM(m.pfcrm), '') IS NULL THEN her.pfcrm
          ELSE UPPER(BTRIM(m.pfcrm))
        END
          AND UPPER(BTRIM(COALESCE(m.nome_medico, ''))) IS DISTINCT FROM UPPER(BTRIM(t.nome))
      `, params);
      carteira = await this.contar(`
        SELECT COUNT(*)::int AS n
        FROM visitacao_fechamento_carteira c
        JOIN visitacao_fechamento f ON f.id = c.fechamento_id
        ${join}
          ON t.unidade = f.unidade
         AND t.crm = NULLIF(regexp_replace(BTRIM(c.crm_medico), '\\D', '', 'g'), '')::int
         AND t.uf = UPPER(BTRIM(c.uf_crm_medico))
        ${her}
          ON her.unidade = f.unidade AND her.crm = t.crm AND her.uf = t.uf
        WHERE t.pfcrm = CASE
          WHEN NULLIF(BTRIM(c.pfcrm), '') IS NULL THEN her.pfcrm
          ELSE UPPER(BTRIM(c.pfcrm))
        END
          AND UPPER(BTRIM(COALESCE(c.nome_medico, ''))) IS DISTINCT FROM UPPER(BTRIM(t.nome))
      `, params);
      historico = await this.contar(`
        SELECT COUNT(*)::int AS n
        FROM painel_medicos_representantes_historico h
        ${join}
          ON t.unidade = h.unidade
         AND t.crm = NULLIF(regexp_replace(BTRIM(h."crmMedico"), '\\D', '', 'g'), '')::int
         AND t.uf = UPPER(BTRIM(h."ufCrmMedico"))
        ${her}
          ON her.unidade = h.unidade AND her.crm = t.crm AND her.uf = t.uf
        WHERE t.pfcrm = CASE
          WHEN NULLIF(BTRIM(h.pfcrm), '') IS NULL THEN her.pfcrm
          ELSE UPPER(BTRIM(h.pfcrm))
        END
          AND UPPER(BTRIM(COALESCE(h."nomeMedico", ''))) IS DISTINCT FROM UPPER(BTRIM(t.nome))
      `, params);
    }
    const producao = producaoAlvo.length
      ? await this.contar(`
          SELECT COUNT(*)::int AS n
          FROM producao_etapas_resumo e
          JOIN unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[])
            AS t(unidade, crm, uf, nome)
            ON t.unidade = e.unidade
           AND t.crm = NULLIF(regexp_replace(BTRIM(e.crf), '\\D', '', 'g'), '')::int
           AND t.uf = UPPER(BTRIM(e."ufCrf"))
          WHERE UPPER(BTRIM(COALESCE(e."nomePrescritor", ''))) IS DISTINCT FROM UPPER(BTRIM(t.nome))
        `, this.paramsProducao(producaoAlvo))
      : 0;
    if (!plano.length && !producao) return vazio;
    return { medico, carteira, historico, producao };
  }

  private async contar(sql: string, params: unknown[]): Promise<number> {
    const rows = (await this.dataSource.query(sql, params)) as Array<{ n: number }>;
    return Number(rows[0]?.n ?? 0);
  }

  private amostra(plano: PlanoLinha[]): ReplicarPrescritorAmostraDto[] {
    const grupos = new Map<string, PlanoLinha[]>();
    for (const linha of plano) {
      const list = grupos.get(linha.chave) ?? [];
      list.push(linha);
      grupos.set(linha.chave, list);
    }
    const out: ReplicarPrescritorAmostraDto[] = [];
    for (const [chave, linhas] of grupos) {
      const nomes = new Set(linhas.map((l) => l.nome));
      if (nomes.size < 2) continue;
      const [crm, uf, pfcrm] = chave.split('|');
      out.push({
        crm,
        uf,
        pfcrm,
        porUnidade: linhas.map((l) => ({
          unidade: l.unidade,
          nome: l.nome,
          origem: l.origem,
        })),
      });
      if (out.length >= 15) break;
    }
    return out;
  }

  private escolherKeeper(
    nullId: string | null,
    units: Unidade[],
    vendasAgg: Map<string, number>,
  ): Unidade {
    let melhor = units[0];
    let melhorN = -1;
    const ordenadas = [...units].sort(
      (a, b) => ORDEM_UNIDADE.indexOf(a) - ORDEM_UNIDADE.indexOf(b),
    );
    for (const unidade of ordenadas) {
      const n = nullId ? vendasAgg.get(`${unidade}|${nullId}`) ?? 0 : 0;
      if (n > melhorN) {
        melhorN = n;
        melhor = unidade;
      }
    }
    return melhor;
  }

  private async carregarVendasAgg(): Promise<Map<string, number>> {
    const rows = (await this.dataSource.query(`
      SELECT v.unidade::text AS unidade, v."prescritorId" AS id, COUNT(*)::int AS n
      FROM vendas v
      WHERE v."prescritorId" IS NOT NULL AND v.unidade IS NOT NULL
      GROUP BY 1, 2
    `)) as Array<{ unidade: string; id: string; n: number }>;
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(`${row.unidade}|${row.id}`, Number(row.n));
    }
    return map;
  }

  private async contarVendasSemUnidade(): Promise<number> {
    const rows = (await this.dataSource.query(`
      SELECT COUNT(*)::int AS n
      FROM vendas
      WHERE "prescritorId" IS NOT NULL AND unidade IS NULL
    `)) as Array<{ n: number }>;
    return Number(rows[0]?.n ?? 0);
  }

  private async carregarPrescritores(): Promise<PrescritorRow[]> {
    const rows = (await this.dataSource.query(`
      SELECT id, nome, "numeroCRM" AS "numeroCRM", "UFCRM" AS "UFCRM",
             pfcrm, unidade
      FROM prescritores
      WHERE "numeroCRM" IS NOT NULL AND "UFCRM" IS NOT NULL AND BTRIM("UFCRM") <> ''
    `)) as PrescritorRow[];
    return rows.map((r) => ({
      ...r,
      numeroCRM: Number(r.numeroCRM),
      UFCRM: String(r.UFCRM).trim().toUpperCase(),
      pfcrm: (r.pfcrm || PF_CRM_PADRAO_VISITACAO).trim().toUpperCase(),
      unidade: r.unidade ? String(r.unidade) : null,
      nome: r.nome || '',
    }));
  }

  private async carregarUso(): Promise<UsoBruto[]> {
    const rows = (await this.dataSource.query(`
      SELECT unidade::text AS unidade, crm, uf, pfcrm, origem FROM (
        SELECT o.unidade,
               NULLIF(regexp_replace(BTRIM(o."crmMedico"), '\\D', '', 'g'), '') AS crm,
               UPPER(BTRIM(o."ufcrmMedico")) AS uf,
               NULLIF(UPPER(BTRIM(o.pfcrm)), '') AS pfcrm,
               'movimento' AS origem
        FROM orcamentos o
        UNION
        SELECT c.unidade,
               NULLIF(regexp_replace(BTRIM(c.crm_medico), '\\D', '', 'g'), ''),
               UPPER(BTRIM(c.uf_crm_medico)),
               NULLIF(UPPER(BTRIM(c.pfcrm)), ''),
               'movimento'
        FROM caixa_requisicoes_pagas c
        UNION
        SELECT f.unidade,
               NULLIF(regexp_replace(BTRIM(f.crm_medico), '\\D', '', 'g'), ''),
               UPPER(BTRIM(f.uf_crm_medico)),
               NULLIF(UPPER(BTRIM(f.pfcrm)), ''),
               'movimento'
        FROM caixa_requisicao_formula f
        UNION
        SELECT i.unidade,
               NULLIF(regexp_replace(BTRIM(i.crm_medico), '\\D', '', 'g'), ''),
               UPPER(BTRIM(i.uf_crm_medico)),
               NULLIF(UPPER(BTRIM(i.pfcrm)), ''),
               'movimento'
        FROM caixa_itens_erp i
        UNION
        SELECT p.unidade,
               NULLIF(regexp_replace(BTRIM(p."crmMedico"), '\\D', '', 'g'), ''),
               UPPER(BTRIM(p."ufCrmMedico")),
               NULLIF(UPPER(BTRIM(p.pfcrm)), ''),
               'movimento'
        FROM painel_medicos_representantes p
        UNION
        SELECT h.unidade,
               NULLIF(regexp_replace(BTRIM(h."crmMedico"), '\\D', '', 'g'), ''),
               UPPER(BTRIM(h."ufCrmMedico")),
               NULLIF(UPPER(BTRIM(h.pfcrm)), ''),
               'movimento'
        FROM painel_medicos_representantes_historico h
        UNION
        SELECT m.unidade,
               NULLIF(regexp_replace(BTRIM(m.crm_medico), '\\D', '', 'g'), ''),
               UPPER(BTRIM(m.uf_crm_medico)),
               NULLIF(UPPER(BTRIM(m.pfcrm)), ''),
               'movimento'
        FROM visitacao_fechamento_medico m
        UNION
        SELECT f.unidade,
               NULLIF(regexp_replace(BTRIM(c.crm_medico), '\\D', '', 'g'), ''),
               UPPER(BTRIM(c.uf_crm_medico)),
               NULLIF(UPPER(BTRIM(c.pfcrm)), ''),
               'movimento'
        FROM visitacao_fechamento_carteira c
        JOIN visitacao_fechamento f ON f.id = c.fechamento_id
        UNION
        SELECT e.unidade,
               NULLIF(regexp_replace(BTRIM(e.crf), '\\D', '', 'g'), ''),
               UPPER(BTRIM(e."ufCrf")),
               NULL::varchar,
               'producao'
        FROM producao_etapas_resumo e
        UNION
        SELECT v.unidade::text,
               pr."numeroCRM"::text,
               UPPER(BTRIM(pr."UFCRM")),
               NULLIF(UPPER(BTRIM(pr.pfcrm)), ''),
               'movimento'
        FROM vendas v
        JOIN prescritores pr ON pr.id = v."prescritorId"
        WHERE v.unidade IS NOT NULL
      ) u
      WHERE crm IS NOT NULL AND crm ~ '^[0-9]+$' AND uf IS NOT NULL AND BTRIM(uf) <> ''
        AND unidade IS NOT NULL AND BTRIM(unidade) <> ''
    `)) as Array<{ unidade: string; crm: string; uf: string; pfcrm: string | null; origem: string }>;

    const out: UsoBruto[] = [];
    for (const row of rows) {
      if (!Object.values(Unidade).includes(row.unidade as Unidade)) continue;
      const crm = parseCrmNumero(row.crm);
      const uf = normalizarUfCrm(row.uf);
      if (crm == null || !uf) continue;
      out.push({
        unidade: row.unidade as Unidade,
        crm,
        uf,
        pfcrm: normalizarPfCrm(row.pfcrm) ?? null,
        producao: row.origem === 'producao',
      });
    }
    return out;
  }

  private async carregarErp(
    agentesConsultados: string[],
    erros: string[],
  ): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    const configs = await this.configRepository.find({
      where: { ativo: true },
      order: { agente: 'ASC' },
    });
    const agentesConfig = this.configService.get('agentes') as Record<
      string,
      { url?: string; token?: string }
    >;
    if (!configs.length) {
      erros.push('Nenhuma configuração de sincronização ativa.');
      return mapa;
    }
    for (const config of configs) {
      const unidade = AGENTE_UNIDADE[config.agente];
      if (!unidade) {
        erros.push(`Agente ${config.agente}: sem unidade mapeada`);
        continue;
      }
      const agenteCfg = agentesConfig?.[config.agente];
      if (!agenteCfg?.url || !agenteCfg?.token) {
        erros.push(`Agente ${config.agente}: URL/token ausente`);
        continue;
      }
      this.publicar('agentes', `Consultando ${config.agente} (${unidade})…`);
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
          pfcrm?: string;
          nrcrm?: number | string;
          ufcrm?: string;
          nomemed?: string;
        }>;
        agentesConsultados.push(config.agente);
        for (const row of data || []) {
          const crm = parseCrmNumero(row.nrcrm);
          const uf = normalizarUfCrm(row.ufcrm);
          const pfcrm = normalizarPfCrm(row.pfcrm) ?? PF_CRM_PADRAO_VISITACAO;
          const nome =
            padronizarNomeDeSistemaLegado(String(row.nomemed ?? '')) ||
            String(row.nomemed ?? '').trim();
          if (crm == null || !uf || !nome) continue;
          mapa.set(`${unidade}|${this.chave(crm, uf, pfcrm)}`, nome);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`Agente ${config.agente}: ${msg}`);
      }
    }
    return mapa;
  }

  private async montarPlanoSemChave(
    vendasAgg: Map<string, number>,
  ): Promise<PlanoSemChave[]> {
    const rows = (await this.dataSource.query(`
      SELECT id, nome, pfcrm
      FROM prescritores
      WHERE unidade IS NULL
        AND ("numeroCRM" IS NULL OR "UFCRM" IS NULL OR BTRIM("UFCRM") = '')
    `)) as Array<{ id: string; nome: string | null; pfcrm: string | null }>;
    const porId = new Map(rows.map((r) => [r.id, r]));
    const unidadesPorId = new Map<string, Unidade[]>();
    for (const [key] of vendasAgg) {
      const sep = key.indexOf('|');
      if (sep < 0) continue;
      const unidade = key.slice(0, sep);
      const id = key.slice(sep + 1);
      if (!porId.has(id)) continue;
      if (!Object.values(Unidade).includes(unidade as Unidade)) continue;
      const lista = unidadesPorId.get(id) ?? [];
      if (!lista.includes(unidade as Unidade)) lista.push(unidade as Unidade);
      unidadesPorId.set(id, lista);
    }
    const plano: PlanoSemChave[] = [];
    for (const [id, unidades] of unidadesPorId) {
      const row = porId.get(id);
      if (!row) continue;
      const keeper = this.escolherKeeper(id, unidades, vendasAgg);
      const nome = (row.nome || '').trim() || 'SEM NOME';
      const pfcrm = (row.pfcrm || PF_CRM_PADRAO_VISITACAO).trim().toUpperCase();
      for (const unidade of unidades) {
        const vendas = vendasAgg.get(`${unidade}|${id}`) ?? 0;
        if (unidade === keeper) {
          plano.push({
            id,
            prescritorAtualId: id,
            unidade,
            nome,
            pfcrm,
            acao: 'atribuir',
            vendas,
          });
          continue;
        }
        plano.push({
          id: randomUUID(),
          prescritorAtualId: id,
          unidade,
          nome,
          pfcrm,
          acao: 'criar',
          vendas,
        });
      }
    }
    return plano;
  }

  private async aplicarSemChave(
    qr: QueryRunner,
    plano: PlanoSemChave[],
  ): Promise<void> {
    for (const linha of plano) {
      if (linha.acao === 'criar') {
        await qr.query(
          `
          INSERT INTO prescritores
            (id, nome, "numeroCRM", "UFCRM", pfcrm, unidade, "criadoEm", "atualizadoEm")
          VALUES ($1, $2, NULL, NULL, $3, $4, NOW(), NOW())
          `,
          [linha.id, linha.nome, linha.pfcrm, linha.unidade],
        );
        await qr.query(
          `
          UPDATE vendas
          SET "prescritorId" = $1, "atualizadoEm" = NOW()
          WHERE "prescritorId" = $2 AND unidade::text = $3
          `,
          [linha.id, linha.prescritorAtualId, linha.unidade],
        );
        continue;
      }
      await qr.query(
        `
        UPDATE prescritores
        SET unidade = $2, "atualizadoEm" = NOW()
        WHERE id = $1 AND unidade IS NULL
        `,
        [linha.id, linha.unidade],
      );
    }
  }

  private chave(crm: number, uf: string, pfcrm: string): string {
    return `${crm}|${uf}|${pfcrm}`;
  }

  private profissoesPorCrmUf(
    erp: Map<string, string>,
  ): Map<string, Array<{ pfcrm: string; nome: string }>> {
    const acc = new Map<string, Map<string, string>>();
    for (const [chave, nome] of erp) {
      const partes = chave.split('|');
      if (partes.length !== 4) continue;
      const [unidade, crm, uf, pfcrm] = partes;
      const base = `${unidade}|${crm}|${uf}`;
      const pf = acc.get(base) ?? new Map<string, string>();
      pf.set(pfcrm, nome);
      acc.set(base, pf);
    }
    const out = new Map<string, Array<{ pfcrm: string; nome: string }>>();
    for (const [base, pf] of acc) {
      out.set(
        base,
        [...pf.entries()].map(([pfcrm, nome]) => ({ pfcrm, nome })),
      );
    }
    return out;
  }

  private paramsHeranca(herancas: HerancaPf[]): unknown[] {
    return [
      herancas.map((h) => h.unidade),
      herancas.map((h) => h.crm),
      herancas.map((h) => h.uf),
      herancas.map((h) => h.pfcrm),
    ];
  }

  private paramsProducao(producao: HerancaPf[]): unknown[] {
    return [
      producao.map((h) => h.unidade),
      producao.map((h) => h.crm),
      producao.map((h) => h.uf),
      producao.map((h) => h.nome),
    ];
  }

  private async preencherPfcrmVazio(
    qr: QueryRunner,
    herancas: HerancaPf[],
  ): Promise<void> {
    if (!herancas.length) return;
    const params = this.paramsHeranca(herancas);
    const fonte = `unnest($1::varchar[], $2::int[], $3::varchar[], $4::varchar[]) AS her(unidade, crm, uf, pfcrm)`;
    const crm = (expr: string): string =>
      `NULLIF(regexp_replace(BTRIM(${expr}), '\\D', '', 'g'), '')::int`;
    const vazio = (col: string): string => `(${col} IS NULL OR BTRIM(${col}) = '')`;
    const alvos = [
      `UPDATE orcamentos o SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE o.unidade = her.unidade AND her.crm = ${crm('o."crmMedico"')}
          AND her.uf = UPPER(BTRIM(o."ufcrmMedico")) AND ${vazio('o.pfcrm')}`,
      `UPDATE caixa_requisicoes_pagas c SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE c.unidade = her.unidade AND her.crm = ${crm('c.crm_medico')}
          AND her.uf = UPPER(BTRIM(c.uf_crm_medico)) AND ${vazio('c.pfcrm')}`,
      `UPDATE caixa_requisicao_formula f SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE f.unidade = her.unidade AND her.crm = ${crm('f.crm_medico')}
          AND her.uf = UPPER(BTRIM(f.uf_crm_medico)) AND ${vazio('f.pfcrm')}`,
      `UPDATE caixa_itens_erp i SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE i.unidade = her.unidade AND her.crm = ${crm('i.crm_medico')}
          AND her.uf = UPPER(BTRIM(i.uf_crm_medico)) AND ${vazio('i.pfcrm')}`,
      `UPDATE painel_medicos_representantes p SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE p.unidade = her.unidade AND her.crm = ${crm('p."crmMedico"')}
          AND her.uf = UPPER(BTRIM(p."ufCrmMedico")) AND ${vazio('p.pfcrm')}`,
      `UPDATE painel_medicos_representantes_historico h SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE h.unidade = her.unidade AND her.crm = ${crm('h."crmMedico"')}
          AND her.uf = UPPER(BTRIM(h."ufCrmMedico")) AND ${vazio('h.pfcrm')}`,
      `UPDATE visitacao_fechamento_medico m SET pfcrm = her.pfcrm FROM ${fonte}
        WHERE m.unidade = her.unidade AND her.crm = ${crm('m.crm_medico')}
          AND her.uf = UPPER(BTRIM(m.uf_crm_medico)) AND ${vazio('m.pfcrm')}`,
      `UPDATE visitacao_fechamento_carteira c SET pfcrm = her.pfcrm
        FROM visitacao_fechamento f
        JOIN ${fonte} ON her.unidade = f.unidade
        WHERE f.id = c.fechamento_id AND her.crm = ${crm('c.crm_medico')}
          AND her.uf = UPPER(BTRIM(c.uf_crm_medico)) AND ${vazio('c.pfcrm')}`,
    ];
    for (const sql of alvos) {
      await qr.query(sql, params);
    }
  }
}
