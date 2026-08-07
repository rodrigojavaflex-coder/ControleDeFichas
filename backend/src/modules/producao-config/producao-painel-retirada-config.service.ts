import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProducaoPainelEtapaFinal } from './entities/producao-painel-etapa-final.entity';
import {
  ProducaoPainelAlertaRetirada,
  ProducaoPainelAlertaTipo,
} from './entities/producao-painel-alerta-retirada.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { assertUnidadeFolha } from '../folha/utils/folha-unidade-scope.util';
import {
  ProducaoPainelRetiradaConfigResponseDto,
  SalvarProducaoPainelRetiradaDto,
} from './dto/producao-painel-retirada.dto';
import {
  corPainelRetiradaValida,
  normalizarCorPainelRetirada,
} from './utils/producao-painel-cor.util';

@Injectable()
export class ProducaoPainelRetiradaConfigService {
  private readonly logger = new Logger(ProducaoPainelRetiradaConfigService.name);

  constructor(
    @InjectRepository(ProducaoPainelEtapaFinal)
    private readonly etapaFinalRepo: Repository<ProducaoPainelEtapaFinal>,
    @InjectRepository(ProducaoPainelAlertaRetirada)
    private readonly alertaRepo: Repository<ProducaoPainelAlertaRetirada>,
    private readonly dataSource: DataSource,
  ) {}

  async obterConfig(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ProducaoPainelRetiradaConfigResponseDto> {
    assertUnidadeFolha(usuario, unidade);
    const [etapas, alertas] = await Promise.all([
      this.etapaFinalRepo.find({
        where: { unidade },
        order: { codEtapa: 'ASC' },
      }),
      this.alertaRepo.find({
        where: { unidade },
        order: { ordem: 'ASC' },
      }),
    ]);
    return {
      unidade,
      etapasFinalizacao: etapas.map((e) => e.codEtapa),
      alertas: alertas.map((a) => ({
        id: a.id,
        ordem: a.ordem,
        tipo: a.tipo,
        minutosAntes: a.minutosAntes,
        cor: normalizarCorPainelRetirada(a.cor),
        rotulo: a.rotulo,
      })),
    };
  }

  async salvarConfig(
    usuario: Usuario,
    dto: SalvarProducaoPainelRetiradaDto,
  ): Promise<ProducaoPainelRetiradaConfigResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    this.validarAlertas(dto.alertas);

    const unidade = dto.unidade;
    const codigos = [
      ...new Set(
        (dto.etapasFinalizacao ?? [])
          .map((c) => String(c).trim())
          .filter(Boolean),
      ),
    ];

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ProducaoPainelEtapaFinal, { unidade });
      await manager.delete(ProducaoPainelAlertaRetirada, { unidade });

      if (codigos.length > 0) {
        await manager.insert(
          ProducaoPainelEtapaFinal,
          codigos.map((codEtapa) => ({ unidade, codEtapa })),
        );
      }

      if (dto.alertas.length > 0) {
        await manager.insert(
          ProducaoPainelAlertaRetirada,
          dto.alertas.map((a, idx) => ({
            unidade,
            ordem: a.ordem ?? idx,
            tipo: a.tipo,
            minutosAntes:
              a.tipo === ProducaoPainelAlertaTipo.ANTES
                ? (a.minutosAntes ?? null)
                : null,
            cor: normalizarCorPainelRetirada(a.cor),
            rotulo: a.rotulo?.trim() || null,
          })),
        );
      }
    });

    this.logger.log(
      `Painel retirada unidade=${unidade}: ${codigos.length} etapa(s) final, ${dto.alertas.length} alerta(s)`,
    );

    return this.obterConfig(usuario, unidade);
  }

  async mapaEtapasFinalPorUnidades(
    unidades: Unidade[],
  ): Promise<Map<Unidade, Set<string>>> {
    const map = new Map<Unidade, Set<string>>();
    for (const u of unidades) {
      map.set(u, new Set());
    }
    if (unidades.length === 0) {
      return map;
    }
    const rows = await this.etapaFinalRepo
      .createQueryBuilder('e')
      .where('e.unidade IN (:...unidades)', { unidades })
      .getMany();
    for (const row of rows) {
      map.get(row.unidade)?.add(row.codEtapa);
    }
    return map;
  }

  async mapaAlertasPorUnidades(
    unidades: Unidade[],
  ): Promise<Map<Unidade, ProducaoPainelAlertaRetirada[]>> {
    const map = new Map<Unidade, ProducaoPainelAlertaRetirada[]>();
    for (const u of unidades) {
      map.set(u, []);
    }
    if (unidades.length === 0) {
      return map;
    }
    const rows = await this.alertaRepo.find({
      where: { unidade: In(unidades) },
      order: { ordem: 'ASC' },
    });
    for (const row of rows) {
      map.get(row.unidade)?.push(row);
    }
    return map;
  }

  private validarAlertas(
    alertas: SalvarProducaoPainelRetiradaDto['alertas'],
  ): void {
    for (const a of alertas) {
      if (!corPainelRetiradaValida(a.cor)) {
        throw new BadRequestException(
          'Cor inválida na faixa de alerta (use #RRGGBB ou NEUTRO).',
        );
      }
      if (a.tipo === ProducaoPainelAlertaTipo.ANTES) {
        if (a.minutosAntes == null || a.minutosAntes < 1) {
          throw new BadRequestException(
            'Faixas «antes da retirada» exigem minutosAntes ≥ 1.',
          );
        }
      }
    }
    const atrasados = alertas.filter(
      (a) => a.tipo === ProducaoPainelAlertaTipo.ATRASADO,
    );
    if (atrasados.length > 1) {
      throw new BadRequestException(
        'Informe no máximo uma faixa «Retirada atrasada».',
      );
    }
  }
}
