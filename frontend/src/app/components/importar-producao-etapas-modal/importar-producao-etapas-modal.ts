import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Unidade } from '../../models/usuario.model';
import { ImportarProducaoEtapasResponse } from '../../models/sincronizacao.model';
import { ImportacaoManualProgress } from '../../models/importacao-manual-progress.model';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { ImportacaoManualProgressService } from '../../services/importacao-manual-progress.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';
import { ImportacaoManualProgressPanelComponent } from '../importacao-manual-progress-panel/importacao-manual-progress-panel';

export interface ImportarProducaoEtapasModalOptions {
  dataInicio?: string;
  dataFim?: string;
  unidade?: Unidade | '';
}

@Component({
  selector: 'app-importar-producao-etapas-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateRangeFilterComponent,
    ImportacaoManualProgressPanelComponent,
  ],
  templateUrl: './importar-producao-etapas-modal.html',
  styleUrls: ['./importar-producao-etapas-modal.css'],
})
export class ImportarProducaoEtapasModalComponent implements OnDestroy {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly importacaoProgressService = inject(ImportacaoManualProgressService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);
  private progressSubscription?: Subscription;

  unidades = Object.values(Unidade);

  visible = false;
  loading = false;
  error = '';
  dataInicio = '';
  dataFim = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  result: ImportarProducaoEtapasResponse | null = null;
  importacaoProgress: ImportacaoManualProgress | null = null;

  @Output() importacaoConcluida = new EventEmitter<void>();

  ngOnDestroy(): void {
    this.pararPollingProgresso();
  }

  abrir(options?: ImportarProducaoEtapasModalOptions): void {
    this.error = '';
    this.result = null;
    this.importacaoProgress = null;

    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? options?.unidade ?? '';

    const periodoPadrao = this.resolverPeriodoPadrao();
    this.dataInicio = options?.dataInicio ?? periodoPadrao.inicio;
    this.dataFim = options?.dataFim ?? periodoPadrao.fim;

    this.visible = true;
  }

  onPeriodoRangeChange(range: DateRangeValue): void {
    this.dataInicio = range.start;
    this.dataFim = range.end;
  }

  get periodoResumo(): string {
    if (!this.dataInicio || !this.dataFim) {
      return '';
    }
    if (this.dataInicio === this.dataFim) {
      return this.formatDateDisplay(this.dataInicio);
    }
    return `${this.formatDateDisplay(this.dataInicio)} a ${this.formatDateDisplay(this.dataFim)}`;
  }

  fechar(): void {
    if (this.loading) {
      return;
    }
    this.visible = false;
  }

  executarImportacao(): void {
    const unidadeUsuario = this.obterUnidadeUsuarioLogado();

    if (unidadeUsuario && this.unidade !== unidadeUsuario) {
      this.error = 'A busca só é permitida para a unidade do usuário logado.';
      return;
    }

    if (!this.unidade) {
      this.error = 'Selecione a unidade.';
      return;
    }

    if (!this.dataInicio || !this.dataFim) {
      this.error = 'Informe o período (data início e fim).';
      return;
    }

    if (this.dataInicio > this.dataFim) {
      this.error = 'A data inicial não pode ser posterior à data final.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;
    this.importacaoProgress = null;
    this.iniciarPollingProgresso();

    this.sincronizacaoService
      .importarProducaoEtapas({
        unidade: this.unidade,
        dataInicio: this.dataInicio,
        dataFim: this.dataFim,
      })
      .subscribe({
        next: (importResult) => {
          this.result = importResult;
          this.loading = false;
          this.pararPollingProgresso(true);
          this.importacaoConcluida.emit();
        },
        error: (err) => {
          this.loading = false;
          this.pararPollingProgresso(true);
          const msg =
            err?.error?.message ||
            (Array.isArray(err?.error?.message)
              ? err.error.message.join(', ')
              : null) ||
            'Não foi possível importar as etapas de produção. Verifique o agente e tente novamente.';
          this.error = msg;
          this.errorModalService.show(msg, 'Importar etapas de produção');
        },
      });
  }

  podeExecutarImportacao(): boolean {
    return (
      !this.loading &&
      !!this.unidade &&
      !!this.dataInicio &&
      !!this.dataFim &&
      this.dataInicio <= this.dataFim
    );
  }

  formatDateDisplay(value?: string): string {
    if (!value) {
      return '';
    }
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private iniciarPollingProgresso(): void {
    this.pararPollingProgresso();
    this.progressSubscription = this.importacaoProgressService.iniciarPolling(
      (progress) => {
        if (progress) {
          this.importacaoProgress = progress;
        }
      },
    );
  }

  private pararPollingProgresso(finalFetch = false): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = undefined;
    }

    if (finalFetch) {
      this.importacaoProgressService.getProgresso().subscribe({
        next: (progress) => {
          if (progress) {
            this.importacaoProgress = progress;
          }
        },
      });
    }
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const currentUser = this.authService.getCurrentUser();
    const unidade = currentUser?.unidade?.trim();
    if (!unidade) {
      return null;
    }
    return unidade as Unidade;
  }

  private resolverPeriodoPadrao(): { inicio: string; fim: string } {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return {
      inicio: this.formatDateIso(inicio),
      fim: this.formatDateIso(hoje),
    };
  }

  private formatDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
