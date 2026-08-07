import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProducaoJornadaUnidade } from './entities/producao-jornada-unidade.entity';
import { ProducaoJornadaIntervalo } from './entities/producao-jornada-intervalo.entity';
import { ProducaoJornadaDia } from './entities/producao-jornada-dia.entity';
import {
  ProducaoFeriado,
  ProducaoFeriadoOrigem,
} from './entities/producao-feriado.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { assertUnidadeFolha } from '../folha/utils/folha-unidade-scope.util';
import {
  ImportarFeriadosNacionaisResponseDto,
  ProducaoFeriadoItemDto,
  ProducaoFeriadosMesResponseDto,
  ProducaoFeriadoToggleDto,
  ProducaoJornadaDiaDto,
  ProducaoJornadaResponseDto,
  SalvarProducaoJornadaDto,
} from './dto/producao-jornada-feriado.dto';
import {
  normalizarHoraCurta,
  ProducaoCalendarioUnidade,
  ProducaoIntervaloHorario,
  validarFaixasDia,
} from './utils/producao-calendario.util';
import {
  JornadaCalendarioBase,
  ProducaoCalendarioCacheService,
} from './producao-calendario-cache.service';

export interface MapaCalendarioOpcoes {
  /** YYYY-MM-DD — limita carga de feriados (ex.: intervalo das entradas na fila). */
  feriadoDataMin?: string;
  feriadoDataMax?: string;
}

interface BrasilApiFeriado {
  date: string;
  name: string;
  type: string;
}

const DIAS_SEMANA_ORDEM = [0, 1, 2, 3, 4, 5, 6];

const NOMES_DIA: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

@Injectable()
export class ProducaoCalendarioService {
  private readonly logger = new Logger(ProducaoCalendarioService.name);

  constructor(
    @InjectRepository(ProducaoJornadaUnidade)
    private readonly jornadaUnidadeRepo: Repository<ProducaoJornadaUnidade>,
    @InjectRepository(ProducaoJornadaIntervalo)
    private readonly jornadaIntervaloRepo: Repository<ProducaoJornadaIntervalo>,
    @InjectRepository(ProducaoJornadaDia)
    private readonly jornadaDiaRepo: Repository<ProducaoJornadaDia>,
    @InjectRepository(ProducaoFeriado)
    private readonly feriadoRepo: Repository<ProducaoFeriado>,
    private readonly dataSource: DataSource,
    private readonly calendarioCache: ProducaoCalendarioCacheService,
  ) {}

  static nomeDiaSemana(dia: number): string {
    return NOMES_DIA[dia] ?? String(dia);
  }

  async obterJornada(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ProducaoJornadaResponseDto> {
    assertUnidadeFolha(usuario, unidade);
    const cfg = await this.jornadaUnidadeRepo.findOne({ where: { unidade } });
    const intervalos = await this.jornadaIntervaloRepo.find({
      where: { unidade },
      order: { diaSemana: 'ASC', ordem: 'ASC' },
    });
    const diasFechadoRows = await this.jornadaDiaRepo.find({ where: { unidade } });
    const fechadoPorDia = new Map(
      diasFechadoRows.map((r) => [r.diaSemana, r.fechado]),
    );

    const porDia = new Map<number, ProducaoJornadaDiaDto['intervalos']>();
    for (const row of intervalos) {
      let list = porDia.get(row.diaSemana);
      if (!list) {
        list = [];
        porDia.set(row.diaSemana, list);
      }
      list.push({
        diaSemana: row.diaSemana,
        ordem: row.ordem,
        horaInicio: normalizarHoraCurta(row.horaInicio),
        horaFim: normalizarHoraCurta(row.horaFim),
      });
    }

    const dias: ProducaoJornadaDiaDto[] = DIAS_SEMANA_ORDEM.map((diaSemana) => {
      const ints = porDia.get(diaSemana) ?? [];
      const fechadoRegistrado = fechadoPorDia.get(diaSemana);
      return {
        diaSemana,
        fechado:
          fechadoRegistrado !== undefined
            ? fechadoRegistrado
            : ints.length === 0,
        intervalos: ints,
      };
    });

    return {
      configurado: cfg?.configurado ?? false,
      dias,
    };
  }

  async salvarJornada(
    usuario: Usuario,
    dto: SalvarProducaoJornadaDto,
  ): Promise<ProducaoJornadaResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade as Unidade);
    const unidade = dto.unidade as Unidade;

