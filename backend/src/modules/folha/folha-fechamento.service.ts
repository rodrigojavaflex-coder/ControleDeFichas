import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import { FolhaFechamento } from './entities/folha-fechamento.entity';
import { FolhaTipo } from './entities/folha-tipo.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  FolhaCompetenciaGridRowDto,
  FolhaCompetenciaSituacaoGrid,
} from './dto/folha-competencia-grid-row.dto';
import { ListaFechamentoEscopo } from './utils/folha-unidade-scope.util';

export type FolhaFechamentoStatusDto = {
  fechado: boolean;
  fechadoEm: Date | null;
  id: string | null;
  /** Linha existe em `folha_fechamento` (abertura registrada). */
  registrada: boolean;
};

@Injectable()
export class FolhaFechamentoService {
  constructor(
    @InjectRepository(FolhaFechamento)
    private readonly fechamentoRepo: Repository<FolhaFechamento>,
  ) {}

  async getStatus(
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
  ): Promise<FolhaFechamentoStatusDto> {
    const row = await this.fechamentoRepo.findOne({
      where: {
        unidade,
        ano,
        mes,
        folhaTipo: { id: folhaTipoId },
      },
      relations: ['folhaTipo', 'fechadoPor'],
    });
    if (!row) {
      return {
        fechado: false,
        fechadoEm: null,
        id: null,
        registrada: false,
      };
    }
    return {
      fechado: row.fechado,
      fechadoEm: row.fechadoEm ?? null,
      id: row.id,
      registrada: true,
    };
  }

  async assertLoteAberto(
    unidade: Unidade,
    ano: number,
    mes: number,
    tipoId: string,
  ): Promise<void> {
    const row = await this.fechamentoRepo.findOne({
      where: {
        unidade,
        ano,
        mes,
        folhaTipo: { id: tipoId },
      },
    });
    if (!row) {
      throw new BadRequestException(
        'Competência não aberta para lançamentos. Registre a abertura em Folha › Controle das competências.',
      );
    }
    if (row.fechado) {
      throw new BadRequestException(
        'Este lote da folha está fechado. Não é possível alterar capas nem itens.',
      );
    }
  }

  /** Registra abertura da competência (linha em `folha_fechamento` com `fechado = false`). */
  async registrarAbertura(
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
    folhaTipoRef: FolhaTipo,
  ): Promise<FolhaFechamento> {
    const exists = await this.fechamentoRepo.findOne({
      where: {
        unidade,
        ano,
        mes,
        folhaTipo: { id: folhaTipoId },
      },
    });
    if (exists?.fechado) {
      throw new BadRequestException(
        'Esta competência está fechada. Reabra o lote em Folha › Controle das competências (ação Reabrir) antes de alterar registros.',
      );
    }
    if (exists && !exists.fechado) {
      throw new BadRequestException(
        'A abertura desta competência já está registrada.',
      );
    }
    const now = new Date();
    const row = this.fechamentoRepo.create({
      unidade,
      ano,
      mes,
      folhaTipo: folhaTipoRef,
      fechado: false,
      abertaEm: now,
    });
    return this.fechamentoRepo.save(row);
  }

  /** Lista competências já registradas (`folha_fechamento`): escopo opcional ALL; filtros por mês/tipo opcionais. */
  async listCompetenciasRegistradas(filters: {
    escopo: ListaFechamentoEscopo;
    ano: number;
    mes?: number;
    folhaTipoId?: string;
  }): Promise<FolhaCompetenciaGridRowDto[]> {
    const qb = this.fechamentoRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.folhaTipo', 't')
      .where('f.ano = :ano', { ano: filters.ano })
      .orderBy('f.unidade', 'ASC')
      .addOrderBy('f.mes', 'ASC')
      .addOrderBy('t.descricao', 'ASC');

    if (filters.escopo !== 'ALL') {
      qb.andWhere('f.unidade = :u', { u: filters.escopo });
    }
    if (filters.mes != null) {
      qb.andWhere('f.mes = :m', { m: filters.mes });
    }
    if (filters.folhaTipoId) {
      qb.andWhere('t.id = :tid', { tid: filters.folhaTipoId });
    }

    const fechos = await qb.getMany();
    return fechos.map((f) => ({
      unidade: f.unidade,
      mes: f.mes,
      folhaTipoId: f.folhaTipo.id,
      folhaTipoDescricao: f.folhaTipo.descricao,
      situacao: f.fechado
        ? FolhaCompetenciaSituacaoGrid.FECHADA
        : FolhaCompetenciaSituacaoGrid.ABERTA,
      fechamentoId: f.id,
      fechadoEm:
        f.fechadoEm != null
          ? f.fechadoEm instanceof Date
            ? f.fechadoEm.toISOString()
            : String(f.fechadoEm)
          : null,
      abertaEm:
        f.abertaEm != null
          ? f.abertaEm instanceof Date
            ? f.abertaEm.toISOString()
            : String(f.abertaEm)
          : null,
    }));
  }
  async fechar(
    usuario: Usuario,
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
    _folhaTipoRef: FolhaTipo,
  ): Promise<FolhaFechamento> {
    let row = await this.fechamentoRepo.findOne({
      where: {
        unidade,
        ano,
        mes,
        folhaTipo: { id: folhaTipoId },
      },
    });
    if (!row) {
      throw new BadRequestException(
        'Não há abertura registrada para esta competência. Registre a abertura antes de fechar o lote.',
      );
    }
    if (row.fechado) {
      throw new BadRequestException('Este lote já está fechado.');
    }
    row.fechado = true;
    row.fechadoEm = new Date();
    row.fechadoPor = usuario;
    return this.fechamentoRepo.save(row);
  }

  /** Reabre competência previamente fechada (`fechado = false`; limpa auditoria do fechamento). */
  async reabrir(
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
    _folhaTipoRef: FolhaTipo,
  ): Promise<FolhaFechamento> {
    const row = await this.fechamentoRepo.findOne({
      where: {
        unidade,
        ano,
        mes,
        folhaTipo: { id: folhaTipoId },
      },
    });
    if (!row) {
      throw new BadRequestException(
        'Não há abertura registrada para esta competência. Registre a abertura antes de usar reabrir.',
      );
    }
    if (!row.fechado) {
      throw new BadRequestException('Este lote já está aberto para lançamentos.');
    }
    row.fechado = false;
    row.fechadoEm = null;
    row.fechadoPor = null;
    row.abertaEm = new Date();
    return this.fechamentoRepo.save(row);
  }
}
