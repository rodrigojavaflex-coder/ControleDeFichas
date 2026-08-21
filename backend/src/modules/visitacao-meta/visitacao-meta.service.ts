import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VisitacaoMetaRepresentante } from './entities/visitacao-meta-representante.entity';
import { VisitacaoComissaoFaixa } from './entities/visitacao-comissao-faixa.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  assertUnidadeFolha,
  unidadeEscopoUsuarioFolha,
} from '../folha/utils/folha-unidade-scope.util';
import {
  CopiarVisitacaoMetaDto,
  CopiarVisitacaoMetaResponseDto,
  FindVisitacaoMetaDto,
  SalvarVisitacaoMetaDto,
  VisitacaoMetaListResponseDto,
} from './dto/visitacao-meta.dto';
import {
  SalvarVisitacaoComissaoFaixaDto,
  VisitacaoComissaoFaixaItemDto,
  VisitacaoComissaoRepresentantesResponseDto,
} from './dto/visitacao-comissao-faixa.dto';

interface FaixaIntervalo {
  id?: string;
  de: number;
  ate: number | null;
}

const FAIXAS_COMISSAO_PADRAO: ReadonlyArray<{
  de: number;
  ate: number | null;
  comissao: number;
  ordem: number;
}> = [
  { de: 0, ate: 79.99, comissao: 0, ordem: 1 },
  { de: 80, ate: 89.99, comissao: 1, ordem: 2 },
  { de: 90, ate: 99.99, comissao: 1.5, ordem: 3 },
  { de: 100, ate: 104.99, comissao: 2, ordem: 4 },
  { de: 105, ate: null, comissao: 2.5, ordem: 5 },
];

@Injectable()
export class VisitacaoMetaService {
  constructor(
    @InjectRepository(VisitacaoMetaRepresentante)
    private readonly metaRepo: Repository<VisitacaoMetaRepresentante>,
    @InjectRepository(VisitacaoComissaoFaixa)
    private readonly faixaRepo: Repository<VisitacaoComissaoFaixa>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    private readonly dataSource: DataSource,
  ) {}

  async listarMetas(
    usuario: Usuario,
    dto: FindVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    return this.montarLista(dto.unidade, dto.ano, dto.mes);
  }

