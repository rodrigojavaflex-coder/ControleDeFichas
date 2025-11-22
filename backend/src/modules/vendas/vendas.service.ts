import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Venda } from './entities/venda.entity';
import { CreateVendaDto } from './dto/create-venda.dto';
import { UpdateVendaDto } from './dto/update-venda.dto';
import { FindVendasDto } from './dto/find-vendas.dto';
import { VendaStatus } from '../../common/enums/venda.enum';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { FecharVendasEmMassaDto } from './dto/fechar-vendas-em-massa.dto';
import { CancelarFechamentosEmMassaDto } from './dto/cancelar-fechamentos-em-massa.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Permission } from '../../common/enums/permission.enum';

interface FecharVendaFalha {
  id: string;
  motivo: string;
}

interface ProcessamentoVendasEmMassaResult {
  sucesso: Venda[];
  falhas: FecharVendaFalha[];
}

@Injectable()
export class VendasService {
  private readonly logger = new Logger(VendasService.name);

  constructor(
    @InjectRepository(Venda)
    private readonly vendaRepository: Repository<Venda>,
  ) {}

  private usuarioPodeVerValorCompra(usuario?: Usuario | null): boolean {
    if (!usuario) {
      return true;
    }
    const permissoes = usuario.perfil?.permissoes || [];
    return permissoes.includes(Permission.VENDA_VIEW_VALOR_COMPRA);
  }

  private calcularValorCompraPadrao(valorCliente: number): number {
    const valorClienteNumero = Number(valorCliente || 0);
    const desconto = valorClienteNumero * 0.35;
    return Number((valorClienteNumero - desconto).toFixed(2));
  }

  async create(createVendaDto: CreateVendaDto, usuario?: Usuario | null): Promise<Venda> {
    try {
      const podeVerValorCompra = this.usuarioPodeVerValorCompra(usuario);
      const valorClienteNumero = Number(createVendaDto.valorCliente || 0);
      const valorCompraCalculado = this.calcularValorCompraPadrao(valorClienteNumero);

      if (!podeVerValorCompra) {
        createVendaDto.valorCompra = valorCompraCalculado;
      } else if (
        createVendaDto.valorCompra === undefined ||
        createVendaDto.valorCompra === null ||
        Number(createVendaDto.valorCompra) <= 0
      ) {
        createVendaDto.valorCompra = valorCompraCalculado;
      }

      if (
        createVendaDto.valorCompra !== undefined &&
        createVendaDto.valorCliente !== undefined &&
        Number(createVendaDto.valorCompra) > Number(createVendaDto.valorCliente)
      ) {
        throw new BadRequestException(
          'O valor da compra não pode ser maior que o valor do cliente.',
        );
      }

      // Manter data como string YYYY-MM-DD para evitar conversão de timezone
      const venda = this.vendaRepository.create({
        ...createVendaDto,
        dataVenda: createVendaDto.dataVenda as any, // TypeORM transformer cuidará da conversão
      });

      const savedVenda = await this.vendaRepository.save(venda);

      return savedVenda;
    } catch (error) {
      this.logger.error('Error creating venda:', error);
      throw error;
    }
  }

  async fecharVendasEmMassa(
    fecharDto: FecharVendasEmMassaDto,
  ): Promise<ProcessamentoVendasEmMassaResult> {
    const dataFechamento =
      fecharDto.dataFechamento ?? new Date().toISOString().split('T')[0];
    const vendas = await this.vendaRepository.find({
      where: { id: In(fecharDto.vendaIds) },
    });

    const vendasMap = new Map(vendas.map((venda) => [venda.id, venda]));
    const falhas: FecharVendaFalha[] = [];
    const sucesso: Venda[] = [];

    for (const vendaId of fecharDto.vendaIds) {
      const venda = vendasMap.get(vendaId);

      if (!venda) {
        falhas.push({ id: vendaId, motivo: 'Venda não encontrada' });
        continue;
      }

      if (venda.status !== VendaStatus.PAGO) {
        falhas.push({
          id: vendaId,
          motivo: `Venda ${venda.protocolo} está com status ${venda.status}. Apenas vendas PAGO podem ser fechadas.`,
        });
        continue;
      }

      const totalBaixas = await this.getTotalBaixasForVenda(vendaId);
      const valorCliente = Number(venda.valorCliente || 0);
      const totalBaixasFixed = Number(totalBaixas.toFixed(2));
      const valorClienteFixed = Number(valorCliente.toFixed(2));

      if (totalBaixasFixed !== valorClienteFixed) {
        falhas.push({
          id: vendaId,
          motivo: `Venda ${venda.protocolo} possui valor baixado (${totalBaixasFixed.toFixed(
            2,
          )}) diferente do valor do cliente (${valorClienteFixed.toFixed(2)}).`,
        });
        continue;
      }

      await this.vendaRepository.update(vendaId, {
        status: VendaStatus.FECHADO,
        dataFechamento,
      });
      const vendaAtualizada = await this.findOne(vendaId);
      sucesso.push(vendaAtualizada);
    }

    return { sucesso, falhas };
  }