    if (!dto.dias || dto.dias.length !== 7) {
      throw new BadRequestException(
        'Informe os 7 dias da semana (0=domingo … 6=sábado).',
      );
    }

    const intervalosPersistir: Partial<ProducaoJornadaIntervalo>[] = [];
    const diasFechadoPersistir: Partial<ProducaoJornadaDia>[] = [];
    for (const dia of dto.dias) {
      diasFechadoPersistir.push({
        unidade,
        diaSemana: dia.diaSemana,
        fechado: dia.fechado,
      });

      const ints = dia.intervalos ?? [];
      if (!dia.fechado && ints.length === 0) {
        throw new BadRequestException(
          `Dia ${ProducaoCalendarioService.nomeDiaSemana(dia.diaSemana)}: informe horários ou marque Fechado.`,
        );
      }
      if (ints.length === 0) {
        continue;
      }
      const faixas: ProducaoIntervaloHorario[] = ints.map((i) => ({
        horaInicio: normalizarHoraCurta(i.horaInicio),
        horaFim: normalizarHoraCurta(i.horaFim),
      }));
      const erro = validarFaixasDia(faixas);
      if (erro) {
        throw new BadRequestException(
          `${ProducaoCalendarioService.nomeDiaSemana(dia.diaSemana)}: ${erro}`,
        );
      }
      faixas.forEach((f, ordem) => {
        intervalosPersistir.push({
          unidade,
          diaSemana: dia.diaSemana,
          ordem,
          horaInicio: f.horaInicio,
          horaFim: f.horaFim,
        });
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ProducaoJornadaIntervalo, { unidade });
      await manager.delete(ProducaoJornadaDia, { unidade });
      let cfg = await manager.findOne(ProducaoJornadaUnidade, {
        where: { unidade },
      });
      if (!cfg) {
        cfg = manager.create(ProducaoJornadaUnidade, {
          unidade,
          configurado: true,
        });
      } else {
        cfg.configurado = true;
      }
      await manager.save(ProducaoJornadaUnidade, cfg);
      if (diasFechadoPersistir.length > 0) {
        await manager.save(
          ProducaoJornadaDia,
          diasFechadoPersistir.map((row) =>
            manager.create(ProducaoJornadaDia, row),
          ),
        );
      }
      if (intervalosPersistir.length > 0) {
        await manager.save(
          ProducaoJornadaIntervalo,
          intervalosPersistir.map((row) =>
            manager.create(ProducaoJornadaIntervalo, row),
          ),
        );
      }
    });