  async salvarMeta(
    usuario: Usuario,
    dto: SalvarVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    const funcionario = await this.obterRepresentanteVinculado(
      dto.funcionarioId,
    );
    assertUnidadeFolha(usuario, funcionario.unidade);

    let row = await this.metaRepo.findOne({
      where: { funcionario: { id: funcionario.id }, anoMes: dto.anoMes },
      relations: ['funcionario'],
    });
    if (!row) {
      row = this.metaRepo.create({
        funcionario,
        anoMes: dto.anoMes,
        unidade: funcionario.unidade,
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

  async copiarMesAnterior(
    usuario: Usuario,
    dto: CopiarVisitacaoMetaDto,
  ): Promise<CopiarVisitacaoMetaResponseDto> {
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
    if (origem.length === 0) {
      throw new BadRequestException(
        'Não há metas cadastradas no mês de origem para copiar.',
      );
    }

    const vinculados = await this.listarVinculados(dto.unidade);
    const idsVinculados = new Set(vinculados.map((f) => f.id));
    const origemPorFunc = new Map(
      origem
        .filter((m) => idsVinculados.has(m.funcionario.id))
        .map((m) => [m.funcionario.id, Number(m.valorMeta)]),
    );

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VisitacaoMetaRepresentante);
      for (const func of vinculados) {
        const valor = origemPorFunc.get(func.id);
        if (valor == null) continue;
        let row = await repo.findOne({
          where: { funcionario: { id: func.id }, anoMes: dto.anoMesDestino },
          relations: ['funcionario'],
        });
        if (!row) {
          row = repo.create({
            funcionario: func,
            anoMes: dto.anoMesDestino,
            unidade: func.unidade,
            valorMeta: valor,
          });
        } else {
          row.valorMeta = valor;
          row.unidade = func.unidade;
        }
        await repo.save(row);
      }
    });

    const [anoDestino, mesDestino] = dto.anoMesDestino
      .split('-')
      .map((n) => Number(n));
    const lista = await this.montarLista(dto.unidade, anoDestino, mesDestino);
    return { copiados: origemPorFunc.size, lista };
  }

  async listarRepresentantesComissao(
    usuario: Usuario,
    unidadeQuery?: Unidade,
  ): Promise<VisitacaoComissaoRepresentantesResponseDto> {
    const unidade = this.resolverUnidadeLista(usuario, unidadeQuery);
    const vinculados = await this.listarVinculados(unidade);
    if (vinculados.length === 0) {
      return { unidade, itens: [] };
    }
    const faixas = await this.faixaRepo.find({
      where: { funcionario: { id: In(vinculados.map((f) => f.id)) } },
      relations: ['funcionario'],
    });
    const porFunc = new Map<string, number>();
    for (const fx of faixas) {
      const id = fx.funcionario.id;
      porFunc.set(id, (porFunc.get(id) ?? 0) + 1);
    }
    return {
      unidade,
      itens: vinculados.map((f) => ({
        funcionarioId: f.id,
        nome: f.nome,
        unidade: f.unidade,
        painelContratoRepresentante: f.painelContratoRepresentante!,
        painelCodigoRepresentante: f.painelCodigoRepresentante!,
        faixasCount: porFunc.get(f.id) ?? 0,
      })),
    };
  }

  async listarFaixas(
    usuario: Usuario,
    funcionarioId: string,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    const funcionario = await this.obterRepresentanteVinculado(funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    const rows = await this.faixaRepo.find({
      where: { funcionario: { id: funcionario.id } },
      order: { ordem: 'ASC', percentualMetaDe: 'ASC' },
      relations: ['funcionario'],
    });
    return rows.map((r) => this.toFaixaDto(r));
  }

  async carregarFaixasPadrao(
    usuario: Usuario,
    funcionarioId: string,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    const funcionario = await this.obterRepresentanteVinculado(funcionarioId);
    assertUnidadeFolha(usuario, funcionario.unidade);
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VisitacaoComissaoFaixa);
      const existentes = await repo.find({
        where: { funcionario: { id: funcionario.id } },
      });
      if (existentes.length) {
        await repo.remove(existentes);
      }
      const rows = FAIXAS_COMISSAO_PADRAO.map((f) =>
        repo.create({
          funcionario,
          percentualMetaDe: f.de,
          percentualMetaAte: f.ate,
          percentualComissao: f.comissao,
          ordem: f.ordem,
        }),
      );
      await repo.save(rows);
    });
    return this.listarFaixas(usuario, funcionario.id);
  }

  async criarFaixa(
    usuario: Usuario,
    dto: SalvarVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    const funcionario = await this.obterRepresentanteVinculado(
      dto.funcionarioId,
    );
    assertUnidadeFolha(usuario, funcionario.unidade);
    const existentes = await this.faixaRepo.find({
      where: { funcionario: { id: funcionario.id } },
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
      percentualMetaDe: dto.percentualMetaDe,
      percentualMetaAte: this.normalizarAte(dto.percentualMetaAte),
      percentualComissao: dto.percentualComissao,
      ordem: 0,
    });
    await this.faixaRepo.save(row);
    await this.reordenarFaixas(funcionario.id);
    return this.listarFaixas(usuario, funcionario.id);
  }

  async atualizarFaixa(
    usuario: Usuario,
    id: string,
    dto: SalvarVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    const atual = await this.obterFaixaDoRepresentante(usuario, id);
    if (atual.funcionario.id !== dto.funcionarioId) {
      throw new BadRequestException(
        'A faixa não pertence ao representante informado.',
      );
    }
    const demais = (
      await this.faixaRepo.find({
        where: { funcionario: { id: atual.funcionario.id } },
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
    await this.faixaRepo.save(atual);
    await this.reordenarFaixas(atual.funcionario.id);
    return this.listarFaixas(usuario, atual.funcionario.id);
  }

  async excluirFaixa(
    usuario: Usuario,
    id: string,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    const atual = await this.obterFaixaDoRepresentante(usuario, id);
    const funcionarioId = atual.funcionario.id;
    await this.faixaRepo.remove(atual);
    await this.reordenarFaixas(funcionarioId);
    return this.listarFaixas(usuario, funcionarioId);
  }

  private async montarLista(
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Promise<VisitacaoMetaListResponseDto> {
    const vinculados = await this.listarVinculados(unidade);
    const meses = mes ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const competencias = meses.map(
      (m) => `${ano}-${String(m).padStart(2, '0')}`,
    );
    const metas = await this.metaRepo.find({
      where: { unidade, anoMes: In(competencias) },
      relations: ['funcionario'],
    });
    const porChave = new Map(
      metas.map((m) => [`${m.funcionario.id}|${m.anoMes}`, Number(m.valorMeta)]),
    );
    const itens: VisitacaoMetaListResponseDto['itens'] = [];
    for (const f of vinculados) {
      for (const m of meses) {
        const anoMes = `${ano}-${String(m).padStart(2, '0')}`;
        itens.push({
          funcionarioId: f.id,
          nome: f.nome,
          unidade: f.unidade,
          anoMes,
          mes: m,
          valorMeta: porChave.has(`${f.id}|${anoMes}`)
            ? porChave.get(`${f.id}|${anoMes}`)!
            : null,
        });
      }
    }
    return {
      unidade,
      ano,
      mes: mes ?? null,
      itens,
    };
  }

  private async listarVinculados(unidade: Unidade): Promise<Funcionario[]> {
    return this.funcionarioRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.painelContratoRepresentante IS NOT NULL')
      .andWhere('f.painelContratoRepresentante > 0')
      .andWhere('f.painelCodigoRepresentante IS NOT NULL')
      .andWhere('f.painelCodigoRepresentante > 0')
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
        'Informe a unidade para listar os representantes.',
      );
    }
    return unidadeQuery;
  }

  private async obterRepresentanteVinculado(
    funcionarioId: string,
  ): Promise<Funcionario> {
    const funcionario = await this.funcionarioRepo.findOne({
      where: { id: funcionarioId },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado.');
    }
    if (!this.ehRepresentantePainel(funcionario)) {
      throw new BadRequestException(
        'O funcionário não é representante do painel (Filial do painel e Código representante painel são obrigatórios).',
      );
    }
    return funcionario;
  }

  private ehRepresentantePainel(funcionario: Funcionario): boolean {
    return (
      funcionario.painelContratoRepresentante != null &&
      funcionario.painelContratoRepresentante > 0 &&
      funcionario.painelCodigoRepresentante != null &&
      funcionario.painelCodigoRepresentante > 0
    );
  }

  private async obterFaixaDoRepresentante(
    usuario: Usuario,
    id: string,
  ): Promise<VisitacaoComissaoFaixa> {
    const atual = await this.faixaRepo.findOne({
      where: { id },
      relations: ['funcionario'],
    });
    if (!atual?.funcionario) {
      throw new NotFoundException('Faixa de comissão não encontrada.');
    }
    if (!this.ehRepresentantePainel(atual.funcionario)) {
      throw new BadRequestException(
        'O funcionário da faixa não é representante do painel.',
      );
    }
    assertUnidadeFolha(usuario, atual.funcionario.unidade);
    return atual;
  }

  private toFaixaDto(row: VisitacaoComissaoFaixa): VisitacaoComissaoFaixaItemDto {
    return {
      id: row.id,
      funcionarioId: row.funcionario.id,
      percentualMetaDe: Number(row.percentualMetaDe),
      percentualMetaAte:
        row.percentualMetaAte == null ? null : Number(row.percentualMetaAte),
      percentualComissao: Number(row.percentualComissao),
      ordem: row.ordem,
    };
  }

  private toIntervalo(row: VisitacaoComissaoFaixa): FaixaIntervalo {
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
      if (atual.de <= (proxima.ate ?? Number.POSITIVE_INFINITY) && proxima.de <= fimAtual) {
        throw new BadRequestException(
          'As faixas não podem se sobrepor. Use intervalos contínuos sem cruzar (ex.: 80–89,99 e 90–99,99).',
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

  private async reordenarFaixas(funcionarioId: string): Promise<void> {
    const rows = await this.faixaRepo.find({
      where: { funcionario: { id: funcionarioId } },
      order: { percentualMetaDe: 'ASC' },
    });
    rows.forEach((row, idx) => {
      row.ordem = idx + 1;
    });
    await this.faixaRepo.save(rows);
  }
}