  async cancelarFechamentosEmMassa(
    cancelarDto: CancelarFechamentosEmMassaDto,
  ): Promise<ProcessamentoVendasEmMassaResult> {
    const vendas = await this.vendaRepository.find({
      where: { id: In(cancelarDto.vendaIds) },
    });

    const vendasMap = new Map(vendas.map((venda) => [venda.id, venda]));
    const falhas: FecharVendaFalha[] = [];
    const sucesso: Venda[] = [];

    for (const vendaId of cancelarDto.vendaIds) {
      const venda = vendasMap.get(vendaId);

      if (!venda) {
        falhas.push({ id: vendaId, motivo: 'Venda não encontrada' });
        continue;
      }

      if (venda.status !== VendaStatus.FECHADO) {
        falhas.push({
          id: vendaId,
          motivo: `Venda ${venda.protocolo} precisa estar com status FECHADO para cancelar o fechamento.`,
        });
        continue;
      }

      await this.vendaRepository.update(vendaId, {
        status: VendaStatus.PAGO,
        dataFechamento: null,
      });
      const vendaAtualizada = await this.findOne(vendaId);
      sucesso.push(vendaAtualizada);
    }

    return { sucesso, falhas };
  }

  async findAll(findVendasDto: FindVendasDto): Promise<PaginatedResponseDto<Venda>> {
    const queryBuilder = this.vendaRepository.createQueryBuilder('venda');

    // Aplicar filtros
    this.applyFilters(queryBuilder, findVendasDto);

    // Ordenação
    queryBuilder.orderBy('venda.dataVenda', 'ASC');
    queryBuilder.addOrderBy('venda.criadoEm', 'ASC');

    // Paginação
    const { page = 1, limit = 10 } = findVendasDto;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [vendas, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const meta = new PaginationMetaDto(page, limit, total);

    return {
      data: vendas,
      meta,
    };
  }

  async findOne(id: string): Promise<Venda> {
    const venda = await this.vendaRepository.findOneBy({ id });

    if (!venda) {
      throw new NotFoundException(`Venda com ID ${id} não encontrada`);
    }

    return venda;
  }

  async update(id: string, updateVendaDto: UpdateVendaDto, usuario?: Usuario | null): Promise<Venda> {
    try {
      const venda = await this.findOne(id);
      const podeVerValorCompra = this.usuarioPodeVerValorCompra(usuario);
      const valorClienteBase =
        updateVendaDto.valorCliente !== undefined && updateVendaDto.valorCliente !== null
          ? Number(updateVendaDto.valorCliente)
          : Number(venda.valorCliente || 0);
      const valorCompraCalculado = this.calcularValorCompraPadrao(valorClienteBase);

      if (!podeVerValorCompra) {
        updateVendaDto.valorCompra = valorCompraCalculado;
      } else if (
        updateVendaDto.valorCompra === undefined ||
        updateVendaDto.valorCompra === null ||
        Number(updateVendaDto.valorCompra) <= 0
      ) {
        updateVendaDto.valorCompra = valorCompraCalculado;
      }

      // Validação 1: Venda não pode estar FECHADA
      if (venda.status === VendaStatus.FECHADO) {
        throw new ConflictException(
          `Não é possível editar uma venda com status "Fechado". A venda está fechada.`
        );
      }

      const valorCompraAtualizado =
        updateVendaDto.valorCompra !== undefined ? updateVendaDto.valorCompra : venda.valorCompra;
      const valorClienteAtualizado =
        updateVendaDto.valorCliente !== undefined ? updateVendaDto.valorCliente : venda.valorCliente;

      if (
        valorCompraAtualizado !== undefined &&
        valorClienteAtualizado !== undefined &&
        Number(valorCompraAtualizado) > Number(valorClienteAtualizado)
      ) {
        throw new BadRequestException(
          'O valor da compra não pode ser maior que o valor do cliente.',
        );
      }

      // Validação 2: Se o novo valorCliente for informado, validar contra as baixas já lançadas
      if (updateVendaDto.valorCliente !== undefined && updateVendaDto.valorCliente !== venda.valorCliente) {
        const novoValorCliente = updateVendaDto.valorCliente;
        
        // Calcular total das baixas já lançadas para esta venda
        const result = await this.vendaRepository.query(
          `SELECT COALESCE(SUM(CAST("valorBaixa" AS NUMERIC)), 0) as total 
           FROM baixas 
           WHERE idvenda = $1`,
          [id]
        );

        const totalBaixas = parseFloat(result[0]?.total || '0');

        if (novoValorCliente < totalBaixas) {
          const diferenca = totalBaixas - novoValorCliente;
          throw new ConflictException(
            `O novo valor do cliente (R$ ${novoValorCliente.toFixed(2)}) é menor que o total de baixas já lançadas (R$ ${totalBaixas.toFixed(2)}). Diferença: R$ ${diferenca.toFixed(2)}`
          );
        }
      }

      // Manter data como string YYYY-MM-DD para evitar conversão de timezone
      const updateData = {
        ...updateVendaDto,
        ...(updateVendaDto.dataVenda && { dataVenda: updateVendaDto.dataVenda as any }),
      };

      await this.vendaRepository.update(id, updateData);

      
      // Após atualizar a venda, recalcular o status baseado nas baixas
      await this.updateVendaStatusBasedOnBaixas(id);

      // Buscar e retornar a venda atualizada com status recalculado
      const updatedVenda = await this.findOne(id);

      return updatedVenda;
    } catch (error) {
      this.logger.error('Error updating venda:', error.message, error.stack);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const venda = await this.findOne(id);

    await this.vendaRepository.remove(venda);
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Venda>,
    filters: FindVendasDto,
  ): void {
    if (filters.protocolo) {
      queryBuilder.andWhere('venda.protocolo ILIKE :protocolo', {
        protocolo: `%${filters.protocolo}%`,
      });
    }

    if (filters.cliente) {
      queryBuilder.andWhere('venda.cliente ILIKE :cliente', {
        cliente: `%${filters.cliente}%`,
      });
    }

    if (filters.origem) {
      queryBuilder.andWhere('venda.origem = :origem', {
        origem: filters.origem,
      });
    }

    if (filters.vendedor) {
      queryBuilder.andWhere('venda.vendedor ILIKE :vendedor', {
        vendedor: `%${filters.vendedor}%`,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('venda.status = :status', {
        status: filters.status,
      });
    }

    if (filters.dataInicial) {
      queryBuilder.andWhere('venda.dataVenda >= :dataInicial', {
        dataInicial: filters.dataInicial,
      });
    }

    if (filters.dataFinal) {
      queryBuilder.andWhere('venda.dataVenda <= :dataFinal', {
        dataFinal: filters.dataFinal,
      });
    }

    if (filters.dataInicialFechamento) {
      queryBuilder.andWhere('venda.dataFechamento >= :dataInicialFechamento', {
        dataInicialFechamento: filters.dataInicialFechamento,
      });
    }

    if (filters.dataFinalFechamento) {
      queryBuilder.andWhere('venda.dataFechamento <= :dataFinalFechamento', {
        dataFinalFechamento: filters.dataFinalFechamento,
      });
    }

    if (filters.unidade) {
      queryBuilder.andWhere('venda.unidade = :unidade', {
        unidade: filters.unidade,
      });
    }

    if (filters.ativo) {
      queryBuilder.andWhere('venda.ativo ILIKE :ativo', {
        ativo: `%${filters.ativo}%`,
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
  async updateVendaStatusBasedOnBaixas(idvenda: string): Promise<void> {
    try {
      // Buscar a venda atualizada do banco para ter o valorCliente mais recente
      const venda = await this.vendaRepository.findOneBy({ id: idvenda });
      if (!venda) {
        return;
      }

      // Calcular total das baixas para esta venda usando query bruta
      const totalPago = await this.getTotalBaixasForVenda(idvenda);
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

      // Não alterar status se venda estiver FECHADA
      if (venda.status === VendaStatus.FECHADO) {
        return;
      }

      // Só atualizar se o status mudou
      if (venda.status !== novoStatus) {
        await this.vendaRepository.update(idvenda, { status: novoStatus });
      }
    } catch (error) {
      this.logger.error(`[updateVendaStatusBasedOnBaixas] Erro ao atualizar status da venda ${idvenda}:`, error);
      // Não lançar erro para não quebrar a edição da venda
    }
  }
  private async getTotalBaixasForVenda(idvenda: string): Promise<number> {
    const result = await this.vendaRepository.query(
      `SELECT COALESCE(SUM(CAST("valorBaixa" AS NUMERIC)), 0) as total 
         FROM baixas 
         WHERE "idvenda" = $1`,
      [idvenda],
    );

    return parseFloat(result[0]?.total || '0');
  }
}
