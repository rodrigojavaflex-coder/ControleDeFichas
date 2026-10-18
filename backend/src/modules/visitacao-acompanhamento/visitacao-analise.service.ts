import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { resolverEscopoListaFechamentoPorUsuario } from '../folha/utils/folha-unidade-scope.util';
import { VisitacaoFechamento } from './entities/visitacao-fechamento.entity';
import { VisitacaoFechamentoMedico } from './entities/visitacao-fechamento-medico.entity';
import {
  FindVisitacaoAnaliseDto,
  FindVisitacaoAnaliseOpcoesDto,
  VisitacaoAnaliseCompetenciaRef,
  VisitacaoAnaliseModo,
  parseCompetenciaKey,
} from './dto/find-visitacao-analise.dto';
import {
  VisitacaoAnaliseCompetenciaDto,
  VisitacaoAnaliseMedicoDto,
  VisitacaoAnaliseOpcoesResponseDto,
  VisitacaoAnaliseResponseDto,
} from './dto/visitacao-analise-response.dto';
import { VisitacaoPainelMedicoRepresentanteDto } from '../visitacao-painel-medico/dto/visitacao-painel-medico-representante.dto';

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

type AgregadoComparativoRow = {
  crm_medico: string;
  uf_crm_medico: string;
  nome_medico: string;
  nome_representante: string | null;
  recebido_mes1: string | number;
  recebido_mes2: string | number;
  rejeitado_mes1: string | number;
  rejeitado_mes2: string | number;
};

type AgregadoRankingRow = {
  crm_medico: string;
  uf_crm_medico: string;
  nome_medico: string;
  nome_representante: string | null;
  recebido_periodo: string | number;
  rejeitado_periodo: string | number;
};

type MedicoValores = {
  crmMedico: string;
  ufCrmMedico: string;
  nomeMedico: string;
  nomeRepresentante: string | null;
  valorMes1: number | null;
  valorMes2: number | null;
};

type FiltrosAnalise = Pick<
  FindVisitacaoAnaliseDto,
  'funcionarioId' | 'nomeMedico' | 'naCarteira' | 'top'
>;

@Injectable()
export class VisitacaoAnaliseService {
  private readonly logger = new Logger(VisitacaoAnaliseService.name);

  constructor(
    @InjectRepository(VisitacaoFechamento)
    private readonly fechamentoRepository: Repository<VisitacaoFechamento>,
    @InjectRepository(VisitacaoFechamentoMedico)
    private readonly fechamentoMedicoRepository: Repository<VisitacaoFechamentoMedico>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
  ) {}

  async opcoes(
    usuario: Usuario,
    dto: FindVisitacaoAnaliseOpcoesDto,
  ): Promise<VisitacaoAnaliseOpcoesResponseDto> {
    const iniciouEm = Date.now();
    const unidade = this.resolverUnidadeObrigatoria(usuario, dto.unidade);

    // Competências + representantes em paralelo (rápido para popular Ano/Competência na UI).
    const [competenciasDisponiveis, representantes] = await Promise.all([
      this.listarCompetenciasFechadas(unidade),
      this.listarRepresentantesRapido(usuario, unidade),
    ]);

    // Análise embutida é opcional e cara — a tela prefere carregar opções primeiro
    // e chamar GET /analise em seguida (evita "Carregando…" nos filtros).
    let analise: VisitacaoAnaliseResponseDto | null = null;
    if (dto.comAnalise && competenciasDisponiveis.length >= 2) {
      const c1 = competenciasDisponiveis[competenciasDisponiveis.length - 2];
      const c2 = competenciasDisponiveis[competenciasDisponiveis.length - 1];
      analise = await this.analisarCompararInterno(
        unidade,
        { key: c1.key, ano: c1.ano, mes: c1.mes },
        { key: c2.key, ano: c2.ano, mes: c2.mes },
        {
          funcionarioId: undefined,
          nomeMedico: undefined,
          naCarteira: 'todos',
          top: undefined,
        },
      );
      this.logger.log(
        `Opções+análise ${unidade} em ${Date.now() - iniciouEm}ms`,
      );
    } else {
      this.logger.log(`Opções ${unidade} em ${Date.now() - iniciouEm}ms`);
    }

    return {
      unidade,
      competenciasDisponiveis,
      representantes,
      analise,
    };
  }

