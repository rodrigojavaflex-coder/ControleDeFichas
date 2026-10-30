import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { VisitacaoFechamentoMedico } from '../visitacao-acompanhamento/entities/visitacao-fechamento-medico.entity';
import { VisitacaoFechamentoCarteira } from '../visitacao-acompanhamento/entities/visitacao-fechamento-carteira.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { PF_CRM_PADRAO_VISITACAO } from '../../common/enums/pf-crm.enum';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';
import { parseCrmNumero } from '../../common/utils/prescritor-crm.util';
import {
  BackfillPfcrmRetratosDto,
  BackfillPfcrmRetratosResponseDto,
  BackfillPfcrmUnidadeResumoDto,
} from './dto/backfill-pfcrm-retratos.dto';

type RowPend = {
  id: string;
  crmMedico: string;
  ufCrmMedico: string;
  nomeMedico: string;
  /** Unidade do fechamento (escopo do filtro), não a unidade de movimento. */
  unidade: Unidade;
};

type ResolveOk = { pfcrm: string; via: 'unico' | 'nome' | 'padrao' };
type ResolveResult = ResolveOk | null;

type TotaisUnidade = { medicosTotal: number; carteiraTotal: number };

/**
 * Preenche pfcrm em retratos fechados (só referência; não recalcula valores).
 * Escopo opcional por unidade do fechamento.
 *
 * Contagens = linhas em todos os meses já fechados (mesmo CRM em N meses = N linhas).
 * Match: 1) nome (exato, depois contém); 2) CRM+UF único; 3) dúvida → PFCRM padrão `1`.
 */
@Injectable()
export class BackfillPfcrmRetratosService {
  private readonly logger = new Logger(BackfillPfcrmRetratosService.name);

  constructor(
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
    @InjectRepository(VisitacaoFechamentoMedico)
    private readonly medicoRepository: Repository<VisitacaoFechamentoMedico>,
    @InjectRepository(VisitacaoFechamentoCarteira)
    private readonly carteiraRepository: Repository<VisitacaoFechamentoCarteira>,
  ) {}

