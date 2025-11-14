import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Baixa } from './entities/baixa.entity';
import { CreateBaixaDto } from './dto/create-baixa.dto';
import { UpdateBaixaDto } from './dto/update-baixa.dto';
import { FindBaixasDto } from './dto/find-baixas.dto';
import { VendasService } from '../vendas/vendas.service';
import { VendaStatus } from '../../common/enums/venda.enum';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';

@Injectable()
export class BaixasService {
  private readonly logger = new Logger(BaixasService.name);

  constructor(
    @InjectRepository(Baixa)
    private readonly baixaRepository: Repository<Baixa>,
    private readonly vendasService: VendasService,
  ) {}

  async create(createBaixaDto: CreateBaixaDto): Promise<Baixa> {
    try {
      // Verificar se a venda existe
      const venda = await this.vendasService.findOne(createBaixaDto.idvenda);
      if (!venda) {
        throw new NotFoundException(`Venda com ID ${createBaixaDto.idvenda} não encontrada`);
      }

      // Calcular total das baixas existentes para esta venda
      const totalBaixasExistentes = await this.baixaRepository
        .createQueryBuilder('baixa')
        .select('SUM(baixa.valorBaixa)', 'total')
        .where('baixa.idvenda = :idvenda', { idvenda: createBaixaDto.idvenda })
        .getRawOne();

      const totalPagoAnterior = parseFloat(totalBaixasExistentes?.total || '0');
      const valorCliente = venda.valorCliente || 0;

      // Validar se a soma das baixas não ultrapassará o valor do cliente
      const totalComNovaBaixa = totalPagoAnterior + createBaixaDto.valorBaixa;

      if (totalComNovaBaixa > valorCliente) {
        const diferenca = totalComNovaBaixa - valorCliente;
        throw new ConflictException(
          `O valor da baixa ultrapassa o valor total em R$ ${diferenca.toFixed(2)}. Valor restante: R$ ${(valorCliente - totalPagoAnterior).toFixed(2)}`
        );
      }

      // Manter data como string YYYY-MM-DD para evitar conversão de timezone
      const baixa = this.baixaRepository.create({
        ...createBaixaDto,
        dataBaixa: createBaixaDto.dataBaixa as any, // TypeORM transformer cuidará da conversão
      });

      const savedBaixa = await this.baixaRepository.save(baixa);
      // Atualizar status da venda baseado no total das baixas
      await this.updateVendaStatus(createBaixaDto.idvenda);

      return savedBaixa;
    } catch (error) {
      throw error;
    }
  }

  async findAll(findBaixasDto: FindBaixasDto): Promise<PaginatedResponseDto<Baixa>> {
    const queryBuilder = this.baixaRepository.createQueryBuilder('baixa');

    // Aplicar filtros
    this.applyFilters(queryBuilder, findBaixasDto);

    // Ordenação
    queryBuilder.orderBy('baixa.dataBaixa', 'DESC');
    queryBuilder.addOrderBy('baixa.criadoEm', 'DESC');

    // Paginação
    const { page = 1, limit = 10 } = findBaixasDto;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [baixas, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const meta = new PaginationMetaDto(page, limit, total);

    return {
      data: baixas,
      meta,
    };
  }

  async findOne(id: string): Promise<Baixa> {
    const baixa = await this.baixaRepository.findOne({
      where: { id },
      relations: ['venda'], // Carregar relacionamento com venda
    });

    if (!baixa) {
      throw new NotFoundException(`Baixa com ID ${id} não encontrada`);
    }

    return baixa;
  }

  async update(id: string, updateBaixaDto: UpdateBaixaDto): Promise<Baixa> {
    const baixa = await this.findOne(id);

    // Manter data como string YYYY-MM-DD para evitar conversão de timezone
    const updateData = {
      ...updateBaixaDto,
      ...(updateBaixaDto.dataBaixa && { dataBaixa: updateBaixaDto.dataBaixa as any }),
    };

    await this.baixaRepository.update(id, updateData);

    const updatedBaixa = await this.findOne(id);

    // Atualizar status da venda após atualizar a baixa
    await this.updateVendaStatus(baixa.idvenda);

    return updatedBaixa;
  }

  async remove(id: string): Promise<void> {
    const baixa = await this.findOne(id);

    // Validar status da venda antes de permitir exclusão
    const venda = await this.vendasService.findOne(baixa.idvenda);
    if (venda.status === VendaStatus.FECHADO) {
      throw new ConflictException(
        `Não é possível remover baixas de uma venda com status "${VendaStatus.FECHADO}". A venda está fechada.`
      );
    }

    await this.baixaRepository.remove(baixa);

    // Atualizar status da venda após remover a baixa
    await this.updateVendaStatus(baixa.idvenda);
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Baixa>,
    filters: FindBaixasDto,
  ): void {
    if (filters.idvenda) {
      queryBuilder.andWhere('baixa.idvenda = :idvenda', {
        idvenda: filters.idvenda,
      });
    }

    if (filters.tipoDaBaixa) {
      queryBuilder.andWhere('baixa.tipoDaBaixa = :tipoDaBaixa', {
        tipoDaBaixa: filters.tipoDaBaixa,
      });
    }

    if (filters.dataInicial) {
      queryBuilder.andWhere('baixa.dataBaixa >= :dataInicial', {
        dataInicial: filters.dataInicial,
      });
    }

    if (filters.dataFinal) {
      queryBuilder.andWhere('baixa.dataBaixa <= :dataFinal', {
        dataFinal: filters.dataFinal,
      });
    }
  }

  /**
   * Atualiza o status da venda baseado no total das baixas
   * 
   * Regras de atualização de status:
   * - REGISTRADO: Nenhuma baixa (totalPago = 0)
   * - PAGO_PARCIAL: Valor baixado > 0 E menor que valorCliente
   * - PAGO: Valor baixado >= valorCliente
   * - FECHADO: Não é alterado por este método (status permanece)
   * 
   * @param idvenda - ID da venda para atualizar o status
   */
  private async updateVendaStatus(idvenda: string): Promise<void> {
    try {
      // Buscar venda
      const venda = await this.vendasService.findOne(idvenda);

      // Calcular total das baixas para esta venda
      const totalBaixas = await this.baixaRepository
        .createQueryBuilder('baixa')
        .select('SUM(baixa.valorBaixa)', 'total')
        .where('baixa.idvenda = :idvenda', { idvenda })
        .getRawOne();

      const totalPago = parseFloat(totalBaixas?.total || '0');
      const valorCliente = venda.valorCliente || 0;

      // Determinar novo status baseado nas regras de negócio
      let novoStatus: VendaStatus;

      if (totalPago === 0) {
        // Nenhuma baixa: status REGISTRADO
        novoStatus = VendaStatus.REGISTRADO;
      } else if (totalPago >= valorCliente) {
        // Valor baixado >= valor cliente: status PAGO
        novoStatus = VendaStatus.PAGO;
      } else {
        // Valor baixado > 0 E < valor cliente: status PAGO_PARCIAL
        novoStatus = VendaStatus.PAGO_PARCIAL;
      }

      // Não alterar status se venda estiver FECHADA ou se o status já é correto
      if (venda.status === VendaStatus.FECHADO) {
        return;
      }

      // Só atualizar se o status mudou
      if (venda.status !== novoStatus) {
        await this.vendasService.update(idvenda, { status: novoStatus });
      } else {
        // Nenhuma alteração necessária
      }
    } catch (error) {
      this.logger.error(`Erro ao atualizar status da venda ${idvenda}:`, error);
      // Não lançar erro para não quebrar a criação/remoção da baixa
    }
  }
}