  async analisar(
    usuario: Usuario,
    dto: FindVisitacaoAnaliseDto,
  ): Promise<VisitacaoAnaliseResponseDto> {
    const unidade = this.resolverUnidadeObrigatoria(usuario, dto.unidade);
    const modo: VisitacaoAnaliseModo = dto.modo ?? 'comparar';

    if (modo === 'ranking') {
      const refs = this.normalizarCompetenciasKeys(dto.competencias ?? []);
      if (!refs.length) {
        throw new BadRequestException(
          'Informe ao menos uma competência fechada para o ranking.',
        );
      }
      await this.assertCompetenciasFechadas(unidade, refs);
      return this.analisarRankingInterno(unidade, refs, dto);
    }

    const c1 = parseCompetenciaKey(dto.c1);
    const c2 = parseCompetenciaKey(dto.c2);
    if (!c1 || !c2) {
      throw new BadRequestException(
        'Informe as competências c1 e c2 no formato YYYY-MM para comparar.',
      );
    }
    if (c1.key === c2.key) {
      throw new BadRequestException(
        'Selecione duas competências diferentes para comparar.',
      );
    }

    await this.assertCompetenciasFechadas(unidade, [c1, c2]);
    return this.analisarCompararInterno(unidade, c1, c2, dto);
  }

  private async analisarCompararInterno(
    unidade: Unidade,
    c1: VisitacaoAnaliseCompetenciaRef,
    c2: VisitacaoAnaliseCompetenciaRef,
    dto: FiltrosAnalise,
  ): Promise<VisitacaoAnaliseResponseDto> {
    const iniciouEm = Date.now();
    const top = dto.top ?? null;
    const competencia1 = this.toCompetenciaDto(c1);
    const competencia2 = this.toCompetenciaDto(c2);
    const agregados = await this.carregarAgregadoComparativo(
      unidade,
      c1,
      c2,
      dto,
    );

    const mapaRecebido = new Map<string, MedicoValores>();
    const mapaRejeitado = new Map<string, MedicoValores>();
    for (const row of agregados) {
      this.aplicarComparativo(
        mapaRecebido,
        row,
        Number(row.recebido_mes1) || 0,
        Number(row.recebido_mes2) || 0,
      );
      this.aplicarComparativo(
        mapaRejeitado,
        row,
        Number(row.rejeitado_mes1) || 0,
        Number(row.rejeitado_mes2) || 0,
      );
    }

    const { crescimento, queda } = this.montarCrescimentoQueda(
      mapaRecebido,
      top,
    );
    const maioresRejeitados = this.montarMaioresRejeitados(mapaRejeitado, top);

    this.logger.log(
      `Análise comparar ${unidade} ${c1.key}→${c2.key} cresc=${crescimento.length} queda=${queda.length} rej=${maioresRejeitados.length} em ${Date.now() - iniciouEm}ms`,
    );

    return {
      unidade,
      modo: 'comparar',
      competencias: [competencia1, competencia2],
      competencia1,
      competencia2,
      agregacao: null,
      filtrosAplicados: {
        funcionarioId: dto.funcionarioId ?? null,
        nomeMedico: dto.nomeMedico?.trim() || null,
        naCarteira: dto.naCarteira ?? 'todos',
      },
      crescimento,
      queda,
      maioresVendas: [],
      maioresRejeitados,
    };
  }

  private async analisarRankingInterno(
    unidade: Unidade,
    refs: VisitacaoAnaliseCompetenciaRef[],
    dto: FiltrosAnalise,
  ): Promise<VisitacaoAnaliseResponseDto> {
    const iniciouEm = Date.now();
    const top = dto.top ?? null;
    const competencias = refs.map((r) => this.toCompetenciaDto(r));
    const agregados = await this.carregarAgregadoRanking(unidade, refs, dto);

    const vendas: VisitacaoAnaliseMedicoDto[] = [];
    const rejeitados: VisitacaoAnaliseMedicoDto[] = [];
    const qtd = refs.length;

    for (const row of agregados) {
      const recebido = Number(row.recebido_periodo) || 0;
      const rejeitado = Number(row.rejeitado_periodo) || 0;
      if (recebido <= 0 && rejeitado <= 0) {
        continue;
      }
      const base = {
        crmMedico: String(row.crm_medico).trim(),
        ufCrmMedico: String(row.uf_crm_medico).trim().toUpperCase(),
        nomeMedico: row.nome_medico,
        nomeRepresentante: row.nome_representante,
        valorMes1: null as number | null,
        valorMes2: null as number | null,
        delta: 0,
        percentual: null as number | null,
      };
      if (recebido > 0) {
        vendas.push({
          ...base,
          valorPeriodo: recebido,
          valorMedia: qtd > 0 ? recebido / qtd : null,
        });
      }
      if (rejeitado > 0) {
        rejeitados.push({
          ...base,
          valorPeriodo: rejeitado,
          valorMedia: qtd > 0 ? rejeitado / qtd : null,
        });
      }
    }

    vendas.sort((a, b) => (b.valorPeriodo ?? 0) - (a.valorPeriodo ?? 0));
    rejeitados.sort((a, b) => (b.valorPeriodo ?? 0) - (a.valorPeriodo ?? 0));

    const maioresVendas = this.limitar(vendas, top);
    const maioresRejeitados = this.limitar(rejeitados, top);

    this.logger.log(
      `Análise ranking ${unidade} competencias=[${refs.map((r) => r.key).join(',')}] vendas=${maioresVendas.length} rej=${maioresRejeitados.length} em ${Date.now() - iniciouEm}ms`,
    );

    return {
      unidade,
      modo: 'ranking',
      competencias,
      competencia1: null,
      competencia2: null,
      agregacao: 'soma',
      filtrosAplicados: {
        funcionarioId: dto.funcionarioId ?? null,
        nomeMedico: dto.nomeMedico?.trim() || null,
        naCarteira: dto.naCarteira ?? 'todos',
      },
      crescimento: [],
      queda: [],
      maioresVendas,
      maioresRejeitados,
    };
  }

