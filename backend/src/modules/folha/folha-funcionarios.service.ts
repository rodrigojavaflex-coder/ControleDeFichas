import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from './entities/funcionario.entity';
import { FolhaCapa } from './entities/folha-capa.entity';
import { FolhaCargo } from './entities/folha-cargo.entity';
import { FolhaSetor } from './entities/folha-setor.entity';
import { FolhaVerba } from './entities/folha-verba.entity';
import { FolhaFuncionarioEventoFixo } from './entities/folha-funcionario-evento-fixo.entity';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto/paginated-response.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  assertUnidadeFolha,
  usuarioPodeGerenciarUnidade,
} from './utils/folha-unidade-scope.util';
import { CreateFuncionarioFolhaDto } from './dto/create-funcionario-folha.dto';
import { FindFuncionarioFolhaDto } from './dto/find-funcionario-folha.dto';
import { UpdateFuncionarioFolhaDto } from './dto/update-funcionario-folha.dto';
import { FindFuncionariosLancamentoFolhaDto } from './dto/find-funcionarios-lancamento-folha.dto';
import { FuncionarioEventoFixoLinhaDto } from './dto/funcionario-evento-fixo-linha.dto';
import {
  competenciaParaIndice,
  periodoApartirDaDataIso,
  funcionarioElegivelNovaCapaNaCompetencia,
  normalizarDataCadastroParaIso,
} from './utils/folha-competencia.util';
import { Unidade } from '../../common/enums/unidade.enum';
import { TipoChavePixFolha } from '../../common/enums/tipo-chave-pix-folha.enum';

const EMAIL_CHAVE_PIX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

@Injectable()
export class FolhaFuncionariosService {
  constructor(
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    @InjectRepository(FolhaCapa)
    private readonly capaRepo: Repository<FolhaCapa>,
    @InjectRepository(FolhaCargo)
    private readonly cargoCatalogoRepo: Repository<FolhaCargo>,
    @InjectRepository(FolhaSetor)
    private readonly setorCatalogoRepo: Repository<FolhaSetor>,
    @InjectRepository(FolhaVerba)
    private readonly verbaRepo: Repository<FolhaVerba>,
    @InjectRepository(FolhaFuncionarioEventoFixo)
    private readonly eventoFixoRepo: Repository<FolhaFuncionarioEventoFixo>,
  ) {}

  async create(
    usuario: Usuario,
    dto: CreateFuncionarioFolhaDto,
  ): Promise<Funcionario> {
    assertUnidadeFolha(usuario, dto.unidade);
    await this.assertCargoSetorIds(dto.cargoId, dto.setorId);
    const payload: Partial<Funcionario> = {
      nome: dto.nome,
      unidade: dto.unidade,
      cpf: dto.cpf?.trim() ? dto.cpf.trim() : undefined,
      telefone: dto.telefone?.trim() || null,
      endereco: dto.endereco?.trim() || null,
      email: dto.email?.trim() ? dto.email.trim().toLowerCase() : null,
      dataNascimento: dto.dataNascimento,
      dataAdmissao: dto.dataAdmissao,
      dataDemissao: dto.dataDemissao,
      cargo: dto.cargoId ? ({ id: dto.cargoId } as FolhaCargo) : null,
      setor: dto.setorId ? ({ id: dto.setorId } as FolhaSetor) : null,
      ativo: dto.ativo ?? true,
      tipoPix: dto.tipoPix ?? null,
      chavePix: dto.chavePix?.trim() ? dto.chavePix.trim() : null,
    };
    const entity = this.funcionarioRepo.create(payload as Funcionario);
    this.assertFuncionarioCamposObrigatorios(entity);
    const saved = await this.funcionarioRepo.save(entity);
    await this.sincronizarEventosFixos(saved.id, dto.eventosFixos ?? []);
    return this.findOne(usuario, saved.id);
  }

