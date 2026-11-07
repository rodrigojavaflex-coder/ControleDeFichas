import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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
      const pfcrm =
        createPrescritorDto.pfcrm?.trim()?.toUpperCase() || '1';
      const unidade = createPrescritorDto.unidade ?? null;

      if (
        createPrescritorDto.numeroCRM != null &&
        createPrescritorDto.UFCRM
      ) {
        const mesmaTriade = await this.prescritorRepository.findOne({
          where: {
            numeroCRM: createPrescritorDto.numeroCRM,
            UFCRM: createPrescritorDto.UFCRM,
            pfcrm,
            unidade: unidade ?? IsNull(),
          },
        });
        if (mesmaTriade) {
          throw new ConflictException(
            `Já existe prescritor com CRM ${createPrescritorDto.numeroCRM}/${createPrescritorDto.UFCRM}, profissão ${pfcrm} e unidade ${unidade ?? 'sem unidade'}`,
          );
        }
      }

      const prescritor = this.prescritorRepository.create({
        ...createPrescritorDto,
        pfcrm,
        unidade,
      });
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
    const { page = 1, limit = 10, nome, numeroCRM, pfcrm, unidade } =
      findPrescritoresDto;

    const queryBuilder =
      this.prescritorRepository.createQueryBuilder('prescritor');

    if (nome) {
      queryBuilder.andWhere('prescritor.nome ILIKE :nome', {
        nome: `%${nome}%`,
      });
    }

    if (numeroCRM) {
      queryBuilder.andWhere('prescritor.numeroCRM = :numeroCRM', { numeroCRM });
    }

    if (pfcrm?.trim()) {
      queryBuilder.andWhere('UPPER(BTRIM(prescritor.pfcrm)) = :pfcrm', {
        pfcrm: pfcrm.trim().toUpperCase(),
      });
    }

    if (unidade === 'SEM') {
      queryBuilder.andWhere('prescritor.unidade IS NULL');
    } else if (unidade) {
      queryBuilder.andWhere('prescritor.unidade = :unidade', { unidade });
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

    const nextCrm =
      updatePrescritorDto.numeroCRM !== undefined
        ? updatePrescritorDto.numeroCRM
        : prescritor.numeroCRM;
    const nextUf =
      updatePrescritorDto.UFCRM !== undefined
        ? updatePrescritorDto.UFCRM
        : prescritor.UFCRM;
    const nextPf =
      (
        updatePrescritorDto.pfcrm !== undefined
          ? updatePrescritorDto.pfcrm
          : prescritor.pfcrm
      )
        ?.trim()
        ?.toUpperCase() || '1';
    const nextUnidade =
      updatePrescritorDto.unidade !== undefined
        ? updatePrescritorDto.unidade
        : prescritor.unidade ?? null;

    if (nextCrm != null && nextUf) {
      const conflito = await this.prescritorRepository.findOne({
        where: {
          numeroCRM: nextCrm,
          UFCRM: nextUf,
          pfcrm: nextPf,
          unidade: nextUnidade ?? IsNull(),
        },
      });
      if (conflito && conflito.id !== id) {
        throw new ConflictException(
          `Já existe prescritor com CRM ${nextCrm}/${nextUf}, profissão ${nextPf} e unidade ${nextUnidade ?? 'sem unidade'}`,
        );
      }
    }

    Object.assign(prescritor, {
      ...updatePrescritorDto,
      ...(updatePrescritorDto.pfcrm !== undefined
        ? { pfcrm: nextPf }
        : {}),
    });

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
    const queryBuilder =
      this.prescritorRepository.createQueryBuilder('prescritor');

    if (nome && nome.trim()) {
      queryBuilder.andWhere('prescritor.nome ILIKE :nome', {
        nome: `%${nome.trim()}%`,
      });
    }

    return await queryBuilder
      .orderBy('prescritor.nome', 'ASC')
      .take(limit)
      .getMany();
  }
}