  async executar(
    dto: BackfillPfcrmRetratosDto,
  ): Promise<BackfillPfcrmRetratosResponseDto> {
    const aplicar = !!dto.aplicar;
    const unidadeFiltro = dto.unidade ?? null;
    const padrao = PF_CRM_PADRAO_VISITACAO;

    const prescritores = await this.prescritorRepository.find({
      select: ['id', 'nome', 'numeroCRM', 'UFCRM', 'pfcrm'],
    });
    const porCrmUf = new Map<string, Prescritor[]>();
    for (const p of prescritores) {
      if (p.numeroCRM == null || !p.UFCRM) continue;
      const k = `${p.numeroCRM}|${String(p.UFCRM).toUpperCase()}`;
      const list = porCrmUf.get(k) ?? [];
      list.push(p);
      porCrmUf.set(k, list);
    }

    const totaisPorUnidade = await this.contarTotaisPorUnidade(unidadeFiltro);

    const medicosQb = this.medicoRepository
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.fechamento', 'f')
      .where(`m.pfcrm IS NULL OR BTRIM(COALESCE(m.pfcrm, '')) = ''`);
    if (unidadeFiltro) {
      medicosQb.andWhere('f.unidade = :unidade', { unidade: unidadeFiltro });
    }
    const medicosRaw = await medicosQb.getMany();
    const medicosNull: RowPend[] = medicosRaw
      .filter((m) => !unidadeFiltro || m.fechamento?.unidade === unidadeFiltro)
      .map((m) => ({
        id: m.id,
        crmMedico: m.crmMedico,
        ufCrmMedico: m.ufCrmMedico,
        nomeMedico: m.nomeMedico,
        unidade: m.fechamento.unidade,
      }));

    const carteiraQb = this.carteiraRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.fechamento', 'f')
      .where(`c.pfcrm IS NULL OR BTRIM(COALESCE(c.pfcrm, '')) = ''`);
    if (unidadeFiltro) {
      carteiraQb.andWhere('f.unidade = :unidade', { unidade: unidadeFiltro });
    }
    const carteiraEntities = await carteiraQb.getMany();
    const carteiraNull: RowPend[] = carteiraEntities
      .filter((c) => !unidadeFiltro || c.fechamento?.unidade === unidadeFiltro)
      .map((c) => ({
        id: c.id,
        crmMedico: c.crmMedico,
        ufCrmMedico: c.ufCrmMedico,
        nomeMedico: c.nomeMedico,
        unidade: c.fechamento.unidade,
      }));

    const resumoMap = new Map<Unidade, BackfillPfcrmUnidadeResumoDto>();
    const ensure = (u: Unidade): BackfillPfcrmUnidadeResumoDto => {
      let r = resumoMap.get(u);
      if (!r) {
        const tot = totaisPorUnidade.get(u) ?? {
          medicosTotal: 0,
          carteiraTotal: 0,
        };
        r = {
          unidade: u,
          medicosTotal: tot.medicosTotal,
          carteiraTotal: tot.carteiraTotal,
          medicosSemPfcrm: 0,
          carteiraSemPfcrm: 0,
          medicosPreenchidos: 0,
          carteiraPreenchidos: 0,
          ambiguos: 0,
          semMatch: 0,
          fallbackPadrao: 0,
        };
        resumoMap.set(u, r);
      }
      return r;
    };

    // Garante linha por unidade do escopo (mesmo sem pendências)
    if (unidadeFiltro) {
      ensure(unidadeFiltro);
    } else {
      for (const u of totaisPorUnidade.keys()) ensure(u);
    }

    for (const m of medicosNull) ensure(m.unidade).medicosSemPfcrm++;
    for (const c of carteiraNull) ensure(c.unidade).carteiraSemPfcrm++;

    let ambiguos = 0;
    let semMatch = 0;
    let fallbackPadrao = 0;
    const amostraFalhas: string[] = [];

    const nomePrescritor = (p: Prescritor): string =>
      padronizarNomeDeSistemaLegado(p.nome) ||
      String(p.nome || '')
        .trim()
        .toUpperCase();

    const pfcrmDe = (p: Prescritor): string =>
      (p.pfcrm && String(p.pfcrm).trim()) || padrao;

    /**
     * 1) Nome exato → 2) nome contém → 3) CRM+UF único → 4) dúvida → padrão `1`.
     * Retorna null só quando CRM+UF não existe em prescritores.
     */
    const resolver = (
      crm: string,
      uf: string,
      nome: string,
    ): ResolveResult => {
      const crmN = parseCrmNumero(crm);
      if (crmN == null || !uf?.trim()) return null;
      const list = porCrmUf.get(`${crmN}|${uf.trim().toUpperCase()}`) ?? [];
      if (!list.length) return null;

      const nomePad =
        padronizarNomeDeSistemaLegado(nome) ||
        String(nome || '')
          .trim()
          .toUpperCase();

      if (nomePad) {
        const exact = list.filter((p) => nomePrescritor(p) === nomePad);
        if (exact.length === 1) {
          return { pfcrm: pfcrmDe(exact[0]), via: 'nome' };
        }
        if (exact.length > 1) {
          return { pfcrm: padrao, via: 'padrao' };
        }

        const fuzzy = list.filter((p) => {
          const pn = nomePrescritor(p);
          return pn.includes(nomePad) || nomePad.includes(pn);
        });
        if (fuzzy.length === 1) {
          return { pfcrm: pfcrmDe(fuzzy[0]), via: 'nome' };
        }
        if (fuzzy.length > 1) {
          return { pfcrm: padrao, via: 'padrao' };
        }
      }

      if (list.length === 1) {
        return { pfcrm: pfcrmDe(list[0]), via: 'unico' };
      }

      return { pfcrm: padrao, via: 'padrao' };
    };

    const processar = async (
      rows: RowPend[],
      updateFn: (id: string, pfcrm: string) => Promise<unknown>,
      tipo: 'medico' | 'carteira',
    ): Promise<number> => {
      const updates: Array<{
        id: string;
        pfcrm: string;
        unidade: Unidade;
        via: ResolveOk['via'];
      }> = [];
      for (const row of rows) {
        const r = resolver(row.crmMedico, row.ufCrmMedico, row.nomeMedico);
        const resumo = ensure(row.unidade);
        if (!r) {
          semMatch++;
          resumo.semMatch++;
          if (amostraFalhas.length < 40) {
            amostraFalhas.push(
              `${tipo} ${row.unidade} ${row.crmMedico}/${row.ufCrmMedico} — sem match`,
            );
          }
          continue;
        }
        updates.push({
          id: row.id,
          pfcrm: r.pfcrm,
          unidade: row.unidade,
          via: r.via,
        });
      }
      for (const u of updates) {
        const resumo = ensure(u.unidade);
        if (tipo === 'medico') resumo.medicosPreenchidos++;
        else resumo.carteiraPreenchidos++;
        if (u.via === 'padrao') {
          fallbackPadrao++;
          resumo.fallbackPadrao++;
        }
        if (aplicar) {
          await updateFn(u.id, u.pfcrm);
        }
      }
      return updates.length;
    };

    const medicosCandidatos = await processar(
      medicosNull,
      (id, pfcrm) => this.medicoRepository.update({ id }, { pfcrm }),
      'medico',
    );
    const carteiraCandidatos = await processar(
      carteiraNull,
      (id, pfcrm) => this.carteiraRepository.update({ id }, { pfcrm }),
      'carteira',
    );

    let porUnidade = [...resumoMap.values()].sort((a, b) =>
      a.unidade.localeCompare(b.unidade, 'pt-BR'),
    );
    if (unidadeFiltro) {
      porUnidade = porUnidade.filter((r) => r.unidade === unidadeFiltro);
    }

    const medicosTotal = [...totaisPorUnidade.values()].reduce(
      (s, t) => s + t.medicosTotal,
      0,
    );
    const carteiraTotal = [...totaisPorUnidade.values()].reduce(
      (s, t) => s + t.carteiraTotal,
      0,
    );

    this.logger.log(
      `Backfill PFCRM retratos aplicar=${aplicar} unidade=${unidadeFiltro ?? 'TODAS'} medicos=${medicosCandidatos}/${medicosNull.length} (totalLinhas=${medicosTotal}) carteira=${carteiraCandidatos}/${carteiraNull.length} (totalLinhas=${carteiraTotal}) amb=${ambiguos} sem=${semMatch} padrao=${fallbackPadrao}`,
    );

    return {
      aplicar,
      unidadeFiltro,
      medicosTotal,
      carteiraTotal,
      medicosSemPfcrm: medicosNull.length,
      carteiraSemPfcrm: carteiraNull.length,
      medicosPreenchidos: medicosCandidatos,
      carteiraPreenchidos: carteiraCandidatos,
      ambiguos,
      semMatch,
      fallbackPadrao,
      porUnidade,
      amostraFalhas,
    };
  }

