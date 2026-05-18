import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolhaCapa } from './entities/folha-capa.entity';
import { FolhaItem } from './entities/folha-item.entity';
import { FolhaTipo } from './entities/folha-tipo.entity';
import { FolhaVerba } from './entities/folha-verba.entity';
import { FolhaFuncionarioEventoFixo } from './entities/folha-funcionario-evento-fixo.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { assertUnidadeFolha } from './utils/folha-unidade-scope.util';
import { FolhaFuncionariosService } from './folha-funcionarios.service';
import { FolhaFechamentoService } from './folha-fechamento.service';
import { CreateFolhaCapaDto } from './dto/create-folha-capa.dto';
import { QueryFolhaCapaDto } from './dto/query-folha-capa.dto';
import { CreateFolhaItemDto } from './dto/create-folha-item.dto';
import { UpdateFolhaItemDto } from './dto/update-folha-item.dto';
import { FolhaMovimentoTipo } from '../../common/enums/folha-movimento-tipo.enum';
import { CarregarFolhaCompetenciaDto } from './dto/carregar-folha-competencia.dto';

/** Resposta útil ao frontend para totais e bloqueios */
export interface FolhaCapaDetalheDto {
  capa: FolhaCapa;
  totalReceitas: number;
  totalDespesas: number;
  liquido: number;
}

@Injectable()
export class FolhaCapasService {
  constructor(
    @InjectRepository(FolhaCapa)
    private readonly capaRepo: Repository<FolhaCapa>,
    @InjectRepository(FolhaItem)
    private readonly itemRepo: Repository<FolhaItem>,
    @InjectRepository(FolhaTipo)
    private readonly tipoRepo: Repository<FolhaTipo>,
    @InjectRepository(FolhaVerba)
    private readonly verbaRepo: Repository<FolhaVerba>,
    @InjectRepository(FolhaFuncionarioEventoFixo)
    private readonly eventoFixoRepo: Repository<FolhaFuncionarioEventoFixo>,
    private readonly funcionariosSvc: FolhaFuncionariosService,
    private readonly fechamentoSvc: FolhaFechamentoService,
  ) {}

  /** Na primeira criação da capa, replica `folha_funcionario_evento_fixo` → `folha_item` (RN-013). */
  private async copiarEventosFixosParaCapaNova(
    capaId: string,
    funcionarioId: string,
  ): Promise<void> {
    const fixos = await this.eventoFixoRepo.find({
      where: { funcionario: { id: funcionarioId } },
      relations: ['folhaVerba'],
    });
    const capaRef = { id: capaId } as FolhaCapa;
    for (const ef of fixos) {
      if (!ef.folhaVerba?.ativo) {
        continue;
      }
      const duplo = await this.itemRepo.findOne({
        where: {
          folhaCapa: { id: capaId },
          folhaVerba: { id: ef.folhaVerba.id },
        },
      });
      if (duplo) {
        continue;
      }
      const item = this.itemRepo.create({
        folhaCapa: capaRef,
        folhaVerba: ef.folhaVerba,
        valor: ef.valor,
        quantidade: ef.quantidade,
      });
      await this.itemRepo.save(item);
    }
  }

  private assertCapaItensEditaveis(capa: FolhaCapa): void {
    if (capa.congelada) {
      throw new BadRequestException(
        'Esta folha está congelada. É necessário liberá-la para alterar eventos.',
      );
    }
  }

  /** Cria a capa se não existir; retorna sempre com funcionário, tipo e itens/carregável. */
  async obterOuCriar(usuario: Usuario, dto: CreateFolhaCapaDto): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    await this.fechamentoSvc.assertLoteAberto(
      dto.unidade,
      dto.ano,
      dto.mes,
      dto.folhaTipoId,
    );

    const tipo = await this.tipoRepo.findOne({ where: { id: dto.folhaTipoId } });
    if (!tipo) throw new NotFoundException('Tipo de folha não encontrado');

