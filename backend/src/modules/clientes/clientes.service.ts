import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FindClientesDto } from './dto/find-clientes.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { Unidade } from '../../common/enums/unidade.enum';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
  ) {}

  async create(createClienteDto: CreateClienteDto): Promise<Cliente> {
    try {
      // Verificar se já existe cliente com mesmo CPF (se informado)
      if (createClienteDto.cpf) {
        const existingByCpf = await this.clienteRepository.findOne({
          where: { cpf: createClienteDto.cpf },
        });
        if (existingByCpf) {
          throw new ConflictException(
            `Já existe um cliente cadastrado com este CPF: ${existingByCpf.nome} (${existingByCpf.cpf})`,
          );
        }
      }

      // Verificar se já existe cliente com mesmo nome e unidade
      const existingByNome = await this.clienteRepository.findOne({
        where: {
          nome: createClienteDto.nome,
          unidade: createClienteDto.unidade,
        },
      });
      if (existingByNome) {
        throw new ConflictException(
          `Já existe um cliente cadastrado com este nome na unidade ${createClienteDto.unidade}: ${existingByNome.nome}`,
        );
      }

      const cliente = this.clienteRepository.create(createClienteDto);
      return await this.clienteRepository.save(cliente);
    } catch (error) {
      this.logger.error('Error creating cliente:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw error;
    }
  }

  async findAll(
    findClientesDto: FindClientesDto,
  ): Promise<PaginatedResponseDto<Cliente>> {
    const { page = 1, limit = 10, nome, cpf, unidade } = findClientesDto;

    const queryBuilder = this.clienteRepository.createQueryBuilder('cliente');

    if (nome) {
      queryBuilder.andWhere('cliente.nome ILIKE :nome', { nome: `%${nome}%` });
    }

    if (cpf) {
      queryBuilder.andWhere('cliente.cpf ILIKE :cpf', { cpf: `%${cpf}%` });
    }

    if (unidade) {
      queryBuilder.andWhere('cliente.unidade = :unidade', { unidade });
    }

    const [clientes, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('cliente.nome', 'ASC')
      .getManyAndCount();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(clientes, meta);
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`);
    }

    return cliente;
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
  ): Promise<Cliente> {
    const cliente = await this.findOne(id);

    // Verificar CPF duplicado (se estiver alterando)
    if (updateClienteDto.cpf && updateClienteDto.cpf !== cliente.cpf) {
      const existingByCpf = await this.clienteRepository.findOne({
        where: { cpf: updateClienteDto.cpf },
      });
      if (existingByCpf && existingByCpf.id !== id) {
        throw new ConflictException(
          `Já existe um cliente cadastrado com este CPF: ${existingByCpf.nome} (${existingByCpf.cpf})`,
        );
      }
    }

    // Verificar nome duplicado na mesma unidade (se estiver alterando)
    if (
      updateClienteDto.nome &&
      updateClienteDto.nome !== cliente.nome &&
      (updateClienteDto.unidade || cliente.unidade)
    ) {
      const unidadeCheck = updateClienteDto.unidade || cliente.unidade;
      const existingByNome = await this.clienteRepository.findOne({
        where: {
          nome: updateClienteDto.nome,
          unidade: unidadeCheck,
        },
      });
      if (existingByNome && existingByNome.id !== id) {
        throw new ConflictException(
          `Já existe um cliente cadastrado com este nome na unidade ${unidadeCheck}: ${existingByNome.nome}`,
        );
      }
    }

    // Atualizar campos
    Object.assign(cliente, updateClienteDto);

    try {
      return await this.clienteRepository.save(cliente);
    } catch (error) {
      this.logger.error('Error updating cliente:', error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const cliente = await this.findOne(id);
    await this.clienteRepository.remove(cliente);
  }

  async search(nome: string, unidade?: Unidade, limit: number = 20): Promise<Cliente[]> {
    const queryBuilder = this.clienteRepository.createQueryBuilder('cliente');

    if (nome && nome.trim()) {
      queryBuilder.andWhere('cliente.nome ILIKE :nome', { nome: `%${nome.trim()}%` });
    }

    if (unidade) {
      queryBuilder.andWhere('cliente.unidade = :unidade', { unidade });
    }

    return await queryBuilder
      .orderBy('cliente.nome', 'ASC')
      .take(limit)
      .getMany();
  }
}

