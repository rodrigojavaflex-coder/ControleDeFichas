import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Permission } from '../../common/enums/permission.enum';
import { Unidade } from '../../common/enums/unidade.enum';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import { TiposPendenciaService } from '../tipos-pendencia/tipos-pendencia.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ConcluirSolicitacaoDto } from './dto/concluir-solicitacao.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { FindGestaoSolicitacoesDto } from './dto/find-gestao-solicitacoes.dto';
import { FindSolicitacoesDto } from './dto/find-solicitacoes.dto';
import { ResolverSolicitacaoDto } from './dto/resolver-solicitacao.dto';
import { TratarSolicitacaoDto } from './dto/tratar-solicitacao.dto';
import { SolicitacaoHistorico } from './entities/solicitacao-historico.entity';
import { Solicitacao } from './entities/solicitacao.entity';
import { StatusSolicitacao } from './enums/status-solicitacao.enum';
import {
  SolicitacaoPainelItem,
  SolicitacaoResumo,
  SolicitacoesListaPaginada,
  SolicitacaoGestaoItem,
  SolicitacaoHistoricoItem,
  MedicoSolicitacaoOpcao,
  VisitaParaSolicitacao,
} from './solicitacoes.types';

interface PrescritorVinculo {
  id: string;
  unidade: Unidade | null;
}

interface VinculoPainel {
  unidade: Unidade;
  contrato: number;
  codigo: number;
  painelDisponivel: boolean;
}

const COLUNAS_RESUMO = `
  s.id,
  s.texto,
  s.status,
  s."visitaId" AS "visitaId",
  s."prescritorId" AS "prescritorId",
  p.nome AS "prescritorNome",
  p."numeroCRM"::text AS crm,
  p."UFCRM" AS uf,
  s."visitadorId" AS "visitadorId",
  u.nome AS "visitadorNome",
  s."tipoPendenciaId" AS "tipoPendenciaId",
  tp.nome AS "tipoPendenciaNome",
  tp."responsavelId" AS "responsavelId",
  ur.nome AS "responsavelNome",
  s."criadoEm" AS "criadoEm",
  ult.descricao AS "ultimaDescricao"
`;

const JUNCAO_RESUMO = `
  LEFT JOIN prescritores p ON p.id = s."prescritorId"
  LEFT JOIN usuarios u ON u.id = s."visitadorId"
  LEFT JOIN tipos_pendencia tp ON tp.id = s."tipoPendenciaId"
  LEFT JOIN usuarios ur ON ur.id = tp."responsavelId"
  LEFT JOIN LATERAL (
    SELECT h.descricao
    FROM solicitacao_historicos h
    WHERE h."solicitacaoId" = s.id
    ORDER BY h."criadoEm" DESC
    LIMIT 1
  ) ult ON true
`;

@Injectable()
export class SolicitacoesService {
  constructor(
    @InjectRepository(Solicitacao)
    private readonly solicitacoes: Repository<Solicitacao>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly tiposPendencia: TiposPendenciaService,
  ) {}

