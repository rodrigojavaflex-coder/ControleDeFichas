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
  ) {}

  async create(createBaixaDto: CreateBaixaDto): Promise<Baixa> {
    try {
      // Verificar se a venda existe
      const venda = await this.vendasService.findOne(createBaixaDto.idvenda);
      if (!venda) {
        throw new NotFoundException(`Venda com ID ${createBaixaDto.idvenda} não encontrada`);
      }

      // Validar dataFechamento da venda (já existe)
      if (venda.dataFechamento) {
        throw new ConflictException(
          `Não é possível criar baixa em venda com fechamento registrado em ${venda.dataFechamento}.`
        );
      }

      // NOVA VALIDAÇÃO: Validar data da baixa por unidade
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

    // Validar dataFechamento (já existe)
    if (venda.dataFechamento) {
      throw new ConflictException(
        `Não é possível editar baixa de venda com fechamento registrado em ${venda.dataFechamento}.`
      );
    }

    // NOVA VALIDAÇÃO: Validar data da baixa por unidade (se estiver alterando a data)
    if (updateBaixaDto.dataBaixa && venda.unidade) {
      // Se a data está sendo alterada, validar
      const dataAtual = typeof baixa.dataBaixa === 'string' 
        ? baixa.dataBaixa 
        : (baixa.dataBaixa as Date).toISOString().split('T')[0];
      
      // Só validar se a nova data for diferente da atual
      if (updateBaixaDto.dataBaixa !== dataAtual) {
        // Passar o ID da baixa sendo editada para excluir da busca
        await this.validarDataBaixaPorUnidade(updateBaixaDto.dataBaixa, venda.unidade, baixa.id);
      }
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

    // Validar dataFechamento antes de permitir exclusão
    const venda = await this.vendasService.findOne(baixa.idvenda);
    if (venda.dataFechamento) {
      throw new ConflictException(
        `Não é possível remover baixas de uma venda com fechamento registrado em ${venda.dataFechamento}.`
      );
    }

    // NOVA VALIDAÇÃO: Validar data da baixa por unidade antes de excluir
    if (venda.unidade) {
      // Converter dataBaixa para string YYYY-MM-DD
      const dataBaixa = typeof baixa.dataBaixa === 'string' 
        ? baixa.dataBaixa 
        : (baixa.dataBaixa as Date).toISOString().split('T')[0];
      
      // Passar o ID da baixa sendo excluída para excluir da busca
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
   * Busca a data da última baixa registrada para uma unidade
   * @param unidade - Unidade para buscar
   * @param excludeBaixaId - ID da baixa a ser excluída da busca (opcional, usado em edição/exclusão)
   * @returns Data da última baixa no formato YYYY-MM-DD ou null se não houver baixas
   */
  private async getUltimaDataBaixaPorUnidade(unidade: string, excludeBaixaId?: string): Promise<string | null> {
    try {
      const queryBuilder = this.baixaRepository
        .createQueryBuilder('baixa')
        .innerJoin('baixa.venda', 'venda')
        .where('venda.unidade = :unidade', { unidade });

      // Excluir a baixa específica se fornecida (caso de edição/exclusão)
      if (excludeBaixaId) {
        queryBuilder.andWhere('baixa.id != :excludeBaixaId', { excludeBaixaId });
        this.logger.debug(
          `Buscando última data de baixa para unidade ${unidade}, excluindo baixa ${excludeBaixaId}`
        );
      }

      const resultado = await queryBuilder
        .orderBy('baixa.dataBaixa', 'DESC')
        .addOrderBy('baixa.criadoEm', 'DESC')
        .limit(1)
        .getOne();

      this.logger.debug(
        `Buscando última data de baixa para unidade ${unidade}. ` +
        `Resultado encontrado: ${resultado ? 'SIM' : 'NÃO'}`
      );

      if (!resultado || !resultado.dataBaixa) {
        this.logger.debug(`Nenhuma baixa encontrada para unidade ${unidade}`);
        return null;
      }

      // Converter dataBaixa para string YYYY-MM-DD
      let ultimaData: string;
      const dataBaixaValue: Date | string = resultado.dataBaixa as Date | string;
      
      if (dataBaixaValue instanceof Date) {
        ultimaData = dataBaixaValue.toISOString().split('T')[0];
      } else if (typeof dataBaixaValue === 'string') {
        // Se já for string, garantir formato YYYY-MM-DD
        ultimaData = dataBaixaValue.split('T')[0].substring(0, 10);
      } else {
        this.logger.warn(
          `Formato inesperado de data retornado: ${typeof dataBaixaValue}, valor: ${dataBaixaValue}`
        );
        return null;
      }

      this.logger.debug(`Última data de baixa para unidade ${unidade}: ${ultimaData}`);
      return ultimaData;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar última data de baixa para unidade ${unidade}:`,
        error
      );
      return null;
    }
  }

  /**
   * Valida se a data da baixa é permitida para a unidade
   * Só permite se a data for >= data da última baixa da unidade
   * Se não houver baixas na unidade, permite qualquer data
   * @param dataBaixa - Data da baixa sendo criada/editada/excluída (formato YYYY-MM-DD)
   * @param unidade - Unidade da venda
   * @param excludeBaixaId - ID da baixa a ser excluída da busca (opcional, usado em edição/exclusão)
   * @throws ConflictException se a data for anterior à última baixa
   */
  private async validarDataBaixaPorUnidade(
    dataBaixa: string, 
    unidade: string, 
    excludeBaixaId?: string
  ): Promise<void> {
    // Garantir que dataBaixa está no formato YYYY-MM-DD
    const dataBaixaFormatada = dataBaixa.split('T')[0].substring(0, 10);
    
    this.logger.debug(
      `Validando data de baixa. Unidade: ${unidade}, Data informada: ${dataBaixaFormatada}` +
      (excludeBaixaId ? `, Excluindo baixa: ${excludeBaixaId}` : '')
    );

    const ultimaData = await this.getUltimaDataBaixaPorUnidade(unidade, excludeBaixaId);
    
    // Se não houver baixas na unidade, permitir qualquer data
    if (!ultimaData) {
      this.logger.debug(`Unidade ${unidade} não possui baixas registradas. Permitindo operação.`);
      return;
    }

    this.logger.debug(
      `Comparando datas. Data informada: ${dataBaixaFormatada}, Última data: ${ultimaData}`
    );

    // Comparar datas (formato YYYY-MM-DD permite comparação direta como string)
    if (dataBaixaFormatada < ultimaData) {
      // Buscar protocolo da venda da última baixa para incluir na mensagem de erro
      const protocoloUltimaBaixa = await this.getProtocoloUltimaBaixaPorUnidade(unidade, excludeBaixaId);
      
      this.logger.warn(
        `Tentativa de operação com baixa de data anterior à última baixa da unidade. ` +
        `Unidade: ${unidade}, Última baixa: ${ultimaData}, Data informada: ${dataBaixaFormatada}`
      );
      
      const mensagemProtocolo = protocoloUltimaBaixa 
        ? ` (Protocolo: ${protocoloUltimaBaixa})`
        : '';
      
      throw new ConflictException(
        `Não é possível realizar esta operação com baixa de data anterior à última baixa registrada na unidade ${unidade}. ` +
        `Última baixa registrada: ${this.formatDateDisplay(ultimaData)}${mensagemProtocolo}. ` +
        `Data da baixa: ${this.formatDateDisplay(dataBaixaFormatada)}.`
      );
    }

    this.logger.debug(`Validação de data aprovada para unidade ${unidade}`);
  }

  /**
   * Busca o protocolo da venda da última baixa registrada para uma unidade
   * @param unidade - Unidade para buscar
   * @param excludeBaixaId - ID da baixa a ser excluída da busca (opcional)
   * @returns Protocolo da venda ou null se não houver baixas
   */
  private async getProtocoloUltimaBaixaPorUnidade(unidade: string, excludeBaixaId?: string): Promise<string | null> {
    try {
      const queryBuilder = this.baixaRepository
        .createQueryBuilder('baixa')
        .innerJoin('baixa.venda', 'venda')
        .where('venda.unidade = :unidade', { unidade })
        .select('venda.protocolo', 'protocolo');

      // Excluir a baixa específica se fornecida (caso de edição/exclusão)
      if (excludeBaixaId) {
        queryBuilder.andWhere('baixa.id != :excludeBaixaId', { excludeBaixaId });
      }

      const resultado = await queryBuilder
        .orderBy('baixa.dataBaixa', 'DESC')
        .addOrderBy('baixa.criadoEm', 'DESC')
        .limit(1)
        .getRawOne();

      return resultado?.protocolo || null;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar protocolo da última baixa para unidade ${unidade}:`,
        error
      );
      return null;
    }
  }

  /**
   * Formata data para exibição (YYYY-MM-DD -> DD/MM/YYYY)
   */
  private formatDateDisplay(date: string): string {
    if (!date || date.length !== 10) return date;
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  /**
   * Atualiza o status da venda baseado no total das baixas
   * 
   * Regras de atualização de status:
   * - REGISTRADO: Nenhuma baixa (totalPago = 0)
   * - PAGO_PARCIAL: Valor baixado > 0 E menor que valorCliente
   * - PAGO: Valor baixado >= valorCliente
   * 
   * O status é sempre atualizado baseado nas baixas, independente de dataFechamento.
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

      // Sempre atualizar baseado nas baixas, independente de dataFechamento
      if (venda.status !== novoStatus) {
        await this.vendasService.update(idvenda, { status: novoStatus });
      }
    } catch (error) {
      this.logger.error(`Erro ao atualizar status da venda ${idvenda}:`, error);
      // Não lançar erro para não quebrar a criação/remoção da baixa
    }
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

        // NOVA VALIDAÇÃO: Validar data da baixa por unidade
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
