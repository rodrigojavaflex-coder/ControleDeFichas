import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FichaTecnica } from './entities/ficha-tecnica.entity';
import { CreateFichaTecnicaDto, UpdateFichaTecnicaDto, FindFichaTecnicaDto } from './dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class FichaTecnicaService {
  constructor(
    @InjectRepository(FichaTecnica)
    private readonly fichaTecnicaRepository: Repository<FichaTecnica>,
  ) {}

  async create(createFichaTecnicaDto: CreateFichaTecnicaDto): Promise<FichaTecnica> {
    try {
      const fichaTecnica = this.fichaTecnicaRepository.create(createFichaTecnicaDto);
      return await this.fichaTecnicaRepository.save(fichaTecnica);
    } catch (error) {
      throw new BadRequestException('Erro ao criar ficha técnica: ' + error.message);
    }
  }

  async findAll(query: FindFichaTecnicaDto): Promise<PaginatedResponseDto<FichaTecnica>> {
    try {
      const { page = 1, limit = 10, ...filters } = query;
      
      const queryBuilder = this.fichaTecnicaRepository.createQueryBuilder('ficha');

      // Filtros por campos específicos
      if (filters.codigoFormulaCerta) {
        queryBuilder.andWhere('ficha.codigoFormulaCerta = :codigoFormulaCerta', {
          codigoFormulaCerta: filters.codigoFormulaCerta,
        });
      }

      if (filters.produto) {
        queryBuilder.andWhere('LOWER(ficha.produto) LIKE LOWER(:produto)', {
          produto: `%${filters.produto}%`,
        });
      }

      if (filters.dcb) {
        queryBuilder.andWhere('LOWER(ficha.dcb) LIKE LOWER(:dcb)', {
          dcb: `%${filters.dcb}%`,
        });
      }

      if (filters.nomeCientifico) {
        queryBuilder.andWhere('LOWER(ficha.nomeCientifico) LIKE LOWER(:nomeCientifico)', {
          nomeCientifico: `%${filters.nomeCientifico}%`,
        });
      }

      if (filters.revisao) {
        queryBuilder.andWhere('LOWER(ficha.revisao) LIKE LOWER(:revisao)', {
          revisao: `%${filters.revisao}%`,
        });
      }

      // Filtro por data de análise
      if (filters.dataInicialAnalise) {
        queryBuilder.andWhere('ficha.dataDeAnalise >= :dataInicial', {
          dataInicial: filters.dataInicialAnalise,
        });
      }

      if (filters.dataFinalAnalise) {
        queryBuilder.andWhere('ficha.dataDeAnalise <= :dataFinal', {
          dataFinal: filters.dataFinalAnalise,
        });
      }

      // Busca geral em múltiplos campos
      if (filters.search) {
        queryBuilder.andWhere(
          '(LOWER(ficha.produto) LIKE LOWER(:search) OR ' +
          'LOWER(ficha.dcb) LIKE LOWER(:search) OR ' +
          'LOWER(ficha.nomeCientifico) LIKE LOWER(:search) OR ' +
          'LOWER(ficha.formulaMolecular) LIKE LOWER(:search) OR ' +
          'LOWER(ficha.pesoMolecular) LIKE LOWER(:search) OR ' +
          'CAST(ficha.codigoFormulaCerta AS TEXT) LIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      // Ordenação padrão
      queryBuilder.orderBy('ficha.createdAt', 'DESC');

      // Paginação
      const skip = (page - 1) * limit;
      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      const meta = new PaginationMetaDto(page, limit, total);
      
      return new PaginatedResponseDto(data, meta);
    } catch (error) {
      throw new BadRequestException('Erro ao buscar fichas técnicas: ' + error.message);
    }
  }

  async findOne(id: string): Promise<FichaTecnica> {
    try {
      const fichaTecnica = await this.fichaTecnicaRepository.findOne({
        where: { id },
      });

      if (!fichaTecnica) {
        throw new NotFoundException('Ficha técnica não encontrada');
      }

      return fichaTecnica;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erro ao buscar ficha técnica: ' + error.message);
    }
  }

  async findByCodigoFormulaCerta(codigoFormulaCerta: string): Promise<FichaTecnica> {
    try {
      const fichaTecnica = await this.fichaTecnicaRepository.findOne({
        where: { codigoFormulaCerta },
      });

      if (!fichaTecnica) {
        throw new NotFoundException(`Ficha técnica com código ${codigoFormulaCerta} não encontrada`);
      }

      return fichaTecnica;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erro ao buscar ficha técnica: ' + error.message);
    }
  }

  async update(id: string, updateFichaTecnicaDto: UpdateFichaTecnicaDto): Promise<FichaTecnica> {
    try {
      const fichaTecnica = await this.findOne(id);
      
      Object.assign(fichaTecnica, updateFichaTecnicaDto);
      
      return await this.fichaTecnicaRepository.save(fichaTecnica);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erro ao atualizar ficha técnica: ' + error.message);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const fichaTecnica = await this.findOne(id);
      await this.fichaTecnicaRepository.remove(fichaTecnica);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erro ao remover ficha técnica: ' + error.message);
    }
  }

  async count(): Promise<number> {
    try {
      return await this.fichaTecnicaRepository.count();
    } catch (error) {
      throw new BadRequestException('Erro ao contar fichas técnicas: ' + error.message);
    }
  }

  async findRecentFichas(limit: number = 5): Promise<FichaTecnica[]> {
    try {
      return await this.fichaTecnicaRepository.find({
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      throw new BadRequestException('Erro ao buscar fichas técnicas recentes: ' + error.message);
    }
  }
}