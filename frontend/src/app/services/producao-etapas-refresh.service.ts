import { Injectable, inject } from '@angular/core';
import { Subject, Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SincronizacaoService } from './sincronizacao.service';
import type { SincronizacaoStatus } from '../models/sincronizacao.model';

/**
 * Notifica telas operacionais (painel, acompanhamento) para recarregar após
 * carga de etapas — principalmente ao concluir sync agendada/manual.
 */
@Injectable({ providedIn: 'root' })
export class ProducaoEtapasRefreshService {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly refresh$ = new Subject<void>();
  readonly onEtapasAtualizadas$ = this.refresh$.asObservable();

  private monitorWatchers = 0;
  private monitorSub?: Subscription;
  private syncEstavaEmExecucao = false;
  private viuEtapaProducaoEtapas = false;

  notificarEtapasAtualizadas(): void {
    this.refresh$.next();
  }

  iniciarMonitoramentoSincronizacao(): void {
    this.monitorWatchers += 1;
    if (this.monitorSub) {
      return;
    }
    this.syncEstavaEmExecucao = false;
    this.viuEtapaProducaoEtapas = false;
    this.monitorSub = interval(2000)
      .pipe(switchMap(() => this.sincronizacaoService.getStatus()))
      .subscribe({
        next: (status) => this.processarStatusSincronizacao(status),
        error: () => {},
      });
  }

  pararMonitoramentoSincronizacao(): void {
    this.monitorWatchers = Math.max(0, this.monitorWatchers - 1);
    if (this.monitorWatchers === 0) {
      this.monitorSub?.unsubscribe();
      this.monitorSub = undefined;
      this.syncEstavaEmExecucao = false;
      this.viuEtapaProducaoEtapas = false;
    }
  }

  private processarStatusSincronizacao(status: SincronizacaoStatus): void {
    const emExecucao = status.emExecucao;
    const progresso = status.progresso;

    if (emExecucao) {
      this.syncEstavaEmExecucao = true;
      if (progresso?.etapa === 'producao_etapas') {
        this.viuEtapaProducaoEtapas = true;
      }
      return;
    }

    if (!this.syncEstavaEmExecucao) {
      return;
    }

    this.syncEstavaEmExecucao = false;
    const viuProducao = this.viuEtapaProducaoEtapas;
    this.viuEtapaProducaoEtapas = false;

    const concluiuComSucesso = progresso?.status === 'completed';
    const processouEtapas = (progresso?.producaoEtapasProcessados ?? 0) > 0;

    if (concluiuComSucesso && (viuProducao || processouEtapas)) {
      this.notificarEtapasAtualizadas();
    }
  }
}
