import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PainelMedicoRepresentante } from '../painel-medicos/entities/painel-medico-representante.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { FindVisitacaoPainelMedicoDto } from './dto/find-visitacao-painel-medico.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { resolverEscopoListaFechamentoPorUsuario } from '../folha/utils/folha-unidade-scope.util';
import { VisitacaoPainelMedicoItemDto } from './dto/visitacao-painel-medico-item.dto';
import { VisitacaoPainelMedicoRepresentanteDto } from './dto/visitacao-painel-medico-representante.dto';
import { Unidade } from '../../common/enums/unidade.enum';

type PainelComFuncionario = PainelMedicoRepresentante & {
  funcionarioVinculado?: Funcionario | null;
};

@Injectable()
export class VisitacaoPainelMedicoService {
  constructor(
    @InjectRepository(PainelMedicoRepresentante)
    private readonly painelRepository: Repository<PainelMedicoRepresentante>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
  ) {}

  async findAll(
    usuario: Usuario,
    dto: FindVisitacaoPainelMedicoDto,
  ): Promise<PaginatedResponseDto<VisitacaoPainelMedicoItemDto>> {
    const {
      page = 1,
      limit = 50,
      nomeMedico,
      crmMedico,
      ufCrmMedico,
      nomeRepresentante,
      funcionarioId,
    } = dto;

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );

    const qb = this.painelRepository
      .createQueryBuilder('p')
      .leftJoinAndMapOne(
        'p.funcionarioVinculado',
        Funcionario,
        'fv',
        `fv."unidade" = p."unidade"
          AND fv."painelContratoRepresentante" = p."contratoRepresentante"
          AND fv."painelCodigoRepresentante" = p."codigoRepresentante"`,
      );

    if (escopo !== 'ALL') {
      qb.andWhere('p.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    if (nomeMedico?.trim()) {
      qb.andWhere('p.nomeMedico ILIKE :nomeMedico', {
        nomeMedico: `%${nomeMedico.trim()}%`,
      });
    }

    if (crmMedico?.trim()) {
      qb.andWhere('p.crmMedico ILIKE :crmMedico', {
        crmMedico: `%${crmMedico.trim()}%`,
      });
    }

    if (ufCrmMedico?.trim()) {
      qb.andWhere('p.ufCrmMedico = :ufCrmMedico', {
        ufCrmMedico: ufCrmMedico.trim().toUpperCase(),
      });
    }

    if (nomeRepresentante?.trim()) {
      qb.andWhere(
        '(p.nomeRepresentante ILIKE :nomeRepresentante OR fv.nome ILIKE :nomeRepresentante)',
        { nomeRepresentante: `%${nomeRepresentante.trim()}%` },
      );
    }

    if (funcionarioId) {
      const funcionario = await this.funcionarioRepository.findOne({
        where: { id: funcionarioId },
      });
      if (!funcionario) {
        throw new NotFoundException('Funcionário representante não encontrado.');
      }
      if (
        funcionario.painelContratoRepresentante == null ||
        funcionario.painelCodigoRepresentante == null
      ) {
        return new PaginatedResponseDto([], new PaginationMetaDto(page, limit, 0));
      }
      if (escopo !== 'ALL' && funcionario.unidade !== escopo) {
        return new PaginatedResponseDto([], new PaginationMetaDto(page, limit, 0));
      }
      qb.andWhere('p.unidade = :funUnidade', { funUnidade: funcionario.unidade });
      qb.andWhere('p.contratoRepresentante = :funContrato', {
        funContrato: funcionario.painelContratoRepresentante,
      });
      qb.andWhere('p.codigoRepresentante = :funCodigo', {
        funCodigo: funcionario.painelCodigoRepresentante,
      });
    }

    const [rows, total] = await qb
      .orderBy('p.nomeMedico', 'ASC')
      .addOrderBy('p.crmMedico', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = (rows as PainelComFuncionario[]).map((row) =>
      this.mapItem(row),
    );
    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(data, meta);
  }

  async listarRepresentantesVinculados(
    usuario: Usuario,
    unidade?: Unidade,
  ): Promise<VisitacaoPainelMedicoRepresentanteDto[]> {
    const escopo = resolverEscopoListaFechamentoPorUsuario(usuario, unidade);

    const qb = this.funcionarioRepository
      .createQueryBuilder('f')
      .where('f.painelContratoRepresentante IS NOT NULL')
      .andWhere('f.painelCodigoRepresentante IS NOT NULL');

    if (escopo !== 'ALL') {
      qb.andWhere('f.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    const rows = await qb.orderBy('f.nome', 'ASC').getMany();

    return rows.map((f) => ({
      id: f.id,
      nome: f.nome,
      unidade: f.unidade,
      painelContratoRepresentante: f.painelContratoRepresentante!,
      painelCodigoRepresentante: f.painelCodigoRepresentante!,
    }));
  }

  private mapItem(row: PainelComFuncionario): VisitacaoPainelMedicoItemDto {
    const funcionario = row.funcionarioVinculado ?? null;
    const vinculado = !!funcionario;
    return {
      id: row.id,
      unidade: row.unidade,
      nomeMedico: row.nomeMedico,
      ufCrmMedico: row.ufCrmMedico,
      crmMedico: row.crmMedico,
      contratoRepresentante: row.contratoRepresentante,
      codigoRepresentante: row.codigoRepresentante,
      nomeRepresentanteErp: row.nomeRepresentante,
      funcionarioId: funcionario?.id ?? null,
      nomeRepresentante: funcionario?.nome ?? row.nomeRepresentante,
      vinculadoFuncionario: vinculado,
      criadoEm: row.criadoEm,
      atualizadoEm: row.atualizadoEm,
    };
  }
}
