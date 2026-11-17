import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Permission } from '../../common/enums/permission.enum';
import { Unidade } from '../../common/enums/unidade.enum';
import { rotuloPfCrm } from '../../common/enums/pf-crm.enum';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import { TipoVisita } from '../tipos-visita/entities/tipo-visita.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AtualizarVisitaDto } from './dto/atualizar-visita.dto';
import {
  AgendaAlertasDto,
  AgendamentoVisitaItemDto,
  AtualizarAgendamentoVisitaDto,
  ChecarDataAgendamentoResultadoDto,
  CriarAgendamentoVisitaDto,
  FindAgendamentosVisitaDto,
} from './dto/agendamento-visita.dto';
import { FindMinhasVisitasDto } from './dto/find-minhas-visitas.dto';
import { EncerrarVisitaDto } from './dto/encerrar-visita.dto';
import { IniciarVisitaDto } from './dto/iniciar-visita.dto';
import { SolicitacoesService } from '../solicitacoes/solicitacoes.service';
import { Visita } from './entities/visita.entity';
import { VisitaAgendamento } from './entities/visita-agendamento.entity';
import { VisitaMidia } from './entities/visita-midia.entity';
import { StatusVisita } from './enums/status-visita.enum';
import { OrcamentoStatus } from '../../common/enums/orcamento-status.enum';
import {
  CarteiraVisitas,
  FiltroPainelVisita,
  HistoricoVisita,
  MedicoCarteira,
  PainelAtivoItem,
  PainelPrescritorVisita,
  VisitaResumo,
} from './visitas.types';

interface VinculoVisita {
  unidade: Unidade;
  contrato: number;
  codigo: number;
  painelDisponivel: boolean;
}

interface LinhaMedico {
  prescritorId: string | null;
  nome: string;
  crm: string;
  uf: string;
  pfcrm: string | null;
  noPainel: boolean | string | number | null;
  dias: number | string | null;
}