    const funcionario = await this.funcionariosSvc.findOnePorUnidadeOuLanca(
      dto.funcionarioId,
      dto.unidade,
    );

    this.funcionariosSvc.podeCriarCapaParaFuncionario(funcionario, dto.ano, dto.mes);

    let capa = await this.capaRepo.findOne({
      where: {
        funcionario: { id: dto.funcionarioId },
        ano: dto.ano,
        mes: dto.mes,
        folhaTipo: { id: dto.folhaTipoId },
      },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });

    if (!capa) {
      capa = this.capaRepo.create({
        funcionario,
        ano: dto.ano,
        mes: dto.mes,
        folhaTipo: tipo,
      });
      await this.capaRepo.save(capa);
      await this.copiarEventosFixosParaCapaNova(capa.id, dto.funcionarioId);
      capa = (await this.capaRepo.findOne({
        where: { id: capa.id },
        relations: [
          'folhaTipo',
          'funcionario',
          'funcionario.cargo',
          'funcionario.setor',
          'itens',
          'itens.folhaVerba',
        ],
      }))!;
    }

    return this.calcularDetalhe(capa);
  }

  /**
   * Para **cada funcionário elegível** (RN-011), obtém ou cria `folha_capa` na unidade,
   * competência e tipo informados (`POST …/carregar-competencia`).
   */
  async carregarCompetenciaLancamento(
    usuario: Usuario,
    dto: CarregarFolhaCompetenciaDto,
  ): Promise<FolhaCapaDetalheDto[]> {
    const tipo = await this.tipoRepo.findOne({ where: { id: dto.folhaTipoId } });
    if (!tipo) throw new NotFoundException('Tipo de folha não encontrado');

    const funcionarios = await this.funcionariosSvc.listarParaLancamento(usuario, {
      unidade: dto.unidade,
      ano: dto.ano,
      mes: dto.mes,
      somenteAtivos: true,
    });

    const resultados: FolhaCapaDetalheDto[] = [];
    for (const func of funcionarios) {
      const d = await this.obterOuCriar(usuario, {
        funcionarioId: func.id,
        unidade: dto.unidade,
        ano: dto.ano,
        mes: dto.mes,
        folhaTipoId: dto.folhaTipoId,
      });
      resultados.push(d);
    }

    resultados.sort((a, b) =>
      String(a.capa.funcionario?.nome ?? '').localeCompare(
        String(b.capa.funcionario?.nome ?? ''),
        'pt-BR',
      ),
    );
    return resultados;
  }

  async listar(
    usuario: Usuario,
    dto: QueryFolhaCapaDto,
  ): Promise<FolhaCapa[] | FolhaCapaDetalheDto[]> {
    assertUnidadeFolha(usuario, dto.unidade);

    const comDetalhe = !!dto.comDetalhe;

    const qb = this.capaRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.funcionario', 'f')
      .leftJoinAndSelect('f.cargo', 'fc')
      .leftJoinAndSelect('f.setor', 'fs')
      .leftJoinAndSelect('c.folhaTipo', 'tipo')
      .where('f.unidade = :unidade', { unidade: dto.unidade })
      .andWhere('c.ano = :ano AND c.mes = :mes AND c.folhaTipoId = :tid', {
        ano: dto.ano,
        mes: dto.mes,
        tid: dto.folhaTipoId,
      });

    if (dto.funcionarioId) {
      qb.andWhere('f.id = :fid', { fid: dto.funcionarioId });
    }

    if (comDetalhe) {
      qb.leftJoinAndSelect('c.itens', 'item').leftJoinAndSelect('item.folhaVerba', 'fv');
    }

    qb.orderBy('f.nome', 'ASC');

    const capas = await qb.getMany();
    if (comDetalhe) {
      return capas.map((c) => this.calcularDetalhe(c));
    }
    return capas;
  }

  async buscarCompletaPorId(
    usuario: Usuario,
    capaId: string,
    unidadeReq: Parameters<typeof assertUnidadeFolha>[1],
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, unidadeReq);

    const capa = await this.capaRepo.findOne({
      where: { id: capaId },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });
    if (
      !capa ||
      !capa.funcionario ||
      capa.funcionario.unidade !== unidadeReq
    ) {
      throw new NotFoundException('Folha (capa) não encontrada para esta unidade.');
    }

    return this.calcularDetalhe(capa);
  }

  async adicionarItem(
    usuario: Usuario,
    capaId: string,
    unidade: Parameters<typeof assertUnidadeFolha>[1],
    dto: CreateFolhaItemDto,
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, unidade);

    const capa = await this.capaRepo.findOne({
      where: { id: capaId },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });
    if (
      !capa ||
      !capa.funcionario ||
      capa.funcionario.unidade !== unidade
    ) {
      throw new NotFoundException('Capa não encontrada');
    }

    await this.fechamentoSvc.assertLoteAberto(
      unidade,
      capa.ano,
      capa.mes,
      capa.folhaTipo.id,
    );

    this.assertCapaItensEditaveis(capa);

    const verba = await this.verbaRepo.findOne({ where: { id: dto.folhaVerbaId } });
    if (!verba) throw new NotFoundException('Verba não encontrada');
    if (!verba.ativo) {
      throw new BadRequestException('Verba está inativa. Selecione outra.');
    }

    const duplo = await this.itemRepo.findOne({
      where: {
        folhaCapa: { id: capa.id },
        folhaVerba: { id: dto.folhaVerbaId },
      },
    });
    if (duplo) {
      throw new ConflictException('Esta verba já foi lançada nesta folha.');
    }

    const q =
      dto.quantidade != null && dto.quantidade !== undefined
        ? Number(dto.quantidade)
        : 1;
    if (!Number.isFinite(q) || q < 0.0001) {
      throw new BadRequestException('Quantidade deve ser um número maior que zero.');
    }

    const item = this.itemRepo.create({
      folhaCapa: capa,
      folhaVerba: verba,
      valor: String(Number(dto.valor).toFixed(2)),
      quantidade: q.toFixed(4),
    });
    await this.itemRepo.save(item);

    const recarrega = await this.recarregaCapa(capa.id);
    return this.calcularDetalhe(recarrega);
  }

  async atualizarItemValor(
    usuario: Usuario,
    capaId: string,
    itemId: string,
    unidade: Parameters<typeof assertUnidadeFolha>[1],
    dto: UpdateFolhaItemDto,
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, unidade);

    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['folhaCapa', 'folhaCapa.funcionario', 'folhaCapa.funcionario.cargo', 'folhaCapa.funcionario.setor', 'folhaCapa.folhaTipo'],
    });
    if (
      !item ||
      item.folhaCapa.id !== capaId ||
      item.folhaCapa.funcionario.unidade !== unidade
    ) {
      throw new NotFoundException('Item não encontrado nesta folha/unidade.');
    }

    await this.fechamentoSvc.assertLoteAberto(
      unidade,
      item.folhaCapa.ano,
      item.folhaCapa.mes,
      item.folhaCapa.folhaTipo.id,
    );

    this.assertCapaItensEditaveis(item.folhaCapa);

    if (dto.valor === undefined && dto.quantidade === undefined) {
      throw new BadRequestException('Informe valor e/ou quantidade.');
    }
    if (dto.valor !== undefined) {
      item.valor = String(Number(dto.valor).toFixed(2));
    }
    if (dto.quantidade !== undefined) {
      const q = Number(dto.quantidade);
      if (!Number.isFinite(q) || q < 0.0001) {
        throw new BadRequestException('Quantidade deve ser um número maior que zero.');
      }
      item.quantidade = q.toFixed(4);
    }
    await this.itemRepo.save(item);

    const capaFull = await this.recarregaCapa(capaId);
    return this.calcularDetalhe(capaFull);
  }

  async removerItem(
    usuario: Usuario,
    capaId: string,
    itemId: string,
    unidade: Parameters<typeof assertUnidadeFolha>[1],
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, unidade);

    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['folhaCapa', 'folhaCapa.funcionario', 'folhaCapa.funcionario.cargo', 'folhaCapa.funcionario.setor', 'folhaCapa.folhaTipo'],
    });
    if (
      !item ||
      item.folhaCapa.id !== capaId ||
      item.folhaCapa.funcionario.unidade !== unidade
    ) {
      throw new NotFoundException('Item não encontrado nesta folha/unidade.');
    }

    await this.fechamentoSvc.assertLoteAberto(
      unidade,
      item.folhaCapa.ano,
      item.folhaCapa.mes,
      item.folhaCapa.folhaTipo.id,
    );

    this.assertCapaItensEditaveis(item.folhaCapa);

    await this.itemRepo.remove(item);

    const capaFull = await this.recarregaCapa(capaId);
    return this.calcularDetalhe(capaFull);
  }

  async congelarCapa(
    usuario: Usuario,
    capaId: string,
    unidadeReq: Parameters<typeof assertUnidadeFolha>[1],
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(usuario, unidadeReq);

    const capa = await this.capaRepo.findOne({
      where: { id: capaId },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });
    if (!capa?.funcionario || capa.funcionario.unidade !== unidadeReq) {
      throw new NotFoundException('Capa não encontrada.');
    }

    await this.fechamentoSvc.assertLoteAberto(
      unidadeReq,
      capa.ano,
      capa.mes,
      capa.folhaTipo.id,
    );

    if (capa.congelada) {
      throw new BadRequestException('Esta folha já está congelada.');
    }

    capa.congelada = true;
    capa.congeladaEm = new Date();
    capa.congeladaPor = { id: usuario.id } as Usuario;
    await this.capaRepo.save(capa);

    const full = await this.recarregaCapa(capa.id);
    return this.calcularDetalhe(full);
  }

  async liberarCapa(
    _usuario: Usuario,
    capaId: string,
    unidadeReq: Parameters<typeof assertUnidadeFolha>[1],
  ): Promise<FolhaCapaDetalheDto> {
    assertUnidadeFolha(_usuario, unidadeReq);

    const capa = await this.capaRepo.findOne({
      where: { id: capaId },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });
    if (!capa?.funcionario || capa.funcionario.unidade !== unidadeReq) {
      throw new NotFoundException('Capa não encontrada.');
    }

    await this.fechamentoSvc.assertLoteAberto(
      unidadeReq,
      capa.ano,
      capa.mes,
      capa.folhaTipo.id,
    );

    if (!capa.congelada) {
      throw new BadRequestException('Esta folha não está congelada.');
    }

    capa.congelada = false;
    capa.congeladaEm = null;
    capa.congeladaPor = null;
    await this.capaRepo.save(capa);

    const full = await this.recarregaCapa(capa.id);
    return this.calcularDetalhe(full);
  }

  private async recarregaCapa(id: string): Promise<FolhaCapa> {
    const capa = await this.capaRepo.findOne({
      where: { id },
      relations: [
        'folhaTipo',
        'funcionario',
        'funcionario.cargo',
        'funcionario.setor',
        'itens',
        'itens.folhaVerba',
      ],
    });
    if (!capa) throw new NotFoundException('Capa não encontrada após atualização.');
    return capa;
  }

  private calcularDetalhe(capa: FolhaCapa): FolhaCapaDetalheDto {
    let totalReceitas = 0;
    let totalDespesas = 0;
    const itens = capa.itens ?? [];
    for (const item of itens) {
      const v = Number.parseFloat(item.valor);
      const tipo = item.folhaVerba?.tipoMovimento;
      if (tipo === FolhaMovimentoTipo.RECEITA) totalReceitas += v;
      else if (tipo === FolhaMovimentoTipo.DESPESA) totalDespesas += v;
    }
    return {
      capa,
      totalReceitas,
      totalDespesas,
      liquido: totalReceitas - totalDespesas,
    };
  }
}
