import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoMotivoRejeicao } from './entities/orcamento-motivo-rejeicao.entity';
import {
  FindOrcamentosDto,
  OrcamentoListaStatusFiltro,
} from './dto/find-orcamentos.dto';
import { BulkUpdateRejeitadosDto } from './dto/bulk-update-rejeitados.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { OrcamentoStatus } from '../../common/enums/orcamento-status.enum';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  resolverEscopoListaFechamentoPorUsuario,
  usuarioPodeGerenciarUnidade,
} from '../folha/utils/folha-unidade-scope.util';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';

const SORTABLE_FIELDS: Record<string, string> = {
  dataOrcamento: 'o.dataOrcamento',
  nrOrcamento: 'o.nrOrcamento',
  nomeCliente: 'o.nomeCliente',
  nomeVendedor: 'o.nomeVendedor',
  nomeMedico: 'o.nomeMedico',
  unidade: 'o.unidade',
  precoCobrado: 'o.precoCobrado',
  status: 'o.status',
};

const LIMITE_OPCOES_FILTRO = 5000;

@Injectable()
export class OrcamentosService {
  constructor(
    @InjectRepository(Orcamento)
    private readonly orcamentoRepo: Repository<Orcamento>,
    @InjectRepository(OrcamentoMotivoRejeicao)
    private readonly motivoRepo: Repository<OrcamentoMotivoRejeicao>,
  ) {}

