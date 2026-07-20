import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProducaoEtapaRemuneracao } from './entities/producao-etapa-remuneracao.entity';
import { ProducaoFuncionarioEtapa } from './entities/producao-funcionario-etapa.entity';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { assertUnidadeFolha } from '../folha/utils/folha-unidade-scope.util';
import { BulkSaveProducaoEtapasDto } from './dto/bulk-save-producao-etapas.dto';
import { BulkSaveProducaoFuncionarioEtapasDto } from './dto/bulk-save-producao-funcionario-etapas.dto';
import {
  VinculoCodigoFuncionarioConfirmResponseDto,
  VinculoCodigoFuncionarioPreviewResponseDto,
  VinculoCodigoFuncionarioPreviewRowDto,
  VinculoCodigoFuncionarioSituacao,
} from './dto/vincular-codigo-funcionario-preview.dto';
import { AplicarEtapasRemuneradasDto } from './dto/aplicar-etapas-remuneradas.dto';
import {
  RemoverEtapasFuncionariosDto,
  RemoverEtapasFuncionariosResponseDto,
} from './dto/remover-etapas-funcionarios.dto';
import {
  AplicarEtapasRemuneradasResponseDto,
  ProducaoConfigRelatorioResponseDto,
} from './dto/producao-config-relatorio.dto';
import { normalizarNomeComparacao } from './utils/normalizar-nome-comparacao.util';

export interface ProducaoEtapaRemuneracaoRow {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  recebe: boolean;
  valor: number;
}

export interface ProducaoFuncionarioConfigRow {
  id: string;
  nome: string;
  codigoFuncionarioErp: number | null;
  setor: string | null;
  cargo: string | null;
  dataDemissao: string | null;
  desligado: boolean;
  qtdEtapasConfiguradas: number;
}

export interface ProducaoFuncionarioEtapaModalRow {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  etapaRemunerada: boolean;
  valor: number;
  recebe: boolean;
}

@Injectable()
export class ProducaoConfigService {
  constructor(
    @InjectRepository(ProducaoEtapaRemuneracao)
    private readonly etapaRemuneracaoRepo: Repository<ProducaoEtapaRemuneracao>,
    @InjectRepository(ProducaoFuncionarioEtapa)
    private readonly funcionarioEtapaRepo: Repository<ProducaoFuncionarioEtapa>,
    @InjectRepository(ProducaoEtapaResumo)
    private readonly resumoRepo: Repository<ProducaoEtapaResumo>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    private readonly dataSource: DataSource,
  ) {}

