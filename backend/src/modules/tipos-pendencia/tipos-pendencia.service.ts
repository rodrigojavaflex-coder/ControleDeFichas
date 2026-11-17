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
  unidadeDoVisitador,
} from '../../common/utils/unidade-escopo.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CreateTipoPendenciaDto } from './dto/create-tipo-pendencia.dto';
import { UpdateTipoPendenciaDto } from './dto/update-tipo-pendencia.dto';
import { TipoPendencia } from './entities/tipo-pendencia.entity';
import {
  ResponsavelTipoPendenciaOpcao,
  TipoPendenciaItem,
  TipoPendenciaOpcao,
} from './tipos-pendencia.types';

@Injectable()
export class TiposPendenciaService {
  constructor(
    @InjectRepository(TipoPendencia)
    private readonly repo: Repository<TipoPendencia>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateTipoPendenciaDto,
  ): Promise<TipoPendenciaItem> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = exigirUnidadeEscopo(usuario, dto.unidade);
    await this.garantirNomeLivre(dto.nome, unidade);
    await this.garantirResponsavel(dto.responsavelId);
    const entity = this.repo.create({
      nome: dto.nome,
      descricao: dto.descricao,
      responsavelId: dto.responsavelId,
      unidade,
      ativo: dto.ativo ?? true,
    });
    const salva = await this.repo.save(entity);
    return this.obterItem(salva.id);
  }

  async findAll(
    usuarioId: string,
    opcoes?: { apenasAtivos?: boolean; unidade?: string },
  ): Promise<TipoPendenciaItem[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = resolverUnidadeEscopo(usuario, opcoes?.unidade);
    const where: string[] = [];
    const params: unknown[] = [];
    if (opcoes?.apenasAtivos) {
      where.push('t.ativo = true');
    }
    if (unidade) {
      params.push(unidade);
      where.push(`t.unidade = $${params.length}`);
    }
    const filtro = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.repo.query(
      `
      SELECT
        t.id,
        t.nome,
        t.descricao,
        t.unidade,
        t."responsavelId" AS "responsavelId",
        u.nome AS "responsavelNome",
        t.ativo,
        t."criadoEm" AS "criadoEm",
        t."atualizadoEm" AS "atualizadoEm"
      FROM tipos_pendencia t
      LEFT JOIN usuarios u ON u.id = t."responsavelId"
      ${filtro}
      ORDER BY t.unidade ASC, t.nome ASC
      `,
      params,
    );
    return (rows as Array<Record<string, unknown>>).map((row) =>
      this.mapItem(row),
    );
  }

  async listarAtivos(usuarioId: string): Promise<TipoPendenciaOpcao[]> {
    const usuario = await this.carregarUsuario(usuarioId);
    const unidade = unidadeDoVisitador(usuario);
    if (!unidade) return [];
    const itens = await this.findAll(usuarioId, {
      apenasAtivos: true,
      unidade,
    });
    return itens.map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao,
      responsavelId: item.responsavelId,
      responsavelNome: item.responsavelNome,
    }));
  }

  async findOne(usuarioId: string, id: string): Promise<TipoPendenciaItem> {
    const usuario = await this.carregarUsuario(usuarioId);
    const item = await this.obterItem(id);
    this.garantirAcesso(usuario, item.unidade as Unidade);
    return item;
  }

  async update(
    usuarioId: string,
    id: string,
    dto: UpdateTipoPendenciaDto,
  ): Promise<TipoPendenciaItem> {
    const usuario = await this.carregarUsuario(usuarioId);
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Tipo de pendência não encontrado.');
    }
    this.garantirAcesso(usuario, entity.unidade);
    if (dto.unidade !== undefined && dto.unidade !== entity.unidade) {
      throw new BadRequestException('A unidade do tipo não pode ser alterada.');
    }
    if (dto.nome !== undefined) {
      await this.garantirNomeLivre(dto.nome, entity.unidade, id);
      entity.nome = dto.nome;
    }
    if (dto.descricao !== undefined) {
      entity.descricao = dto.descricao;
    }
    if (dto.responsavelId !== undefined) {
      await this.garantirResponsavel(dto.responsavelId);
      entity.responsavelId = dto.responsavelId;
    }
    if (dto.ativo !== undefined) {
      entity.ativo = dto.ativo;
    }
    await this.repo.save(entity);
    return this.obterItem(id);
  }

  async remove(usuarioId: string, id: string): Promise<void> {
    await this.findOne(usuarioId, id);
    const emUso: unknown[] = await this.repo.manager.query(
      `SELECT 1 FROM solicitacoes WHERE "tipoPendenciaId" = $1 LIMIT 1`,
      [id],
    );
    if (emUso.length > 0) {
      throw new ConflictException(
        'Tipo em uso em pendência. Inative em vez de excluir.',
      );
    }
    await this.repo.delete(id);
  }

  async listarResponsaveis(): Promise<ResponsavelTipoPendenciaOpcao[]> {
    const rows = await this.usuarios.query(
      `
      SELECT id, nome
      FROM usuarios
      WHERE ativo = true
      ORDER BY nome ASC
      LIMIT 500
      `,
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      nome: String(row.nome ?? ''),
    }));
  }

  async exigirAtivo(
    id: string,
    unidadeEsperada?: string | null,
  ): Promise<TipoPendencia> {
    const tipo = await this.repo.findOne({ where: { id } });
    if (!tipo) {
      throw new BadRequestException('Tipo de pendência inválido.');
    }
    if (!tipo.ativo) {
      throw new BadRequestException('Tipo de pendência inativo.');
    }
    if (unidadeEsperada && tipo.unidade !== unidadeEsperada) {
      throw new BadRequestException(
        'O tipo de pendência é de outra unidade.',
      );
    }
    return tipo;
  }

  private async obterItem(id: string): Promise<TipoPendenciaItem> {
    const rows = await this.repo.query(
      `
      SELECT
        t.id,
        t.nome,
        t.descricao,
        t.unidade,
        t."responsavelId" AS "responsavelId",
        u.nome AS "responsavelNome",
        t.ativo,
        t."criadoEm" AS "criadoEm",
        t."atualizadoEm" AS "atualizadoEm"
      FROM tipos_pendencia t
      LEFT JOIN usuarios u ON u.id = t."responsavelId"
      WHERE t.id = $1
      LIMIT 1
      `,
      [id],
    );
    const row = (rows as Array<Record<string, unknown>>)[0];
    if (!row) {
      throw new NotFoundException('Tipo de pendência não encontrado.');
    }
    return this.mapItem(row);
  }

  private mapItem(row: Record<string, unknown>): TipoPendenciaItem {
    return {
      id: String(row.id),
      nome: String(row.nome ?? ''),
      descricao: String(row.descricao ?? ''),
      unidade: String(row.unidade ?? ''),
      responsavelId: String(row.responsavelId),
      responsavelNome: row.responsavelNome ? String(row.responsavelNome) : null,
      ativo: Boolean(row.ativo),
      criadoEm: this.iso(row.criadoEm),
      atualizadoEm: this.iso(row.atualizadoEm),
    };
  }

  private iso(valor: unknown): string {
    if (valor instanceof Date) return valor.toISOString();
    const data = new Date(String(valor ?? ''));
    return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
  }

  private garantirAcesso(usuario: Usuario, unidade: Unidade): void {
    const escopo = resolverUnidadeEscopo(usuario, null);
    if (escopo && escopo !== unidade) {
      throw new BadRequestException('Tipo de pendência de outra unidade.');
    }
  }

  private async garantirResponsavel(id: string): Promise<void> {
    const usuario = await this.usuarios.findOne({ where: { id, ativo: true } });
    if (!usuario) {
      throw new BadRequestException('Responsável inválido ou inativo.');
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
        'Já existe um tipo de pendência com este nome nesta unidade.',
      );
    }
  }
}
