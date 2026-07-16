import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Unidade } from '../../models/usuario.model';
import { ImportarOrcamentosResponse } from '../../models/sincronizacao.model';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';

export interface ImportarOrcamentosModalOptions {
  dataInicio?: string;
  dataFim?: string;
  unidade?: Unidade | '';
}

@Component({
  selector: 'app-importar-orcamentos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent],
  templateUrl: './importar-orcamentos-modal.html',
  styleUrls: ['./importar-orcamentos-modal.css'],
})
export class ImportarOrcamentosModalComponent {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);

  unidades = Object.values(Unidade);

  visible = false;
  loading = false;
  error = '';
  dataInicio = '';
  dataFim = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  result: ImportarOrcamentosResponse | null = null;

  @Output() importacaoConcluida = new EventEmitter<void>();

  abrir(options?: ImportarOrcamentosModalOptions): void {
    this.error = '';
    this.result = null;

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

    this.sincronizacaoService
      .importarOrcamentos({
        unidade: this.unidade,
        dataInicio: this.dataInicio,
        dataFim: this.dataFim,
      })
      .subscribe({
        next: (importResult) => {
          this.result = importResult;
          this.loading = false;
          this.importacaoConcluida.emit();
        },
        error: (err) => {
          this.loading = false;
          const msg =
            err?.error?.message ||
            (Array.isArray(err?.error?.message)
              ? err.error.message.join(', ')
              : null) ||
            'Não foi possível importar os orçamentos. Verifique o agente e tente novamente.';
          this.error = msg;
          this.errorModalService.show(msg, 'Importar orçamentos');
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
