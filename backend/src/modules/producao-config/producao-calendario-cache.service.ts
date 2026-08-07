import { Injectable } from '@nestjs/common';
import { Unidade } from '../../common/enums/unidade.enum';
import type { ProducaoIntervaloHorario } from './utils/producao-calendario.util';

/** Parte estável do calendário (jornada), cacheada por unidade. Feriados entram por consulta. */
export interface JornadaCalendarioBase {
  configurado: boolean;
  intervalosPorDia: Map<number, ProducaoIntervaloHorario[]>;
}

@Injectable()
export class ProducaoCalendarioCacheService {
  /** TTL padrão: 2 minutos (config de jornada muda pouco; feriados invalidam). */
  private readonly ttlMs = 120_000;

  private readonly store = new Map<
    Unidade,
    { base: JornadaCalendarioBase; expiresAt: number }
  >();

  obter(unidade: Unidade): JornadaCalendarioBase | null {
    const row = this.store.get(unidade);
    if (!row) {
      return null;
    }
    if (Date.now() > row.expiresAt) {
      this.store.delete(unidade);
      return null;
    }
    return {
      configurado: row.base.configurado,
      intervalosPorDia: new Map(row.base.intervalosPorDia),
    };
  }

  gravar(unidade: Unidade, base: JornadaCalendarioBase): void {
    this.store.set(unidade, {
      base: {
        configurado: base.configurado,
        intervalosPorDia: new Map(base.intervalosPorDia),
      },
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidar(unidade: Unidade): void {
    this.store.delete(unidade);
  }

  invalidarVarias(unidades: Unidade[]): void {
    for (const u of unidades) {
      this.store.delete(u);
    }
  }
}