  async criar(
    usuarioId: string,
    dto: CreateSolicitacaoDto,
  ): Promise<SolicitacaoResumo> {
    const usuario = await this.carregarUsuario(usuarioId);
    const prescritorId = dto.prescritorId ?? null;
    const visitadorId = usuario.id;
    let unidade: string | null = usuario.unidade ?? null;
    if (prescritorId) {
      const prescritor = await this.carregarPrescritor(prescritorId);
      this.exigirMesmaUnidade(usuario, prescritor);
      unidade = prescritor.unidade ?? unidade;
    }
    await this.tiposPendencia.exigirAtivo(dto.tipoPendenciaId, unidade);

    const salva = await this.solicitacoes.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Solicitacao);
      const criada = await repo.save(
        repo.create({
          texto: dto.texto,
          status: StatusSolicitacao.ABERTA,
          tipoPendenciaId: dto.tipoPendenciaId,
          visitaId: null,
          prescritorId,
          visitadorId,
          unidade,
        }),
      );
      await this.registrarHistorico(manager, {
        solicitacaoId: criada.id,
        status: StatusSolicitacao.ABERTA,
        descricao: dto.texto,
        usuarioId,
      });
      return criada;
    });
    return this.resumo(salva.id);
  }

  async buscarMedicos(
    usuarioId: string,
    busca: string,
    filtroPainel?: string,
  ): Promise<MedicoSolicitacaoOpcao[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const vinculo = this.vinculoPainel(usuario);
    const unidade = vinculo?.unidade ?? usuario.funcionario?.unidade ?? usuario.unidade ?? null;
    const termo = busca.trim().replace(/[%_\\]/g, '');
    if (!unidade || termo.length < 2) return [];
    const painel = this.parseFiltroPainel(filtroPainel);
    if (painel !== 'todos' && !vinculo?.painelDisponivel) return [];

    const params: unknown[] = [unidade, `%${termo}%`];
    let joinPainel = '';
    let filtroSql = '';
    if (vinculo?.painelDisponivel && painel !== 'todos') {
      params.push(vinculo.contrato, vinculo.codigo);
      const contratoIdx = params.length - 1;
      const codigoIdx = params.length;
      joinPainel = `
        LEFT JOIN painel_medicos_representantes pm
          ON pm.unidade = p.unidade
         AND pm."contratoRepresentante" = $${contratoIdx}
         AND pm."codigoRepresentante" = $${codigoIdx}
         AND BTRIM(pm."crmMedico") = BTRIM(p."numeroCRM"::text)
         AND UPPER(BTRIM(pm."ufCrmMedico")) = UPPER(BTRIM(p."UFCRM"))
         AND UPPER(BTRIM(COALESCE(pm.pfcrm, '1')))
             = UPPER(BTRIM(COALESCE(p.pfcrm, '1')))
      `;
      filtroSql =
        painel === 'no_painel' ? 'AND pm.id IS NOT NULL' : 'AND pm.id IS NULL';
    }

    const rows = await this.solicitacoes.query(
      `
      SELECT
        p.id,
        COALESCE(NULLIF(BTRIM(p.nome), ''), 'Sem nome') AS nome,
        COALESCE(BTRIM(p."numeroCRM"::text), '') AS crm,
        COALESCE(UPPER(BTRIM(p."UFCRM")), '') AS uf
      FROM prescritores p
      ${joinPainel}
      WHERE p.unidade = $1
        AND p."numeroCRM" IS NOT NULL
        AND BTRIM(p."numeroCRM"::text) <> ''
        AND p."UFCRM" IS NOT NULL
        AND BTRIM(p."UFCRM") <> ''
        AND (
          p.nome ILIKE $2
          OR p."numeroCRM"::text ILIKE $2
        )
        ${filtroSql}
      ORDER BY p.nome ASC
      LIMIT 8
      `,
      params,
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      nome: String(row.nome ?? ''),
      crm: String(row.crm ?? ''),
      uf: String(row.uf ?? ''),
    }));
  }

  async minhas(
    usuarioId: string,
    filtro: FindSolicitacoesDto,
  ): Promise<SolicitacoesListaPaginada> {
    const usuario = await this.carregarUsuario(usuarioId);
    const vinculo = this.vinculoPainel(usuario);
    const page = this.parsePage(filtro.page);
    const limit = this.parseLimit(filtro.limit);
    const intervalo = this.intervaloPeriodo(filtro);

    const params: unknown[] = [usuarioId];
    const where = [`s."visitadorId" = $1`];

    const status = filtro.status ?? 'todas';
    if (status !== 'todas') {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }

    if (filtro.prescritorId) {
      params.push(filtro.prescritorId);
      where.push(`s."prescritorId" = $${params.length}`);
    }
    if (filtro.tipoPendenciaId) {
      params.push(filtro.tipoPendenciaId);
      where.push(`s."tipoPendenciaId" = $${params.length}`);
    }
    if (intervalo) {
      params.push(intervalo.inicio, intervalo.fimExclusivo);
      const inicioIdx = params.length - 1;
      const fimIdx = params.length;
      where.push(
        `(s."criadoEm" AT TIME ZONE 'America/Sao_Paulo')::date >= $${inicioIdx}::date`,
      );
      where.push(
        `(s."criadoEm" AT TIME ZONE 'America/Sao_Paulo')::date < $${fimIdx}::date`,
      );
    }

    let joinPainel = `
      LEFT JOIN painel_medicos_representantes pm ON FALSE
    `;
    if (vinculo?.painelDisponivel) {
      params.push(vinculo.contrato, vinculo.codigo);
      const contratoIdx = params.length - 1;
      const codigoIdx = params.length;
      joinPainel = `
        LEFT JOIN painel_medicos_representantes pm
          ON pm.unidade = p.unidade
         AND pm."contratoRepresentante" = $${contratoIdx}
         AND pm."codigoRepresentante" = $${codigoIdx}
         AND BTRIM(pm."crmMedico") = BTRIM(p."numeroCRM"::text)
         AND UPPER(BTRIM(pm."ufCrmMedico")) = UPPER(BTRIM(p."UFCRM"))
         AND UPPER(BTRIM(COALESCE(pm.pfcrm, '1')))
             = UPPER(BTRIM(COALESCE(p.pfcrm, '1')))
      `;
    }

    const whereSql = where.join(' AND ');
    const countRows = (await this.solicitacoes.query(
      `
      SELECT COUNT(*)::int AS total
      FROM solicitacoes s
      LEFT JOIN prescritores p ON p.id = s."prescritorId"
      ${joinPainel}
      WHERE ${whereSql}
      `,
      params,
    )) as Array<{ total: string | number }>;
    const total = Number(countRows[0]?.total ?? 0);

    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const rows = await this.solicitacoes.query(
      `
      SELECT
        ${COLUNAS_RESUMO},
        CASE
          WHEN s."prescritorId" IS NULL THEN NULL
          WHEN pm.id IS NULL THEN FALSE
          ELSE TRUE
        END AS "noPainel",
        (
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
          - (s."criadoEm" AT TIME ZONE 'America/Sao_Paulo')::date
        )::int AS "diasAberta"
      FROM solicitacoes s
      ${JUNCAO_RESUMO}
      ${joinPainel}
      WHERE ${whereSql}
      ORDER BY s."criadoEm" DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params,
    );

    return {
      items: (rows as Array<Record<string, unknown>>).map((row) =>
        this.mapResumo(row),
      ),
      total,
      page,
      limit,
      hasMore: page * limit < total,
      painelDisponivel: Boolean(vinculo?.painelDisponivel),
    };
  }

  async listarGestao(
    usuarioId: string,
    filtro: FindGestaoSolicitacoesDto,
  ): Promise<SolicitacaoGestaoItem[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const params: unknown[] = [];
    const where: string[] = [];
    const unidade = usuario.unidade || filtro.unidade;
    if (unidade) {
      params.push(unidade);
      where.push(`s.unidade = $${params.length}`);
    }
    const status = filtro.status ?? 'todas';
    if (status !== 'todas') {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }
    const busca = filtro.busca?.replace(/[%_\\]/g, '').trim();
    if (busca) {
      params.push(`%${busca}%`);
      const indice = params.length;
      where.push(
        `(s.texto ILIKE $${indice} OR p.nome ILIKE $${indice} OR u.nome ILIKE $${indice})`,
      );
    }
    const filtroSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.solicitacoes.query(
      `
      SELECT
        ${COLUNAS_RESUMO},
        s.unidade
      FROM solicitacoes s
      ${JUNCAO_RESUMO}
      ${filtroSql}
      ORDER BY s."criadoEm" DESC
      LIMIT 300
      `,
      params,
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      ...this.mapResumo(row),
      unidade: row.unidade ? String(row.unidade) : null,
    }));
  }

  async tratar(
    usuarioId: string,
    id: string,
    dto: TratarSolicitacaoDto,
  ): Promise<SolicitacaoGestaoItem> {
    const usuario = await this.carregarUsuario(usuarioId);
    const atual = await this.solicitacoes.findOne({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    this.exigirUnidadeDaPendencia(usuario, atual);
    const permitida =
      (dto.status === StatusSolicitacao.RESOLVIDA &&
        (atual.status === StatusSolicitacao.ABERTA ||
          atual.status === StatusSolicitacao.REABERTA)) ||
      (dto.status === StatusSolicitacao.REABERTA &&
        (atual.status === StatusSolicitacao.RESOLVIDA ||
          atual.status === StatusSolicitacao.CONCLUIDA));
    if (!permitida) {
      throw new BadRequestException('A pendência não pode ir para essa situação.');
    }
    await this.solicitacoes.manager.transaction(async (manager) => {
      await manager.getRepository(Solicitacao).update(id, {
        status: dto.status,
      });
      await this.registrarHistorico(manager, {
        solicitacaoId: id,
        status: dto.status,
        descricao: dto.descricao,
        usuarioId,
      });
    });
    return this.gestaoPorId(id);
  }

  /**
   * Visitador que registrou atende a própria pendência (ABERTA/REABERTA → RESOLVIDA).
   */
  async resolver(
    usuarioId: string,
    id: string,
    dto: ResolverSolicitacaoDto,
  ): Promise<SolicitacaoResumo> {
    const atual = await this.solicitacoes.findOne({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    if (atual.visitadorId !== usuarioId) {
      throw new BadRequestException(
        'Só o visitador que registrou pode resolver esta pendência.',
      );
    }
    if (
      atual.status !== StatusSolicitacao.ABERTA &&
      atual.status !== StatusSolicitacao.REABERTA
    ) {
      throw new BadRequestException(
        'Só uma pendência aberta ou reaberta pode ser resolvida pelo visitador.',
      );
    }
    await this.solicitacoes.manager.transaction(async (manager) => {
      await manager.getRepository(Solicitacao).update(id, {
        status: StatusSolicitacao.RESOLVIDA,
      });
      await this.registrarHistorico(manager, {
        solicitacaoId: id,
        status: StatusSolicitacao.RESOLVIDA,
        descricao: dto.descricao,
        usuarioId,
      });
    });
    return this.resumo(id);
  }

  async concluir(
    usuarioId: string,
    id: string,
    dto: ConcluirSolicitacaoDto,
  ): Promise<SolicitacaoResumo> {
    const atual = await this.solicitacoes.findOne({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    if (atual.visitadorId !== usuarioId) {
      throw new BadRequestException('Só o visitador que registrou pode concluir.');
    }
    if (atual.status !== StatusSolicitacao.RESOLVIDA) {
      throw new BadRequestException('Só uma pendência resolvida pode ser concluída.');
    }
    await this.solicitacoes.manager.transaction(async (manager) => {
      await manager.getRepository(Solicitacao).update(id, {
        status: StatusSolicitacao.CONCLUIDA,
      });
      await this.registrarHistorico(manager, {
        solicitacaoId: id,
        status: StatusSolicitacao.CONCLUIDA,
        descricao: dto.descricao,
        usuarioId,
      });
    });
    return this.resumo(id);
  }

  async contarAConcluir(usuarioId: string): Promise<{ total: number }> {
    const total = await this.solicitacoes
      .createQueryBuilder('s')
      .where('s.visitadorId = :usuarioId', { usuarioId })
      .andWhere(`s.status = 'RESOLVIDA'`)
      .getCount();
    return { total };
  }

  /** Contagens do app: abertas e resolvidas aguardando validação. */
  async contarResumoAlertas(usuarioId: string): Promise<{
    abertas: number;
    aConcluir: number;
  }> {
    const rows = (await this.solicitacoes.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE s.status = 'ABERTA')::int AS abertas,
        COUNT(*) FILTER (WHERE s.status = 'RESOLVIDA')::int AS "aConcluir"
      FROM solicitacoes s
      WHERE s."visitadorId" = $1
      `,
      [usuarioId],
    )) as Array<{ abertas: number; aConcluir: number }>;
    return {
      abertas: Number(rows[0]?.abertas ?? 0),
      aConcluir: Number(rows[0]?.aConcluir ?? 0),
    };
  }

  async historico(
    usuarioId: string,
    id: string,
  ): Promise<SolicitacaoHistoricoItem[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const atual = await this.solicitacoes.findOne({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    const permissoes = getUsuarioPermissoes(usuario);
    const web = permissoes.includes(Permission.PENDENCIAS_WEB_READ);
    const app =
      permissoes.includes(Permission.PENDENCIAS_READ) ||
      permissoes.includes(Permission.PENDENCIAS_CREATE);
    const mesmaUnidade =
      !usuario.unidade || atual.unidade === usuario.unidade;
    const dono = atual.visitadorId === usuario.id;
    if (!(web && mesmaUnidade) && !(app && dono)) {
      throw new ForbiddenException('Você não pode ver o histórico desta pendência.');
    }
    const rows = await this.solicitacoes.query(
      `
      SELECT
        h.id,
        h.status,
        h.descricao,
        h."usuarioId" AS "usuarioId",
        u.nome AS "usuarioNome",
        h."criadoEm" AS "criadoEm"
      FROM solicitacao_historicos h
      LEFT JOIN usuarios u ON u.id = h."usuarioId"
      WHERE h."solicitacaoId" = $1
      ORDER BY h."criadoEm" ASC
      `,
      [id],
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      status: this.statusDe(row.status),
      descricao: String(row.descricao ?? ''),
      usuarioId: row.usuarioId ? String(row.usuarioId) : null,
      usuarioNome: row.usuarioNome ? String(row.usuarioNome) : null,
      criadoEm: this.iso(row.criadoEm),
    }));
  }

  async abertasDoMedico(prescritorId: string): Promise<SolicitacaoPainelItem[]> {
    const rows = await this.solicitacoes.query(
      `
      SELECT
        s.id,
        s.texto,
        s."visitaId" AS "visitaId",
        COALESCE(v."dataHoraInicio", s."criadoEm") AS "dataHoraInicio",
        t.nome AS "tipoVisitaNome",
        u.nome AS "visitadorNome"
      FROM solicitacoes s
      LEFT JOIN visitas v ON v.id = s."visitaId"
      LEFT JOIN tipos_visita t ON t.id = v."tipoVisitaId"
      LEFT JOIN usuarios u ON u.id = s."visitadorId"
      WHERE s.status IN ('ABERTA', 'REABERTA', 'RESOLVIDA')
        AND s."prescritorId" = $1
      ORDER BY s."criadoEm" DESC
      LIMIT 20
      `,
      [prescritorId],
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      visitaId: row.visitaId ? String(row.visitaId) : null,
      texto: String(row.texto ?? '').trim() || 'Sem texto de pendência',
      dataHoraInicio: this.iso(row.dataHoraInicio),
      tipoVisitaNome: row.tipoVisitaNome ? String(row.tipoVisitaNome) : null,
      visitadorNome: row.visitadorNome ? String(row.visitadorNome) : null,
    }));
  }

  /**
   * Mantém uma solicitação por visita encerrada.
   * Texto preenchido cria a pendência aberta. Texto vazio só conclui
   * se ela ainda estiver aberta, sem desfazer resolução do escritório.
   */
  async sincronizarDaVisita(
    manager: EntityManager,
    visita: VisitaParaSolicitacao,
  ): Promise<void> {
    const repo = manager.getRepository(Solicitacao);
    const texto = (visita.pendencia ?? '').trim();
    const existente = await repo.findOne({ where: { visitaId: visita.id } });
    if (!texto) {
      if (existente && existente.status === StatusSolicitacao.ABERTA) {
        await repo.update(existente.id, { status: StatusSolicitacao.CONCLUIDA });
        await this.registrarHistorico(manager, {
          solicitacaoId: existente.id,
          status: StatusSolicitacao.CONCLUIDA,
          descricao: 'Encerrada na visita, sem texto de pendência.',
          usuarioId: visita.usuarioId,
        });
      }
      return;
    }
    if (!visita.tipoPendenciaId) {
      throw new BadRequestException(
        'Informe o tipo da pendência quando houver solicitação.',
      );
    }
    await this.tiposPendencia.exigirAtivo(
      visita.tipoPendenciaId,
      visita.unidade,
    );
    if (existente) {
      const reabrir = existente.status === StatusSolicitacao.CONCLUIDA;
      await repo.update(existente.id, {
        texto,
        status: reabrir ? StatusSolicitacao.ABERTA : existente.status,
        tipoPendenciaId: visita.tipoPendenciaId,
        prescritorId: visita.prescritorId,
        visitadorId: visita.usuarioId,
        unidade: visita.unidade,
      });
      if (reabrir) {
        await this.registrarHistorico(manager, {
          solicitacaoId: existente.id,
          status: StatusSolicitacao.ABERTA,
          descricao: texto,
          usuarioId: visita.usuarioId,
        });
      }
      return;
    }
    const criada = await repo.save(
      repo.create({
        texto,
        status: StatusSolicitacao.ABERTA,
        tipoPendenciaId: visita.tipoPendenciaId,
        visitaId: visita.id,
        prescritorId: visita.prescritorId,
        visitadorId: visita.usuarioId,
        unidade: visita.unidade,
      }),
    );
    await this.registrarHistorico(manager, {
      solicitacaoId: criada.id,
      status: StatusSolicitacao.ABERTA,
      descricao: texto,
      usuarioId: visita.usuarioId,
    });
  }

  private async gestaoPorId(id: string): Promise<SolicitacaoGestaoItem> {
    const encontrada = (await this.solicitacoes.query(
      `
      SELECT ${COLUNAS_RESUMO}, s.unidade
      FROM solicitacoes s
      ${JUNCAO_RESUMO}
      WHERE s.id = $1
      `,
      [id],
    )) as Array<Record<string, unknown>>;
    const row = encontrada[0];
    if (!row) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    return {
      ...this.mapResumo(row),
      unidade: row.unidade ? String(row.unidade) : null,
    };
  }

  private async resumo(id: string): Promise<SolicitacaoResumo> {
    const rows = await this.solicitacoes.query(
      `
      SELECT ${COLUNAS_RESUMO}
      FROM solicitacoes s
      ${JUNCAO_RESUMO}
      WHERE s.id = $1
      `,
      [id],
    );
    const row = (rows as Array<Record<string, unknown>>)[0];
    if (!row) {
      throw new NotFoundException('Pendência não encontrada.');
    }
    return this.mapResumo(row);
  }

  private async registrarHistorico(
    manager: EntityManager,
    dados: {
      solicitacaoId: string;
      status: StatusSolicitacao;
      descricao: string;
      usuarioId: string | null;
    },
  ): Promise<void> {
    const descricao = dados.descricao.trim();
    if (!descricao) {
      throw new BadRequestException('Descreva o que foi feito.');
    }
    await manager.getRepository(SolicitacaoHistorico).insert({
      solicitacaoId: dados.solicitacaoId,
      status: dados.status,
      descricao,
      usuarioId: dados.usuarioId,
    });
  }

  private mapResumo(row: Record<string, unknown>): SolicitacaoResumo {
    const noPainelBruto = row.noPainel;
    let noPainel: boolean | null = null;
    if (noPainelBruto === true || noPainelBruto === 't' || noPainelBruto === 1 || noPainelBruto === '1') {
      noPainel = true;
    } else if (
      noPainelBruto === false ||
      noPainelBruto === 'f' ||
      noPainelBruto === 0 ||
      noPainelBruto === '0'
    ) {
      noPainel = false;
    }
    return {
      id: String(row.id),
      texto: String(row.texto ?? ''),
      status: this.statusDe(row.status),
      visitaId: row.visitaId ? String(row.visitaId) : null,
      prescritorId: row.prescritorId ? String(row.prescritorId) : null,
      prescritorNome: row.prescritorNome ? String(row.prescritorNome) : null,
      crm: row.crm ? String(row.crm) : null,
      uf: row.uf ? String(row.uf) : null,
      visitadorId: row.visitadorId ? String(row.visitadorId) : null,
      visitadorNome: row.visitadorNome ? String(row.visitadorNome) : null,
      tipoPendenciaId: row.tipoPendenciaId ? String(row.tipoPendenciaId) : null,
      tipoPendenciaNome: row.tipoPendenciaNome
        ? String(row.tipoPendenciaNome)
        : null,
      responsavelId: row.responsavelId ? String(row.responsavelId) : null,
      responsavelNome: row.responsavelNome ? String(row.responsavelNome) : null,
      criadoEm: this.iso(row.criadoEm),
      ultimaDescricao: row.ultimaDescricao ? String(row.ultimaDescricao) : null,
      noPainel,
      diasAberta:
        row.diasAberta == null || row.diasAberta === ''
          ? null
          : Number(row.diasAberta),
      rotuloDias:
        row.diasAberta == null || row.diasAberta === ''
          ? null
          : this.rotuloDias(Number(row.diasAberta)),
    };
  }

  private rotuloDias(dias: number): string {
    if (!Number.isFinite(dias) || dias <= 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  }

  private vinculoPainel(usuario: Usuario): VinculoPainel | null {
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

  private parseFiltroPainel(
    valor?: string | null,
  ): 'todos' | 'no_painel' | 'fora_painel' {
    if (valor === 'no_painel' || valor === 'fora_painel') return valor;
    return 'todos';
  }

  private parsePage(valor?: number): number {
    const n = Number(valor ?? 1);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  }

  private parseLimit(valor?: number): number {
    const n = Number(valor ?? 20);
    if (!Number.isFinite(n) || n < 1) return 20;
    return Math.min(100, Math.floor(n));
  }

  private intervaloPeriodo(
    filtro: FindSolicitacoesDto,
  ): { inicio: string; fimExclusivo: string } | null {
    if (!filtro.periodo) return null;
    if (filtro.periodo === 'ano') {
      if (!filtro.ano) {
        throw new BadRequestException('Informe o ano.');
      }
      return {
        inicio: `${filtro.ano}-01-01`,
        fimExclusivo: `${filtro.ano + 1}-01-01`,
      };
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
    if (
      !this.dataCalendarioValida(filtro.dataInicio) ||
      !this.dataCalendarioValida(filtro.dataFim)
    ) {
      throw new BadRequestException(
        'Informe datas válidas no formato AAAA-MM-DD.',
      );
    }
    if (filtro.dataFim < filtro.dataInicio) {
      throw new BadRequestException(
        'A data final precisa ser igual ou posterior à inicial.',
      );
    }
    const dias = this.diferencaDias(filtro.dataInicio, filtro.dataFim);
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
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    const data = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    data.setUTCDate(data.getUTCDate() + 1);
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private statusDe(valor: unknown): StatusSolicitacao {
    const texto = String(valor ?? '');
    if ((Object.values(StatusSolicitacao) as string[]).includes(texto)) {
      return texto as StatusSolicitacao;
    }
    return StatusSolicitacao.ABERTA;
  }

  private iso(valor: unknown): string {
    if (valor instanceof Date) return valor.toISOString();
    const data = new Date(String(valor ?? ''));
    return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
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

  private async carregarPrescritor(id: string): Promise<PrescritorVinculo> {
    const rows: PrescritorVinculo[] = await this.solicitacoes.query(
      `
      SELECT id, unidade
      FROM prescritores
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    const prescritor = rows[0];
    if (!prescritor) {
      throw new BadRequestException('Médico não encontrado.');
    }
    return prescritor;
  }

  private exigirMesmaUnidade(
    usuario: Usuario,
    prescritor: PrescritorVinculo,
  ): void {
    const unidade = usuario.funcionario?.unidade ?? usuario.unidade ?? null;
    if (!unidade || !prescritor.unidade) return;
    if (unidade !== prescritor.unidade) {
      throw new BadRequestException('O médico é de outra unidade.');
    }
  }

  private exigirUnidadeDaPendencia(usuario: Usuario, atual: Solicitacao): void {
    if (usuario.unidade && atual.unidade && atual.unidade !== usuario.unidade) {
      throw new BadRequestException('A pendência é de outra unidade.');
    }
  }
}
