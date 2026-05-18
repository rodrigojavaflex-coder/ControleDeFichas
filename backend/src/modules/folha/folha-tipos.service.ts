import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolhaTipo } from './entities/folha-tipo.entity';
import { FolhaCapa } from './entities/folha-capa.entity';
import { FolhaFechamento } from './entities/folha-fechamento.entity';
import { CreateFolhaTipoDto } from './dto/create-folha-tipo.dto';
import { UpdateFolhaTipoDto } from './dto/update-folha-tipo.dto';

@Injectable()
export class FolhaTiposService {
  constructor(
    @InjectRepository(FolhaTipo)
    private readonly tipoRepo: Repository<FolhaTipo>,
    @InjectRepository(FolhaCapa)
    private readonly capaRepo: Repository<FolhaCapa>,
    @InjectRepository(FolhaFechamento)
    private readonly fechoRepo: Repository<FolhaFechamento>,
  ) {}

  async create(dto: CreateFolhaTipoDto): Promise<FolhaTipo> {
    const entity = this.tipoRepo.create({
      descricao: dto.descricao,
      ativo: dto.ativo ?? true,
      ordenacao: dto.ordenacao ?? 0,
      folhaMensal: dto.folhaMensal ?? false,
    });
    return this.tipoRepo.save(entity);
  }

  async findAll(): Promise<FolhaTipo[]> {
    return this.tipoRepo.find({ order: { ordenacao: 'ASC', descricao: 'ASC' } });
  }

  async findOne(id: string): Promise<FolhaTipo> {
    const t = await this.tipoRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Tipo de folha ${id} não encontrado`);
    return t;
  }

  async update(id: string, dto: UpdateFolhaTipoDto): Promise<FolhaTipo> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.tipoRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const emCapas = await this.capaRepo.count({
      where: { folhaTipo: { id } },
    });
    const emFechamento = await this.fechoRepo.count({
      where: { folhaTipo: { id } },
    });
    if (emCapas > 0 || emFechamento > 0) {
      throw new ConflictException(
        'Este tipo já está referenciado em folhas ou fechamentos.',
      );
    }
    await this.tipoRepo.delete(id);
  }
}
