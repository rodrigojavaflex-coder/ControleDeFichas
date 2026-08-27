import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ComercialMetaVendedor } from './entities/comercial-meta-vendedor.entity';
import { ComercialMetaUnidade } from './entities/comercial-meta-unidade.entity';
import { ComercialComissaoFaixa } from './entities/comercial-comissao-faixa.entity';
import { ComercialComissaoPolitica } from './entities/comercial-comissao-politica.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { ComercialTipoBase } from '../../common/enums/comercial-tipo-base.enum';
import { ComercialIncidenciaComissao } from '../../common/enums/comercial-incidencia-comissao.enum';
import {
  assertUnidadeFolha,
  unidadeEscopoUsuarioFolha,
} from '../folha/utils/folha-unidade-scope.util';
import {
  CopiarComercialMetaDto,
  CopiarComercialMetaResponseDto,
  FindComercialMetaDto,
  SalvarComercialMetaDto,
  SalvarComercialMetaUnidadeDto,
  ComercialMetaListResponseDto,
} from './dto/comercial-meta.dto';
import {
  SalvarComercialComissaoFaixaDto,
  ComercialComissaoFaixaItemDto,
  ComercialComissaoVendedoresResponseDto,
  CarregarComercialComissaoPadraoPendentesResponseDto,
  ComercialComissaoPoliticaResponseDto,
  SalvarComercialComissaoPoliticaDto,
} from './dto/comercial-comissao-faixa.dto';

interface FaixaIntervalo {
  id?: string;
  de: number;
  ate: number | null;
}

type FaixaPadrao = {
  de: number;
  ate: number | null;
  comissao: number;
  ordem: number;
};

const FAIXAS_PADRAO_REQUISICAO: ReadonlyArray<FaixaPadrao> = [
  { de: 0, ate: 79.99, comissao: 0, ordem: 1 },
  { de: 80, ate: 89.99, comissao: 1, ordem: 2 },
  { de: 90, ate: 99.99, comissao: 1.25, ordem: 3 },
  { de: 100, ate: 104.99, comissao: 1.35, ordem: 4 },
  { de: 105, ate: null, comissao: 2, ordem: 5 },
];

const FAIXAS_PADRAO_MARCA_PROPRIA: ReadonlyArray<FaixaPadrao> = [
  { de: 0, ate: 79.99, comissao: 0, ordem: 1 },
  { de: 80, ate: 89.99, comissao: 1.5, ordem: 2 },
  { de: 90, ate: 99.99, comissao: 2, ordem: 3 },
  { de: 100, ate: 104.99, comissao: 2.5, ordem: 4 },
  { de: 105, ate: null, comissao: 3.5, ordem: 5 },
];

function faixasPadraoPorTipo(tipoBase: ComercialTipoBase): ReadonlyArray<FaixaPadrao> {
  return tipoBase === ComercialTipoBase.MARCA_PROPRIA
    ? FAIXAS_PADRAO_MARCA_PROPRIA
    : FAIXAS_PADRAO_REQUISICAO;
}

@Injectable()
export class ComercialMetaService {
  private readonly logger = new Logger(ComercialMetaService.name);

  constructor(
    @InjectRepository(ComercialMetaVendedor)
    private readonly metaRepo: Repository<ComercialMetaVendedor>,
    @InjectRepository(ComercialMetaUnidade)
    private readonly metaUnidadeRepo: Repository<ComercialMetaUnidade>,
    @InjectRepository(ComercialComissaoFaixa)
    private readonly faixaRepo: Repository<ComercialComissaoFaixa>,
    @InjectRepository(ComercialComissaoPolitica)
    private readonly politicaRepo: Repository<ComercialComissaoPolitica>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    private readonly dataSource: DataSource,
  ) {}

