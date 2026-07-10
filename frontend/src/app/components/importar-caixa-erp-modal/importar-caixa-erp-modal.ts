import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Unidade } from '../../models/usuario.model';
import { FechamentoCaixaService } from '../../services/fechamento-caixa.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import {
  CaixaPreviewRow,
  ImportarCaixaErpResponse,
} from '../../models/fechamento-caixa.model';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';

export interface ImportarCaixaErpModalOptions {
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  unidade?: Unidade | '';
  modoPeriodo?: boolean;
}

@Component({
  selector: 'app-importar-caixa-erp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent],
  templateUrl: './importar-caixa-erp-modal.html',
  styleUrls: ['./importar-caixa-erp-modal.css'],
})
export class ImportarCaixaErpModalComponent {
  private readonly fechamentoCaixaService = inject(FechamentoCaixaService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);

  unidades = Object.values(Unidade);

  visible = false;
  loading = false;
  error = '';
  modoPeriodo = false;
  data = '';
  dataInicio = '';
  dataFim = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  @Output() importacaoConcluida = new EventEmitter<void>();
  result: ImportarCaixaErpResponse | null = null;
  previewRows: CaixaPreviewRow[] = [];

  abrir(options?: ImportarCaixaErpModalOptions): void {
    this.error = '';
    this.result = null;
    this.previewRows = [];
    this.modoPeriodo = options?.modoPeriodo ?? false;

    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? options?.unidade ?? '';

    if (this.modoPeriodo) {
      const periodoPadrao = this.resolverPeriodoPadrao();
      this.dataInicio = options?.dataInicio ?? periodoPadrao.inicio;
      this.dataFim = options?.dataFim ?? periodoPadrao.fim;
      this.data = '';
    } else {
      this.data = options?.data ?? this.resolverDataPadrao();
      this.dataInicio = this.data;
      this.dataFim = this.data;
    }

    this.visible = true;
  }

  onPeriodoRangeChange(range: DateRangeValue): void {
    this.dataInicio = range.start;
    this.dataFim = range.end;
  }

  get tituloModal(): string {
    return this.modoPeriodo
      ? 'Buscar caixa ERP por período'
      : 'Buscar caixa ERP';
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
      this.error = 'Selecione a unidade do caixa.';
      return;
    }

    const inicio = this.modoPeriodo ? this.dataInicio : this.data;
    const fim = this.modoPeriodo ? this.dataFim : this.data;

    if (!inicio || !fim) {
      this.error = this.modoPeriodo
        ? 'Informe o período (data início e fim).'
        : 'Informe a data do caixa.';
      return;
    }

    if (inicio > fim) {
      this.error = 'A data inicial não pode ser posterior à data final.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;
    this.previewRows = [];

    this.fechamentoCaixaService
      .importarCaixaErp({
        unidade: this.unidade,
        dataInicio: inicio,
        dataFim: fim,
      })
      .subscribe({
        next: (importResult) => {
          if (this.modoPeriodo) {
            this.result = importResult;
            this.previewRows = this.montarPreviewCaixa(importResult);
          } else {
            this.visible = false;
          }
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
            'Não foi possível importar o caixa ERP. Verifique o agente e tente novamente.';
          this.error = msg;
          this.errorModalService.show(msg, 'Importar caixa ERP');
        },
      });
  }

  podeExecutarImportacao(): boolean {
    if (this.loading || !this.unidade) {
      return false;
    }
    if (this.modoPeriodo) {
      return !!this.dataInicio && !!this.dataFim && this.dataInicio <= this.dataFim;
    }
    return !!this.data;
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

  formatPreviewCell(total: { qtd: number; liquido: number } | null): string {
    if (!total) {
      return '—';
    }
    return `${total.qtd} / ${this.formatCurrency(total.liquido)}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const currentUser = this.authService.getCurrentUser();
    const unidade = currentUser?.unidade?.trim();
    if (!unidade) {
      return null;
    }
    return unidade as Unidade;
  }

  private resolverDataPadrao(): string {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return this.formatDateIso(yesterday);
  }

  private resolverPeriodoPadrao(): { inicio: string; fim: string } {
    const fim = this.resolverDataPadrao();
    const inicioDate = new Date();
    inicioDate.setDate(1);
    return {
      inicio: this.formatDateIso(inicioDate),
      fim,
    };
  }

  private formatDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private montarPreviewCaixa(
    importResult: ImportarCaixaErpResponse,
  ): CaixaPreviewRow[] {
    const formas = new Set<string>([
      ...Object.keys(importResult.totaisConsolidados ?? {}),
      ...Object.keys(importResult.totaisErpNormalizados ?? {}),
      ...(importResult.totaisTerceiroDetalhe ?? []).map((t) => t.forma),
    ]);

    return Array.from(formas)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((forma) => ({
        forma,
        terceiro: importResult.totaisTerceiro?.[forma] ?? null,
        erp: importResult.totaisErpNormalizados?.[forma] ?? null,
        consolidado: importResult.totaisConsolidados?.[forma] ?? null,
      }));
  }
}
