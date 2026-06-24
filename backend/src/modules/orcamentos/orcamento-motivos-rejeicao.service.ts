import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrcamentoMotivoRejeicao } from './entities/orcamento-motivo-rejeicao.entity';
import { Orcamento } from './entities/orcamento.entity';
import { CreateOrcamentoMotivoRejeicaoDto } from './dto/create-orcamento-motivo-rejeicao.dto';
import { UpdateOrcamentoMotivoRejeicaoDto } from './dto/update-orcamento-motivo-rejeicao.dto';

@Injectable()
export class OrcamentoMotivosRejeicaoService {
  constructor(
    @InjectRepository(OrcamentoMotivoRejeicao)
    private readonly motivoRepo: Repository<OrcamentoMotivoRejeicao>,
    @InjectRepository(Orcamento)
    private readonly orcamentoRepo: Repository<Orcamento>,
  ) {}

  async create(
    dto: CreateOrcamentoMotivoRejeicaoDto,
  ): Promise<OrcamentoMotivoRejeicao> {
    const entity = this.motivoRepo.create({
      descricao: dto.descricao.trim(),
      ativo: dto.ativo ?? true,
    });
    return this.motivoRepo.save(entity);
  }

  async findAll(apenasAtivos?: boolean): Promise<OrcamentoMotivoRejeicao[]> {
    const where = apenasAtivos ? { ativo: true } : {};
    return this.motivoRepo.find({
      where,
      order: { descricao: 'ASC' },
    });
  }

  async findOne(id: string): Promise<OrcamentoMotivoRejeicao> {
    const motivo = await this.motivoRepo.findOne({ where: { id } });
    if (!motivo) {
      throw new NotFoundException(`Motivo de rejeição ${id} não encontrado`);
    }
    return motivo;
  }

  async update(
    id: string,
    dto: UpdateOrcamentoMotivoRejeicaoDto,
  ): Promise<OrcamentoMotivoRejeicao> {
    const entity = await this.findOne(id);
    if (dto.descricao !== undefined) {
      entity.descricao = dto.descricao.trim();
    }
    if (dto.ativo !== undefined) {
      entity.ativo = dto.ativo;
    }
    return this.motivoRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const emUso = await this.orcamentoRepo.count({
      where: { motivoRejeicaoId: id },
    });
    if (emUso > 0) {
      throw new ConflictException(
        'Este motivo já está vinculado a orçamentos rejeitados. Inative-o em vez de excluir.',
      );
    }
    await this.motivoRepo.delete(id);
  }
}