  private async sincronizarEventosFixos(
    funcionarioId: string,
    linhas: FuncionarioEventoFixoLinhaDto[],
  ): Promise<void> {
    const verbIds = linhas.map((l) => l.folhaVerbaId);
    if (verbIds.length !== new Set(verbIds).size) {
      throw new BadRequestException(
        'Não é permitido repetir o mesmo evento (verba) nos eventos fixos.',
      );
    }
    for (const row of linhas) {
      const verba = await this.verbaRepo.findOne({
        where: { id: row.folhaVerbaId },
      });
      if (!verba) {
        throw new BadRequestException('Verba/evento não encontrado.');
      }
      if (!verba.ativo) {
        throw new BadRequestException(
          `A verba «${verba.descricao}» está inativa. Use apenas eventos ativos nos eventos fixos.`,
        );
      }
      const q =
        row.quantidade != null && row.quantidade !== undefined
          ? Number(row.quantidade)
          : 1;
      if (!Number.isFinite(q) || q < 0.0001) {
        throw new BadRequestException(
          'Cada evento fixo deve ter referência/quantidade maior que zero.',
        );
      }
      const valor = Number(row.valor);
      if (!Number.isFinite(valor)) {
        throw new BadRequestException('Valor inválido em evento fixo.');
      }
    }

    await this.eventoFixoRepo.delete({ funcionario: { id: funcionarioId } });

    for (const row of linhas) {
      const q =
        row.quantidade != null && row.quantidade !== undefined
          ? Number(row.quantidade)
          : 1;
      const ev = this.eventoFixoRepo.create({
        funcionario: { id: funcionarioId } as Funcionario,
        folhaVerba: { id: row.folhaVerbaId } as FolhaVerba,
        valor: String(Number(row.valor).toFixed(2)),
        quantidade: q.toFixed(4),
      });
      await this.eventoFixoRepo.save(ev);
    }
  }

  private async assertCargoSetorIds(
    cargoId?: string | null,
    setorId?: string | null,
  ): Promise<void> {
    if (cargoId) {
      const ok = await this.cargoCatalogoRepo.exist({
        where: { id: cargoId },
      });
      if (!ok) {
        throw new BadRequestException('Cargo informado não existe.');
      }
    }
    if (setorId) {
      const ok = await this.setorCatalogoRepo.exist({
        where: { id: setorId },
      });
      if (!ok) {
        throw new BadRequestException('Setor informado não existe.');
      }
    }
  }

  async findPaginated(
    usuario: Usuario,
    dto: FindFuncionarioFolhaDto,
  ): Promise<PaginatedResponseDto<Funcionario>> {
    assertUnidadeFolha(usuario, dto.unidade);
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    const qb = this.funcionarioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.cargo', 'cargo')
      .leftJoinAndSelect('f.setor', 'setor')
      .where('f.unidade = :unidade', { unidade: dto.unidade });

    if (dto.nome?.trim()) {
      qb.andWhere('f.nome ILIKE :nome', { nome: `%${dto.nome.trim()}%` });
    }

    qb.orderBy('f.nome', 'ASC');

    const total = await qb.getCount();

    qb.skip((page - 1) * limit).take(limit);
    const data = await qb.getMany();

    const meta = new PaginationMetaDto(page, limit, total);
    return new PaginatedResponseDto(data, meta);
  }

  async findOne(usuario: Usuario, id: string): Promise<Funcionario> {
    const entity = await this.funcionarioRepo.findOne({
      where: { id },
      relations: ['cargo', 'setor', 'eventosFixos', 'eventosFixos.folhaVerba'],
    });
    if (!entity) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    if (!usuarioPodeGerenciarUnidade(usuario, entity.unidade as Unidade)) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    return entity;
  }

  async remove(usuario: Usuario, id: string): Promise<void> {
    await this.findOne(usuario, id);
    const comCapa = await this.capaRepo.count({
      where: { funcionario: { id } },
    });
    if (comCapa > 0) {
      throw new BadRequestException(
        'Existem lançamentos de folha para este funcionário. Não é possível excluir o cadastro.',
      );
    }
    await this.funcionarioRepo.delete(id);
  }