    this.calendarioCache.invalidar(unidade);
    return this.obterJornada(usuario, unidade);
  }

  async listarFeriados(
    usuario: Usuario,
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    assertUnidadeFolha(usuario, unidade);
    if (mes != null && (mes < 1 || mes > 12)) {
      throw new BadRequestException('Mês inválido.');
    }

    const qb = this.feriadoRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.data LIKE :anoPrefixo', { anoPrefixo: `${ano}-%` })
      .orderBy('f.data', 'ASC');

    if (mes != null) {
      const prefixoMes = `${ano}-${String(mes).padStart(2, '0')}`;
      qb.andWhere('f.data LIKE :mesPrefixo', { mesPrefixo: `${prefixoMes}-%` });
    }

    const rows = await qb.getMany();

    const feriados: ProducaoFeriadoItemDto[] = rows.map((r) => ({
      data: r.data,
      descricao: r.descricao ?? null,
      origem: r.origem,
    }));

    return { ano, mes: mes ?? null, feriados };
  }

  /** @deprecated Use listarFeriados */
  async listarFeriadosMes(
    usuario: Usuario,
    unidade: Unidade,
    ano: number,
    mes: number,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    return this.listarFeriados(usuario, unidade, ano, mes);
  }

  async incluirFeriado(
    usuario: Usuario,
    dto: ProducaoFeriadoToggleDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    const unidade = dto.unidade as Unidade;
    assertUnidadeFolha(usuario, unidade);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.data)) {
      throw new BadRequestException('Data deve estar no formato YYYY-MM-DD.');
    }

    const existente = await this.feriadoRepo.findOne({
      where: { unidade, data: dto.data },
    });
    if (existente) {
      throw new ConflictException('Esta data já está cadastrada como feriado.');
    }

    await this.feriadoRepo.save(
      this.feriadoRepo.create({
        unidade,
        data: dto.data,
        descricao: dto.descricao?.trim() || null,
        origem: ProducaoFeriadoOrigem.MANUAL,
      }),
    );

    this.calendarioCache.invalidar(unidade);
    const ano = Number(dto.data.slice(0, 4));
    return this.listarFeriados(usuario, unidade, ano);
  }

  async removerFeriado(
    usuario: Usuario,
    dto: ProducaoFeriadoToggleDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    const unidade = dto.unidade as Unidade;
    assertUnidadeFolha(usuario, unidade);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.data)) {
      throw new BadRequestException('Data deve estar no formato YYYY-MM-DD.');
    }

    const existente = await this.feriadoRepo.findOne({
      where: { unidade, data: dto.data },
    });
    if (!existente) {
      throw new NotFoundException('Feriado não encontrado para esta data.');
    }

    await this.feriadoRepo.remove(existente);

    this.calendarioCache.invalidar(unidade);
    const ano = Number(dto.data.slice(0, 4));
    return this.listarFeriados(usuario, unidade, ano);
  }

  async toggleFeriado(
    usuario: Usuario,
    dto: ProducaoFeriadoToggleDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    const unidade = dto.unidade as Unidade;
    assertUnidadeFolha(usuario, unidade);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.data)) {
      throw new BadRequestException('Data deve estar no formato YYYY-MM-DD.');
    }

    const existente = await this.feriadoRepo.findOne({
      where: { unidade, data: dto.data },
    });
    if (existente) {
      await this.feriadoRepo.remove(existente);
    } else {
      await this.feriadoRepo.save(
        this.feriadoRepo.create({
          unidade,
          data: dto.data,
          descricao: dto.descricao?.trim() || null,
          origem: ProducaoFeriadoOrigem.MANUAL,
        }),
      );
    }

    this.calendarioCache.invalidar(unidade);
    const ano = Number(dto.data.slice(0, 4));
    return this.listarFeriados(usuario, unidade, ano);
  }

  async importarFeriadosNacionais(
    usuario: Usuario,
    unidade: Unidade,
    ano: number,
  ): Promise<ImportarFeriadosNacionaisResponseDto> {
    assertUnidadeFolha(usuario, unidade);
    let lista: BrasilApiFeriado[];
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/feriados/v1/${ano}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      lista = (await res.json()) as BrasilApiFeriado[];
    } catch (err) {
      this.logger.warn(
        `Falha ao buscar feriados nacionais (${ano}): ${String(err)}`,
      );
      throw new ServiceUnavailableException(
        'Não foi possível obter feriados nacionais. Tente novamente ou cadastre manualmente.',
      );
    }

    let inseridos = 0;
    let ignorados = 0;
    for (const item of lista) {
      if (!item.date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        ignorados += 1;
        continue;
      }
      const ja = await this.feriadoRepo.findOne({
        where: { unidade, data: item.date },
      });
      if (ja) {
        ignorados += 1;
        continue;
      }
      await this.feriadoRepo.save(
        this.feriadoRepo.create({
          unidade,
          data: item.date,
          descricao: item.name?.trim() || 'Feriado nacional',
          origem: ProducaoFeriadoOrigem.NACIONAL,
        }),
      );
      inseridos += 1;
    }

    this.calendarioCache.invalidar(unidade);
    return { inseridos, ignorados };
  }

  async mapaCalendariosPorUnidade(
    unidades: Unidade[],
    opcoes?: MapaCalendarioOpcoes,
  ): Promise<Map<Unidade, ProducaoCalendarioUnidade>> {
    const unicas = [...new Set(unidades)];
    const map = new Map<Unidade, ProducaoCalendarioUnidade>();
    if (unicas.length === 0) {
      return map;
    }

    const bases = new Map<Unidade, JornadaCalendarioBase>();
    const precisaDb: Unidade[] = [];
    for (const unidade of unicas) {
      const cached = this.calendarioCache.obter(unidade);
      if (cached) {
        bases.set(unidade, cached);
      } else {
        precisaDb.push(unidade);
      }
    }

    if (precisaDb.length > 0) {
      const [configs, intervalos, diasFechadoRows] = await Promise.all([
        this.jornadaUnidadeRepo.find({
          where: { unidade: In(precisaDb) },
        }),
        this.jornadaIntervaloRepo.find({
          where: { unidade: In(precisaDb) },
          order: { diaSemana: 'ASC', ordem: 'ASC' },
        }),
        this.jornadaDiaRepo.find({
          where: { unidade: In(precisaDb) },
        }),
      ]);

      const configuradoPorUnidade = new Map(
        configs.map((c) => [c.unidade, c.configurado]),
      );

      for (const unidade of precisaDb) {
        const base = this.montarBaseJornada(
          unidade,
          configuradoPorUnidade.get(unidade) ?? false,
          intervalos,
          diasFechadoRows,
        );
        this.calendarioCache.gravar(unidade, base);
        bases.set(unidade, base);
      }
    }

    const feriadosRows = await this.carregarFeriadosUnidades(unicas, opcoes);
    const feriadosPorUnidade = new Map<Unidade, Set<string>>();
    for (const u of unicas) {
      feriadosPorUnidade.set(u, new Set());
    }
    for (const row of feriadosRows) {
      feriadosPorUnidade.get(row.unidade)?.add(row.data);
    }

    for (const unidade of unicas) {
      const base = bases.get(unidade);
      if (!base) {
        continue;
      }
      map.set(unidade, {
        configurado: base.configurado,
        intervalosPorDia: new Map(base.intervalosPorDia),
        feriados: feriadosPorUnidade.get(unidade) ?? new Set(),
      });
    }

    return map;
  }

  private montarBaseJornada(
    unidade: Unidade,
    configurado: boolean,
    intervalos: ProducaoJornadaIntervalo[],
    diasFechadoRows: ProducaoJornadaDia[],
  ): JornadaCalendarioBase {
    const fechadoPorDia = new Map<number, boolean>();
    for (const row of diasFechadoRows.filter((d) => d.unidade === unidade)) {
      fechadoPorDia.set(row.diaSemana, row.fechado);
    }

    const intervalosPorDia = new Map<number, ProducaoIntervaloHorario[]>();
    for (const row of intervalos.filter((i) => i.unidade === unidade)) {
      if (fechadoPorDia.get(row.diaSemana) === true) {
        continue;
      }
      const list = intervalosPorDia.get(row.diaSemana) ?? [];
      list.push({
        horaInicio: normalizarHoraCurta(row.horaInicio),
        horaFim: normalizarHoraCurta(row.horaFim),
      });
      intervalosPorDia.set(row.diaSemana, list);
    }

    return { configurado, intervalosPorDia };
  }

  private async carregarFeriadosUnidades(
    unidades: Unidade[],
    opcoes?: MapaCalendarioOpcoes,
  ): Promise<ProducaoFeriado[]> {
    const min = opcoes?.feriadoDataMin?.trim();
    const max = opcoes?.feriadoDataMax?.trim();
    const filtraIntervalo =
      min &&
      max &&
      /^\d{4}-\d{2}-\d{2}$/.test(min) &&
      /^\d{4}-\d{2}-\d{2}$/.test(max) &&
      min <= max;

    if (filtraIntervalo) {
      return this.feriadoRepo
        .createQueryBuilder('f')
        .where('f.unidade IN (:...unidades)', { unidades })
        .andWhere('f.data >= :min', { min })
        .andWhere('f.data <= :max', { max })
        .getMany();
    }

    return this.feriadoRepo.find({
      where: { unidade: In(unidades) },
    });
  }
}
