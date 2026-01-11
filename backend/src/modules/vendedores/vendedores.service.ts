import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendedor } from './entities/vendedor.entity';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';
import { FindVendedoresDto } from './dto/find-vendedores.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { Unidade } from '../../common/enums/unidade.enum';

@Injectable()
export class VendedoresService {
  private readonly logger = new Logger(VendedoresService.name);

  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedorRepository: Repository<Vendedor>,
  ) {}

  async create(createVendedorDto: CreateVendedorDto): Promise<Vendedor> {
    try {
      // Verificar se já existe vendedor com mesmo nome e unidade
      const existing = await this.vendedorRepository.findOne({
        where: {
          nome: createVendedorDto.nome,
          unidade: createVendedorDto.unidade,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Já existe um vendedor cadastrado com este nome na unidade ${createVendedorDto.unidade}: ${existing.nome}`,
        );
      }

      const vendedor = this.vendedorRepository.create(createVendedorDto);
      return await this.vendedorRepository.save(vendedor);
    } catch (error) {
      this.logger.error('Error creating vendedor:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw error;
    }
  }

  async findAll(
    findVendedoresDto: FindVendedoresDto,
  ): Promise<PaginatedResponseDto<Vendedor>> {
    const { page = 1, limit = 10, nome, unidade } = findVendedoresDto;

    const queryBuilder = this.vendedorRepository.createQueryBuilder('vendedor');

    if (nome) {
      queryBuilder.andWhere('vendedor.nome ILIKE :nome', { nome: `%${nome}%` });
    }

    if (unidade) {
      queryBuilder.andWhere('vendedor.unidade = :unidade', { unidade });
    }

    const [vendedores, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('vendedor.nome', 'ASC')
      .getManyAndCount();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(vendedores, meta);
  }

  async findOne(id: string): Promise<Vendedor> {
    const vendedor = await this.vendedorRepository.findOne({
      where: { id },
    });

    if (!vendedor) {
      throw new NotFoundException(`Vendedor com ID ${id} não encontrado`);
    }

    return vendedor;
  }

  async update(
    id: string,
    updateVendedorDto: UpdateVendedorDto,
  ): Promise<Vendedor> {
    const vendedor = await this.findOne(id);

    // Verificar nome duplicado na mesma unidade (se estiver alterando)
    if (
      updateVendedorDto.nome &&
      updateVendedorDto.nome !== vendedor.nome &&
      (updateVendedorDto.unidade || vendedor.unidade)
    ) {
      const unidadeCheck = updateVendedorDto.unidade || vendedor.unidade;
      const existing = await this.vendedorRepository.findOne({
        where: {
          nome: updateVendedorDto.nome,
          unidade: unidadeCheck,
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Já existe um vendedor cadastrado com este nome na unidade ${unidadeCheck}: ${existing.nome}`,
        );
      }
    }

    Object.assign(vendedor, updateVendedorDto);

    try {
      return await this.vendedorRepository.save(vendedor);
    } catch (error) {
      this.logger.error('Error updating vendedor:', error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const vendedor = await this.findOne(id);
    await this.vendedorRepository.remove(vendedor);
  }

  async search(nome: string, unidade?: Unidade, limit: number = 20): Promise<Vendedor[]> {
    const queryBuilder = this.vendedorRepository.createQueryBuilder('vendedor');

    if (nome && nome.trim()) {
      queryBuilder.andWhere('vendedor.nome ILIKE :nome', { nome: `%${nome.trim()}%` });
    }

    if (unidade) {
      queryBuilder.andWhere('vendedor.unidade = :unidade', { unidade });
    }

    return await queryBuilder
      .orderBy('vendedor.nome', 'ASC')
      .take(limit)
      .getMany();
  }
}