  async update(
    usuario: Usuario,
    id: string,
    dto: UpdateFuncionarioFolhaDto,
  ): Promise<Funcionario> {
    const entity = await this.funcionarioRepo.findOne({
      where: { id },
      relations: ['cargo', 'setor'],
    });
    if (!entity) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    if (!usuarioPodeGerenciarUnidade(usuario, entity.unidade as Unidade)) {
      throw new NotFoundException(`Funcionário ${id} não encontrado`);
    }
    if (dto.unidade !== undefined && dto.unidade !== entity.unidade) {
      assertUnidadeFolha(usuario, dto.unidade as Unidade);
    }

    const comCapaCongelada = await this.capaRepo.count({
      where: { funcionario: { id }, congelada: true },
    });
    if (comCapaCongelada > 0) {
      throw new BadRequestException(
        'Este funcionário possui folha (capa) congelada. Libere a capa em Lançamento de folha antes de alterar o cadastro.',
      );
    }

    const {
      cargoId: patchCargoId,
      setorId: patchSetorId,
      eventosFixos: patchEventosFixos,
      ...restPatch
    } = dto;

    Object.assign(entity, restPatch);

    if (dto.unidade !== undefined) {
      entity.unidade = dto.unidade as Unidade;
    }
    if (dto.telefone !== undefined) {
      entity.telefone = dto.telefone?.trim() ? dto.telefone.trim() : null;
    }
    if (dto.endereco !== undefined) {
      entity.endereco = dto.endereco?.trim() ? dto.endereco.trim() : null;
    }
    if (dto.email !== undefined) {
      entity.email = dto.email?.trim() ? dto.email.trim().toLowerCase() : null;
    }
    if (dto.cpf !== undefined) {
      entity.cpf = dto.cpf?.trim() ? dto.cpf.trim() : null;
    }

    if (patchCargoId !== undefined) {
      await this.assertCargoSetorIds(
        patchCargoId as string | null,
        undefined,
      );
      entity.cargo = patchCargoId
        ? ({ id: patchCargoId } as FolhaCargo)
        : null;
    }
    if (patchSetorId !== undefined) {
      await this.assertCargoSetorIds(undefined, patchSetorId as string | null);
      entity.setor = patchSetorId
        ? ({ id: patchSetorId } as FolhaSetor)
        : null;
    }

    if (dto.tipoPix !== undefined) {
      entity.tipoPix = dto.tipoPix;
    }
    if (dto.chavePix !== undefined) {
      entity.chavePix = dto.chavePix?.trim() ? dto.chavePix.trim() : null;
    }
    this.assertFuncionarioCamposObrigatorios(entity);
    await this.funcionarioRepo.save(entity);
    if (patchEventosFixos !== undefined) {
      await this.sincronizarEventosFixos(id, patchEventosFixos);
    }
    return this.findOne(usuario, id);
  }

  /** Funcionários da unidade para tela/listagens de lançamentos (ordenado por nome). Com ano/mês, aplica RN-011. */
  async listarParaLancamento(
    usuario: Usuario,
    dto: FindFuncionariosLancamentoFolhaDto,
  ): Promise<Funcionario[]> {
    assertUnidadeFolha(usuario, dto.unidade);

    const qb = this.funcionarioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.cargo', 'cargo')
      .leftJoinAndSelect('f.setor', 'setor')
      .where('f.unidade = :unidade', { unidade: dto.unidade })
      .orderBy('f.nome', 'ASC');

    const somenteAtivos =
      dto.somenteAtivos === undefined ? true : dto.somenteAtivos;
    if (somenteAtivos) {
      qb.andWhere('f.ativo = true');
    }

    let rows = await qb.getMany();

    const anoMes =
      dto.ano != null && dto.mes != null
        ? { ano: dto.ano, mes: dto.mes }
        : undefined;

    if (anoMes) {
      rows = rows.filter((f) =>
        funcionarioElegivelNovaCapaNaCompetencia(f, anoMes.ano, anoMes.mes),
      );
    }

    return rows;
  }

  /** Valida funcionário+competência antes de criar folha_capa (RN-005 / RN-011). */
  podeCriarCapaParaFuncionario(
    funcionario: Funcionario,
    ano: number,
    mes: number,
  ): void {
    if (!funcionario.ativo) {
      throw new BadRequestException(
        'Funcionário inativo não pode ter nova folha nesta competência.',
      );
    }
    const daNorm = normalizarDataCadastroParaIso(funcionario.dataAdmissao);
    if (!daNorm) {
      throw new BadRequestException(
        'Data de admissão obrigatória para lançamento de folha.',
      );
    }
    let alvoIndice: number;
    try {
      alvoIndice = competenciaParaIndice(ano, mes);
      const ia = periodoApartirDaDataIso(daNorm);
      if (ia > alvoIndice) {
        throw new BadRequestException(
          'A competência é anterior ao mês/ano de admissão do funcionário. Não é permitido novo lançamento.',
        );
      }
      if (funcionario.dataDemissao) {
        const demIso = normalizarDataCadastroParaIso(funcionario.dataDemissao);
        if (!demIso) {
          throw new BadRequestException(
            'Não foi possível validar a data de demissão para esta competência.',
          );
        }
        const dem = periodoApartirDaDataIso(demIso);
        if (alvoIndice >= dem) {
          throw new BadRequestException(
            'Este funcionário possui demissão neste mês ou em mês anterior à competência. Não é permitido novo lançamento.',
          );
        }
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        'Não foi possível validar datas de admissão/demissão para esta competência.',
      );
    }
  }