  async listarEtapas(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ProducaoEtapaRemuneracaoRow[]> {
    assertUnidadeFolha(usuario, unidade);

    const distinctRaw = await this.resumoRepo
      .createQueryBuilder('r')
      .select('r.codEtapa', 'codEtapa')
      .addSelect('MAX(r.etapa)', 'etapa')
      .addSelect('MIN(r.posicaoEtapa)', 'posicaoEtapa')
      .where('r.unidade = :unidade', { unidade })
      .groupBy('r.codEtapa')
      .orderBy('MIN(r.posicaoEtapa)', 'ASC')
      .addOrderBy('MAX(r.etapa)', 'ASC')
      .getRawMany<{
        codEtapa: string;
        etapa: string;
        posicaoEtapa: string;
      }>();

    const configs = await this.etapaRemuneracaoRepo.find({ where: { unidade } });
    const configMap = new Map(configs.map((c) => [c.codEtapa, c]));

    const codigosVistos = new Set<string>();
    const rows: ProducaoEtapaRemuneracaoRow[] = [];

    for (const raw of distinctRaw) {
      codigosVistos.add(raw.codEtapa);
      const cfg = configMap.get(raw.codEtapa);
      rows.push(this.mergeEtapaRow(raw, cfg));
    }

    for (const cfg of configs) {
      if (!codigosVistos.has(cfg.codEtapa)) {
        rows.push({
          codEtapa: cfg.codEtapa,
          etapa: cfg.etapa,
          posicaoEtapa: cfg.posicaoEtapa,
          recebe: cfg.recebe,
          valor: Number(cfg.valor),
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.posicaoEtapa - b.posicaoEtapa ||
        a.etapa.localeCompare(b.etapa, 'pt-BR'),
    );

    return rows;
  }

  async salvarEtapas(
    usuario: Usuario,
    dto: BulkSaveProducaoEtapasDto,
  ): Promise<ProducaoEtapaRemuneracaoRow[]> {
    assertUnidadeFolha(usuario, dto.unidade);

    const codigos = dto.itens.map((i) => i.codEtapa);
    if (codigos.length !== new Set(codigos).size) {
      throw new BadRequestException('Etapa duplicada na lista enviada.');
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProducaoEtapaRemuneracao);
    for (const item of dto.itens) {
      const recebe = item.recebe === true;
      const valor = recebe ? Math.max(0, Number(item.valor) || 0) : 0;
      if (recebe && valor <= 0) {
        throw new BadRequestException(
          `Informe valor maior que zero para a etapa «${item.etapa.trim()}» marcada como Recebe.`,
        );
      }
      let entity = await repo.findOne({
          where: { unidade: dto.unidade, codEtapa: item.codEtapa },
        });
        if (!entity) {
          entity = repo.create({
            unidade: dto.unidade,
            codEtapa: item.codEtapa,
          });
        }
        entity.etapa = item.etapa.trim();
        entity.posicaoEtapa = Number(item.posicaoEtapa) || 0;
        entity.recebe = recebe;
        entity.valor = String(valor);
        await repo.save(entity);
      }
    });

    return this.listarEtapas(usuario, dto.unidade);
  }

  async listarFuncionarios(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ProducaoFuncionarioConfigRow[]> {
    assertUnidadeFolha(usuario, unidade);

    const funcionarios = await this.funcionarioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.cargo', 'cargo')
      .leftJoinAndSelect('f.setor', 'setor')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.codigoFuncionarioErp IS NOT NULL')
      .orderBy('CASE WHEN f.dataDemissao IS NULL THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('f.nome', 'ASC')
      .getMany();

    const countsRaw = await this.funcionarioEtapaRepo
      .createQueryBuilder('fe')
      .select('fe.funcionarioId', 'funcionarioId')
      .addSelect('COUNT(*)', 'total')
      .where('fe.unidade = :unidade', { unidade })
      .andWhere('fe.recebe = true')
      .groupBy('fe.funcionarioId')
      .getRawMany<{ funcionarioId: string; total: string }>();

    const countMap = new Map(
      countsRaw.map((r) => [r.funcionarioId, Number(r.total)]),
    );

    return funcionarios.map((f) => ({
      id: f.id,
      nome: f.nome,
      codigoFuncionarioErp: f.codigoFuncionarioErp ?? null,
      setor: f.setor?.descricao?.trim() || null,
      cargo: f.cargo?.descricao?.trim() || null,
      dataDemissao: f.dataDemissao ?? null,
      desligado: !!f.dataDemissao,
      qtdEtapasConfiguradas: countMap.get(f.id) ?? 0,
    }));
  }

  async listarEtapasFuncionario(
    usuario: Usuario,
    unidade: Unidade,
    funcionarioId: string,
  ): Promise<ProducaoFuncionarioEtapaModalRow[]> {
    assertUnidadeFolha(usuario, unidade);

    const funcionario = await this.funcionarioRepo.findOne({
      where: { id: funcionarioId, unidade },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado.');
    }

    const etapas = await this.listarEtapas(usuario, unidade);
    const configsFunc = await this.funcionarioEtapaRepo.find({
      where: { unidade, funcionario: { id: funcionarioId } },
    });
    const funcMap = new Map(configsFunc.map((c) => [c.codEtapa, c]));

    return etapas
      .filter((e) => e.recebe)
      .map((e) => ({
        codEtapa: e.codEtapa,
        etapa: e.etapa,
        posicaoEtapa: e.posicaoEtapa,
        etapaRemunerada: true,
        valor: e.valor,
        recebe: funcMap.get(e.codEtapa)?.recebe ?? false,
      }));
  }

  async salvarEtapasFuncionario(
    usuario: Usuario,
    funcionarioId: string,
    dto: BulkSaveProducaoFuncionarioEtapasDto,
  ): Promise<ProducaoFuncionarioEtapaModalRow[]> {
    assertUnidadeFolha(usuario, dto.unidade);

    const funcionario = await this.funcionarioRepo.findOne({
      where: { id: funcionarioId, unidade: dto.unidade },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado.');
    }

    const etapasRemuneradas = await this.listarEtapas(usuario, dto.unidade);
    const remuneradasSet = new Set(
      etapasRemuneradas.filter((e) => e.recebe).map((e) => e.codEtapa),
    );

    const codigos = dto.itens.map((i) => i.codEtapa);
    if (codigos.length !== new Set(codigos).size) {
      throw new BadRequestException('Etapa duplicada na lista enviada.');
    }

    for (const item of dto.itens) {
      if (item.recebe && !remuneradasSet.has(item.codEtapa)) {
        throw new BadRequestException(
          `A etapa «${item.codEtapa}» não está remunerada na unidade.`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProducaoFuncionarioEtapa);
      await repo.delete({ funcionario: { id: funcionarioId } });

      const toSave = dto.itens
        .filter((i) => i.recebe && remuneradasSet.has(i.codEtapa))
        .map((i) =>
          repo.create({
            unidade: dto.unidade,
            funcionario: { id: funcionarioId } as Funcionario,
            codEtapa: i.codEtapa,
            recebe: true,
          }),
        );

      if (toSave.length > 0) {
        await repo.save(toSave);
      }
    });

    return this.listarEtapasFuncionario(
      usuario,
      dto.unidade,
      funcionarioId,
    );
  }

  async gerarRelatorioConfig(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ProducaoConfigRelatorioResponseDto> {
    assertUnidadeFolha(usuario, unidade);

    const etapas = await this.listarEtapas(usuario, unidade);
    const etapasRemuneradas = etapas
      .filter((e) => e.recebe)
      .map((e) => ({
        codEtapa: e.codEtapa,
        etapa: e.etapa,
        posicaoEtapa: e.posicaoEtapa,
        valor: e.valor,
      }));

    const etapaNomeMap = new Map(etapas.map((e) => [e.codEtapa, e.etapa]));

    const funcionarios = await this.listarFuncionarios(usuario, unidade);

    const configsFunc = await this.funcionarioEtapaRepo.find({
      where: { unidade, recebe: true },
      relations: ['funcionario'],
    });

    const etapasPorFuncionario = new Map<
      string,
      { codEtapa: string; etapa: string }[]
    >();

    for (const cfg of configsFunc) {
      const funcId = cfg.funcionario?.id;
      if (!funcId) continue;
      const lista = etapasPorFuncionario.get(funcId) ?? [];
      lista.push({
        codEtapa: cfg.codEtapa,
        etapa: etapaNomeMap.get(cfg.codEtapa) ?? cfg.codEtapa,
      });
      etapasPorFuncionario.set(funcId, lista);
    }

    return {
      unidade,
      etapasRemuneradas,
      funcionarios: funcionarios.map((f) => {
        const etapasFunc = (etapasPorFuncionario.get(f.id) ?? []).sort((a, b) =>
          a.etapa.localeCompare(b.etapa, 'pt-BR'),
        );
        return {
          id: f.id,
          nome: f.nome,
          setor: f.setor,
          cargo: f.cargo,
          codigoFuncionarioErp: f.codigoFuncionarioErp as number,
          desligado: f.desligado,
          dataDemissao: f.dataDemissao,
          etapas: etapasFunc,
        };
      }),
    };
  }

  async aplicarEtapasRemuneradasTodosFuncionarios(
    usuario: Usuario,
    dto: AplicarEtapasRemuneradasDto,
  ): Promise<AplicarEtapasRemuneradasResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);

    const etapasRemuneradas = (await this.listarEtapas(usuario, dto.unidade)).filter(
      (e) => e.recebe,
    );
    if (etapasRemuneradas.length === 0) {
      throw new BadRequestException(
        'Nenhuma etapa remunerada configurada na unidade.',
      );
    }

    const alvo = await this.buscarFuncionariosSelecionadosComCodigoErp(
      dto.unidade,
      dto.funcionarioIds,
    );

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProducaoFuncionarioEtapa);

      for (const funcionario of alvo) {
        await repo.delete({ funcionario: { id: funcionario.id } });

        const toSave = etapasRemuneradas.map((e) =>
          repo.create({
            unidade: dto.unidade,
            funcionario: { id: funcionario.id } as Funcionario,
            codEtapa: e.codEtapa,
            recebe: true,
          }),
        );

        if (toSave.length > 0) {
          await repo.save(toSave);
        }
      }
    });

    return {
      funcionariosAtualizados: alvo.length,
      etapasAplicadas: etapasRemuneradas.length,
    };
  }

  async removerEtapasFuncionarios(
    usuario: Usuario,
    dto: RemoverEtapasFuncionariosDto,
  ): Promise<RemoverEtapasFuncionariosResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);

    const alvo = await this.buscarFuncionariosSelecionadosComCodigoErp(
      dto.unidade,
      dto.funcionarioIds,
    );

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProducaoFuncionarioEtapa);
      for (const funcionario of alvo) {
        await repo.delete({
          unidade: dto.unidade,
          funcionario: { id: funcionario.id },
        });
      }
    });

    return { funcionariosAtualizados: alvo.length };
  }

  private async buscarFuncionariosSelecionadosComCodigoErp(
    unidade: Unidade,
    funcionarioIds: string[],
  ): Promise<Funcionario[]> {
    const ids = [...new Set(funcionarioIds)];
    if (ids.length === 0) {
      throw new BadRequestException('Selecione ao menos um funcionário.');
    }

    const funcionarios = await this.funcionarioRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.codigoFuncionarioErp IS NOT NULL')
      .andWhere('f.id IN (:...ids)', { ids })
      .getMany();

    if (funcionarios.length === 0) {
      throw new BadRequestException(
        'Nenhum funcionário válido selecionado nesta unidade.',
      );
    }

    return funcionarios;
  }

  async previewVincularCodigoFuncionario(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<VinculoCodigoFuncionarioPreviewResponseDto> {
    assertUnidadeFolha(usuario, unidade);
    const { itens, erpSemFuncionario, totalErpDistinct } =
      await this.montarVinculoCodigoFuncionario(unidade);
    return this.montarPreviewResponse(
      itens,
      erpSemFuncionario,
      totalErpDistinct,
    );
  }

  async confirmarVincularCodigoFuncionario(
    usuario: Usuario,
    unidade: Unidade,
    funcionarioIds: string[],
  ): Promise<VinculoCodigoFuncionarioConfirmResponseDto> {
    assertUnidadeFolha(usuario, unidade);

    const idsUnicos = [...new Set(funcionarioIds)];
    if (idsUnicos.length === 0) {
      throw new BadRequestException(
        'Selecione ao menos um funcionário para atualizar.',
      );
    }

    const { itens } = await this.montarVinculoCodigoFuncionario(unidade);
    const elegiveisMap = new Map(
      itens.filter((i) => i.atualizavel).map((i) => [i.funcionarioId, i]),
    );

    const atualizaveis: VinculoCodigoFuncionarioPreviewRowDto[] = [];
    for (const id of idsUnicos) {
      const row = elegiveisMap.get(id);
      if (!row) {
        throw new BadRequestException(
          'Um ou mais funcionários selecionados não estão elegíveis para atualização.',
        );
      }
      atualizaveis.push(row);
    }

    if (atualizaveis.length === 0) {
      return { atualizados: 0, itens: [] };
    }

    const atualizados: VinculoCodigoFuncionarioPreviewRowDto[] = [];

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Funcionario);
      for (const row of atualizaveis) {
        const func = await repo.findOne({
          where: { id: row.funcionarioId, unidade },
        });
        if (!func || func.codigoFuncionarioErp != null) {
          continue;
        }
        const codigoOcupado = await repo.findOne({
          where: {
            unidade,
            codigoFuncionarioErp: row.codigoErp,
          },
        });
        if (codigoOcupado && codigoOcupado.id !== func.id) {
          throw new BadRequestException(
            `Código ERP ${row.codigoErp} já está em uso por «${codigoOcupado.nome}».`,
          );
        }
        func.codigoFuncionarioErp = row.codigoErp;
        await repo.save(func);
        atualizados.push(row);
      }
    });

    return {
      atualizados: atualizados.length,
      itens: atualizados,
    };
  }

  private async montarVinculoCodigoFuncionario(
    unidade: Unidade,
  ): Promise<{
    itens: VinculoCodigoFuncionarioPreviewRowDto[];
    erpSemFuncionario: string[];
    totalErpDistinct: number;
  }> {
    const erpRaw = await this.resumoRepo
      .createQueryBuilder('r')
      .select('r.codFuncSaida', 'codErp')
      .addSelect('TRIM(r.funcSaida)', 'funcSaidaErp')
      .where('r.unidade = :unidade', { unidade })
      .andWhere('r.funcSaida IS NOT NULL')
      .andWhere("TRIM(r.funcSaida) <> ''")
      .andWhere('r.codFuncSaida IS NOT NULL')
      .groupBy('r.codFuncSaida')
      .addGroupBy('TRIM(r.funcSaida)')
      .getRawMany<{ codErp: string; funcSaidaErp: string }>();

    const erpFunc = erpRaw.map((r) => ({
      codErp: Number(r.codErp),
      funcSaidaErp: r.funcSaidaErp,
      nomeNorm: normalizarNomeComparacao(r.funcSaidaErp),
    }));

    const funcionarios = await this.funcionarioRepo.find({
      where: { unidade },
      order: { nome: 'ASC' },
    });

    const funcPorNome = new Map<string, typeof funcionarios>();
    for (const f of funcionarios) {
      const norm = normalizarNomeComparacao(f.nome);
      const lista = funcPorNome.get(norm) ?? [];
      lista.push(f);
      funcPorNome.set(norm, lista);
    }

    const erpPorNome = new Map<string, typeof erpFunc>();
    for (const e of erpFunc) {
      const lista = erpPorNome.get(e.nomeNorm) ?? [];
      lista.push(e);
      erpPorNome.set(e.nomeNorm, lista);
    }

    const erpSemFuncionario: string[] = [];
    for (const e of erpFunc) {
      if (!funcPorNome.has(e.nomeNorm)) {
        erpSemFuncionario.push(e.funcSaidaErp);
      }
    }

    const pares: Array<{
      funcionarioId: string;
      funcionarioNome: string;
      funcSaidaErp: string;
      codigoErp: number;
      codigoAtual: number | null;
      nomeNorm: string;
    }> = [];

    for (const e of erpFunc) {
      const funcs = funcPorNome.get(e.nomeNorm);
      if (!funcs?.length) continue;
      for (const f of funcs) {
        pares.push({
          funcionarioId: f.id,
          funcionarioNome: f.nome,
          funcSaidaErp: e.funcSaidaErp,
          codigoErp: e.codErp,
          codigoAtual: f.codigoFuncionarioErp ?? null,
          nomeNorm: e.nomeNorm,
        });
      }
    }

    const qtdFuncPorNome = new Map<string, number>();
    const qtdErpPorFunc = new Map<string, number>();
    const qtdNomesPorCodErp = new Map<string, number>();

    for (const p of pares) {
      qtdFuncPorNome.set(
        p.nomeNorm,
        (qtdFuncPorNome.get(p.nomeNorm) ?? 0) + 1,
      );
      qtdErpPorFunc.set(
        p.funcionarioId,
        (qtdErpPorFunc.get(p.funcionarioId) ?? 0) + 1,
      );
      const codKey = String(p.codigoErp);
      qtdNomesPorCodErp.set(
        codKey,
        (qtdNomesPorCodErp.get(codKey) ?? 0) + 1,
      );
    }

    const itens: VinculoCodigoFuncionarioPreviewRowDto[] = pares.map((p) => {
      const qtdFunc = qtdFuncPorNome.get(p.nomeNorm) ?? 0;
      const qtdErpFunc = qtdErpPorFunc.get(p.funcionarioId) ?? 0;
      const qtdNomes = qtdNomesPorCodErp.get(String(p.codigoErp)) ?? 0;

      let situacao: VinculoCodigoFuncionarioSituacao;
      if (qtdFunc > 1) {
        situacao =
          VinculoCodigoFuncionarioSituacao.MULTIPLOS_FUNCIONARIOS_MESMO_NOME;
      } else if (qtdErpFunc > 1) {
        situacao =
          VinculoCodigoFuncionarioSituacao.MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO;
      } else if (qtdNomes > 1) {
        situacao =
          VinculoCodigoFuncionarioSituacao.MULTIPLOS_NOMES_MESMO_COD_ERP;
      } else if (p.codigoAtual == null) {
        situacao = VinculoCodigoFuncionarioSituacao.PREENCHER;
      } else if (p.codigoAtual === p.codigoErp) {
        situacao = VinculoCodigoFuncionarioSituacao.OK_JA_CORRETO;
      } else {
        situacao =
          VinculoCodigoFuncionarioSituacao.CONFLITO_CODIGO_DIFERENTE;
      }

      const atualizavel =
        situacao === VinculoCodigoFuncionarioSituacao.PREENCHER;

      return {
        funcionarioId: p.funcionarioId,
        funcionarioNome: p.funcionarioNome,
        funcSaidaErp: p.funcSaidaErp,
        codigoErp: p.codigoErp,
        codigoAtual: p.codigoAtual,
        situacao,
        atualizavel,
      };
    });

    itens.sort((a, b) => {
      const ordem = (s: VinculoCodigoFuncionarioSituacao) => {
        switch (s) {
          case VinculoCodigoFuncionarioSituacao.PREENCHER:
            return 1;
          case VinculoCodigoFuncionarioSituacao.CONFLITO_CODIGO_DIFERENTE:
            return 2;
          case VinculoCodigoFuncionarioSituacao.MULTIPLOS_FUNCIONARIOS_MESMO_NOME:
            return 3;
          case VinculoCodigoFuncionarioSituacao.MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO:
            return 4;
          case VinculoCodigoFuncionarioSituacao.MULTIPLOS_NOMES_MESMO_COD_ERP:
            return 5;
          default:
            return 6;
        }
      };
      return (
        ordem(a.situacao) - ordem(b.situacao) ||
        a.funcionarioNome.localeCompare(b.funcionarioNome, 'pt-BR')
      );
    });

    return {
      itens,
      erpSemFuncionario: [...new Set(erpSemFuncionario)].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      totalErpDistinct: erpFunc.length,
    };
  }

  private montarPreviewResponse(
    itens: VinculoCodigoFuncionarioPreviewRowDto[],
    erpSemFuncionario: string[],
    totalErpDistinct: number,
  ): VinculoCodigoFuncionarioPreviewResponseDto {
    const resumo = {
      totalErp: totalErpDistinct,
      totalPreencher: itens.filter((i) => i.atualizavel).length,
      totalOk: itens.filter(
        (i) =>
          i.situacao === VinculoCodigoFuncionarioSituacao.OK_JA_CORRETO,
      ).length,
      totalConflitos: itens.filter(
        (i) =>
          i.situacao ===
          VinculoCodigoFuncionarioSituacao.CONFLITO_CODIGO_DIFERENTE,
      ).length,
      totalAmbiguos: itens.filter(
        (i) =>
          i.situacao ===
            VinculoCodigoFuncionarioSituacao.MULTIPLOS_FUNCIONARIOS_MESMO_NOME ||
          i.situacao ===
            VinculoCodigoFuncionarioSituacao.MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO ||
          i.situacao ===
            VinculoCodigoFuncionarioSituacao.MULTIPLOS_NOMES_MESMO_COD_ERP,
      ).length,
      totalErpSemFuncionario: erpSemFuncionario.length,
    };

    return { itens, resumo, erpSemFuncionario };
  }

  private mergeEtapaRow(
    raw: { codEtapa: string; etapa: string; posicaoEtapa: string },
    cfg?: ProducaoEtapaRemuneracao,
  ): ProducaoEtapaRemuneracaoRow {
    return {
      codEtapa: raw.codEtapa,
      etapa: raw.etapa,
      posicaoEtapa: Number(raw.posicaoEtapa) || 0,
      recebe: cfg?.recebe ?? false,
      valor: cfg ? Number(cfg.valor) : 0,
    };
  }
}
