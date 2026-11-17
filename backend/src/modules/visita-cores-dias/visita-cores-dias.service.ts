import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  exigirUnidadeEscopo,
  resolverUnidadeEscopo,
  unidadeDoVisitador,
} from '../../common/utils/unidade-escopo.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CreateVisitaCorDiaDto } from './dto/create-visita-cor-dia.dto';
import { UpdateVisitaCorDiaDto } from './dto/update-visita-cor-dia.dto';
import { VisitaCorDia } from './entities/visita-cor-dia.entity';

@Injectable()
export class VisitaCoresDiasService {
  constructor(
    @InjectRepository(VisitaCorDia)
    private readonly repo: Repository<VisitaCorDia>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateVisitaCorDiaDto,
  ): Promise<VisitaCorDia> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = exigirUnidadeEscopo(usuario, dto.unidade);
    await this.garantirLimiteLivre(dto.diasAcimaDe, unidade);
    const entity = this.repo.create({
      diasAcimaDe: dto.diasAcimaDe,
      cor: dto.cor,
      unidade,
      ativo: dto.ativo ?? true,
    });
    return this.repo.save(entity);
  }

  async findAll(
    usuarioId: string,
    unidadeFiltro?: string,
  ): Promise<VisitaCorDia[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = resolverUnidadeEscopo(usuario, unidadeFiltro);
    return this.repo.find({
      where: unidade ? { unidade } : {},
      order: { unidade: 'ASC', diasAcimaDe: 'ASC' },
    });
  }

  async findAtivas(usuarioId: string): Promise<VisitaCorDia[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = unidadeDoVisitador(usuario);
    if (!unidade) return [];
    return this.repo.find({
      where: { ativo: true, unidade },
      order: { diasAcimaDe: 'DESC' },
    });
  }

  async findOne(usuarioId: string, id: string): Promise<VisitaCorDia> {
    const usuario = await this.carregarUsuario(usuarioId);
    const faixa = await this.repo.findOne({ where: { id } });
    if (!faixa) {
      throw new NotFoundException('Faixa de cor não encontrada.');
    }
    this.garantirAcesso(usuario, faixa.unidade);
    return faixa;
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateVisitaCorDiaDto,
  ): Promise<VisitaCorDia> {
    const entity = await this.findOne(usuarioId, id);
    if (dto.unidade !== undefined && dto.unidade !== entity.unidade) {
      throw new BadRequestException('A unidade da faixa não pode ser alterada.');
    }
    if (dto.diasAcimaDe !== undefined) {
      await this.garantirLimiteLivre(dto.diasAcimaDe, entity.unidade, id);
      entity.diasAcimaDe = dto.diasAcimaDe;
    }
    if (dto.cor !== undefined) {
      entity.cor = dto.cor;
    }
    if (dto.ativo !== undefined) {
      entity.ativo = dto.ativo;
    }
    return this.repo.save(entity);
  }

  async remove(usuarioId: string, id: string): Promise<void> {
    await this.findOne(usuarioId, id);
    await this.repo.delete(id);
  }

  private garantirAcesso(usuario: Usuario, unidade: Unidade): void {
    const escopo = resolverUnidadeEscopo(usuario, null);
    if (escopo && escopo !== unidade) {
      throw new BadRequestException('Faixa de cor de outra unidade.');
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

  private async garantirLimiteLivre(
    diasAcimaDe: number,
    unidade: Unidade,
    ignorarId?: string,
  ): Promise<void> {
    const existe = await this.repo.findOne({
      where: ignorarId
        ? { diasAcimaDe, unidade, id: Not(ignorarId) }
        : { diasAcimaDe, unidade },
    });
    if (existe) {
      throw new ConflictException(
        `Já existe uma faixa para mais de ${diasAcimaDe} dias nesta unidade.`,
      );
    }
  }
}
