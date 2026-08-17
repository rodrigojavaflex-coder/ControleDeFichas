import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  assertUnidadeProducao,
  unidadesPermitidasProdutividade,
} from '../folha/utils/folha-unidade-scope.util';
import { ProducaoPainelRetiradaConfigService } from '../producao-config/producao-painel-retirada-config.service';
import {
  classificarCorPainelRetirada,
  mapAlertasEntidade,
  minutosParaRetirada,
  requisicaoFormulaConcluidaPainel,
} from '../producao-config/utils/painel-retirada.util';
import { ProducaoCalendarioService } from '../producao-config/producao-calendario.service';
import {
  ProducaoPainelAlertaCor,
  type ProducaoPainelAlertaRetirada,
} from '../producao-config/entities/producao-painel-alerta-retirada.entity';
import { normalizarCorPainelRetirada } from '../producao-config/utils/producao-painel-cor.util';
import {
  carregarMapaNomesFuncionarioProducao,
  codigoCreditoEntrada,
  codigoCreditoSaida,
  nomeFuncionarioProducao,
} from '../producao-etapas/utils/producao-funcionario-erp.util';
import {
  ProducaoPainelAlertaLegendaDto,
  ProducaoPainelLinhaDto,
  ProducaoPainelResponseDto,
} from './dto/producao-painel-response.dto';
import {
  ProducaoPainelHistoricoResponseDto,
} from './dto/producao-painel-historico.dto';

function chaveFormula(r: ProducaoEtapaResumo): string {
  return `${r.unidade}|${r.filial}|${r.requisicao}|${r.formula}`;
}