  async findOrcamentos(
    dto: FindOrcamentosDto,
    usuario: Usuario,
  ): Promise<PaginatedResponseDto<Orcamento>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const statusList = this.resolverStatusLista(dto.status, usuario);
    const incluiRejeitados = statusList.includes(OrcamentoStatus.REJEITADO);

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );

    const qb = this.orcamentoRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.motivoRejeicao', 'motivo')
      .where('o.status IN (:...statusList)', { statusList });

    if (escopo !== 'ALL') {
      qb.andWhere('o.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    if (dto.nrOrcamento?.trim()) {
      qb.andWhere('o.nrOrcamento ILIKE :nrOrcamento', {
        nrOrcamento: `%${dto.nrOrcamento.trim()}%`,
      });
    }

    if (dto.nomeCliente?.trim()) {
      qb.andWhere('o.nomeCliente ILIKE :nomeCliente', {
        nomeCliente: `%${dto.nomeCliente.trim()}%`,
      });
    }

    if (dto.nomeVendedor?.trim()) {
      qb.andWhere('o.nomeVendedor ILIKE :nomeVendedor', {
        nomeVendedor: `%${dto.nomeVendedor.trim()}%`,
      });
    }

    if (dto.nomesMedico?.length) {
      qb.andWhere(
        `CONCAT(TRIM(o.nomeMedico), ' - ', o.unidade) IN (:...nomesMedico)`,
        { nomesMedico: dto.nomesMedico },
      );
    }

    if (incluiRejeitados) {
      if (dto.motivoRejeicaoId) {
        qb.andWhere('o.motivoRejeicaoId = :motivoRejeicaoId', {
          motivoRejeicaoId: dto.motivoRejeicaoId,
        });
      } else if (dto.comMotivo === true) {
        qb.andWhere('o.motivoRejeicaoId IS NOT NULL');
      } else if (dto.comMotivo === false) {
        qb.andWhere('o.motivoRejeicaoId IS NULL');
      }
    }

    if (dto.dataInicial && dto.dataFinal) {
      qb.andWhere('o.dataOrcamento >= :dataInicial', {
        dataInicial: dto.dataInicial,
      });
      qb.andWhere('o.dataOrcamento <= :dataFinal', {
        dataFinal: dto.dataFinal,
      });
    } else if (dto.dataInicial) {
      qb.andWhere('o.dataOrcamento > :dataInicial', {
        dataInicial: dto.dataInicial,
      });
    } else if (dto.dataFinal) {
      qb.andWhere('o.dataOrcamento <= :dataFinal', {
        dataFinal: dto.dataFinal,
      });
    }

    const sortField =
      SORTABLE_FIELDS[dto.sortBy ?? 'dataOrcamento'] ??
      SORTABLE_FIELDS.dataOrcamento;
    const sortOrder = dto.sortOrder === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortField, sortOrder).addOrderBy('o.nrOrcamento', 'ASC');

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(
      data,
      new PaginationMetaDto(page, limit, total),
    );
  }

  async getOpcoesFiltroOrcamentos(
    dto: Pick<
      FindOrcamentosDto,
      'unidade' | 'dataInicial' | 'dataFinal' | 'status'
    >,
    usuario: Usuario,
  ): Promise<{
    medicos: {
      nome: string;
      total: number;
      aprovados: number;
      rejeitados: number;
    }[];
  }> {
    const statusList = this.resolverStatusLista(dto.status, usuario);
    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );

    const labelMedico = `CONCAT(TRIM(o.nomeMedico), ' - ', o.unidade)`;

    const qb = this.orcamentoRepo
      .createQueryBuilder('o')
      .select(labelMedico, 'nome')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN o.status = :aprovado THEN 1 ELSE 0 END)`,
        'aprovados',
      )
      .addSelect(
        `SUM(CASE WHEN o.status = :rejeitado THEN 1 ELSE 0 END)`,
        'rejeitados',
      )
      .where('o.nomeMedico IS NOT NULL')
      .andWhere("TRIM(o.nomeMedico) <> ''")
      .andWhere('o.status IN (:...statusList)', { statusList })
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy(labelMedico)
      .orderBy('nome', 'ASC')
      .limit(LIMITE_OPCOES_FILTRO);

    if (escopo !== 'ALL') {
      qb.andWhere('o.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    if (dto.dataInicial && dto.dataFinal) {
      qb.andWhere('o.dataOrcamento >= :dataInicial', {
        dataInicial: dto.dataInicial,
      });
      qb.andWhere('o.dataOrcamento <= :dataFinal', {
        dataFinal: dto.dataFinal,
      });
    } else if (dto.dataInicial) {
      qb.andWhere('o.dataOrcamento > :dataInicial', {
        dataInicial: dto.dataInicial,
      });
    } else if (dto.dataFinal) {
      qb.andWhere('o.dataOrcamento <= :dataFinal', {
        dataFinal: dto.dataFinal,
      });
    }

    const medicos = await qb.getRawMany<{
      nome: string;
      total: string;
      aprovados: string;
      rejeitados: string;
    }>();

    return {
      medicos: medicos.map((r) => ({
        nome: r.nome,
        total: Number(r.total) || 0,
        aprovados: Number(r.aprovados) || 0,
        rejeitados: Number(r.rejeitados) || 0,
      })),
    };
  }

  private usuarioPodeLerRejeitados(usuario: Usuario): boolean {
    return getUsuarioPermissoes(usuario).includes(
      Permission.ORCAMENTO_REJEITADO_READ,
    );
  }

  private usuarioPodeLerAprovados(usuario: Usuario): boolean {
    return getUsuarioPermissoes(usuario).includes(
      Permission.ORCAMENTO_APROVADO_READ,
    );
  }

  private resolverStatusLista(
    statusFiltro: OrcamentoListaStatusFiltro | undefined,
    usuario: Usuario,
  ): OrcamentoStatus[] {
    const podeRejeitados = this.usuarioPodeLerRejeitados(usuario);
    const podeAprovados = this.usuarioPodeLerAprovados(usuario);

    if (!podeRejeitados && !podeAprovados) {
      throw new ForbiddenException(
        'Acesso negado. Permissão necessária para visualizar orçamentos.',
      );
    }

    const filtro =
      statusFiltro ??
      (podeRejeitados && podeAprovados
        ? 'TODOS'
        : podeAprovados
          ? 'APROVADO'
          : 'REJEITADO');

    if (filtro === 'APROVADO') {
      if (!podeAprovados) {
        throw new ForbiddenException(
          'Acesso negado. Permissão necessária: orcamento-aprovado:read',
        );
      }
      return [OrcamentoStatus.APROVADO];
    }

    if (filtro === 'REJEITADO') {
      if (!podeRejeitados) {
        throw new ForbiddenException(
          'Acesso negado. Permissão necessária: orcamento-rejeitado:read',
        );
      }
      return [OrcamentoStatus.REJEITADO];
    }

    if (!podeRejeitados || !podeAprovados) {
      throw new ForbiddenException(
        'Acesso negado. Visualizar todos os orçamentos exige permissão para aprovados e rejeitados.',
      );
    }

    return [OrcamentoStatus.APROVADO, OrcamentoStatus.REJEITADO];
  }

  async atualizarRejeitadosEmMassa(
    dto: BulkUpdateRejeitadosDto,
    usuario: Usuario,
  ): Promise<{ atualizados: number }> {
    const motivo = await this.motivoRepo.findOne({
      where: { id: dto.motivoRejeicaoId, ativo: true },
    });
    if (!motivo) {
      throw new BadRequestException(
        'Motivo de rejeição inválido ou inativo.',
      );
    }

    const orcamentos = await this.orcamentoRepo.find({
      where: {
        id: In(dto.ids),
        status: OrcamentoStatus.REJEITADO,
      },
    });

    const elegiveis = orcamentos.filter((o) =>
      usuarioPodeGerenciarUnidade(usuario, o.unidade),
    );

    if (elegiveis.length === 0) {
      throw new BadRequestException(
        'Nenhum orçamento elegível para atualização.',
      );
    }

    const observacao = dto.observacaoRejeicao?.trim() || null;

    for (const orcamento of elegiveis) {
      orcamento.motivoRejeicaoId = motivo.id;
      orcamento.observacaoRejeicao = observacao;
    }

    await this.orcamentoRepo.save(elegiveis);
    return { atualizados: elegiveis.length };
  }
}
