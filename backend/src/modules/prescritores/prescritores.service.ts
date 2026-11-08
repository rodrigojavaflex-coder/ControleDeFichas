import {
  Injectable,
  ConflictException,
  ForbiddenException,
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
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class PrescritoresService {
  private readonly logger = new Logger(PrescritoresService.name);

  constructor(
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
  ) {}

  async create(
    createPrescritorDto: CreatePrescritorDto,
    usuario?: Usuario,
  ): Promise<Prescritor> {
    try {
      const pfcrm =
        createPrescritorDto.pfcrm?.trim()?.toUpperCase() || '1';
      const unidade = this.unidadeParaGravar(
        usuario,
        createPrescritorDto.unidade ?? null,
      );

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
            this.mensagemCrmDuplicado(
              mesmaTriade,
              createPrescritorDto.numeroCRM,
              createPrescritorDto.UFCRM,
              pfcrm,
              unidade,
            ),
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
    usuario?: Usuario,
  ): Promise<PaginatedResponseDto<Prescritor>> {
    const { page = 1, limit = 10, nome, numeroCRM, pfcrm } =
      findPrescritoresDto;
    const unidade = this.unidadeDaConsulta(usuario, findPrescritoresDto.unidade);

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

  async findOne(id: string, usuario?: Usuario): Promise<Prescritor> {
    const prescritor = await this.prescritorRepository.findOne({
      where: { id },
    });

    if (!prescritor) {
      throw new NotFoundException(`Prescritor com ID ${id} não encontrado`);
    }

    this.exigirMesmaUnidade(usuario, prescritor.unidade ?? null);
    return prescritor;
  }

  async update(
    id: string,
    updatePrescritorDto: UpdatePrescritorDto,
    usuario?: Usuario,
  ): Promise<Prescritor> {
    const prescritor = await this.findOne(id, usuario);

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
    const nextUnidade = this.unidadeParaGravar(
      usuario,
      updatePrescritorDto.unidade !== undefined
        ? updatePrescritorDto.unidade
        : prescritor.unidade ?? null,
    );

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
          this.mensagemCrmDuplicado(
            conflito,
            nextCrm,
            nextUf,
            nextPf,
            nextUnidade,
          ),
        );
      }
    }

    Object.assign(prescritor, {
      ...updatePrescritorDto,
      unidade: nextUnidade,
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

  async remove(id: string, usuario?: Usuario): Promise<void> {
    const prescritor = await this.findOne(id, usuario);
    await this.prescritorRepository.remove(prescritor);
  }

  async search(
    nome: string,
    limit: number = 20,
    usuario?: Usuario,
  ): Promise<Prescritor[]> {
    const queryBuilder =
      this.prescritorRepository.createQueryBuilder('prescritor');

    if (nome && nome.trim()) {
      queryBuilder.andWhere('prescritor.nome ILIKE :nome', {
        nome: `%${nome.trim()}%`,
      });
    }

    const vinculo = this.unidadeVinculada(usuario);
    if (vinculo) {
      queryBuilder.andWhere('prescritor.unidade = :unidadeEscopo', {
        unidadeEscopo: vinculo,
      });
    }

    return await queryBuilder
      .orderBy('prescritor.nome', 'ASC')
      .take(limit)
      .getMany();
  }

  private unidadeVinculada(usuario?: Usuario): Unidade | null {
    const valor = usuario?.unidade?.trim() ?? '';
    if (!valor) return null;
    return (Object.values(Unidade) as string[]).includes(valor)
      ? (valor as Unidade)
      : null;
  }

  private unidadeDaConsulta(
    usuario: Usuario | undefined,
    unidadeFiltro?: string,
  ): string | undefined {
    return this.unidadeVinculada(usuario) ?? unidadeFiltro;
  }

  private unidadeParaGravar(
    usuario: Usuario | undefined,
    unidadeInformada: Unidade | null,
  ): Unidade | null {
    return this.unidadeVinculada(usuario) ?? unidadeInformada;
  }

  private mensagemCrmDuplicado(
    existente: Prescritor,
    crm: number,
    uf: string,
    pfcrm: string,
    unidade: Unidade | null,
  ): string {
    const nome = existente.nome?.trim() || 'sem nome';
    const loja = unidade
      ? `na unidade ${unidade}`
      : 'sem unidade';
    return `O prescritor ${nome} já possui o CRM ${crm}/${uf} e a profissão ${pfcrm}, ${loja}.`;
  }

  private exigirMesmaUnidade(
    usuario: Usuario | undefined,
    unidadePrescritor: Unidade | null,
  ): void {
    const vinculo = this.unidadeVinculada(usuario);
    if (!vinculo) return;
    if (unidadePrescritor !== vinculo) {
      throw new ForbiddenException(
        'Você só pode consultar e alterar prescritores da sua unidade.',
      );
    }
  }
}