@Injectable()
export class ProducaoPainelService {
  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly resumoRepo: Repository<ProducaoEtapaResumo>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepo: Repository<Prescritor>,
    private readonly painelConfig: ProducaoPainelRetiradaConfigService,
    private readonly calendarioService: ProducaoCalendarioService,
  ) {}

  async consultar(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): Promise<ProducaoPainelResponseDto> {
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );
    const consultadoEm = new Date().toISOString();
    const agora = new Date(consultadoEm);

    const [rows, mapaFinal, mapaAlertas, mapaCalendarios] = await Promise.all([
      this.buscarLinhasResumo(unidades),
      this.painelConfig.mapaEtapasFinalPorUnidades(unidades),
      this.painelConfig.mapaAlertasPorUnidades(unidades),
      this.calendarioService.mapaCalendariosPorUnidade(unidades),
    ]);

    const alertasPorUnidade = new Map<
      Unidade,
      ReturnType<typeof mapAlertasEntidade>
    >();
    for (const unidade of unidades) {
      alertasPorUnidade.set(
        unidade,
        mapAlertasEntidade(mapaAlertas.get(unidade) ?? []),
      );
    }

    const mapaPrescritorPromise = this.mapaNomesPrescritorPorCrm(rows);

    const grupos = new Map<string, ProducaoEtapaResumo[]>();
    for (const row of rows) {
      const k = chaveFormula(row);
      const list = grupos.get(k) ?? [];
      list.push(row);
      grupos.set(k, list);
    }

    const mapaPrescritorCrm = await mapaPrescritorPromise;

    const linhas: ProducaoPainelLinhaDto[] = [];

    for (const [, grupo] of grupos) {
      const amostra = grupo[0];
      const finais = mapaFinal.get(amostra.unidade) ?? new Set<string>();
      if (requisicaoFormulaConcluidaPainel(grupo, finais)) {
        continue;
      }

      const alertas = alertasPorUnidade.get(amostra.unidade) ?? [];
      const dataRetirada =
        grupo.map((r) => r.dataRetirada?.trim()).find(Boolean) ?? null;
      const horaRetirada =
        grupo.map((r) => r.horaRetirada?.trim()).find(Boolean) ?? null;

      const atual = this.resolverEtapaAtual(grupo);
      const calendario = mapaCalendarios.get(amostra.unidade);
      const minutos = minutosParaRetirada(
        dataRetirada,
        horaRetirada,
        agora,
        calendario,
      );
      const cor = classificarCorPainelRetirada(minutos, alertas);
      const rotuloAlerta = this.rotuloParaCor(cor, alertas);

      linhas.push({
        unidade: amostra.unidade,
        filial: amostra.filial,
        requisicao: amostra.requisicao,
        formula: amostra.formula,
        cliente: grupo.map((r) => r.cliente?.trim()).find(Boolean) ?? null,
        paciente: grupo.map((r) => r.paciente?.trim()).find(Boolean) ?? null,
        nomePrescritor: this.resolverNomePrescritor(grupo, mapaPrescritorCrm),
        dataRetirada,
        horaRetirada,
        codEtapaAtual: atual.codEtapa,
        etapaAtual: atual.etapa,
        posicaoEtapaAtual: atual.posicaoEtapa,
        minutosParaRetirada: minutos,
        corPainel: cor,
        rotuloAlerta,
      });
    }

    linhas.sort((a, b) => {
      const ma = a.minutosParaRetirada;
      const mb = b.minutosParaRetirada;
      if (ma == null && mb == null) {
        return a.requisicao - b.requisicao;
      }
      if (ma == null) return 1;
      if (mb == null) return -1;
      if (ma !== mb) return ma - mb;
      return a.requisicao - b.requisicao;
    });

    const legenda = this.montarLegendaPainel(unidades, mapaAlertas);

    return { unidades, consultadoEm, linhas, legenda };
  }

  /** Faixas configuradas nas unidades consultadas (independente de haver linha na cor). */
  private montarLegendaPainel(
    unidades: Unidade[],
    mapaAlertas: Map<Unidade, ProducaoPainelAlertaRetirada[]>,
  ): ProducaoPainelAlertaLegendaDto[] {
    const candidatos: {
      ordem: number;
      cor: string;
      rotulo: string | null;
    }[] = [];
    for (const unidade of unidades) {
      for (const a of mapaAlertas.get(unidade) ?? []) {
        candidatos.push({
          ordem: a.ordem,
          cor: a.cor,
          rotulo: a.rotulo,
        });
      }
    }
    candidatos.sort((a, b) => a.ordem - b.ordem);

    const vistos = new Set<string>();
    const legenda: ProducaoPainelAlertaLegendaDto[] = [];
    for (const c of candidatos) {
      const norm = normalizarCorPainelRetirada(c.cor);
      if (norm === ProducaoPainelAlertaCor.NEUTRO) {
        continue;
      }
      if (vistos.has(norm)) {
        continue;
      }
      vistos.add(norm);
      legenda.push({
        cor: norm,
        rotulo: c.rotulo?.trim() || null,
      });
    }
    return legenda;
  }

  async historicoRequisicao(
    usuario: Usuario,
    unidade: Unidade,
    filial: number,
    requisicao: number,
    formula: string,
  ): Promise<ProducaoPainelHistoricoResponseDto> {
    assertUnidadeProducao(usuario, unidade);
    const formulaNorm = formula.trim();
    if (!formulaNorm) {
      throw new BadRequestException('Informe a fórmula.');
    }

    const rows = await this.resumoRepo.find({
      where: {
        unidade,
        filial,
        requisicao,
        formula: formulaNorm,
      },
      order: { posicaoEtapa: 'ASC', codEtapa: 'ASC' },
    });

    if (rows.length === 0) {
      throw new NotFoundException(
        'Nenhuma etapa encontrada para esta requisição-fórmula.',
      );
    }

    const amostra = rows[0];
    const codigosUsuario = [
      ...new Set(
        rows
          .flatMap((r) => [
            r.usuarioEntrada,
            r.usuarioSaida,
            r.usuarioEntradaFila,
          ])
          .filter((c): c is number => c != null && c > 0),
      ),
    ];
    const codigosFuncionario = [
      ...new Set(
        rows
          .flatMap((r) => [r.funcionarioEntrada, r.funcionarioSaida])
          .filter((c): c is number => c != null && c > 0),
      ),
    ];
    const nomes = await carregarMapaNomesFuncionarioProducao(
      this.funcionarioRepo,
      [unidade],
      codigosUsuario,
      codigosFuncionario,
    );
    const consultadoEm = new Date().toISOString();

    const etapas = rows.map((r) => ({
      posicaoEtapa: r.posicaoEtapa,
      codEtapa: r.codEtapa,
      etapa: r.etapa?.trim() || r.codEtapa,
      dataEntrada: r.dataEntrada?.trim() || null,
      horaEntrada: this.normalizarHora(r.horaEntrada),
      funcionarioEntrada: nomeFuncionarioProducao(
        nomes,
        unidade,
        codigoCreditoEntrada(r),
      ),
      dataSaida: r.dataSaida?.trim() || null,
      horaSaida: this.normalizarHora(r.horaSaida),
      funcionarioSaida: nomeFuncionarioProducao(
        nomes,
        unidade,
        codigoCreditoSaida(r),
      ),
      tempoEtapaMinutos: r.tempoEtapa ?? null,
      emAndamentoFila: !!r.emAndamentoFila,
      dataEntradaFila: r.dataEntradaFila?.trim() || null,
      horaEntradaFila: this.normalizarHora(r.horaEntradaFila),
      funcionarioFila: nomeFuncionarioProducao(
        nomes,
        unidade,
        r.usuarioEntradaFila != null && r.usuarioEntradaFila > 0
          ? { tipo: 'USUARIO', codigo: r.usuarioEntradaFila }
          : null,
      ),
    }));

    const meta = rows.find(
      (r) => r.dataRetirada?.trim() || r.cliente?.trim() || r.paciente?.trim(),
    ) ?? amostra;

    return {
      unidade,
      filial,
      requisicao,
      formula: amostra.formula,
      cliente: meta.cliente?.trim() || null,
      paciente: meta.paciente?.trim() || null,
      dataRetirada: meta.dataRetirada?.trim() || null,
      horaRetirada: this.normalizarHora(meta.horaRetirada),
      consultadoEm,
      etapas,
    };
  }

  private resolverEtapaAtual(grupo: ProducaoEtapaResumo[]): {
    codEtapa: string;
    etapa: string;
    posicaoEtapa: number;
  } {
    const fila = grupo.filter((r) => r.emAndamentoFila);
    const pool = fila.length > 0 ? fila : grupo;
    let best = pool[0];
    for (const r of pool) {
      if (r.posicaoEtapa > best.posicaoEtapa) {
        best = r;
      }
    }
    return {
      codEtapa: best.codEtapa,
      etapa: best.etapa?.trim() || best.codEtapa,
      posicaoEtapa: best.posicaoEtapa,
    };
  }

  private rotuloParaCor(
    cor: string,
    alertas: ReturnType<typeof mapAlertasEntidade>,
  ): string | null {
    const hit = alertas.find((a) => a.cor === cor);
    if (hit?.rotulo?.trim()) {
      return hit.rotulo.trim();
    }
    if (
      cor === ProducaoPainelAlertaCor.VERMELHO ||
      cor.toUpperCase() === '#DC2626'
    ) {
      return 'Retirada atrasada';
    }
    return null;
  }

  private async buscarLinhasResumo(
    unidades: Unidade[],
  ): Promise<ProducaoEtapaResumo[]> {
    return this.resumoRepo
      .createQueryBuilder('r')
      .select([
        'r.unidade',
        'r.filial',
        'r.requisicao',
        'r.formula',
        'r.codEtapa',
        'r.etapa',
        'r.posicaoEtapa',
        'r.emAndamentoFila',
        'r.dataSaida',
        'r.dataRetirada',
        'r.horaRetirada',
        'r.cliente',
        'r.paciente',
        'r.nomePrescritor',
        'r.crf',
        'r.ufCrf',
      ])
      .where('r.unidade IN (:...unidades)', { unidades })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM producao_etapas_resumo r2
          INNER JOIN producao_painel_etapa_final ef
            ON ef.unidade = r2.unidade AND ef."codEtapa" = r2."codEtapa"
          WHERE r2.unidade = r.unidade
            AND r2.filial = r.filial
            AND r2.requisicao = r.requisicao
            AND r2.formula = r.formula
            AND r2."dataSaida" IS NOT NULL
        )`,
      )
      .getMany();
  }

  private resolverUnidadesConsulta(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): Unidade[] {
    const solicitadas =
      unidadesQuery?.length && unidadesQuery.length > 0
        ? unidadesQuery
        : unidadeLegado
          ? [unidadeLegado]
          : [];

    const permitidas = unidadesPermitidasProdutividade(usuario);
    const alvo = solicitadas.length > 0 ? solicitadas : (permitidas ?? []);

    if (alvo.length === 0) {
      throw new BadRequestException('Informe ao menos uma unidade.');
    }

    const unicas = [...new Set(alvo)];
    for (const unidade of unicas) {
      assertUnidadeProducao(usuario, unidade);
    }
    return unicas;
  }

  private normalizarHora(hora: string | null | undefined): string | null {
    const h = (hora ?? '').trim();
    if (!h) {
      return null;
    }
    if (/^\d{2}:\d{2}$/.test(h)) {
      return h;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(h)) {
      return h.slice(0, 5);
    }
    if (/^\d{6}$/.test(h)) {
      return `${h.slice(0, 2)}:${h.slice(2, 4)}`;
    }
    return h;
  }

  private resolverNomePrescritor(
    grupo: ProducaoEtapaResumo[],
    mapaCrm: Map<string, string>,
  ): string | null {
    const direto =
      grupo.map((r) => r.nomePrescritor?.trim()).find(Boolean) ?? null;
    if (direto) {
      return direto;
    }
    const crf = grupo.map((r) => r.crf?.trim()).find(Boolean);
    const uf = grupo.map((r) => r.ufCrf?.trim()).find(Boolean)?.toUpperCase();
    if (!crf || !uf) {
      return null;
    }
    const numero = Number.parseInt(crf.replace(/\D/g, ''), 10);
    if (!Number.isFinite(numero) || numero <= 0) {
      return null;
    }
    return mapaCrm.get(`${uf}:${numero}`) ?? null;
  }

  private async mapaNomesPrescritorPorCrm(
    rows: ProducaoEtapaResumo[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const numeros = new Set<number>();
    for (const row of rows) {
      if (row.nomePrescritor?.trim()) {
        continue;
      }
      const crf = row.crf?.trim();
      const uf = row.ufCrf?.trim()?.toUpperCase();
      if (!crf || !uf) {
        continue;
      }
      const numero = Number.parseInt(crf.replace(/\D/g, ''), 10);
      if (Number.isFinite(numero) && numero > 0) {
        numeros.add(numero);
      }
    }
    if (numeros.size === 0) {
      return map;
    }
    const prescritores = await this.prescritorRepo.find({
      where: { numeroCRM: In([...numeros]) },
      select: { nome: true, numeroCRM: true, UFCRM: true },
    });
    for (const p of prescritores) {
      if (p.numeroCRM == null || !p.UFCRM?.trim()) {
        continue;
      }
      const nome = p.nome?.trim();
      if (!nome) {
        continue;
      }
      map.set(`${p.UFCRM.trim().toUpperCase()}:${p.numeroCRM}`, nome);
    }
    return map;
  }
}
