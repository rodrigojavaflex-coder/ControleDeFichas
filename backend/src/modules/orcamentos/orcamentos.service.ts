import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoMotivoRejeicao } from './entities/orcamento-motivo-rejeicao.entity';
import { FindOrcamentosRejeitadosDto } from './dto/find-orcamentos-rejeitados.dto';
import { BulkUpdateRejeitadosDto } from './dto/bulk-update-rejeitados.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { OrcamentoStatus } from '../../common/enums/orcamento-status.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  resolverEscopoListaFechamentoPorUsuario,
  usuarioPodeGerenciarUnidade,
} from '../folha/utils/folha-unidade-scope.util';

const SORTABLE_FIELDS: Record<string, string> = {
  dataOrcamento: 'o.dataOrcamento',
  nrOrcamento: 'o.nrOrcamento',
  nomeCliente: 'o.nomeCliente',
  nomeVendedor: 'o.nomeVendedor',
  unidade: 'o.unidade',
  precoCobrado: 'o.precoCobrado',
};

@Injectable()
export class OrcamentosService {
  constructor(
    @InjectRepository(Orcamento)
    private readonly orcamentoRepo: Repository<Orcamento>,
    @InjectRepository(OrcamentoMotivoRejeicao)
    private readonly motivoRepo: Repository<OrcamentoMotivoRejeicao>,
  ) {}

  async findRejeitados(
    dto: FindOrcamentosRejeitadosDto,
    usuario: Usuario,
  ): Promise<PaginatedResponseDto<Orcamento>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );

    const qb = this.orcamentoRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.motivoRejeicao', 'motivo')
      .where('o.status = :status', { status: OrcamentoStatus.REJEITADO });

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

    if (dto.motivoRejeicaoId) {
      qb.andWhere('o.motivoRejeicaoId = :motivoRejeicaoId', {
        motivoRejeicaoId: dto.motivoRejeicaoId,
      });
    } else if (dto.comMotivo === true) {
      qb.andWhere('o.motivoRejeicaoId IS NOT NULL');
    } else if (dto.comMotivo === false) {
      qb.andWhere('o.motivoRejeicaoId IS NULL');
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
