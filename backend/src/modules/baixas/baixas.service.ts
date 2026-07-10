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
import { ProcessarBaixasEmMassaDto } from './dto/processar-baixas-em-massa.dto';
import { FechamentoCaixaService } from '../fechamento-caixa/fechamento-caixa.service';
import { Unidade } from '../../common/enums/unidade.enum';

interface ProcessamentoBaixasEmMassaResult {
  sucesso: { idvenda: string; protocolo?: string; valorProcessado: number }[];
  falhas: { idvenda: string; protocolo?: string; motivo: string }[];
}

@Injectable()
export class BaixasService {
  private readonly logger = new Logger(BaixasService.name);

  constructor(
    @InjectRepository(Baixa)
    private readonly baixaRepository: Repository<Baixa>,
    private readonly vendasService: VendasService,
    private readonly fechamentoCaixaService: FechamentoCaixaService,
  ) {}

  async create(createBaixaDto: CreateBaixaDto): Promise<Baixa> {
    try {
      // Verificar se a venda existe
      const venda = await this.vendasService.findOne(createBaixaDto.idvenda);
      if (!venda) {
        throw new NotFoundException(`Venda com ID ${createBaixaDto.idvenda} não encontrada`);
      }

      // Validar data da baixa (fechamento de caixa + última baixa da unidade)
      if (venda.unidade) {
        this.logger.debug(
          `Validando criação de baixa. Venda: ${createBaixaDto.idvenda}, ` +
          `Unidade: ${venda.unidade}, Data: ${createBaixaDto.dataBaixa}`
        );
        await this.validarDataBaixaPorUnidade(createBaixaDto.dataBaixa, venda.unidade);
      } else {
        this.logger.warn(
          `Venda ${createBaixaDto.idvenda} não possui unidade definida. Validação de data por unidade ignorada.`
        );
      }

      // Calcular total das baixas existentes para esta venda
      const totalPagoAnterior = await this.getTotalBaixasParaVenda(createBaixaDto.idvenda);
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

      this.logger.log(
        `Baixa criada com sucesso. ID: ${savedBaixa.id}, Venda: ${createBaixaDto.idvenda}, ` +
        `Unidade: ${venda.unidade}, Data: ${createBaixaDto.dataBaixa}`
      );

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
    const venda = await this.vendasService.findOne(baixa.idvenda);

    // Validar data da baixa (fechamento de caixa + última baixa da unidade)
    if (venda.unidade) {
      const dataAtual = typeof baixa.dataBaixa === 'string'
        ? baixa.dataBaixa
        : (baixa.dataBaixa as Date).toISOString().split('T')[0];
      const dataEfetiva = updateBaixaDto.dataBaixa || dataAtual;
      await this.validarDataBaixaPorUnidade(dataEfetiva, venda.unidade, baixa.id);
    }

    // Manter data como string YYYY-MM-DD para evitar conversão de timezone
    const updateData = {
      ...updateBaixaDto,
      ...(updateBaixaDto.dataBaixa && { dataBaixa: updateBaixaDto.dataBaixa as any }),
    };

    await this.baixaRepository.update(id, updateData);

    const updatedBaixa = await this.findOne(id);

    // Atualizar status da venda após atualizar a baixa
    await this.updateVendaStatus(baixa.idvenda);

    this.logger.log(
      `Baixa atualizada com sucesso. ID: ${id}, Venda: ${baixa.idvenda}, ` +
      `Unidade: ${venda.unidade}`
    );

    return updatedBaixa;
  }

  async remove(id: string): Promise<void> {
    const baixa = await this.findOne(id);

    const venda = await this.vendasService.findOne(baixa.idvenda);

    // Validar data da baixa (fechamento de caixa + última baixa da unidade)
    if (venda.unidade) {
      const dataBaixa = typeof baixa.dataBaixa === 'string' 
        ? baixa.dataBaixa 
        : (baixa.dataBaixa as Date).toISOString().split('T')[0];
      
      await this.validarDataBaixaPorUnidade(dataBaixa, venda.unidade, baixa.id);
    }

    await this.baixaRepository.remove(baixa);

    // Atualizar status da venda após remover a baixa
    await this.updateVendaStatus(baixa.idvenda);

    this.logger.log(
      `Baixa removida com sucesso. ID: ${id}, Venda: ${baixa.idvenda}, ` +
      `Unidade: ${venda.unidade}`
    );
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

  private async getTotalBaixasParaVenda(idvenda: string): Promise<number> {
    const totalBaixas = await this.baixaRepository
      .createQueryBuilder('baixa')
      .select('SUM(baixa.valorBaixa)', 'total')
      .where('baixa.idvenda = :idvenda', { idvenda })
      .getRawOne();

    return parseFloat(totalBaixas?.total || '0');
  }

  /**
   * Valida se a data da baixa é permitida para a unidade.
   * Aplica duas regras cumulativas (implantação gradual do fechamento de caixa):
   * 1) data posterior ao último fechamento confirmado do caixa (quando existir);
   * 2) data >= data da última baixa registrada na unidade (quando existir).
   */
  private async validarDataBaixaPorUnidade(
    dataBaixa: string,
    unidade: string,
    excludeBaixaId?: string,
  ): Promise<void> {
    const dataBaixaFormatada = dataBaixa.split('T')[0].substring(0, 10);

    this.logger.debug(
      `Validando data de baixa. Unidade: ${unidade}, Data informada: ${dataBaixaFormatada}` +
      (excludeBaixaId ? `, Excluindo baixa: ${excludeBaixaId}` : ''),
    );

    await this.fechamentoCaixaService.assertPodeRegistrarBaixa(
      unidade as Unidade,
      dataBaixaFormatada,
    );

    await this.validarDataBaixaContraUltimaBaixaUnidade(
      dataBaixaFormatada,
      unidade,
      excludeBaixaId,
    );

    this.logger.debug(`Validação de data aprovada para unidade ${unidade}`);
  }

  /**
   * Valida se a data da baixa não é anterior à última baixa da unidade.
   * Se não houver baixas na unidade, permite qualquer data.
   */
  private async validarDataBaixaContraUltimaBaixaUnidade(
    dataBaixa: string,
    unidade: string,
    excludeBaixaId?: string,
  ): Promise<void> {
    const ultimaData = await this.getUltimaDataBaixaPorUnidade(unidade, excludeBaixaId);

    if (!ultimaData) {
      this.logger.debug(
        `Unidade ${unidade} não possui baixas registradas. Validação por última baixa ignorada.`,
      );
      return;
    }

    if (dataBaixa < ultimaData) {
      const ultimaDataFormatada = this.formatDateDisplay(ultimaData);

      this.logger.warn(
        `Tentativa de operação com baixa de data anterior à última baixa da unidade. ` +
        `Unidade: ${unidade}, Última baixa: ${ultimaData}, Data informada: ${dataBaixa}`,
      );

      const urlBaixas = `/relatorios/baixas?dataInicial=${ultimaData}&dataFinal=${ultimaData}&unidade=${encodeURIComponent(unidade)}`;
      const textoLink = `Clique aqui e veja as baixas do dia ${ultimaDataFormatada}`;

      const mensagem =
        '<strong>Não foi possível realizar esta operação!</strong><br><br>' +
        `Verifique as baixas do dia: <strong>${ultimaDataFormatada}</strong><br><br>` +
        `Já existem baixas registradas nesta unidade até ${ultimaDataFormatada}. ` +
        'Não é possível registrar, alterar ou excluir baixas com data anterior.<br><br>' +
        `<a href="${urlBaixas}">${textoLink}</a>`;

      throw new ConflictException(mensagem);
    }
  }

  private async getUltimaDataBaixaPorUnidade(
    unidade: string,
    excludeBaixaId?: string,
  ): Promise<string | null> {
    try {
      const queryBuilder = this.baixaRepository
        .createQueryBuilder('baixa')
        .innerJoin('baixa.venda', 'venda')
        .where('venda.unidade = :unidade', { unidade });

      if (excludeBaixaId) {
        queryBuilder.andWhere('baixa.id != :excludeBaixaId', { excludeBaixaId });
      }

      const resultado = await queryBuilder
        .orderBy('baixa.dataBaixa', 'DESC')
        .addOrderBy('baixa.criadoEm', 'DESC')
        .limit(1)
        .getOne();

      if (!resultado?.dataBaixa) {
        return null;
      }

      const dataBaixaValue: Date | string = resultado.dataBaixa as Date | string;

      if (dataBaixaValue instanceof Date) {
        return dataBaixaValue.toISOString().split('T')[0];
      }

      if (typeof dataBaixaValue === 'string') {
        return dataBaixaValue.split('T')[0].substring(0, 10);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar última data de baixa para unidade ${unidade}:`,
        error,
      );
      return null;
    }
  }

  private formatDateDisplay(date: string): string {
    if (!date || date.length !== 10) {
      return date;
    }
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  /**
   * Recalcula o status da venda pelas baixas (independente de dataFechamento).
   * Delega a VendasService.updateVendaStatusBasedOnBaixas para não passar pelo
   * PATCH genérico, que bloqueia alterações em vendas fechadas (RN-VND-002).
   */
  private async updateVendaStatus(idvenda: string): Promise<void> {
    await this.vendasService.updateVendaStatusBasedOnBaixas(idvenda);
  }

  async processarBaixasEmMassa(
    processarDto: ProcessarBaixasEmMassaDto,
  ): Promise<ProcessamentoBaixasEmMassaResult> {
    const resultado: ProcessamentoBaixasEmMassaResult = { sucesso: [], falhas: [] };

    for (const vendaId of processarDto.vendaIds) {
      let venda: any = null;
      try {
        venda = await this.vendasService.findOne(vendaId);

        if (
          venda.status !== VendaStatus.REGISTRADO &&
          venda.status !== VendaStatus.PAGO_PARCIAL
        ) {
          resultado.falhas.push({
            idvenda: vendaId,
            protocolo: venda?.protocolo,
            motivo: `Status "${venda.status}" não permite processamento automático.`,
          });
          continue;
        }

        // Validar dataFechamento
        if (venda.dataFechamento) {
          resultado.falhas.push({
            idvenda: vendaId,
            protocolo: venda?.protocolo,
            motivo: `Venda com fechamento registrado em ${venda.dataFechamento}.`,
          });
          continue;
        }

        // Validar data da baixa (fechamento de caixa + última baixa da unidade)
        if (venda.unidade) {
          try {
            await this.validarDataBaixaPorUnidade(processarDto.dataBaixa, venda.unidade);
          } catch (error: any) {
            resultado.falhas.push({
              idvenda: vendaId,
              protocolo: venda?.protocolo,
              motivo: error?.message || 'Data da baixa inválida para a unidade.',
            });
            continue;
          }
        }

        const totalPago = await this.getTotalBaixasParaVenda(vendaId);
        const valorCliente = venda.valorCliente || 0;
        const valorRestante = Number((valorCliente - totalPago).toFixed(2));

        if (valorRestante <= 0) {
          resultado.falhas.push({
            idvenda: vendaId,
            protocolo: venda?.protocolo,
            motivo: 'Não há saldo pendente para essa venda.',
          });
          continue;
        }

        const baixa = this.baixaRepository.create({
          idvenda: vendaId,
          tipoDaBaixa: processarDto.tipoDaBaixa,
          valorBaixa: valorRestante,
          dataBaixa: processarDto.dataBaixa as any,
          observacao: processarDto.observacao,
        });

        await this.baixaRepository.save(baixa);
        await this.updateVendaStatus(vendaId);

        resultado.sucesso.push({
          idvenda: vendaId,
          protocolo: venda?.protocolo,
          valorProcessado: valorRestante,
        });
      } catch (error: any) {
        resultado.falhas.push({
          idvenda: vendaId,
          protocolo: venda?.protocolo,
          motivo: error?.message || 'Erro ao processar a baixa.',
        });
      }
    }

    return resultado;
  }
}
