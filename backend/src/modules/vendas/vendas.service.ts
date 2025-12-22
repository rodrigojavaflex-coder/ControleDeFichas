import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Venda } from './entities/venda.entity';
import { CreateVendaDto } from './dto/create-venda.dto';
import { UpdateVendaDto } from './dto/update-venda.dto';
import { FindVendasDto } from './dto/find-vendas.dto';
import { VendaOrigem, VendaStatus, TipoAtualizacao } from '../../common/enums/venda.enum';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { FecharVendasEmMassaDto } from './dto/fechar-vendas-em-massa.dto';
import { CancelarFechamentosEmMassaDto } from './dto/cancelar-fechamentos-em-massa.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import { AtualizarValorCompraDto } from './dto/atualizar-valor-compra.dto';

interface FecharVendaFalha {
  id: string;
  protocolo?: string;
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
    private readonly configService: ConfigService,
  ) {}

  private mapUnidadeParaOrigem(unidade?: Unidade | null): VendaOrigem | undefined {
    if (!unidade) {
      return undefined;
    }

    switch (unidade) {
      case Unidade.INHUMAS:
        return VendaOrigem.INHUMAS;
      case Unidade.UBERABA:
        return VendaOrigem.UBERABA;
      case Unidade.NERÓPOLIS:
        return VendaOrigem.NEROPOLIS;
      default:
        return undefined;
    }
  }

  async create(createVendaDto: CreateVendaDto, usuario?: Usuario | null): Promise<Venda> {
    try {
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
        falhas.push({ id: vendaId, protocolo: undefined, motivo: 'Venda não encontrada' });
        continue;
      }

      if (venda.status !== VendaStatus.PAGO) {
        falhas.push({
          id: vendaId,
          protocolo: venda.protocolo,
          motivo: `Venda está com status ${venda.status}. Apenas vendas PAGO podem ser fechadas.`,
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
          protocolo: venda.protocolo,
          motivo: `Venda possui valor baixado (${totalBaixasFixed.toFixed(
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

  async registrarEnvioEmMassa(
    registrarEnvioDto: RegistrarEnvioDto,
  ): Promise<ProcessamentoVendasEmMassaResult> {
    const { vendaIds, dataEnvio } = registrarEnvioDto;

    const vendas = await this.vendaRepository.find({
      where: { id: In(vendaIds) },
    });

    const vendasMap = new Map(vendas.map((venda) => [venda.id, venda]));
    const falhas: FecharVendaFalha[] = [];
    const sucesso: Venda[] = [];

    for (const vendaId of vendaIds) {
      const venda = vendasMap.get(vendaId);

      if (!venda) {
        falhas.push({ id: vendaId, protocolo: undefined, motivo: 'Venda não encontrada' });
        continue;
      }

      await this.vendaRepository.update(vendaId, {
        dataEnvio,
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
        falhas.push({ id: vendaId, protocolo: undefined, motivo: 'Venda não encontrada' });
        continue;
      }

      if (venda.status !== VendaStatus.FECHADO) {
        falhas.push({
          id: vendaId,
          protocolo: venda.protocolo,
          motivo: `Venda precisa estar com status FECHADO para cancelar o fechamento.`,
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
    return this.executeListQuery(findVendasDto);
  }

  async findAcompanhar(
    findVendasDto: FindVendasDto,
    usuario?: Usuario | null,
  ): Promise<PaginatedResponseDto<Venda>> {
    const filters: FindVendasDto = { ...findVendasDto };
    const origem = this.mapUnidadeParaOrigem(usuario?.unidade);

    if (origem) {
      filters.origem = origem;
    }

    return this.executeListQuery(filters);
  }

  private async executeListQuery(
    findVendasDto: FindVendasDto,
  ): Promise<PaginatedResponseDto<Venda>> {
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

    if (filters.prescritor) {
      queryBuilder.andWhere('venda.prescritor ILIKE :prescritor', {
        prescritor: `%${filters.prescritor}%`,
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

    if (filters.dataInicialEnvio) {
      queryBuilder.andWhere('venda.dataEnvio >= :dataInicialEnvio', {
        dataInicialEnvio: filters.dataInicialEnvio,
      });
    }

    if (filters.dataFinalEnvio) {
      queryBuilder.andWhere('venda.dataEnvio <= :dataFinalEnvio', {
        dataFinalEnvio: filters.dataFinalEnvio,
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

  async atualizarValorCompraEmMassa(
    dto: AtualizarValorCompraDto,
  ): Promise<ProcessamentoVendasEmMassaResult> {
    const vendas = await this.vendaRepository.find({
      where: { id: In(dto.vendaIds) },
    });

    if (vendas.length === 0) {
      throw new NotFoundException('Nenhuma venda encontrada com os IDs fornecidos');
    }

    // Agrupar vendas por origem/unidade para chamar o agente correto
    const vendasPorOrigem = new Map<VendaOrigem, typeof vendas>();
    const vendasSemOrigem: typeof vendas = [];
    
    for (const venda of vendas) {
      // Validar se o status não é FECHADO - não processar essas vendas
      if (venda.status === VendaStatus.FECHADO) {
        continue;
      }
      
      if (!venda.origem) {
        vendasSemOrigem.push(venda);
        continue;
      }
      if (!vendasPorOrigem.has(venda.origem)) {
        vendasPorOrigem.set(venda.origem, []);
      }
      vendasPorOrigem.get(venda.origem)!.push(venda);
    }

    const sucesso: Venda[] = [];
    const falhas: FecharVendaFalha[] = [];

    // Processar vendas com status FECHADO - adicionar às falhas
    for (const venda of vendas) {
      if (venda.status === VendaStatus.FECHADO) {
        falhas.push({
          id: venda.id,
          protocolo: venda.protocolo,
          motivo: 'Não é possível atualizar o valor de compra de uma venda com status FECHADO.',
        });
      }
    }

    // Processar vendas sem origem
    for (const venda of vendasSemOrigem) {
      falhas.push({
        id: venda.id,
        protocolo: venda.protocolo,
        motivo: 'Venda não possui origem definida',
      });
    }

    // Processar cada grupo de vendas por origem
    for (const [origem, vendasGrupo] of vendasPorOrigem.entries()) {
      try {
        // Mapear origem para configuração do agente
        const agenteConfig = this.getAgenteConfigByOrigem(origem);
        if (!agenteConfig || !agenteConfig.url || !agenteConfig.token) {
          // Se não houver agente configurado e o usuário quer atualizar com valor do cliente
          if (dto.atualizarComValorCliente === true) {
            // Processar apenas vendas com protocolo válido
            for (const venda of vendasGrupo) {
              if (!venda.protocolo) {
                continue;
              }
              
              const protocoloStr = venda.protocolo.toString().trim();
              if (!/^\d+$/.test(protocoloStr)) {
                continue;
              }

              // Atualizar com valor do cliente
              const valorCliente = Number(venda.valorCliente || 0);
              const valorPago = valorCliente * 0.65; // 35% de desconto

              await this.vendaRepository.update(venda.id, {
                valorCompra: valorCliente,
                valorPago: Math.round(valorPago * 100) / 100, // Arredondar para 2 casas decimais
                tipoAtualizacao: TipoAtualizacao.VALOR_CLIENTE,
              });

              const vendaAtualizada = await this.vendaRepository.findOne({
                where: { id: venda.id },
              });

              if (vendaAtualizada) {
                sucesso.push(vendaAtualizada);
              }
            }
          } else {
            // Se não houver agente configurado e não quiser atualizar com valor do cliente, marcar todas como falha
            const nomeUnidade = this.getNomeUnidadePorOrigem(origem);
            for (const venda of vendasGrupo) {
              falhas.push({
                id: venda.id,
                protocolo: venda.protocolo,
                motivo: `Agente não configurado para unidade: ${nomeUnidade}`,
              });
            }
          }
          continue;
        }

        // Separar vendas com protocolos válidos e inválidos
        const vendasComProtocoloValido: typeof vendasGrupo = [];
        const vendasComProtocoloInvalido: typeof vendasGrupo = [];

        for (const venda of vendasGrupo) {
          if (!venda.protocolo) {
            vendasComProtocoloInvalido.push(venda);
            continue;
          }
          
          // Validar se o protocolo contém apenas números
          const protocoloStr = venda.protocolo.toString().trim();
          if (!/^\d+$/.test(protocoloStr)) {
            vendasComProtocoloInvalido.push(venda);
            continue;
          }
          
          vendasComProtocoloValido.push(venda);
        }

        // Processar vendas com protocolo inválido
        for (const venda of vendasComProtocoloInvalido) {
          // Se o usuário quer atualizar com valor do cliente, atualizar mesmo com protocolo inválido
          if (dto.atualizarComValorCliente === true) {
            const valorCliente = Number(venda.valorCliente || 0);
            const valorPago = valorCliente * 0.65; // 35% de desconto

            await this.vendaRepository.update(venda.id, {
              valorCompra: valorCliente,
              valorPago: Math.round(valorPago * 100) / 100, // Arredondar para 2 casas decimais
              tipoAtualizacao: TipoAtualizacao.VALOR_CLIENTE,
            });

            const vendaAtualizada = await this.vendaRepository.findOne({
              where: { id: venda.id },
            });

            if (vendaAtualizada) {
              sucesso.push(vendaAtualizada);
            }
          } else {
            // Se não quiser atualizar com valor do cliente, adicionar às falhas
            falhas.push({
              id: venda.id,
              protocolo: venda.protocolo,
              motivo: 'Protocolo inválido. O protocolo deve conter apenas números.',
            });
          }
        }

        // Se não houver vendas válidas e não atualizou com valor do cliente, continuar para o próximo grupo
        if (vendasComProtocoloValido.length === 0) {
          continue;
        }

        // Extrair protocolos das vendas válidas (converter string para number)
        const protocolos = vendasComProtocoloValido
          .map((v) => parseInt(v.protocolo!, 10))
          .filter((p): p is number => !isNaN(p));

        // Chamar o agente usando fetch nativo com timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

        let response: Response;
        try {
          response = await fetch(
            `${agenteConfig.url}/api/v1/vendas/valor-compra`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${agenteConfig.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                unit: agenteConfig.unit,
                protocolos,
              }),
              signal: controller.signal,
            },
          );
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          // Tratar diferentes tipos de erro
          if (fetchError.name === 'AbortError') {
            throw new Error('Timeout: O agente não respondeu dentro do tempo esperado (30 segundos)');
          }
          
          if (fetchError.cause) {
            const cause = fetchError.cause;
            const nomeUnidade = this.getNomeUnidadePorOrigem(origem);
            if (cause.code === 'ENOTFOUND' || cause.code === 'ECONNREFUSED') {
              throw new Error(`Não foi possível conectar à unidade: ${nomeUnidade}`);
            }
            if (cause.code === 'ETIMEDOUT') {
              throw new Error(`Timeout ao conectar à unidade: ${nomeUnidade}. O serviço pode estar sobrecarregado.`);
            }
          }
          
          throw new Error(`Erro ao chamar agente: ${fetchError.message || 'Erro desconhecido'}`);
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          let errorText = 'Erro desconhecido';
          try {
            errorText = await response.text();
          } catch {
            // Se não conseguir ler o texto do erro, usar mensagem padrão
          }
          
          const statusMessage = response.status === 404
            ? 'Endpoint não encontrado no agente'
            : response.status === 401 || response.status === 403
            ? 'Erro de autenticação com o agente'
            : response.status >= 500
            ? 'Erro interno no agente'
            : `Erro HTTP ${response.status}`;
          
          throw new Error(`${statusMessage}: ${errorText}`);
        }

        const responseData: {
          unit: number;
          resultados: Array<{ protocolo: number; valor_compra: number }>;
        } = await response.json();

        // Criar mapa de protocolo -> valor_compra
        const valorCompraMap = new Map<number, number>();
        for (const resultado of responseData.resultados) {
          valorCompraMap.set(resultado.protocolo, resultado.valor_compra);
        }

        // Atualizar vendas com os valores retornados (apenas as válidas)
        for (const venda of vendasComProtocoloValido) {
          const protocoloNum = parseInt(venda.protocolo!, 10);
          const valorCompra = valorCompraMap.get(protocoloNum);
          
          if (valorCompra === undefined) {
            // Se não encontrou no agente e o usuário quer atualizar com valor do cliente
            if (dto.atualizarComValorCliente === true) {
              const valorCliente = Number(venda.valorCliente || 0);
              const valorPago = valorCliente * 0.65; // 35% de desconto

              await this.vendaRepository.update(venda.id, {
                valorCompra: valorCliente,
                valorPago: Math.round(valorPago * 100) / 100, // Arredondar para 2 casas decimais
                tipoAtualizacao: TipoAtualizacao.VALOR_CLIENTE,
              });

              const vendaAtualizada = await this.vendaRepository.findOne({
                where: { id: venda.id },
              });

              if (vendaAtualizada) {
                sucesso.push(vendaAtualizada);
              }
            } else {
              falhas.push({
                id: venda.id,
                protocolo: venda.protocolo,
                motivo: `Protocolo ${venda.protocolo} não encontrado no Formula Certa`,
              });
            }
            continue;
          }

          // Atualizar valor de compra e valor pago (35% de desconto)
          const valorPago = valorCompra * 0.65; // 35% de desconto

          await this.vendaRepository.update(venda.id, {
            valorCompra,
            valorPago: Math.round(valorPago * 100) / 100, // Arredondar para 2 casas decimais
            tipoAtualizacao: TipoAtualizacao.FORMULA_CERTA_AGENTE,
          });

          const vendaAtualizada = await this.vendaRepository.findOne({
            where: { id: venda.id },
          });

          if (vendaAtualizada) {
            sucesso.push(vendaAtualizada);
          }
        }
      } catch (error: any) {
        this.logger.error(
          `[atualizarValorCompraEmMassa] Erro ao processar vendas de origem ${origem}:`,
          error,
        );

        // Se o usuário quer atualizar com valor do cliente, atualizar mesmo em caso de erro
        if (dto.atualizarComValorCliente === true) {
          // Processar apenas vendas válidas (com protocolo válido)
          for (const venda of vendasGrupo) {
            if (!venda.protocolo) {
              falhas.push({
                id: venda.id,
                protocolo: venda.protocolo,
                motivo: 'Protocolo inválido. O protocolo deve conter apenas números.',
              });
              continue;
            }

            const protocoloStr = venda.protocolo.toString().trim();
            if (!/^\d+$/.test(protocoloStr)) {
              falhas.push({
                id: venda.id,
                protocolo: venda.protocolo,
                motivo: 'Protocolo inválido. O protocolo deve conter apenas números.',
              });
              continue;
            }

            // Atualizar com valor do cliente
            const valorCliente = Number(venda.valorCliente || 0);
            const valorPago = valorCliente * 0.65; // 35% de desconto

            await this.vendaRepository.update(venda.id, {
              valorCompra: valorCliente,
              valorPago: Math.round(valorPago * 100) / 100, // Arredondar para 2 casas decimais
              tipoAtualizacao: TipoAtualizacao.VALOR_CLIENTE,
            });

            const vendaAtualizada = await this.vendaRepository.findOne({
              where: { id: venda.id },
            });

            if (vendaAtualizada) {
              sucesso.push(vendaAtualizada);
            }
          }
        } else {
          // Se não quiser atualizar com valor do cliente, adicionar às falhas
          let errorMessage = 'Erro ao buscar valor de compra no agente';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'object' && error !== null) {
            errorMessage = (error as any).message || JSON.stringify(error);
          }

          for (const venda of vendasGrupo) {
            falhas.push({
              id: venda.id,
              protocolo: venda.protocolo,
              motivo: errorMessage,
            });
          }
        }
      }
    }

    return { sucesso, falhas };
  }

  private getNomeUnidadePorOrigem(origem: VendaOrigem): string {
    const nomes: Record<VendaOrigem, string> = {
      [VendaOrigem.INHUMAS]: 'Inhumas',
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
      [VendaOrigem.GOIANIA]: 'Goiânia',
      [VendaOrigem.RIBEIRAO_PRETO]: 'Ribeirão Preto',
      [VendaOrigem.OUTRO]: 'Outro',
    };
    return nomes[origem] || origem;
  }

  private getAgenteConfigByOrigem(origem: VendaOrigem): {
    url: string;
    token: string;
    unit: number;
  } | null {
    const agentes = this.configService.get('agentes');
    if (!agentes) {
      this.logger.warn('[getAgenteConfigByOrigem] Configuração de agentes não encontrada');
      return null;
    }

    let config: { url: string; token: string; unit: number } | null = null;

    switch (origem) {
      case VendaOrigem.INHUMAS:
        config = agentes.inhumas || null;
        break;
      case VendaOrigem.UBERABA:
        config = agentes.uberaba || null;
        break;
      case VendaOrigem.NEROPOLIS:
        config = agentes.neropolis || null;
        break;
      default:
        this.logger.warn(`[getAgenteConfigByOrigem] Origem não mapeada: ${origem}`);
        return null;
    }

    if (config && (!config.url || !config.token)) {
      this.logger.warn(
        `[getAgenteConfigByOrigem] Configuração incompleta para origem ${origem}`,
      );
      return null;
    }

    return config;
  }
}