  async listarMetas(
    usuario: Usuario,
    dto: FindComercialMetaDto,
  ): Promise<ComercialMetaListResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    return this.montarLista(dto.unidade, dto.ano, dto.mes);
  }

  async salvarMeta(
    usuario: Usuario,
    dto: SalvarComercialMetaDto,
  ): Promise<ComercialMetaListResponseDto> {
    const funcionario = await this.obterVendedorVinculado(dto.funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);

    let row = await this.metaRepo.findOne({
      where: {
        funcionario: { id: funcionario.id },
        anoMes: dto.anoMes,
        tipoBase: dto.tipoBase,
      },
      relations: ['funcionario'],
    });
    if (!row) {
      row = this.metaRepo.create({
        funcionario,
        anoMes: dto.anoMes,
        unidade: funcionario.unidade,
        tipoBase: dto.tipoBase,
        valorMeta: dto.valorMeta,
      });
    } else {
      row.valorMeta = dto.valorMeta;
      row.unidade = funcionario.unidade;
    }
    await this.metaRepo.save(row);
    const [ano, mes] = dto.anoMes.split('-').map((n) => Number(n));
    return this.montarLista(funcionario.unidade, ano, mes);
  }

  async salvarMetaUnidade(
    usuario: Usuario,
    dto: SalvarComercialMetaUnidadeDto,
  ): Promise<ComercialMetaListResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    await this.gravarMetaUnidade(
      this.metaUnidadeRepo,
      dto.unidade,
      dto.anoMes,
      ComercialTipoBase.REQUISICAO,
      dto.valorMetaRequisicao,
    );
    await this.gravarMetaUnidade(
      this.metaUnidadeRepo,
      dto.unidade,
      dto.anoMes,
      ComercialTipoBase.MARCA_PROPRIA,
      dto.valorMetaMarcaPropria,
    );
    const [ano, mes] = dto.anoMes.split('-').map((n) => Number(n));
    return this.montarLista(dto.unidade, ano, mes);
  }

  async copiarMesAnterior(
    usuario: Usuario,
    dto: CopiarComercialMetaDto,
  ): Promise<CopiarComercialMetaResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    if (dto.anoMesOrigem === dto.anoMesDestino) {
      throw new BadRequestException(
        'O mês de origem deve ser diferente do mês de destino.',
      );
    }

    const origem = await this.metaRepo.find({
      where: { unidade: dto.unidade, anoMes: dto.anoMesOrigem },
      relations: ['funcionario'],
    });
    const origemUnidade = await this.metaUnidadeRepo.find({
      where: { unidade: dto.unidade, anoMes: dto.anoMesOrigem },
    });
    if (origem.length === 0 && origemUnidade.length === 0) {
      throw new BadRequestException(
        'Não há metas cadastradas no mês de origem para copiar.',
      );
    }

    const vinculados = await this.listarVinculados(dto.unidade);
    const idsVinculados = new Set(vinculados.map((f) => f.id));
    const origemFiltrada = origem.filter((m) =>
      idsVinculados.has(m.funcionario.id),
    );

    const fatorReq = this.fatorAumento(dto.percentualAumentoRequisicao);
    const fatorMp = this.fatorAumento(dto.percentualAumentoMarcaPropria);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ComercialMetaVendedor);
      const repoUnidade = manager.getRepository(ComercialMetaUnidade);
      for (const meta of origemFiltrada) {
        const fator =
          meta.tipoBase === ComercialTipoBase.REQUISICAO ? fatorReq : fatorMp;
        const valorMeta = this.round2(Number(meta.valorMeta) * fator);
        let row = await repo.findOne({
          where: {
            funcionario: { id: meta.funcionario.id },
            anoMes: dto.anoMesDestino,
            tipoBase: meta.tipoBase,
          },
          relations: ['funcionario'],
        });
        if (!row) {
          row = repo.create({
            funcionario: meta.funcionario,
            anoMes: dto.anoMesDestino,
            unidade: meta.unidade,
            tipoBase: meta.tipoBase,
            valorMeta,
          });
        } else {
          row.valorMeta = valorMeta;
        }
        await repo.save(row);
      }
      for (const meta of origemUnidade) {
        const fator =
          meta.tipoBase === ComercialTipoBase.REQUISICAO ? fatorReq : fatorMp;
        const valorMeta = this.round2(Number(meta.valorMeta) * fator);
        await this.gravarMetaUnidade(
          repoUnidade,
          meta.unidade,
          dto.anoMesDestino,
          meta.tipoBase,
          valorMeta,
        );
      }
    });

    const [anoDestino, mesDestino] = dto.anoMesDestino
      .split('-')
      .map((n) => Number(n));
    const lista = await this.montarLista(dto.unidade, anoDestino, mesDestino);
    return {
      copiados: origemFiltrada.length + origemUnidade.length,
      lista,
    };
  }

  async listarVendedoresComissao(
    usuario: Usuario,
    unidadeQuery?: Unidade,
  ): Promise<ComercialComissaoVendedoresResponseDto> {
    const unidade = this.resolverUnidadeLista(usuario, unidadeQuery);
    const vinculados = await this.listarVinculados(unidade);
    if (vinculados.length === 0) {
      return { unidade, itens: [] };
    }
    const faixas = await this.faixaRepo.find({
      where: { funcionario: { id: In(vinculados.map((f) => f.id)) } },
      relations: ['funcionario'],
    });
    const contagem = new Map<string, { req: number; mp: number }>();
    for (const fx of faixas) {
      const id = fx.funcionario.id;
      const atual = contagem.get(id) ?? { req: 0, mp: 0 };
      if (fx.tipoBase === ComercialTipoBase.REQUISICAO) {
        atual.req += 1;
      } else {
        atual.mp += 1;
      }
      contagem.set(id, atual);
    }
    return {
      unidade,
      itens: vinculados.map((f) => ({
        funcionarioId: f.id,
        nome: f.nome,
        unidade: f.unidade,
        codigoVendedorErp: f.codigoVendedorErp!,
        faixasRequisicaoCount: contagem.get(f.id)?.req ?? 0,
        faixasMarcaPropriaCount: contagem.get(f.id)?.mp ?? 0,
      })),
    };
  }

  async listarFaixas(
    usuario: Usuario,
    funcionarioId: string,
    tipoBase: ComercialTipoBase,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    const funcionario = await this.obterVendedorVinculado(funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    const rows = await this.faixaRepo.find({
      where: { funcionario: { id: funcionario.id }, tipoBase },
      order: { ordem: 'ASC', percentualMetaDe: 'ASC' },
      relations: ['funcionario'],
    });
    return rows.map((r) => this.toFaixaDto(r));
  }

  async carregarFaixasPadrao(
    usuario: Usuario,
    funcionarioId: string,
    tipoBase: ComercialTipoBase,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    const funcionario = await this.obterVendedorVinculado(funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    await this.dataSource.transaction(async (manager) => {
      await this.gravarFaixasPadrao(
        manager.getRepository(ComercialComissaoFaixa),
        funcionario,
        tipoBase,
        true,
      );
    });
    return this.listarFaixas(usuario, funcionario.id, tipoBase);
  }

  async listarPolitica(
    usuario: Usuario,
    funcionarioId: string,
  ): Promise<ComercialComissaoPoliticaResponseDto> {
    const funcionario = await this.obterVendedorVinculado(funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    const rows = await this.politicaRepo.find({
      where: { funcionario: { id: funcionario.id } },
    });
    const porTipo = new Map(rows.map((r) => [r.tipoBase, r]));
    const tipos = [
      ComercialTipoBase.REQUISICAO,
      ComercialTipoBase.MARCA_PROPRIA,
    ];
    return {
      funcionarioId: funcionario.id,
      itens: tipos.map((tipoBase) => {
        const row = porTipo.get(tipoBase);
        return {
          tipoBase,
          incidencia: row?.incidencia ?? ComercialIncidenciaComissao.PROPRIAS,
          percentualMinimoLoja:
            row?.percentualMinimoLoja == null
              ? null
              : Number(row.percentualMinimoLoja),
        };
      }),
    };
  }

  async salvarPolitica(
    usuario: Usuario,
    dto: SalvarComercialComissaoPoliticaDto,
  ): Promise<ComercialComissaoPoliticaResponseDto> {
    const funcionario = await this.obterVendedorVinculado(dto.funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    const minimo =
      dto.percentualMinimoLoja == null || dto.percentualMinimoLoja === 0
        ? null
        : dto.percentualMinimoLoja;
    let row = await this.politicaRepo.findOne({
      where: {
        funcionario: { id: funcionario.id },
        tipoBase: dto.tipoBase,
      },
      relations: ['funcionario'],
    });
    if (!row) {
      row = this.politicaRepo.create({
        funcionario,
        tipoBase: dto.tipoBase,
        incidencia: dto.incidencia,
        percentualMinimoLoja: minimo,
      });
    } else {
      row.incidencia = dto.incidencia;
      row.percentualMinimoLoja = minimo;
    }
    await this.politicaRepo.save(row);
    return this.listarPolitica(usuario, funcionario.id);
  }

  async carregarFaixasPadraoPendentes(
    usuario: Usuario,
    unidadeQuery?: Unidade,
  ): Promise<CarregarComercialComissaoPadraoPendentesResponseDto> {
    const unidade = this.resolverUnidadeLista(usuario, unidadeQuery);
    const vinculados = await this.listarVinculados(unidade);
    let vendedoresAfetados = 0;
    let basesCarregadas = 0;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ComercialComissaoFaixa);
      for (const funcionario of vinculados) {
        const req = await this.gravarFaixasPadrao(
          repo,
          funcionario,
          ComercialTipoBase.REQUISICAO,
          false,
        );
        const mp = await this.gravarFaixasPadrao(
          repo,
          funcionario,
          ComercialTipoBase.MARCA_PROPRIA,
          false,
        );
        if (req || mp) {
          vendedoresAfetados += 1;
          basesCarregadas += (req ? 1 : 0) + (mp ? 1 : 0);
        }
      }
    });

    this.logger.log(
      `Faixas padrão pendentes em ${unidade}: ${vendedoresAfetados} vendedor(es), ${basesCarregadas} base(s) carregada(s) de ${vinculados.length} vinculado(s).`,
    );
    return { unidade, vendedoresAfetados, basesCarregadas };
  }

  async criarFaixa(
    usuario: Usuario,
    dto: SalvarComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    const funcionario = await this.obterVendedorVinculado(dto.funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    const existentes = await this.faixaRepo.find({
      where: { funcionario: { id: funcionario.id }, tipoBase: dto.tipoBase },
    });
    this.assertFaixasValidas([
      ...existentes.map((r) => this.toIntervalo(r)),
      {
        de: dto.percentualMetaDe,
        ate: this.normalizarAte(dto.percentualMetaAte),
      },
    ]);
    const row = this.faixaRepo.create({
      funcionario,
      tipoBase: dto.tipoBase,
      percentualMetaDe: dto.percentualMetaDe,
      percentualMetaAte: this.normalizarAte(dto.percentualMetaAte),
      percentualComissao: dto.percentualComissao,
      valorBonus: this.normalizarBonus(dto.valorBonus),
      ordem: 0,
    });
    await this.faixaRepo.save(row);
    await this.reordenarFaixas(funcionario.id, dto.tipoBase);
    return this.listarFaixas(usuario, funcionario.id, dto.tipoBase);
  }

  async atualizarFaixa(
    usuario: Usuario,
    id: string,
    dto: SalvarComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    const atual = await this.obterFaixaDoVendedor(usuario, id);
    if (atual.funcionario.id !== dto.funcionarioId) {
      throw new BadRequestException(
        'A faixa não pertence ao vendedor informado.',
      );
    }
    if (atual.tipoBase !== dto.tipoBase) {
      throw new BadRequestException(
        'O tipo base da faixa não pode ser alterado.',
      );
    }
    const demais = (
      await this.faixaRepo.find({
        where: {
          funcionario: { id: atual.funcionario.id },
          tipoBase: dto.tipoBase,
        },
      })
    ).filter((r) => r.id !== id);
    this.assertFaixasValidas([
      ...demais.map((r) => this.toIntervalo(r)),
      {
        id,
        de: dto.percentualMetaDe,
        ate: this.normalizarAte(dto.percentualMetaAte),
      },
    ]);
    atual.percentualMetaDe = dto.percentualMetaDe;
    atual.percentualMetaAte = this.normalizarAte(dto.percentualMetaAte);
    atual.percentualComissao = dto.percentualComissao;
    atual.valorBonus = this.normalizarBonus(dto.valorBonus);
    await this.faixaRepo.save(atual);
    await this.reordenarFaixas(atual.funcionario.id, dto.tipoBase);
    return this.listarFaixas(usuario, atual.funcionario.id, dto.tipoBase);
  }

  async excluirFaixa(
    usuario: Usuario,
    id: string,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    const atual = await this.obterFaixaDoVendedor(usuario, id);
    const funcionarioId = atual.funcionario.id;
    const tipoBase = atual.tipoBase;
    await this.faixaRepo.remove(atual);
    await this.reordenarFaixas(funcionarioId, tipoBase);
    return this.listarFaixas(usuario, funcionarioId, tipoBase);
  }

  private async montarLista(
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Promise<ComercialMetaListResponseDto> {
    const vinculados = await this.listarVinculados(unidade);
    const meses = mes ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const competencias = meses.map(
      (m) => `${ano}-${String(m).padStart(2, '0')}`,
    );
    const metas = await this.metaRepo.find({
      where: { unidade, anoMes: In(competencias) },
      relations: ['funcionario'],
    });
    const porChave = new Map<string, number>();
    for (const m of metas) {
      porChave.set(
        `${m.funcionario.id}|${m.anoMes}|${m.tipoBase}`,
        Number(m.valorMeta),
      );
    }
    const itens: ComercialMetaListResponseDto['itens'] = [];
    for (const f of vinculados) {
      for (const m of meses) {
        const anoMes = `${ano}-${String(m).padStart(2, '0')}`;
        const chaveReq = `${f.id}|${anoMes}|${ComercialTipoBase.REQUISICAO}`;
        const chaveMp = `${f.id}|${anoMes}|${ComercialTipoBase.MARCA_PROPRIA}`;
        itens.push({
          funcionarioId: f.id,
          nome: f.nome,
          unidade: f.unidade,
          codigoVendedorErp: f.codigoVendedorErp!,
          anoMes,
          mes: m,
          valorMetaRequisicao: porChave.has(chaveReq)
            ? porChave.get(chaveReq)!
            : null,
          valorMetaMarcaPropria: porChave.has(chaveMp)
            ? porChave.get(chaveMp)!
            : null,
        });
      }
    }
    const metaUnidade = mes
      ? await this.metaUnidadeRepo.find({
          where: {
            unidade,
            anoMes: `${ano}-${String(mes).padStart(2, '0')}`,
          },
        })
      : [];
    let metaUnidadeRequisicao: number | null = null;
    let metaUnidadeMarcaPropria: number | null = null;
    for (const m of metaUnidade) {
      if (m.tipoBase === ComercialTipoBase.REQUISICAO) {
        metaUnidadeRequisicao = Number(m.valorMeta);
      } else {
        metaUnidadeMarcaPropria = Number(m.valorMeta);
      }
    }
    return {
      unidade,
      ano,
      mes: mes ?? null,
      metaUnidadeRequisicao,
      metaUnidadeMarcaPropria,
      itens,
    };
  }

  private async listarVinculados(unidade: Unidade): Promise<Funcionario[]> {
    return this.funcionarioRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.codigoVendedorErp IS NOT NULL')
      .andWhere('f.codigoVendedorErp > 0')
      .orderBy('f.nome', 'ASC')
      .getMany();
  }

  private resolverUnidadeLista(
    usuario: Usuario,
    unidadeQuery?: Unidade,
  ): Unidade {
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    if (escopo) {
      if (unidadeQuery && unidadeQuery !== escopo) {
        throw new BadRequestException(
          'Filtro de unidade deve ser a unidade do usuário logado.',
        );
      }
      return escopo;
    }
    if (!unidadeQuery) {
      throw new BadRequestException(
        'Informe a unidade para listar os vendedores.',
      );
    }
    return unidadeQuery;
  }

  private async obterVendedorVinculado(
    funcionarioId: string,
  ): Promise<Funcionario> {
    const funcionario = await this.funcionarioRepo.findOne({
      where: { id: funcionarioId },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado.');
    }
    if (!this.ehVendedorComercial(funcionario)) {
      throw new BadRequestException(
        'O funcionário não possui código vendedor ERP vinculado.',
      );
    }
    return funcionario;
  }

  private ehVendedorComercial(funcionario: Funcionario): boolean {
    return (
      funcionario.codigoVendedorErp != null && funcionario.codigoVendedorErp > 0
    );
  }

  private async obterFaixaDoVendedor(
    usuario: Usuario,
    id: string,
  ): Promise<ComercialComissaoFaixa> {
    const atual = await this.faixaRepo.findOne({
      where: { id },
      relations: ['funcionario'],
    });
    if (!atual?.funcionario) {
      throw new NotFoundException('Faixa de comissão não encontrada.');
    }
    if (!this.ehVendedorComercial(atual.funcionario)) {
      throw new BadRequestException(
        'O funcionário da faixa não possui código vendedor ERP.',
      );
    }
    assertUnidadeFolha(usuario, atual.funcionario.unidade);
    return atual;
  }

  private async gravarMetaUnidade(
    repo: Repository<ComercialMetaUnidade>,
    unidade: Unidade,
    anoMes: string,
    tipoBase: ComercialTipoBase,
    valorMeta: number,
  ): Promise<void> {
    let row = await repo.findOne({
      where: { unidade, anoMes, tipoBase },
    });
    if (!row) {
      row = repo.create({ unidade, anoMes, tipoBase, valorMeta });
    } else {
      row.valorMeta = valorMeta;
    }
    await repo.save(row);
  }

  private async gravarFaixasPadrao(
    repo: Repository<ComercialComissaoFaixa>,
    funcionario: Funcionario,
    tipoBase: ComercialTipoBase,
    substituir: boolean,
  ): Promise<boolean> {
    const existentes = await repo.find({
      where: { funcionario: { id: funcionario.id }, tipoBase },
    });
    if (existentes.length) {
      if (!substituir) return false;
      await repo.remove(existentes);
    }
    const rows = faixasPadraoPorTipo(tipoBase).map((f) =>
      repo.create({
        funcionario,
        tipoBase,
        percentualMetaDe: f.de,
        percentualMetaAte: f.ate,
        percentualComissao: f.comissao,
        valorBonus: 0,
        ordem: f.ordem,
      }),
    );
    await repo.save(rows);
    return true;
  }

  private toFaixaDto(row: ComercialComissaoFaixa): ComercialComissaoFaixaItemDto {
    return {
      id: row.id,
      funcionarioId: row.funcionario.id,
      tipoBase: row.tipoBase,
      percentualMetaDe: Number(row.percentualMetaDe),
      percentualMetaAte:
        row.percentualMetaAte == null ? null : Number(row.percentualMetaAte),
      percentualComissao: Number(row.percentualComissao),
      valorBonus: Number(row.valorBonus ?? 0),
      ordem: row.ordem,
    };
  }

  private toIntervalo(row: ComercialComissaoFaixa): FaixaIntervalo {
    return {
      id: row.id,
      de: Number(row.percentualMetaDe),
      ate:
        row.percentualMetaAte == null ? null : Number(row.percentualMetaAte),
    };
  }

  private normalizarAte(valor?: number | null): number | null {
    if (valor == null) return null;
    return valor;
  }

  private normalizarBonus(valor?: number | null): number {
    if (valor == null || !Number.isFinite(valor) || valor < 0) return 0;
    return Math.round(valor * 100) / 100;
  }

  private assertFaixasValidas(faixas: FaixaIntervalo[]): void {
    const abertas = faixas.filter((f) => f.ate == null);
    if (abertas.length > 1) {
      throw new BadRequestException(
        'Somente uma faixa pode ficar sem teto (até em branco).',
      );
    }
    for (const f of faixas) {
      if (f.ate != null && f.ate <= f.de) {
        throw new BadRequestException(
          'O percentual até deve ser maior que o percentual de.',
        );
      }
    }
    const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
    for (let i = 0; i < ordenadas.length; i += 1) {
      const atual = ordenadas[i];
      const proxima = ordenadas[i + 1];
      if (!proxima) continue;
      const fimAtual = atual.ate ?? Number.POSITIVE_INFINITY;
      if (
        atual.de <= (proxima.ate ?? Number.POSITIVE_INFINITY) &&
        proxima.de <= fimAtual
      ) {
        throw new BadRequestException(
          'As faixas não podem se sobrepor. Use intervalos contínuos sem cruzar.',
        );
      }
    }
    if (abertas.length === 1) {
      const aberta = abertas[0];
      const maxDe = Math.max(...faixas.map((f) => f.de));
      if (aberta.de < maxDe) {
        throw new BadRequestException(
          'A faixa sem teto deve ser a de maior percentual de início.',
        );
      }
    }
  }

  private async reordenarFaixas(
    funcionarioId: string,
    tipoBase: ComercialTipoBase,
  ): Promise<void> {
    const rows = await this.faixaRepo.find({
      where: { funcionario: { id: funcionarioId }, tipoBase },
      order: { percentualMetaDe: 'ASC' },
    });
    rows.forEach((row, idx) => {
      row.ordem = idx + 1;
    });
    await this.faixaRepo.save(rows);
  }

  private fatorAumento(percentual?: number | null): number {
    const pct = percentual == null || !Number.isFinite(percentual) ? 0 : percentual;
    return 1 + pct / 100;
  }

  private round2(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
