import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolhaCargo } from './entities/folha-cargo.entity';
import { Funcionario } from './entities/funcionario.entity';
import { CreateFolhaCargoDto } from './dto/create-folha-cargo.dto';
import { UpdateFolhaCargoDto } from './dto/update-folha-cargo.dto';

@Injectable()
export class FolhaCargosService {
  constructor(
    @InjectRepository(FolhaCargo)
    private readonly repo: Repository<FolhaCargo>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
  ) {}

  async create(dto: CreateFolhaCargoDto): Promise<FolhaCargo> {
    const entity = this.repo.create({
      descricao: dto.descricao.trim(),
      ativo: dto.ativo ?? true,
    });
    return this.repo.save(entity);
  }

  async findAll(): Promise<FolhaCargo[]> {
    return this.repo.find({ order: { descricao: 'ASC' } });
  }

  async findOne(id: string): Promise<FolhaCargo> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Cargo ${id} não encontrado`);
    return row;
  }

  async update(id: string, dto: UpdateFolhaCargoDto): Promise<FolhaCargo> {
    const entity = await this.findOne(id);
    if (dto.descricao !== undefined) {
      entity.descricao = dto.descricao.trim();
    }
    if (dto.ativo !== undefined) {
      entity.ativo = dto.ativo;
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const emUso = await this.funcionarioRepo.count({
      where: { cargo: { id } },
    });
    if (emUso > 0) {
      throw new ConflictException(
        'Este cargo está vinculado a funcionários. Não é possível excluir; inative-o se não for mais usar.',
      );
    }
    await this.repo.delete(id);
  }
}
