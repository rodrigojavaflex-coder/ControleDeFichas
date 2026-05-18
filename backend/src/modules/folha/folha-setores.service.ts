import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolhaSetor } from './entities/folha-setor.entity';
import { Funcionario } from './entities/funcionario.entity';
import { CreateFolhaSetorDto } from './dto/create-folha-setor.dto';
import { UpdateFolhaSetorDto } from './dto/update-folha-setor.dto';

@Injectable()
export class FolhaSetoresService {
  constructor(
    @InjectRepository(FolhaSetor)
    private readonly repo: Repository<FolhaSetor>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
  ) {}

  async create(dto: CreateFolhaSetorDto): Promise<FolhaSetor> {
    const entity = this.repo.create({
      descricao: dto.descricao.trim(),
      ativo: dto.ativo ?? true,
    });
    return this.repo.save(entity);
  }

  async findAll(): Promise<FolhaSetor[]> {
    return this.repo.find({ order: { descricao: 'ASC' } });
  }

  async findOne(id: string): Promise<FolhaSetor> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Setor ${id} não encontrado`);
    return row;
  }

  async update(id: string, dto: UpdateFolhaSetorDto): Promise<FolhaSetor> {
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
      where: { setor: { id } },
    });
    if (emUso > 0) {
      throw new ConflictException(
        'Este setor está vinculado a funcionários. Não é possível excluir; inative-o se não for mais usar.',
      );
    }
    await this.repo.delete(id);
  }
}