  /** Linhas em todos os meses fechados, agrupadas pela unidade do fechamento. */
  private async contarTotaisPorUnidade(
    unidadeFiltro: Unidade | null,
  ): Promise<Map<Unidade, TotaisUnidade>> {
    const map = new Map<Unidade, TotaisUnidade>();
    const ensure = (u: Unidade): TotaisUnidade => {
      let t = map.get(u);
      if (!t) {
        t = { medicosTotal: 0, carteiraTotal: 0 };
        map.set(u, t);
      }
      return t;
    };

    const medQb = this.medicoRepository
      .createQueryBuilder('m')
      .innerJoin('m.fechamento', 'f')
      .select('f.unidade', 'unidade')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('f.unidade');
    if (unidadeFiltro) {
      medQb.andWhere('f.unidade = :unidade', { unidade: unidadeFiltro });
    }
    const medRows: Array<{ unidade: string; cnt: string }> =
      await medQb.getRawMany();
    for (const row of medRows) {
      ensure(row.unidade as Unidade).medicosTotal = Number(row.cnt) || 0;
    }

    const cartQb = this.carteiraRepository
      .createQueryBuilder('c')
      .innerJoin('c.fechamento', 'f')
      .select('f.unidade', 'unidade')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('f.unidade');
    if (unidadeFiltro) {
      cartQb.andWhere('f.unidade = :unidade', { unidade: unidadeFiltro });
    }
    const cartRows: Array<{ unidade: string; cnt: string }> =
      await cartQb.getRawMany();
    for (const row of cartRows) {
      ensure(row.unidade as Unidade).carteiraTotal = Number(row.cnt) || 0;
    }

    return map;
  }
}