  private resolverUnidadeObrigatoria(
    usuario: Usuario,
    unidadeFiltro?: Unidade,
  ): Unidade {
    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      unidadeFiltro,
    );
    if (escopo === 'ALL') {
      if (!unidadeFiltro) {
        throw new BadRequestException(
          'Informe a unidade para a análise de visitação.',
        );
      }
      return unidadeFiltro;
    }
    return escopo;
  }

  private labelCompetencia(ano: number, mes: number): string {
    const nome = MESES_PT[mes - 1] ?? String(mes);
    return `${nome}/${ano}`;
  }

  private toCompetenciaDto(
    ref: VisitacaoAnaliseCompetenciaRef,
  ): VisitacaoAnaliseCompetenciaDto {
    return {
      key: ref.key,
      ano: ref.ano,
      mes: ref.mes,
      fonte: 'FECHADO',
      label: this.labelCompetencia(ref.ano, ref.mes),
    };
  }

  private competenciaKey(ano: number, mes: number): string {
    return `${ano}-${String(mes).padStart(2, '0')}`;
  }

  private normalizarCompetenciasKeys(
    keys: string[],
  ): VisitacaoAnaliseCompetenciaRef[] {
    const map = new Map<string, VisitacaoAnaliseCompetenciaRef>();
    for (const raw of keys) {
      const parsed = parseCompetenciaKey(raw);
      if (parsed) {
        map.set(parsed.key, parsed);
      }
    }
    return [...map.values()].sort((a, b) =>
      a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes,
    );
  }

  private async listarCompetenciasFechadas(
    unidade: Unidade,
  ): Promise<VisitacaoAnaliseCompetenciaDto[]> {
    const fechados = await this.fechamentoRepository.find({
      where: { unidade },
      select: ['ano', 'mes'],
      order: { ano: 'ASC', mes: 'ASC' },
    });
    return fechados.map((f) => ({
      key: this.competenciaKey(f.ano, f.mes),
      ano: f.ano,
      mes: f.mes,
      fonte: 'FECHADO' as const,
      label: this.labelCompetencia(f.ano, f.mes),
    }));
  }

  private async assertCompetenciasFechadas(
    unidade: Unidade,
    refs: VisitacaoAnaliseCompetenciaRef[],
  ): Promise<void> {
    const disponiveis = await this.listarCompetenciasFechadas(unidade);
    const set = new Set(disponiveis.map((c) => c.key));
    for (const ref of refs) {
      if (!set.has(ref.key)) {
        throw new BadRequestException(
          `Competência ${ref.key} não disponível para análise (somente meses fechados).`,
        );
      }
    }
  }

  private async listarRepresentantesRapido(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<VisitacaoPainelMedicoRepresentanteDto[]> {
    const escopo = resolverEscopoListaFechamentoPorUsuario(usuario, unidade);
    const qb = this.funcionarioRepository
      .createQueryBuilder('f')
      .select([
        'f.id',
        'f.nome',
        'f.unidade',
        'f.painelContratoRepresentante',
        'f.painelCodigoRepresentante',
      ])
      .where('f.painelContratoRepresentante IS NOT NULL')
      .andWhere('f.painelCodigoRepresentante IS NOT NULL');

    if (escopo !== 'ALL') {
      qb.andWhere('f.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    const rows = await qb.orderBy('f.nome', 'ASC').getMany();
    return rows.map((f) => ({
      id: f.id,
      nome: f.nome,
      unidade: f.unidade,
      painelContratoRepresentante: f.painelContratoRepresentante!,
      painelCodigoRepresentante: f.painelCodigoRepresentante!,
    }));
  }

  private aplicarFiltrosMedico(
    qb: ReturnType<Repository<VisitacaoFechamentoMedico>['createQueryBuilder']>,
    dto: FiltrosAnalise,
  ): void {
    if (dto.nomeMedico?.trim()) {
      qb.andWhere('m.nome_medico ILIKE :nomeMedico', {
        nomeMedico: `%${dto.nomeMedico.trim()}%`,
      });
    }
    if (dto.funcionarioId) {
      qb.andWhere('m.funcionario_id = :funcionarioId', {
        funcionarioId: dto.funcionarioId,
      });
    }
    if (dto.naCarteira === 'sim') {
      qb.andWhere('m.na_carteira = TRUE');
    }
    if (dto.naCarteira === 'nao') {
      qb.andWhere('m.na_carteira = FALSE');
    }
  }

  /**
   * Prefixo `cf` evita colisão com parâmetros do pivot (`cmpAno1`/`cmpMes1`).
   * Colisão anterior fazia as duas colunas usarem a mesma competência (Δ=0).
   */
  private aplicarFiltroCompetencias(
    qb: ReturnType<Repository<VisitacaoFechamentoMedico>['createQueryBuilder']>,
    refs: VisitacaoAnaliseCompetenciaRef[],
  ): void {
    qb.andWhere(
      new Brackets((sub) => {
        refs.forEach((ref, i) => {
          const method = i === 0 ? 'where' : 'orWhere';
          sub[method](`(f.ano = :cfAno${i} AND f.mes = :cfMes${i})`, {
            [`cfAno${i}`]: ref.ano,
            [`cfMes${i}`]: ref.mes,
          });
        });
      }),
    );
  }

  private async carregarAgregadoComparativo(
    unidade: Unidade,
    c1: VisitacaoAnaliseCompetenciaRef,
    c2: VisitacaoAnaliseCompetenciaRef,
    dto: FiltrosAnalise,
  ): Promise<AgregadoComparativoRow[]> {
    const qb = this.fechamentoMedicoRepository
      .createQueryBuilder('m')
      .innerJoin('m.fechamento', 'f')
      .select('UPPER(BTRIM(m.crm_medico))', 'crm_medico')
      .addSelect('UPPER(BTRIM(m.uf_crm_medico))', 'uf_crm_medico')
      .addSelect('MAX(m.nome_medico)', 'nome_medico')
      .addSelect('MAX(m.nome_representante)', 'nome_representante')
      .addSelect(
        `COALESCE(SUM(CASE WHEN f.ano = :cmpAno1 AND f.mes = :cmpMes1 THEN m.recebido_loja ELSE 0 END), 0)`,
        'recebido_mes1',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN f.ano = :cmpAno2 AND f.mes = :cmpMes2 THEN m.recebido_loja ELSE 0 END), 0)`,
        'recebido_mes2',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN f.ano = :cmpAno1 AND f.mes = :cmpMes1 THEN m.rejeitado_loja ELSE 0 END), 0)`,
        'rejeitado_mes1',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN f.ano = :cmpAno2 AND f.mes = :cmpMes2 THEN m.rejeitado_loja ELSE 0 END), 0)`,
        'rejeitado_mes2',
      )
      .where('f.unidade = :unidade', { unidade })
      .setParameter('cmpAno1', c1.ano)
      .setParameter('cmpMes1', c1.mes)
      .setParameter('cmpAno2', c2.ano)
      .setParameter('cmpMes2', c2.mes)
      .groupBy('UPPER(BTRIM(m.crm_medico))')
      .addGroupBy('UPPER(BTRIM(m.uf_crm_medico))');

    this.aplicarFiltroCompetencias(qb, [c1, c2]);
    this.aplicarFiltrosMedico(qb, dto);
    return qb.getRawMany<AgregadoComparativoRow>();
  }

  private async carregarAgregadoRanking(
    unidade: Unidade,
    refs: VisitacaoAnaliseCompetenciaRef[],
    dto: FiltrosAnalise,
  ): Promise<AgregadoRankingRow[]> {
    const qb = this.fechamentoMedicoRepository
      .createQueryBuilder('m')
      .innerJoin('m.fechamento', 'f')
      .select('UPPER(BTRIM(m.crm_medico))', 'crm_medico')
      .addSelect('UPPER(BTRIM(m.uf_crm_medico))', 'uf_crm_medico')
      .addSelect('MAX(m.nome_medico)', 'nome_medico')
      .addSelect('MAX(m.nome_representante)', 'nome_representante')
      .addSelect('COALESCE(SUM(m.recebido_loja), 0)', 'recebido_periodo')
      .addSelect('COALESCE(SUM(m.rejeitado_loja), 0)', 'rejeitado_periodo')
      .where('f.unidade = :unidade', { unidade })
      .groupBy('UPPER(BTRIM(m.crm_medico))')
      .addGroupBy('UPPER(BTRIM(m.uf_crm_medico))');

    this.aplicarFiltroCompetencias(qb, refs);
    this.aplicarFiltrosMedico(qb, dto);
    return qb.getRawMany<AgregadoRankingRow>();
  }

  private chaveMedico(crm: string, uf: string): string {
    return `${String(crm).trim().toUpperCase()}|${String(uf).trim().toUpperCase()}`;
  }

  private aplicarComparativo(
    mapa: Map<string, MedicoValores>,
    row: AgregadoComparativoRow,
    valorMes1: number,
    valorMes2: number,
  ): void {
    if (valorMes1 === 0 && valorMes2 === 0) {
      return;
    }
    const tem1 = valorMes1 > 0;
    const tem2 = valorMes2 > 0;
    const key = this.chaveMedico(row.crm_medico, row.uf_crm_medico);
    mapa.set(key, {
      crmMedico: String(row.crm_medico).trim(),
      ufCrmMedico: String(row.uf_crm_medico).trim().toUpperCase(),
      nomeMedico: row.nome_medico,
      nomeRepresentante: row.nome_representante,
      valorMes1: tem1 ? valorMes1 : tem2 ? 0 : null,
      valorMes2: tem2 ? valorMes2 : tem1 ? 0 : null,
    });
  }

  private toLinha(item: MedicoValores): VisitacaoAnaliseMedicoDto {
    const base = item.valorMes1 ?? 0;
    const ref = item.valorMes2 ?? 0;
    const delta = ref - base;
    return {
      crmMedico: item.crmMedico,
      ufCrmMedico: item.ufCrmMedico,
      nomeMedico: item.nomeMedico,
      nomeRepresentante: item.nomeRepresentante,
      valorMes1: item.valorMes1,
      valorMes2: item.valorMes2,
      valorPeriodo: null,
      valorMedia: null,
      delta,
      percentual:
        item.valorMes1 != null && item.valorMes1 !== 0
          ? (delta / item.valorMes1) * 100
          : null,
    };
  }

  private limitar<T>(lista: T[], top: number | null): T[] {
    if (top == null || top <= 0) {
      return lista;
    }
    return lista.slice(0, top);
  }

  private montarCrescimentoQueda(
    mapa: Map<string, MedicoValores>,
    top: number | null,
  ): {
    crescimento: VisitacaoAnaliseMedicoDto[];
    queda: VisitacaoAnaliseMedicoDto[];
  } {
    const linhas: VisitacaoAnaliseMedicoDto[] = [];
    for (const item of mapa.values()) {
      if (item.valorMes1 == null && item.valorMes2 == null) {
        continue;
      }
      const linha = this.toLinha(item);
      if (linha.delta === 0) {
        continue;
      }
      linhas.push(linha);
    }

    return {
      crescimento: this.limitar(
        linhas.filter((l) => l.delta > 0).sort((a, b) => b.delta - a.delta),
        top,
      ),
      queda: this.limitar(
        linhas.filter((l) => l.delta < 0).sort((a, b) => a.delta - b.delta),
        top,
      ),
    };
  }

  private montarMaioresRejeitados(
    mapa: Map<string, MedicoValores>,
    top: number | null,
  ): VisitacaoAnaliseMedicoDto[] {
    return this.limitar(
      [...mapa.values()]
        .filter((item) => item.valorMes1 != null || item.valorMes2 != null)
        .map((item) => this.toLinha(item))
        .sort((a, b) => {
          const va = a.valorMes2 ?? 0;
          const vb = b.valorMes2 ?? 0;
          if (vb !== va) {
            return vb - va;
          }
          return (b.valorMes1 ?? 0) - (a.valorMes1 ?? 0);
        }),
      top,
    );
  }
}