  /** Carrega funcionário garantindo pertença à unidade informada. */
  async findOnePorUnidadeOuLanca(
    id: string,
    unidadeEsperada: Unidade,
  ): Promise<Funcionario> {
    const f = await this.funcionarioRepo.findOne({
      where: { id },
      relations: ['cargo', 'setor'],
    });
    if (!f || f.unidade !== unidadeEsperada) {
      throw new BadRequestException(
        'Funcionário não encontrado para a unidade informada.',
      );
    }
    return f;
  }

  private assertFuncionarioCamposObrigatorios(f: Funcionario): void {
    const parts: string[] = [];
    if (!f.nome?.trim()) {
      parts.push('Nome é obrigatório.');
    }
    if (!f.unidade) {
      parts.push('Unidade é obrigatória.');
    }
    const dnNorm = normalizarDataCadastroParaIso(f.dataNascimento);
    if (!dnNorm) {
      parts.push('Data de nascimento é obrigatória.');
    }
    const daNorm = normalizarDataCadastroParaIso(f.dataAdmissao);
    if (!daNorm) {
      parts.push('Data de admissão é obrigatória.');
    }
    if (parts.length) {
      throw new BadRequestException(parts.join(' '));
    }
    this.assertPixCoerente(f);
  }

  /** Pix opcional; se um lado for informado, o outro também deve ser; formato validado quando ambos presentes. */
  private assertPixCoerente(f: Funcionario): void {
    const temTipo = f.tipoPix != null;
    const temChave = !!f.chavePix?.trim();
    if (temTipo && !temChave) {
      throw new BadRequestException(
        'Informe a chave Pix ou remova o tipo do Pix.',
      );
    }
    if (!temTipo && temChave) {
      throw new BadRequestException(
        'Informe o tipo do Pix ou remova a chave Pix.',
      );
    }
    if (temTipo && temChave && f.tipoPix && f.chavePix?.trim()) {
      this.validarChavePixFormato(
        f.tipoPix as TipoChavePixFolha,
        f.chavePix.trim(),
      );
    }
  }

  private validarChavePixFormato(
    tipo: TipoChavePixFolha,
    chaveRaw: string,
  ): void {
    const chave = chaveRaw.trim();
    if (!chave) {
      return;
    }
    switch (tipo) {
      case TipoChavePixFolha.CPF: {
        const d = chave.replace(/\D/g, '');
        if (d.length !== 11) {
          throw new BadRequestException(
            'Chave Pix do tipo CPF deve conter 11 dígitos.',
          );
        }
        break;
      }
      case TipoChavePixFolha.TELEFONE: {
        const d = chave.replace(/\D/g, '');
        if (d.length < 10 || d.length > 13) {
          throw new BadRequestException(
            'Chave Pix do tipo telefone deve ter entre 10 e 13 dígitos.',
          );
        }
        break;
      }
      case TipoChavePixFolha.EMAIL: {
        if (!EMAIL_CHAVE_PIX.test(chave)) {
          throw new BadRequestException(
            'Chave Pix do tipo e-mail é inválida.',
          );
        }
        break;
      }
      case TipoChavePixFolha.CHAVE_ALEATORIA: {
        const hex = chave.replace(/-/g, '');
        if (hex.length !== 32 || !/^[0-9a-f]+$/i.test(hex)) {
          throw new BadRequestException(
            'Chave aleatória Pix deve ser um código de 32 caracteres hexadecimais (com ou sem hífens no formato UUID).',
          );
        }
        break;
      }
      default:
        throw new BadRequestException('Tipo de chave Pix inválido.');
    }
  }
}
