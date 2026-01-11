import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescritor } from './entities/prescritor.entity';
import { CreatePrescritorDto } from './dto/create-prescritor.dto';
import { UpdatePrescritorDto } from './dto/update-prescritor.dto';
import { FindPrescritoresDto } from './dto/find-prescritores.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';

@Injectable()
export class PrescritoresService {
  private readonly logger = new Logger(PrescritoresService.name);

  constructor(
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
  ) {}

  async create(createPrescritorDto: CreatePrescritorDto): Promise<Prescritor> {
    try {
      // Verificar se já existe prescritor com mesmo nome
      const existing = await this.prescritorRepository.findOne({
        where: {
          nome: createPrescritorDto.nome,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Já existe um prescritor cadastrado com este nome: ${existing.nome}`,
        );
      }

      const prescritor = this.prescritorRepository.create(createPrescritorDto);
      return await this.prescritorRepository.save(prescritor);
    } catch (error) {
      this.logger.error('Error creating prescritor:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw error;
    }
  }

  async findAll(
    findPrescritoresDto: FindPrescritoresDto,
  ): Promise<PaginatedResponseDto<Prescritor>> {
    const { page = 1, limit = 10, nome, numeroCRM } = findPrescritoresDto;

    const queryBuilder = this.prescritorRepository.createQueryBuilder('prescritor');

    if (nome) {
      queryBuilder.andWhere('prescritor.nome ILIKE :nome', { nome: `%${nome}%` });
    }

    if (numeroCRM) {
      queryBuilder.andWhere('prescritor.numeroCRM = :numeroCRM', { numeroCRM });
    }

    const [prescritores, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('prescritor.nome', 'ASC')
      .getManyAndCount();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(prescritores, meta);
  }

  async findOne(id: string): Promise<Prescritor> {
    const prescritor = await this.prescritorRepository.findOne({
      where: { id },
    });

    if (!prescritor) {
      throw new NotFoundException(`Prescritor com ID ${id} não encontrado`);
    }

    return prescritor;
  }

  async update(
    id: string,
    updatePrescritorDto: UpdatePrescritorDto,
  ): Promise<Prescritor> {
    const prescritor = await this.findOne(id);

    // Verificar nome duplicado (se estiver alterando)
    if (
      updatePrescritorDto.nome &&
      updatePrescritorDto.nome !== prescritor.nome
    ) {
      const existing = await this.prescritorRepository.findOne({
        where: {
          nome: updatePrescritorDto.nome,
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Já existe um prescritor cadastrado com este nome: ${existing.nome}`,
        );
      }
    }

    Object.assign(prescritor, updatePrescritorDto);

    try {
      return await this.prescritorRepository.save(prescritor);
    } catch (error) {
      this.logger.error('Error updating prescritor:', error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const prescritor = await this.findOne(id);
    await this.prescritorRepository.remove(prescritor);
  }

  async search(nome: string, limit: number = 20): Promise<Prescritor[]> {
    const queryBuilder = this.prescritorRepository.createQueryBuilder('prescritor');

    if (nome && nome.trim()) {
      queryBuilder.andWhere('prescritor.nome ILIKE :nome', { nome: `%${nome.trim()}%` });
    }

    return await queryBuilder
      .orderBy('prescritor.nome', 'ASC')
      .take(limit)
      .getMany();
  }
}

