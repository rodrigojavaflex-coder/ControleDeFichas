import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../common/enums/permission.enum';
import { buildPermissionCatalog } from '../../common/utils/permission-catalog.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Perfil } from './entities/perfil.entity';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';

export type PerfilUsuarioVinculado = {
  id: string;
  nome: string;
  unidade: Usuario['unidade'] | null;
};

export type PerfilComEstatisticas = Perfil & {
  totalUsuarios: number;
  usuariosVinculados: PerfilUsuarioVinculado[];
};

@Injectable()
export class PerfilService {
  constructor(
    @InjectRepository(Perfil)
    private readonly perfilRepository: Repository<Perfil>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  create(createDto: CreatePerfilDto): Promise<Perfil> {
    const perfil = this.perfilRepository.create(createDto);
    return this.perfilRepository.save(perfil);
  }

  async findAll(): Promise<PerfilComEstatisticas[]> {
    const perfis = await this.perfilRepository.find({
      order: { nomePerfil: 'ASC' },
      relations: ['usuarios'],
    });

    return perfis.map(({ usuarios, ...perfil }) => {
      const usuariosVinculados = (usuarios ?? [])
        .map((u) => ({
          id: u.id,
          nome: u.nome,
          unidade: u.unidade ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return {
        ...perfil,
        totalUsuarios: usuariosVinculados.length,
        usuariosVinculados,
      };
    });
  }

  async findOne(id: string): Promise<Perfil> {
    const perfil = await this.perfilRepository.findOne({ where: { id } });
    if (!perfil) {
      throw new NotFoundException(`Perfil com id ${id} não encontrado`);
    }
    return perfil;
  }

  async update(id: string, updateDto: UpdatePerfilDto): Promise<Perfil> {
    const perfil = await this.findOne(id);
    Object.assign(perfil, updateDto);
    return this.perfilRepository.save(perfil);
  }

  async remove(id: string): Promise<void> {
    const perfil = await this.findOne(id);
    await this.perfilRepository.remove(perfil);
  }

  /**
   * Gera dados formatados para impressão de perfil (agrupados por módulo).
   */
  async getPrintData(id: string): Promise<{
    nomePerfil: string;
    printedAt: Date;
    users: string[];
    groups: { group: string; permissions: string[] }[];
  }> {
    const perfil = await this.findOne(id);
    const catalog = buildPermissionCatalog();
    const selected = new Set<Permission>(perfil.permissoes);

    const groups = catalog.modules.flatMap((mod) =>
      mod.groups
        .map((group) => ({
          group: `${mod.label} — ${group.label}`,
          permissions: group.permissions
            .filter((item) => selected.has(item.key))
            .map((item) => item.label),
        }))
        .filter((g) => g.permissions.length > 0),
    );

    const usuarios = await this.usuarioRepository
      .createQueryBuilder('usuario')
      .innerJoin('usuario.perfis', 'perfil', 'perfil.id = :perfilId', {
        perfilId: id,
      })
      .select(['usuario.nome'])
      .getMany();
    const users = usuarios.map((u) => u.nome);

    return {
      nomePerfil: perfil.nomePerfil,
      printedAt: new Date(),
      users,
      groups,
    };
  }
}