interface PrescritorUnidade {
  id: string;
  unidade: Unidade | null;
  numeroCRM: number | string | null;
  UFCRM: string | null;
}

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    @InjectRepository(VisitaAgendamento)
    private readonly agendamentos: Repository<VisitaAgendamento>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(TipoVisita)
    private readonly tipos: Repository<TipoVisita>,
    private readonly solicitacoes: SolicitacoesService,
  ) {}

  async carteira(
    usuarioId: string,
    opcoes?: {
      filtroPainel?: string | null;
      page?: string | number | null;
      limit?: string | number | null;
      busca?: string | null;
    },
  ): Promise<CarteiraVisitas> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visitaAberta = await this.buscarAberta(usuarioId);
    const filtroPainel = this.parseFiltroPainel(opcoes?.filtroPainel);
    const page = this.parsePage(opcoes?.page);
    const limit = this.parseLimit(opcoes?.limit);
    const busca = this.parseBusca(opcoes?.busca);
    const vinculo = this.vinculoFuncionario(usuario);
    if (!vinculo) {
      return {
        vinculoOk: false,
        vinculoMensagem: this.mensagemVinculo(usuario),
        unidade: null,
        painelDisponivel: false,
        filtroPainel,
        tipos: [],
        visitaAberta: visitaAberta ? this.toResumo(visitaAberta) : null,
        medicos: [],
        page,
        limit,
        total: 0,
        hasMore: false,
        busca,
      };
    }

    const tipos = await this.tipos.find({
      where: { ativo: true, unidade: vinculo.unidade },
      order: { nome: 'ASC' },
      select: { id: true, nome: true },
    });
    const filtroEfetivo =
      !vinculo.painelDisponivel && filtroPainel !== 'todos'
        ? 'todos'
        : filtroPainel;
    const { medicos, total } = await this.listarMedicos(
      vinculo,
      filtroEfetivo,
      page,
      limit,
      busca,
    );
    return {
      vinculoOk: true,
      vinculoMensagem: null,
      unidade: vinculo.unidade,
      painelDisponivel: vinculo.painelDisponivel,
      filtroPainel: filtroEfetivo,
      tipos: tipos.map((tipo) => ({ id: tipo.id, nome: tipo.nome })),
      visitaAberta: visitaAberta ? this.toResumo(visitaAberta) : null,
      medicos,
      page,
      limit,
      total,
      hasMore: page * limit < total,
      busca,
    };
  }

  async minhas(
    usuarioId: string,
    filtro: FindMinhasVisitasDto = {},
  ): Promise<HistoricoVisita[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const vinculo = this.vinculoFuncionario(usuario);
    const intervalo = this.intervaloHistorico(filtro);
    const params: Array<string | number> = [usuarioId];

    let painelJoin = `
      LEFT JOIN painel_medicos_representantes pm ON FALSE
    `;
    if (vinculo?.painelDisponivel) {
      params.push(vinculo.contrato, vinculo.codigo);
      const contratoIdx = params.length - 1;
      const codigoIdx = params.length;
      painelJoin = `
        LEFT JOIN painel_medicos_representantes pm
          ON pm.unidade = v.unidade
         AND pm."contratoRepresentante" = $${contratoIdx}
         AND pm."codigoRepresentante" = $${codigoIdx}
         AND BTRIM(pm."crmMedico") = BTRIM(p."numeroCRM"::text)
         AND UPPER(BTRIM(pm."ufCrmMedico")) = UPPER(BTRIM(p."UFCRM"))
         AND UPPER(BTRIM(COALESCE(pm.pfcrm, '1')))
             = UPPER(BTRIM(COALESCE(p.pfcrm, '1')))
      `;
    }

    let dataSql = '';
    if (intervalo) {
      params.push(intervalo.inicio, intervalo.fimExclusivo);
      const inicioIdx = params.length - 1;
      const fimIdx = params.length;
      dataSql = `
        AND (COALESCE(v."dataHoraFim", v."dataHoraInicio") AT TIME ZONE 'America/Sao_Paulo')::date >= $${inicioIdx}::date
        AND (COALESCE(v."dataHoraFim", v."dataHoraInicio") AT TIME ZONE 'America/Sao_Paulo')::date < $${fimIdx}::date
      `;
    }

    const diasFiltro = this.filtroDiasHistorico(filtro);
    let diasSql = '';
    if (diasFiltro) {
      params.push(diasFiltro.dias);
      const diasIdx = params.length;
      const operador = diasFiltro.comparacao === 'mais' ? '>' : '<';
      diasSql = `
        AND (
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
          - (COALESCE(v."dataHoraFim", v."dataHoraInicio") AT TIME ZONE 'America/Sao_Paulo')::date
        ) ${operador} $${diasIdx}
      `;
    }

    const limite = intervalo || diasFiltro ? 300 : 100;
    params.push(limite);
    const limiteIdx = params.length;

    const rows = (await this.visitas.query(
      `
      SELECT
        v.id,
        v.status,
        v."dataHoraInicio",
        v."dataHoraFim",
        COALESCE(NULLIF(BTRIM(p.nome), ''), 'Sem nome') AS "prescritorNome",
        COALESCE(BTRIM(p."numeroCRM"::text), '') AS crm,
        COALESCE(UPPER(BTRIM(p."UFCRM")), '') AS uf,
        COALESCE(NULLIF(BTRIM(t.nome), ''), '—') AS "tipoVisitaNome",
        CASE WHEN pm.id IS NULL THEN FALSE ELSE TRUE END AS "noPainel",
        (
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
          - (COALESCE(v."dataHoraFim", v."dataHoraInicio") AT TIME ZONE 'America/Sao_Paulo')::date
        )::int AS dias
      FROM visitas v
      LEFT JOIN prescritores p ON p.id = v."prescritorId"
      LEFT JOIN tipos_visita t ON t.id = v."tipoVisitaId"
      ${painelJoin}
      WHERE v."usuarioId" = $1
      ${dataSql}
      ${diasSql}
      ORDER BY COALESCE(v."dataHoraFim", v."dataHoraInicio") DESC
      LIMIT $${limiteIdx}
      `,
      params,
    )) as Array<{
      id: string;
      status: StatusVisita;
      dataHoraInicio: Date | string;
      dataHoraFim: Date | string | null;
      prescritorNome: string;
      crm: string;
      uf: string;
      tipoVisitaNome: string;
      noPainel: boolean | string | number | null;
      dias: number | string | null;
    }>;

    return rows.map((row) => {
      const dias = Number(row.dias);
      const diasDesdeVisita = Number.isFinite(dias) ? dias : 0;
      const noPainel =
        row.noPainel === true ||
        row.noPainel === 't' ||
        row.noPainel === 1 ||
        row.noPainel === '1';
      return {
        id: row.id,
        status: row.status,
        prescritorNome: row.prescritorNome,
        crm: row.crm,
        uf: row.uf,
        tipoVisitaNome: row.tipoVisitaNome,
        dataHoraInicio: this.isoData(row.dataHoraInicio),
        dataHoraFim:
          row.dataHoraFim == null ? null : this.isoData(row.dataHoraFim),
        noPainel,
        diasDesdeVisita,
        rotuloDias: this.rotuloDias(diasDesdeVisita),
      };
    });
  }

  /**
   * Agenda do mês (app): visitas e agendamentos do usuário por dia civil em SP.
   */
  async agendaMes(
    usuarioId: string,
    ano: number,
    mes: number,
  ): Promise<{
    ano: number;
    mes: number;
    unidade: string | null;
    sabadoDiaUtil: boolean;
    feriados: Array<{ data: string; descricao: string | null }>;
    dias: Array<{
      data: string;
      quantidadeVisitas: number;
      quantidadeAgendamentos: number;
      visitas: Array<{
        id: string;
        prescritorNome: string;
        crm: string;
        uf: string;
        tipoVisitaNome: string;
        status: StatusVisita;
        dataHoraInicio: string;
        dataHoraFim: string | null;
      }>;
      agendamentos: AgendamentoVisitaItemDto[];
    }>;
  }> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = this.tentarUnidade(usuario);
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const proximoAno = mes === 12 ? ano + 1 : ano;
    const fimExclusivo = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;
    const prefixoMes = `${ano}-${String(mes).padStart(2, '0')}`;

    const [rows, agRows, calendario] = await Promise.all([
      this.visitas.query(
        `
      SELECT
        v.id,
        v.status,
        v."dataHoraInicio",
        v."dataHoraFim",
        COALESCE(p.nome, '') AS "prescritorNome",
        COALESCE(p."numeroCRM"::text, '') AS crm,
        COALESCE(p."UFCRM", '') AS uf,
        COALESCE(t.nome, '') AS "tipoVisitaNome",
        to_char(
          (v."dataHoraInicio" AT TIME ZONE 'America/Sao_Paulo')::date,
          'YYYY-MM-DD'
        ) AS dia
      FROM visitas v
      LEFT JOIN prescritores p ON p.id = v."prescritorId"
      LEFT JOIN tipos_visita t ON t.id = v."tipoVisitaId"
      WHERE v."usuarioId" = $1
        AND (v."dataHoraInicio" AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
        AND (v."dataHoraInicio" AT TIME ZONE 'America/Sao_Paulo')::date < $3::date
      ORDER BY v."dataHoraInicio" ASC
      `,
        [usuarioId, inicio, fimExclusivo],
      ) as Promise<
        Array<{
          id: string;
          status: StatusVisita;
          dataHoraInicio: Date | string;
          dataHoraFim: Date | string | null;
          prescritorNome: string;
          crm: string;
          uf: string;
          tipoVisitaNome: string;
          dia: string;
        }>
      >,
      this.visitas.query(
        `
      SELECT
        a.id,
        a."prescritorId" AS "prescritorId",
        COALESCE(p.nome, '') AS "prescritorNome",
        COALESCE(p."numeroCRM"::text, '') AS crm,
        COALESCE(p."UFCRM", '') AS uf,
        to_char(a.data, 'YYYY-MM-DD') AS data,
        a.hora,
        a.observacao
      FROM visita_agendamentos a
      LEFT JOIN prescritores p ON p.id = a."prescritorId"
      WHERE a."usuarioId" = $1
        AND a.data >= $2::date
        AND a.data < $3::date
      ORDER BY a.data ASC, a.hora ASC NULLS LAST, a."criadoEm" ASC
      `,
        [usuarioId, inicio, fimExclusivo],
      ) as Promise<
        Array<{
          id: string;
          prescritorId: string;
          prescritorNome: string;
          crm: string;
          uf: string;
          data: string;
          hora: string | null;
          observacao: string | null;
        }>
      >,
      this.carregarCalendarioUnidade(unidade, prefixoMes),
    ]);

    const porDia = new Map<
      string,
      {
        data: string;
        quantidadeVisitas: number;
        quantidadeAgendamentos: number;
        visitas: Array<{
          id: string;
          prescritorNome: string;
          crm: string;
          uf: string;
          tipoVisitaNome: string;
          status: StatusVisita;
          dataHoraInicio: string;
          dataHoraFim: string | null;
        }>;
        agendamentos: AgendamentoVisitaItemDto[];
      }
    >();

    const bucketDia = (data: string) => {
      let bucket = porDia.get(data);
      if (!bucket) {
        bucket = {
          data,
          quantidadeVisitas: 0,
          quantidadeAgendamentos: 0,
          visitas: [],
          agendamentos: [],
        };
        porDia.set(data, bucket);
      }
      return bucket;
    };

    for (const row of rows) {
      const bucket = bucketDia(row.dia);
      bucket.quantidadeVisitas += 1;
      bucket.visitas.push({
        id: row.id,
        prescritorNome: (row.prescritorNome || '').trim() || '—',
        crm: String(row.crm ?? '').trim(),
        uf: String(row.uf ?? '').trim().toUpperCase(),
        tipoVisitaNome: (row.tipoVisitaNome || '').trim() || '—',
        status: row.status,
        dataHoraInicio:
          row.dataHoraInicio instanceof Date
            ? row.dataHoraInicio.toISOString()
            : new Date(row.dataHoraInicio).toISOString(),
        dataHoraFim:
          row.dataHoraFim == null
            ? null
            : row.dataHoraFim instanceof Date
              ? row.dataHoraFim.toISOString()
              : new Date(row.dataHoraFim).toISOString(),
      });
    }

    for (const row of agRows) {
      const bucket = bucketDia(row.data);
      bucket.quantidadeAgendamentos += 1;
      bucket.agendamentos.push(this.toAgendamentoItem(row));
    }

    return {
      ano,
      mes,
      unidade,
      sabadoDiaUtil: calendario.sabadoDiaUtil,
      feriados: calendario.feriados,
      dias: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    };
  }

  async listarAgendamentosPorMedico(
    usuarioId: string,
    filtro: FindAgendamentosVisitaDto,
  ): Promise<AgendamentoVisitaItemDto[]> {
    await this.carregarUsuario(usuarioId);
    const hoje = this.hojeYmdSp();
    const agoraHora = this.agoraHoraSp();
    const dataInicio = filtro.dataInicio ?? hoje;
    const dataFim = filtro.dataFim ?? this.somarDiasYmd(hoje, 365);
    if (dataFim < dataInicio) {
      throw new BadRequestException('Intervalo de datas inválido.');
    }

    const params: unknown[] = [usuarioId, dataInicio, dataFim];
    let filtroMedico = '';
    if (filtro.prescritorId) {
      params.push(filtro.prescritorId);
      filtroMedico = `AND a."prescritorId" = $${params.length}`;
    }

    // Sem dataInicio explícita: só futuros (exclui hora já passada de hoje).
    let filtroFuturo = '';
    if (!filtro.dataInicio) {
      params.push(hoje);
      const idxHoje = params.length;
      params.push(agoraHora);
      const idxHora = params.length;
      filtroFuturo = `
        AND (
          a.data > $${idxHoje}::date
          OR (
            a.data = $${idxHoje}::date
            AND COALESCE(NULLIF(TRIM(a.hora), ''), '00:00') >= $${idxHora}
          )
        )`;
    }

    const rows = (await this.visitas.query(
      `
      SELECT
        a.id,
        a."prescritorId" AS "prescritorId",
        COALESCE(p.nome, '') AS "prescritorNome",
        COALESCE(p."numeroCRM"::text, '') AS crm,
        COALESCE(p."UFCRM", '') AS uf,
        to_char(a.data, 'YYYY-MM-DD') AS data,
        a.hora,
        a.observacao
      FROM visita_agendamentos a
      LEFT JOIN prescritores p ON p.id = a."prescritorId"
      WHERE a."usuarioId" = $1
        AND a.data >= $2::date
        AND a.data <= $3::date
        ${filtroMedico}
        ${filtroFuturo}
      ORDER BY a.data ASC, a.hora ASC NULLS LAST, a."criadoEm" ASC
      `,
      params,
    )) as Array<{
      id: string;
      prescritorId: string;
      prescritorNome: string;
      crm: string;
      uf: string;
      data: string;
      hora: string | null;
      observacao: string | null;
    }>;

    return rows.map((row) => this.toAgendamentoItem(row));
  }

  async checarDataAgendamento(
    usuarioId: string,
    data: string,
  ): Promise<ChecarDataAgendamentoResultadoDto> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.validarDataAgendamento(data);
    const unidade = this.tentarUnidade(usuario);
    const [y, m, d] = data.split('-').map(Number);
    const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom
    const fimDeSemana = diaSemana === 0 || diaSemana === 6;
    let sabadoDiaUtil = false;
    let feriado = false;
    let descricaoFeriado: string | null = null;

    if (unidade) {
      const cal = await this.carregarCalendarioUnidade(
        unidade,
        data.slice(0, 7),
      );
      sabadoDiaUtil = cal.sabadoDiaUtil;
      const hit = cal.feriados.find((f) => f.data === data);
      if (hit) {
        feriado = true;
        descricaoFeriado = hit.descricao;
      }
    }

    const sabadoComAviso = diaSemana === 6 && !sabadoDiaUtil;
    const requerAviso = feriado || diaSemana === 0 || sabadoComAviso;
    let mensagemAviso: string | null = null;
    if (requerAviso) {
      const partes: string[] = [];
      if (diaSemana === 0) partes.push('domingo');
      else if (diaSemana === 6) partes.push('sábado');
      if (feriado) {
        partes.push(
          descricaoFeriado
            ? `feriado (${descricaoFeriado})`
            : 'feriado na unidade',
        );
      }
      mensagemAviso = `A data escolhida cai em ${partes.join(' e ')}. Deseja agendar mesmo assim?`;
    }

    return {
      data,
      diaSemana,
      fimDeSemana,
      feriado,
      descricaoFeriado,
      sabadoDiaUtil,
      requerAviso,
      mensagemAviso,
    };
  }

  async agendaAlertas(usuarioId: string): Promise<AgendaAlertasDto> {
    const usuario = await this.carregarUsuario(usuarioId);
    const permissoes = getUsuarioPermissoes(usuario);
    let pendenciasAbertas = 0;
    let pendenciasAConcluir = 0;
    let agendamentosProximos = 0;

    if (
      permissoes.includes(Permission.PENDENCIAS_READ) ||
      permissoes.includes(Permission.PENDENCIAS_CREATE)
    ) {
      const resp = await this.solicitacoes.contarResumoAlertas(usuarioId);
      pendenciasAbertas = resp.abertas;
      pendenciasAConcluir = resp.aConcluir;
    }

    if (permissoes.includes(Permission.VISITAS_AGENDA_READ)) {
      const hoje = this.hojeYmdSp();
      const agoraHora = this.agoraHoraSp();
      // Semana civil até o próximo domingo (inclusive); se hoje=domingo, fim=hoje.
      const fim = this.proximoDomingoYmd(hoje);
      // Só futuros: data > hoje, ou hoje com hora ainda não passada.
      const rows = (await this.visitas.query(
        `
        SELECT COUNT(*)::int AS total
        FROM visita_agendamentos
        WHERE "usuarioId" = $1
          AND data <= $3::date
          AND (
            data > $2::date
            OR (
              data = $2::date
              AND COALESCE(NULLIF(TRIM(hora), ''), '00:00') >= $4
            )
          )
        `,
        [usuarioId, hoje, fim, agoraHora],
      )) as Array<{ total: number }>;
      agendamentosProximos = Number(rows[0]?.total ?? 0);
    }

    return {
      pendenciasAbertas,
      pendenciasAConcluir,
      agendamentosProximos,
      total:
        pendenciasAbertas + pendenciasAConcluir + agendamentosProximos,
    };
  }

  async criarAgendamento(
    usuarioId: string,
    dto: CriarAgendamentoVisitaDto,
  ): Promise<AgendamentoVisitaItemDto> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.exigir(usuario, Permission.VISITAS_AGENDA_CREATE);
    const unidade = this.unidadeDoUsuario(usuario);
    this.validarDataAgendamento(dto.data);
    const hora = this.normalizarHora(dto.hora);
    if (!hora) {
      throw new BadRequestException('Hora do agendamento é obrigatória.');
    }
    const prescritor = await this.carregarPrescritor(dto.prescritorId);
    this.exigirPrescritorDaUnidade(unidade, prescritor);

    const salvo = await this.agendamentos.save(
      this.agendamentos.create({
        usuarioId,
        prescritorId: dto.prescritorId,
        unidade,
        data: dto.data,
        hora,
        observacao: this.normalizarObs(dto.observacao),
      }),
    );
    return this.buscarAgendamentoItem(salvo.id);
  }

  async atualizarAgendamento(
    usuarioId: string,
    id: string,
    dto: AtualizarAgendamentoVisitaDto,
  ): Promise<AgendamentoVisitaItemDto> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.exigir(usuario, Permission.VISITAS_AGENDA_UPDATE);
    const atual = await this.buscarAgendamento(id);
    if (atual.usuarioId !== usuarioId) {
      throw new BadRequestException('Você não pode alterar este agendamento.');
    }

    if (dto.data !== undefined) {
      this.validarDataAgendamento(dto.data);
      atual.data = dto.data;
    }
    if (dto.hora !== undefined) {
      atual.hora = this.normalizarHora(dto.hora);
    }
    if (dto.observacao !== undefined) {
      atual.observacao = this.normalizarObs(dto.observacao);
    }
    if (dto.prescritorId !== undefined) {
      const prescritor = await this.carregarPrescritor(dto.prescritorId);
      this.exigirPrescritorDaUnidade(atual.unidade, prescritor);
      atual.prescritorId = dto.prescritorId;
    }

    await this.agendamentos.save(atual);
    return this.buscarAgendamentoItem(id);
  }

  async excluirAgendamento(usuarioId: string, id: string): Promise<void> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.exigir(usuario, Permission.VISITAS_AGENDA_DELETE);
    const atual = await this.buscarAgendamento(id);
    if (atual.usuarioId !== usuarioId) {
      throw new BadRequestException('Você não pode excluir este agendamento.');
    }
    await this.agendamentos.remove(atual);
  }

  async obter(usuarioId: string, id: string): Promise<VisitaResumo> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(id);
    this.garantirLeitura(usuario, visita);
    return this.toResumo(visita);
  }

  async painelPrescritor(
    usuarioId: string,
    id: string,
    competenciaRaw?: string | null,
  ): Promise<PainelPrescritorVisita> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(id);
    this.garantirLeitura(usuario, visita);

    const competencia = this.parseCompetencia(competenciaRaw);
    const { inicio, fimExclusivo } = this.intervaloCompetencia(competencia);
    const crm = String(visita.prescritor?.numeroCRM ?? '').trim();
    const uf = String(visita.prescritor?.UFCRM ?? '')
      .trim()
      .toUpperCase();

    const [pendencias, historico, orcamentos] = await Promise.all([
      this.solicitacoes.abertasDoMedico(visita.prescritorId),
      this.visitas
        .createQueryBuilder('v')
        .leftJoinAndSelect('v.tipoVisita', 'tipo')
        .where('v.prescritorId = :prescritorId', {
          prescritorId: visita.prescritorId,
        })
        .andWhere('v.id <> :visitaId', { visitaId: visita.id })
        .andWhere('v.dataHoraInicio >= :desde', {
          desde: this.mesesAtrasIso(12),
        })
        .orderBy('v.dataHoraInicio', 'DESC')
        .take(50)
        .getMany(),
      crm && uf
        ? this.visitas.query(
            `
            SELECT
              o.id,
              o."nrOrcamento" AS "nrOrcamento",
              o."dataOrcamento"::text AS "dataOrcamento",
              o.status,
              o."precoCobrado"::float AS valor,
              o."principiosAtivos" AS "principiosAtivos"
            FROM orcamentos o
            WHERE o.unidade = $1
              AND BTRIM(COALESCE(o."crmMedico", '')) = $2
              AND UPPER(BTRIM(COALESCE(o."ufcrmMedico", ''))) = $3
              AND o."dataOrcamento" >= $4::date
              AND o."dataOrcamento" < $5::date
              AND o.status IN ('APROVADO', 'REJEITADO')
            ORDER BY o."dataOrcamento" DESC, o."nrOrcamento" DESC
            LIMIT 200
            `,
            [visita.unidade, crm, uf, inicio, fimExclusivo],
          )
        : Promise.resolve([]),
    ]);

    const hojeSp = this.hojeSaoPaulo();
    const aprovadosRows = (orcamentos as Array<Record<string, unknown>>).filter(
      (o) => o.status === OrcamentoStatus.APROVADO,
    );
    const rejeitadosRows = (orcamentos as Array<Record<string, unknown>>).filter(
      (o) => o.status === OrcamentoStatus.REJEITADO,
    );

    return {
      visitaId: visita.id,
      prescritorId: visita.prescritorId,
      prescritorNome: visita.prescritor?.nome ?? '',
      crm,
      uf,
      unidade: visita.unidade,
      competencia,
      latitudeInicio: visita.latitudeInicio,
      longitudeInicio: visita.longitudeInicio,
      pendencias: pendencias
        .filter((p) => p.visitaId !== visita.id)
        .map((p) => ({
          id: p.id,
          visitaId: p.visitaId,
          dataHoraInicio: p.dataHoraInicio,
          tipoVisitaNome: p.tipoVisitaNome ?? '',
          pendencia: p.texto,
          visitadorNome: p.visitadorNome,
        })),
      historicoVisitas: historico.map((h) => {
        const dataRef = h.dataHoraFim ?? h.dataHoraInicio;
        const dataIso =
          dataRef instanceof Date
            ? dataRef.toISOString()
            : new Date(dataRef).toISOString();
        return {
          id: h.id,
          data: dataIso,
          dias: this.diasEntreSp(dataIso, hojeSp),
          tipoVisitaNome: h.tipoVisita?.nome ?? '',
          abordagem: (h.descricao ?? '').trim() || '—',
          status: h.status,
        };
      }),
      aprovados: {
        quantidade: aprovadosRows.length,
        valor: this.somaValor(aprovadosRows),
        itens: aprovadosRows.slice(0, 50).map((o) => this.toOrcamentoItem(o)),
      },
      rejeitados: {
        quantidade: rejeitadosRows.length,
        valor: this.somaValor(rejeitadosRows),
        itens: rejeitadosRows.slice(0, 50).map((o) => this.toOrcamentoItem(o)),
      },
      ativosMaisAprovados: this.topAtivos(aprovadosRows, 10),
      ativosMaisRejeitados: this.topAtivos(rejeitadosRows, 10),
    };
  }

  async iniciar(
    usuarioId: string,
    dto: IniciarVisitaDto,
  ): Promise<VisitaResumo> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.exigir(usuario, Permission.VISITAS_CREATE);
    const vinculo = this.vinculoFuncionario(usuario);
    if (!vinculo) {
      throw new BadRequestException(this.mensagemVinculo(usuario));
    }
    const aberta = await this.buscarAberta(usuarioId);
    if (aberta) {
      throw new BadRequestException('Já existe uma visita em andamento.');
    }
    const tipo = await this.tipos.findOne({
      where: {
        id: dto.tipoVisitaId,
        ativo: true,
        unidade: vinculo.unidade,
      },
    });
    if (!tipo) {
      throw new BadRequestException('Tipo de visita inativo ou inexistente.');
    }
    const prescritor = await this.carregarPrescritor(dto.prescritorId);
    this.exigirPrescritorDaUnidade(vinculo.unidade, prescritor);

    const visita = this.visitas.create({
      prescritorId: dto.prescritorId,
      tipoVisitaId: dto.tipoVisitaId,
      usuarioId,
      unidade: vinculo.unidade,
      latitudeInicio: dto.latitude,
      longitudeInicio: dto.longitude,
      dataHoraInicio: new Date(),
      status: StatusVisita.ABERTA,
      descricao: null,
      pendencia: null,
      material: null,
      dataHoraFim: null,
    });

    try {
      const salva = await this.visitas.save(visita);
      return this.toResumo(await this.buscar(salva.id));
    } catch (error) {
      if (this.ehIndiceUnico(error)) {
        throw new BadRequestException('Já existe uma visita em andamento.');
      }
      throw error;
    }
  }

  async encerrar(
    usuarioId: string,
    id: string,
    dto: EncerrarVisitaDto,
  ): Promise<VisitaResumo> {
    const usuario = await this.carregarUsuario(usuarioId);
    this.exigir(usuario, Permission.VISITAS_UPDATE);
    const visita = await this.buscar(id);
    if (visita.usuarioId !== usuarioId) {
      throw new BadRequestException(
        'Só quem iniciou a visita pode encerrá-la.',
      );
    }
    if (visita.status !== StatusVisita.ABERTA) {
      throw new BadRequestException('A visita não está aberta.');
    }
    if (!dto.descricao?.trim()) {
      throw new BadRequestException('Descrição da visita é obrigatória.');
    }

    visita.dataHoraFim = new Date();
    visita.descricao = dto.descricao.trim();
    visita.pendencia = dto.pendencia ?? null;
    visita.material = dto.material ?? null;
    visita.status = visita.pendencia
      ? StatusVisita.PENDENCIA_ABERTA
      : StatusVisita.CONCLUIDA;
    if (visita.pendencia && !dto.tipoPendenciaId) {
      throw new BadRequestException(
        'Informe o tipo da pendência quando houver solicitação.',
      );
    }
    await this.visitas.manager.transaction(async (manager) => {
      await manager.update(Visita, id, {
        dataHoraFim: visita.dataHoraFim,
        descricao: visita.descricao,
        pendencia: visita.pendencia,
        material: visita.material,
        status: visita.status,
      });
      await this.solicitacoes.sincronizarDaVisita(manager, {
        id: visita.id,
        prescritorId: visita.prescritorId,
        usuarioId: visita.usuarioId,
        unidade: visita.unidade,
        pendencia: visita.pendencia,
        tipoPendenciaId: dto.tipoPendenciaId ?? null,
      });
    });
    return this.toResumo(await this.buscar(id));
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarVisitaDto,
  ): Promise<VisitaResumo> {
    if (
      dto.prescritorId === undefined &&
      dto.tipoVisitaId === undefined &&
      dto.descricao === undefined &&
      dto.pendencia === undefined &&
      dto.material === undefined
    ) {
      throw new BadRequestException('Nenhuma alteração informada.');
    }
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(id);
    this.garantirAlteracao(usuario, visita);

    const patch: {
      prescritorId?: string;
      tipoVisitaId?: string;
      descricao?: string | null;
      pendencia?: string | null;
      material?: string | null;
      status?: StatusVisita;
    } = {};

    if (dto.prescritorId && dto.prescritorId !== visita.prescritorId) {
      const prescritor = await this.carregarPrescritor(dto.prescritorId);
      this.exigirPrescritorDaUnidade(visita.unidade, prescritor);
      patch.prescritorId = dto.prescritorId;
    }
    if (dto.tipoVisitaId && dto.tipoVisitaId !== visita.tipoVisitaId) {
      const tipo = await this.tipos.findOne({
        where: {
          id: dto.tipoVisitaId,
          ativo: true,
          unidade: visita.unidade as Unidade,
        },
      });
      if (!tipo) {
        throw new BadRequestException('Tipo de visita inativo ou inexistente.');
      }
      patch.tipoVisitaId = dto.tipoVisitaId;
    }
    if (dto.descricao !== undefined) {
      patch.descricao = dto.descricao;
      visita.descricao = dto.descricao;
    }
    if (dto.pendencia !== undefined) {
      patch.pendencia = dto.pendencia;
      visita.pendencia = dto.pendencia;
    }
    if (dto.material !== undefined) {
      patch.material = dto.material;
      visita.material = dto.material;
    }
    if (visita.status !== StatusVisita.ABERTA) {
      patch.status = visita.pendencia
        ? StatusVisita.PENDENCIA_ABERTA
        : StatusVisita.CONCLUIDA;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhuma alteração informada.');
    }
    // update() grava a coluna. save() com a relação prescritor carregada
    // reescrevia o médico anterior.
    await this.visitas.manager.transaction(async (manager) => {
      await manager.update(Visita, id, patch);
      const gravada = await manager.findOne(Visita, { where: { id } });
      if (!gravada) {
        throw new NotFoundException('Visita não encontrada.');
      }
      if (patch.prescritorId && gravada.prescritorId !== patch.prescritorId) {
        throw new BadRequestException(
          'Não foi possível trocar o médico da visita.',
        );
      }
      if (gravada.status !== StatusVisita.ABERTA) {
        if (gravada.pendencia?.trim() && !dto.tipoPendenciaId) {
          throw new BadRequestException(
            'Informe o tipo da pendência quando houver solicitação.',
          );
        }
        await this.solicitacoes.sincronizarDaVisita(manager, {
          id: gravada.id,
          prescritorId: gravada.prescritorId,
          usuarioId: gravada.usuarioId,
          unidade: gravada.unidade,
          pendencia: gravada.pendencia,
          tipoPendenciaId: dto.tipoPendenciaId ?? null,
        });
      }
    });
    return this.toResumo(await this.buscar(id));
  }

  async exigirVisitaLegivel(
    usuarioId: string,
    visitaId: string,
  ): Promise<Visita> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(visitaId);
    this.garantirLeitura(usuario, visita);
    return visita;
  }

  async exigirVisitaAbertaAlteravel(
    usuarioId: string,
    visitaId: string,
  ): Promise<Visita> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(visitaId);
    if (visita.status !== StatusVisita.ABERTA) {
      throw new BadRequestException(
        'Mídia só pode ser alterada com a visita em andamento.',
      );
    }
    this.garantirAlteracao(usuario, visita);
    return visita;
  }

  async excluir(usuarioId: string, id: string): Promise<void> {
    const usuario = await this.carregarUsuario(usuarioId);
    const visita = await this.buscar(id);
    this.garantirExclusao(usuario, visita);
    await this.visitas.manager.transaction(async (manager) => {
      await manager.delete(VisitaMidia, { visitaId: visita.id });
      await manager.delete(Visita, { id: visita.id });
    });
  }

  private async carregarUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: ['funcionario', 'perfis'],
    });
    if (!usuario || !usuario.ativo) {
      throw new BadRequestException('Usuário inválido.');
    }
    return usuario;
  }

  private async carregarPrescritor(
    prescritorId: string,
  ): Promise<PrescritorUnidade> {
    const rows: PrescritorUnidade[] = await this.visitas.query(
      `
      SELECT id, unidade, "numeroCRM", "UFCRM"
      FROM prescritores
      WHERE id = $1
      LIMIT 1
      `,
      [prescritorId],
    );
    const prescritor = rows[0];
    if (!prescritor) {
      throw new BadRequestException('Médico não encontrado.');
    }
    return prescritor;
  }

  private unidadeDoUsuario(usuario: Usuario): Unidade {
    const vinculo = this.vinculoFuncionario(usuario);
    if (vinculo?.unidade) return vinculo.unidade;
    if (usuario.unidade) return usuario.unidade;
    throw new BadRequestException(this.mensagemVinculo(usuario));
  }

  private tentarUnidade(usuario: Usuario): Unidade | null {
    try {
      return this.unidadeDoUsuario(usuario);
    } catch {
      return null;
    }
  }

  private async carregarCalendarioUnidade(
    unidade: Unidade | null,
    prefixoMes: string,
  ): Promise<{
    sabadoDiaUtil: boolean;
    feriados: Array<{ data: string; descricao: string | null }>;
  }> {
    if (!unidade) {
      return { sabadoDiaUtil: false, feriados: [] };
    }
    const [sabRows, feriadoRows] = await Promise.all([
      this.visitas.query(
        `
        SELECT COALESCE("sabadoDiaUtil", false) AS "sabadoDiaUtil"
        FROM calendario_unidade
        WHERE unidade = $1
        LIMIT 1
        `,
        [unidade],
      ) as Promise<Array<{ sabadoDiaUtil: boolean | string | number }>>,
      this.visitas.query(
        `
        SELECT data, descricao
        FROM producao_feriado
        WHERE unidade = $1
          AND data LIKE $2
        ORDER BY data ASC
        `,
        [unidade, `${prefixoMes}-%`],
      ) as Promise<Array<{ data: string; descricao: string | null }>>,
    ]);

    return {
      sabadoDiaUtil: Boolean(sabRows[0]?.sabadoDiaUtil),
      feriados: (feriadoRows ?? []).map((f) => ({
        data: f.data,
        descricao: f.descricao?.trim() || null,
      })),
    };
  }

  private async buscarAgendamento(id: string): Promise<VisitaAgendamento> {
    const row = await this.agendamentos.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Agendamento não encontrado.');
    }
    return row;
  }

  private async buscarAgendamentoItem(
    id: string,
  ): Promise<AgendamentoVisitaItemDto> {
    const rows = (await this.visitas.query(
      `
      SELECT
        a.id,
        a."prescritorId" AS "prescritorId",
        COALESCE(p.nome, '') AS "prescritorNome",
        COALESCE(p."numeroCRM"::text, '') AS crm,
        COALESCE(p."UFCRM", '') AS uf,
        to_char(a.data, 'YYYY-MM-DD') AS data,
        a.hora,
        a.observacao
      FROM visita_agendamentos a
      LEFT JOIN prescritores p ON p.id = a."prescritorId"
      WHERE a.id = $1
      LIMIT 1
      `,
      [id],
    )) as Array<{
      id: string;
      prescritorId: string;
      prescritorNome: string;
      crm: string;
      uf: string;
      data: string;
      hora: string | null;
      observacao: string | null;
    }>;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Agendamento não encontrado.');
    }
    return this.toAgendamentoItem(row);
  }

  private toAgendamentoItem(row: {
    id: string;
    prescritorId: string;
    prescritorNome: string;
    crm: string;
    uf: string;
    data: string;
    hora: string | null;
    observacao: string | null;
  }): AgendamentoVisitaItemDto {
    return {
      id: row.id,
      prescritorId: row.prescritorId,
      prescritorNome: (row.prescritorNome || '').trim() || '—',
      crm: String(row.crm ?? '').trim(),
      uf: String(row.uf ?? '').trim().toUpperCase(),
      data: row.data,
      hora: row.hora ? String(row.hora).slice(0, 5) : null,
      observacao: row.observacao?.trim() || null,
    };
  }

  private validarDataAgendamento(data: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw new BadRequestException('Data inválida.');
    }
    const hoje = this.hojeYmdSp();
    if (data < hoje) {
      throw new BadRequestException('Não é possível agendar em data passada.');
    }
    const limite = this.somarDiasYmd(hoje, 365);
    if (data > limite) {
      throw new BadRequestException(
        'Agendamento limitado a 365 dias a partir de hoje.',
      );
    }
  }

  private normalizarHora(hora?: string | null): string | null {
    if (hora == null || String(hora).trim() === '') return null;
    const valor = String(hora).trim().slice(0, 5);
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(valor)) {
      throw new BadRequestException('Hora inválida. Use HH:mm.');
    }
    return valor;
  }

  private normalizarObs(obs?: string | null): string | null {
    if (obs == null) return null;
    const texto = String(obs).trim();
    return texto ? texto.slice(0, 2000) : null;
  }

  private hojeYmdSp(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const ano = partes.find((p) => p.type === 'year')?.value ?? '2026';
    const mes = partes.find((p) => p.type === 'month')?.value ?? '01';
    const dia = partes.find((p) => p.type === 'day')?.value ?? '01';
    return `${ano}-${mes}-${dia}`;
  }

  /** Domingo da semana corrente (hoje…próximo domingo). Se hoje é domingo, retorna hoje. */
  private proximoDomingoYmd(hojeYmd: string): string {
    const [y, m, d] = hojeYmd.split('-').map(Number);
    const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom
    const diasAteDomingo = diaSemana === 0 ? 0 : 7 - diaSemana;
    return this.somarDiasYmd(hojeYmd, diasAteDomingo);
  }

  private agoraHoraSp(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const hora = partes.find((p) => p.type === 'hour')?.value ?? '00';
    const minuto = partes.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
  }

  private somarDiasYmd(ymd: string, dias: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + dias);
    const ano = base.getUTCFullYear();
    const mes = String(base.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(base.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private async buscar(id: string): Promise<Visita> {
    const visita = await this.visitas.findOne({
      where: { id },
      relations: ['prescritor', 'tipoVisita'],
    });
    if (!visita) {
      throw new NotFoundException('Visita não encontrada.');
    }
    return visita;
  }

  private async buscarAberta(usuarioId: string): Promise<Visita | null> {
    return this.visitas.findOne({
      where: {
        usuarioId,
        status: StatusVisita.ABERTA,
      },
      relations: ['prescritor', 'tipoVisita'],
    });
  }

  private exigir(usuario: Usuario, permissao: Permission): void {
    if (!getUsuarioPermissoes(usuario).includes(permissao)) {
      throw new BadRequestException(
        'Você não tem permissão para executar esta ação.',
      );
    }
  }

  private garantirLeitura(usuario: Usuario, visita: Visita): void {
    if (visita.usuarioId === usuario.id) {
      const permissoes = getUsuarioPermissoes(usuario);
      if (
        permissoes.includes(Permission.VISITAS_READ) ||
        permissoes.includes(Permission.VISITAS_AGENDA_READ)
      ) {
        return;
      }
      throw new BadRequestException('Você não tem acesso a esta visita.');
    }
    if (
      getUsuarioPermissoes(usuario).includes(Permission.VISITAS_GERIR) &&
      this.naUnidade(usuario, visita.unidade)
    ) {
      return;
    }
    throw new BadRequestException('Você não tem acesso a esta visita.');
  }

  private garantirAlteracao(usuario: Usuario, visita: Visita): void {
    const permissoes = getUsuarioPermissoes(usuario);
    if (
      visita.usuarioId === usuario.id &&
      permissoes.includes(Permission.VISITAS_UPDATE)
    ) {
      return;
    }
    if (
      permissoes.includes(Permission.VISITAS_GERIR) &&
      this.naUnidade(usuario, visita.unidade)
    ) {
      return;
    }
    throw new BadRequestException('Você não pode alterar esta visita.');
  }

  private garantirExclusao(usuario: Usuario, visita: Visita): void {
    const permissoes = getUsuarioPermissoes(usuario);
    if (
      visita.usuarioId === usuario.id &&
      permissoes.includes(Permission.VISITAS_DELETE)
    ) {
      return;
    }
    if (
      permissoes.includes(Permission.VISITAS_GERIR) &&
      this.naUnidade(usuario, visita.unidade)
    ) {
      return;
    }
    throw new BadRequestException('Você não pode excluir esta visita.');
  }

  private naUnidade(usuario: Usuario, unidade: string): boolean {
    if (!usuario.unidade) return true;
    return usuario.unidade === unidade;
  }

  private mensagemVinculo(usuario: Usuario): string {
    const funcionario = usuario.funcionario;
    if (!funcionario) {
      return 'Usuário sem funcionário vinculado.';
    }
    if (usuario.unidade && usuario.unidade !== funcionario.unidade) {
      return 'O funcionário vinculado é de outra unidade.';
    }
    return 'Funcionário sem unidade para listar prescritores.';
  }

  private vinculoFuncionario(usuario: Usuario): VinculoVisita | null {
    const funcionario = usuario.funcionario;
    if (!funcionario) return null;
    if (usuario.unidade && usuario.unidade !== funcionario.unidade) {
      return null;
    }
    if (!funcionario.unidade) return null;
    const contrato = funcionario.painelContratoRepresentante ?? 0;
    const codigo = funcionario.painelCodigoRepresentante ?? 0;
    return {
      unidade: funcionario.unidade,
      contrato,
      codigo,
      painelDisponivel: contrato > 0 && codigo > 0,
    };
  }

  private parseFiltroPainel(valor?: string | null): FiltroPainelVisita {
    if (valor === 'no_painel' || valor === 'fora_painel') {
      return valor;
    }
    return 'todos';
  }

  private parsePage(valor?: string | number | null): number {
    const n = Number(valor ?? 1);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  }

  private parseLimit(valor?: string | number | null): number {
    const n = Number(valor ?? 40);
    if (!Number.isFinite(n) || n < 1) return 40;
    return Math.min(100, Math.floor(n));
  }

  private parseBusca(valor?: string | null): string | null {
    if (!valor) return null;
    const texto = valor.trim().replace(/\s+/g, ' ');
    return texto.length > 0 ? texto.slice(0, 80) : null;
  }

  private exigirPrescritorDaUnidade(
    unidade: Unidade,
    prescritor: PrescritorUnidade,
  ): void {
    if (!prescritor.unidade || prescritor.unidade !== unidade) {
      throw new BadRequestException('Médico fora da unidade do visitante.');
    }
    const crm = String(prescritor.numeroCRM ?? '').trim();
    const uf = String(prescritor.UFCRM ?? '').trim();
    if (!crm || !uf) {
      throw new BadRequestException('Médico sem CRM e UF completos.');
    }
  }

  private async listarMedicos(
    vinculo: VinculoVisita,
    filtro: FiltroPainelVisita,
    page: number,
    limit: number,
    busca: string | null,
  ): Promise<{ medicos: MedicoCarteira[]; total: number }> {
    const params: Array<string | number> = [vinculo.unidade];
    let joinPainel = `
      LEFT JOIN painel_medicos_representantes pm
        ON pm.unidade = pr.unidade
       AND FALSE
    `;
    if (vinculo.painelDisponivel) {
      params.push(vinculo.contrato, vinculo.codigo);
      joinPainel = `
        LEFT JOIN painel_medicos_representantes pm
          ON pm.unidade = pr.unidade
         AND pm."contratoRepresentante" = $2
         AND pm."codigoRepresentante" = $3
         AND BTRIM(pm."crmMedico") = BTRIM(pr."numeroCRM"::text)
         AND UPPER(BTRIM(pm."ufCrmMedico")) = UPPER(BTRIM(pr."UFCRM"))
         AND UPPER(BTRIM(COALESCE(pm.pfcrm, '1')))
             = UPPER(BTRIM(COALESCE(pr.pfcrm, '1')))
      `;
    }

    let filtroSql = '';
    if (filtro === 'no_painel') {
      filtroSql = 'AND pm.id IS NOT NULL';
    } else if (filtro === 'fora_painel') {
      filtroSql = 'AND pm.id IS NULL';
    }

    let buscaSql = '';
    if (busca) {
      params.push(`%${busca.toLowerCase()}%`);
      const idx = params.length;
      buscaSql = `
        AND (
          LOWER(pr.nome) LIKE $${idx}
          OR LOWER(BTRIM(pr."numeroCRM"::text)) LIKE $${idx}
        )
      `;
    }

    const whereSql = `
      WHERE pr.unidade = $1
        AND pr."numeroCRM" IS NOT NULL
        AND BTRIM(pr."numeroCRM"::text) <> ''
        AND pr."UFCRM" IS NOT NULL
        AND BTRIM(pr."UFCRM") <> ''
        ${filtroSql}
        ${buscaSql}
    `;

    const countRows: Array<{ total: string | number }> =
      await this.visitas.query(
        `
        SELECT COUNT(*)::int AS total
        FROM prescritores pr
        ${joinPainel}
        ${whereSql}
        `,
        params,
      );
    const total = Number(countRows[0]?.total ?? 0);
    if (total === 0) {
      return { medicos: [], total: 0 };
    }

    const offset = (page - 1) * limit;
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const listParams = [...params, limit, offset];

    const rows: LinhaMedico[] = await this.visitas.query(
      `
      SELECT
        pr.id AS "prescritorId",
        COALESCE(NULLIF(BTRIM(pr.nome), ''), 'Sem nome') AS nome,
        BTRIM(pr."numeroCRM"::text) AS crm,
        UPPER(BTRIM(pr."UFCRM")) AS uf,
        pr.pfcrm AS pfcrm,
        CASE WHEN pm.id IS NULL THEN FALSE ELSE TRUE END AS "noPainel",
        CASE
          WHEN ult.fim IS NULL THEN NULL
          ELSE (
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
            - (ult.fim AT TIME ZONE 'America/Sao_Paulo')::date
          )::int
        END AS dias
      FROM prescritores pr
      ${joinPainel}
      LEFT JOIN LATERAL (
        SELECT MAX(v."dataHoraFim") AS fim
        FROM visitas v
        WHERE v."prescritorId" = pr.id
          AND v."dataHoraFim" IS NOT NULL
      ) ult ON true
      ${whereSql}
      ORDER BY
        CASE WHEN ult.fim IS NULL THEN 0 ELSE 1 END,
        dias DESC NULLS LAST,
        pr.nome ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      listParams,
    );

    return {
      medicos: rows.map((row) => this.toMedico(row)),
      total,
    };
  }

  private toMedico(row: LinhaMedico): MedicoCarteira {
    const dias = row.dias == null || row.dias === '' ? null : Number(row.dias);
    const diasSemVisita = dias != null && Number.isFinite(dias) ? dias : null;
    const noPainel =
      row.noPainel === true ||
      row.noPainel === 't' ||
      row.noPainel === 1 ||
      row.noPainel === '1';
    return {
      prescritorId: row.prescritorId,
      nome: row.nome,
      crm: row.crm,
      uf: row.uf,
      pfcrm: row.pfcrm,
      profissao: rotuloPfCrm(row.pfcrm) || 'Sem profissão',
      noPainel,
      diasSemVisita,
      rotuloDias: this.rotuloDias(diasSemVisita),
      podeIniciar: Boolean(row.prescritorId),
    };
  }

  private rotuloDias(dias: number | null): string {
    if (dias == null) return 'Nunca visitado';
    if (dias <= 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  }

  private isoData(valor: Date | string): string {
    return valor instanceof Date
      ? valor.toISOString()
      : new Date(valor).toISOString();
  }

  private filtroDiasHistorico(
    filtro: FindMinhasVisitasDto,
  ): { comparacao: 'mais' | 'menos'; dias: number } | null {
    if (filtro.diasComparacao !== 'mais' && filtro.diasComparacao !== 'menos') {
      return null;
    }
    if (filtro.dias == null || !Number.isInteger(filtro.dias)) return null;
    return { comparacao: filtro.diasComparacao, dias: filtro.dias };
  }

  private intervaloHistorico(
    filtro: FindMinhasVisitasDto,
  ): { inicio: string; fimExclusivo: string } | null {
    if (!filtro.periodo) return null;
    if (filtro.periodo === 'ano') {
      if (!filtro.ano) {
        throw new BadRequestException('Informe o ano.');
      }
      const inicio = `${filtro.ano}-01-01`;
      return { inicio, fimExclusivo: `${filtro.ano + 1}-01-01` };
    }
    if (filtro.periodo === 'mes') {
      if (!filtro.ano || !filtro.mes) {
        throw new BadRequestException('Informe o ano e o mês.');
      }
      const inicio = `${filtro.ano}-${String(filtro.mes).padStart(2, '0')}-01`;
      const proximoMes = filtro.mes === 12 ? 1 : filtro.mes + 1;
      const proximoAno = filtro.mes === 12 ? filtro.ano + 1 : filtro.ano;
      return {
        inicio,
        fimExclusivo: `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`,
      };
    }
    if (!filtro.dataInicio || !filtro.dataFim) {
      throw new BadRequestException('Informe a data inicial e a data final.');
    }
    if (!this.dataCalendarioValida(filtro.dataInicio) || !this.dataCalendarioValida(filtro.dataFim)) {
      throw new BadRequestException('Informe datas válidas no formato AAAA-MM-DD.');
    }
    const dias = this.diferencaDias(filtro.dataInicio, filtro.dataFim);
    if (dias < 0) {
      throw new BadRequestException(
        'A data final precisa ser igual ou posterior à inicial.',
      );
    }
    if (dias > 365) {
      throw new BadRequestException(
        'O período personalizado pode ter no máximo 366 dias.',
      );
    }
    return {
      inicio: filtro.dataInicio,
      fimExclusivo: this.diaSeguinte(filtro.dataFim),
    };
  }

  private dataCalendarioValida(iso: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return false;
    const ano = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return (
      data.getUTCFullYear() === ano &&
      data.getUTCMonth() === mes - 1 &&
      data.getUTCDate() === dia
    );
  }

  private diferencaDias(inicio: string, fim: string): number {
    const a = Date.parse(`${inicio}T00:00:00Z`);
    const b = Date.parse(`${fim}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
  }

  private diaSeguinte(iso: string): string {
    const [ano, mes, dia] = iso.split('-').map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    data.setUTCDate(data.getUTCDate() + 1);
    const y = data.getUTCFullYear();
    const m = String(data.getUTCMonth() + 1).padStart(2, '0');
    const d = String(data.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toResumo(visita: Visita): VisitaResumo {
    const inicio =
      visita.dataHoraInicio instanceof Date
        ? visita.dataHoraInicio.toISOString()
        : new Date(visita.dataHoraInicio).toISOString();
    const fim = visita.dataHoraFim
      ? visita.dataHoraFim instanceof Date
        ? visita.dataHoraFim.toISOString()
        : new Date(visita.dataHoraFim).toISOString()
      : null;
    return {
      id: visita.id,
      status: visita.status,
      prescritorId: visita.prescritorId,
      prescritorNome: visita.prescritor?.nome ?? '',
      crm:
        visita.prescritor?.numeroCRM != null
          ? String(visita.prescritor.numeroCRM)
          : '',
      uf: visita.prescritor?.UFCRM ?? '',
      tipoVisitaId: visita.tipoVisitaId,
      tipoVisitaNome: visita.tipoVisita?.nome ?? '',
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      descricao: visita.descricao,
      pendencia: visita.pendencia,
      material: visita.material,
      unidade: visita.unidade,
      latitudeInicio: visita.latitudeInicio,
      longitudeInicio: visita.longitudeInicio,
    };
  }

  private parseCompetencia(raw?: string | null): string {
    const texto = String(raw ?? '').trim();
    if (/^\d{4}-\d{2}$/.test(texto)) {
      return texto;
    }
    return this.hojeSaoPaulo().slice(0, 7);
  }

  private intervaloCompetencia(competencia: string): {
    inicio: string;
    fimExclusivo: string;
  } {
    const [anoStr, mesStr] = competencia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const inicio = `${competencia}-01`;
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const proximoAno = mes === 12 ? ano + 1 : ano;
    const fimExclusivo = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;
    return { inicio, fimExclusivo };
  }

  private hojeSaoPaulo(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private mesesAtrasIso(meses: number): Date {
    const base = new Date(`${this.hojeSaoPaulo()}T12:00:00.000Z`);
    base.setUTCMonth(base.getUTCMonth() - meses);
    return base;
  }

  private diasEntreSp(iso: string, hojeYmd: string): number | null {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return null;
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(data);
    const a = Date.parse(`${ymd}T12:00:00.000Z`);
    const b = Date.parse(`${hojeYmd}T12:00:00.000Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 86_400_000);
  }

  private somaValor(rows: Array<Record<string, unknown>>): number {
    return rows.reduce((acc, row) => acc + Number(row.valor ?? 0), 0);
  }

  private toOrcamentoItem(row: Record<string, unknown>) {
    return {
      id: String(row.id),
      nrOrcamento: String(row.nrOrcamento ?? ''),
      dataOrcamento: String(row.dataOrcamento ?? '').slice(0, 10),
      valor: Number(row.valor ?? 0),
      status: row.status as 'APROVADO' | 'REJEITADO',
    };
  }

  private topAtivos(
    rows: Array<Record<string, unknown>>,
    limite: number,
  ): PainelAtivoItem[] {
    const mapa = new Map<string, { quantidade: number; valor: number }>();
    for (const row of rows) {
      const texto = String(row.principiosAtivos ?? '');
      const valor = Number(row.valor ?? 0);
      const nomes = texto
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      if (nomes.length === 0) continue;
      const rateio = nomes.length > 0 ? valor / nomes.length : 0;
      for (const nome of nomes) {
        const chave = nome.toLocaleUpperCase('pt-BR');
        const atual = mapa.get(chave) ?? { quantidade: 0, valor: 0 };
        atual.quantidade += 1;
        atual.valor += rateio;
        mapa.set(chave, atual);
      }
    }
    return [...mapa.entries()]
      .map(([nome, stats]) => ({
        nome,
        quantidade: stats.quantidade,
        valor: Math.round(stats.valor * 100) / 100,
      }))
      .sort(
        (a, b) =>
          b.quantidade - a.quantidade ||
          b.valor - a.valor ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      )
      .slice(0, limite);
  }

  private ehIndiceUnico(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
