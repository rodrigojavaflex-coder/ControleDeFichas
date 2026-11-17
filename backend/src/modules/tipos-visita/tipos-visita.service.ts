import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  exigirUnidadeEscopo,
  resolverUnidadeEscopo,
} from '../../common/utils/unidade-escopo.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoVisita } from './entities/tipo-visita.entity';
import { CreateTipoVisitaDto } from './dto/create-tipo-visita.dto';
import { UpdateTipoVisitaDto } from './dto/update-tipo-visita.dto';

@Injectable()
export class TiposVisitaService {
  constructor(
    @InjectRepository(TipoVisita)
    private readonly repo: Repository<TipoVisita>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(usuarioId: string, dto: CreateTipoVisitaDto): Promise<TipoVisita> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = exigirUnidadeEscopo(usuario, dto.unidade);
    await this.garantirNomeLivre(dto.nome, unidade);
    const entity = this.repo.create({
      nome: dto.nome,
      unidade,
      ativo: dto.ativo ?? true,
    });
    return this.repo.save(entity);
  }

  async findAll(
    usuarioId: string,
    opcoes?: { apenasAtivos?: boolean; unidade?: string },
  ): Promise<TipoVisita[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = resolverUnidadeEscopo(usuario, opcoes?.unidade);
    const where: { ativo?: boolean; unidade?: Unidade } = {};
    if (opcoes?.apenasAtivos) where.ativo = true;
    if (unidade) where.unidade = unidade;
    return this.repo.find({
      where,
      order: { unidade: 'ASC', nome: 'ASC' },
    });
  }

  async findAtivosDaUnidade(unidade: Unidade): Promise<TipoVisita[]> {
    return this.repo.find({
      where: { ativo: true, unidade },
      order: { nome: 'ASC' },
      select: { id: true, nome: true, unidade: true, ativo: true },
    });
  }

  async findOne(usuarioId: string, id: string): Promise<TipoVisita> {
    const usuario = await this.carregarUsuario(usuarioId);
    const tipo = await this.repo.findOne({ where: { id } });
    if (!tipo) {
      throw new NotFoundException('Tipo de visita não encontrado');
    }
    this.garantirAcesso(usuario, tipo.unidade);
    return tipo;
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateTipoVisitaDto,
  ): Promise<TipoVisita> {
    const entity = await this.findOne(usuarioId, id);
    if (dto.unidade !== undefined && dto.unidade !== entity.unidade) {
      throw new BadRequestException('A unidade do tipo não pode ser alterada.');
    }
    if (dto.nome !== undefined) {
      await this.garantirNomeLivre(dto.nome, entity.unidade, id);
      entity.nome = dto.nome;
    }
    if (dto.ativo !== undefined) {
      entity.ativo = dto.ativo;
    }
    return this.repo.save(entity);
  }

  async remove(usuarioId: string, id: string): Promise<void> {
    await this.findOne(usuarioId, id);
    const emUso: unknown[] = await this.repo.manager.query(
      `SELECT 1 FROM visitas WHERE "tipoVisitaId" = $1 LIMIT 1`,
      [id],
    );
    if (emUso.length > 0) {
      throw new ConflictException(
        'Tipo em uso em visita. Inative em vez de excluir.',
      );
    }
    await this.repo.delete(id);
  }

  private garantirAcesso(usuario: Usuario, unidade: Unidade): void {
    const escopo = resolverUnidadeEscopo(usuario, null);
    if (escopo && escopo !== unidade) {
      throw new BadRequestException('Tipo de visita de outra unidade.');
    }
  }

  private async carregarUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: ['funcionario'],
    });
    if (!usuario || !usuario.ativo) {
      throw new BadRequestException('Usuário inválido.');
    }
    return usuario;
  }

  private async garantirNomeLivre(
    nome: string,
    unidade: Unidade,
    ignorarId?: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('lower(t.nome) = lower(:nome)', { nome })
      .andWhere('t.unidade = :unidade', { unidade });
    if (ignorarId) {
      qb.andWhere('t.id <> :id', { id: ignorarId });
    }
    const existe = await qb.getOne();
    if (existe) {
      throw new ConflictException(
        'Já existe um tipo de visita com este nome nesta unidade.',
      );
    }
  }
}
