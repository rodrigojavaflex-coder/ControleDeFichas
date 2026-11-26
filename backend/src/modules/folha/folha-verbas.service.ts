import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolhaVerba } from './entities/folha-verba.entity';
import { FolhaItem } from './entities/folha-item.entity';
import { CreateFolhaVerbaDto } from './dto/create-folha-verba.dto';
import { UpdateFolhaVerbaDto } from './dto/update-folha-verba.dto';
import { FolhaMovimentoTipo } from '../../common/enums/folha-movimento-tipo.enum';

@Injectable()
export class FolhaVerbasService {
  constructor(
    @InjectRepository(FolhaVerba)
    private readonly verbaRepo: Repository<FolhaVerba>,
    @InjectRepository(FolhaItem)
    private readonly itemRepo: Repository<FolhaItem>,
  ) {}

  private normalizarEhComissao(
    tipoMovimento: FolhaMovimentoTipo,
    ehComissao?: boolean,
  ): boolean {
    if (tipoMovimento === FolhaMovimentoTipo.DESPESA) {
      return false;
    }
    return ehComissao === true;
  }

  async create(dto: CreateFolhaVerbaDto): Promise<FolhaVerba> {
    const entity = this.verbaRepo.create({
      descricao: dto.descricao,
      tipoMovimento: dto.tipoMovimento,
      ativo: dto.ativo ?? true,
      ehComissao: this.normalizarEhComissao(dto.tipoMovimento, dto.ehComissao),
    });
    return this.verbaRepo.save(entity);
  }

  async findAll(): Promise<FolhaVerba[]> {
    return this.verbaRepo.find({ order: { descricao: 'ASC' } });
  }

  async findOne(id: string): Promise<FolhaVerba> {
    const v = await this.verbaRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException(`Verba ${id} não encontrada`);
    return v;
  }

  async update(id: string, dto: UpdateFolhaVerbaDto): Promise<FolhaVerba> {
    const entity = await this.findOne(id);
    if (dto.descricao !== undefined) entity.descricao = dto.descricao;
    if (dto.tipoMovimento !== undefined) entity.tipoMovimento = dto.tipoMovimento;
    if (dto.ativo !== undefined) entity.ativo = dto.ativo;
    const tipoFinal = entity.tipoMovimento;
    const ehInformado =
      dto.ehComissao !== undefined ? dto.ehComissao : entity.ehComissao;
    entity.ehComissao = this.normalizarEhComissao(tipoFinal, ehInformado);
    return this.verbaRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const emUso = await this.itemRepo.count({
      where: { folhaVerba: { id } },
    });
    if (emUso > 0) {
      throw new ConflictException(
        'Esta verba já foi utilizada em lançamentos. Não é possível excluir o cadastro; inative-a se não for mais usar.',
      );
    }
    await this.verbaRepo.delete(id);
  }
}
