import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  inject,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Unidade } from '../../models/usuario.model';
import {
  FormulaAmostraLimpeza,
  LimparProducaoEtapasAntigasResponse,
  ProducaoEtapaDisponivelLimpeza,
} from '../../models/sincronizacao.model';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';

export interface LimparProducaoEtapasModalOptions {
  dataLimite?: string;
  unidade?: Unidade | '';
}

@Component({
  selector: 'app-limpar-producao-etapas-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './limpar-producao-etapas-modal.html',
  styleUrls: ['./limpar-producao-etapas-modal.css'],
})
export class LimparProducaoEtapasModalComponent implements OnDestroy {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);

  unidades = Object.values(Unidade);

  visible = false;
  loadingEtapas = false;
  loadingPreview = false;
  loadingExecucao = false;
  error = '';
  dataLimite = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;

  etapasDisponiveis: ProducaoEtapaDisponivelLimpeza[] = [];
  etapasSelecionadas = new Set<string>();

  preview: LimparProducaoEtapasAntigasResponse | null = null;
  result: LimparProducaoEtapasAntigasResponse | null = null;
  confirmacaoTexto = '';

  listaCompletaVisivel = false;
  loadingListaCompleta = false;
  formulasCompletas: FormulaAmostraLimpeza[] = [];

  @Output() limpezaConcluida = new EventEmitter<void>();

  ngOnDestroy(): void {
    // sem subscriptions persistentes
  }

  get loading(): boolean {
    return (
      this.loadingPreview ||
      this.loadingExecucao ||
      this.loadingEtapas ||
      this.loadingListaCompleta
    );
  }

  abrir(options?: LimparProducaoEtapasModalOptions): void {
    this.error = '';
    this.preview = null;
    this.result = null;
    this.confirmacaoTexto = '';
    this.resetListaCompleta();
    this.etapasDisponiveis = [];
    this.etapasSelecionadas = new Set();

    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? options?.unidade ?? '';

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    this.dataLimite =
      options?.dataLimite ?? this.formatarYmd(ontem);

    this.visible = true;
    if (this.unidade) {
      this.carregarEtapas();
    }
  }

  fechar(): void {
    if (this.loading) return;
    this.visible = false;
  }

  onUnidadeChange(): void {
    this.preview = null;
    this.result = null;
    this.confirmacaoTexto = '';
    this.resetListaCompleta();
    this.etapasSelecionadas = new Set();
    if (this.unidade) {
      this.carregarEtapas();
    } else {
      this.etapasDisponiveis = [];
    }
  }

  onDataLimiteChange(): void {
    this.preview = null;
    this.result = null;
    this.confirmacaoTexto = '';
    this.resetListaCompleta();
  }

  toggleEtapa(codEtapa: string): void {
    const next = new Set(this.etapasSelecionadas);
    if (next.has(codEtapa)) {
      next.delete(codEtapa);
    } else {
      next.add(codEtapa);
    }
    this.etapasSelecionadas = next;
    this.preview = null;
    this.result = null;
    this.confirmacaoTexto = '';
    this.resetListaCompleta();
  }

  isEtapaSelecionada(codEtapa: string): boolean {
    return this.etapasSelecionadas.has(codEtapa);
  }

  selecionarEtapasRot(): void {
    const next = new Set(this.etapasSelecionadas);
    for (const e of this.etapasDisponiveis) {
      if (e.etapa.toUpperCase().includes('ROT')) {
        next.add(e.codEtapa);
      }
    }
    this.etapasSelecionadas = next;
    this.preview = null;
    this.result = null;
    this.resetListaCompleta();
  }

  podePreview(): boolean {
    return (
      !!this.unidade &&
      /^\d{4}-\d{2}-\d{2}$/.test(this.dataLimite) &&
      this.etapasSelecionadas.size > 0 &&
      !this.loading
    );
  }

  podeExecutar(): boolean {
    return (
      !!this.preview &&
      !this.preview.executado &&
      this.confirmacaoTexto.trim().toUpperCase() === 'LIMPAR' &&
      !this.loading
    );
  }

  executarPreview(): void {
    if (!this.podePreview() || !this.unidade) return;
    this.error = '';
    this.result = null;
    this.resetListaCompleta();
    this.loadingPreview = true;
    this.sincronizacaoService
      .previewLimparProducaoEtapasAntigas({
        unidade: this.unidade,
        dataLimite: this.dataLimite,
        etapasFinais: [...this.etapasSelecionadas],
      })
      .subscribe({
        next: (res) => {
          this.preview = res;
          this.confirmacaoTexto = '';
          this.loadingPreview = false;
        },
        error: (err) => {
          this.loadingPreview = false;
          this.error =
            err?.error?.message ??
            'Erro ao pré-visualizar limpeza de etapas.';
          this.errorModalService.show(this.error, 'Limpeza de etapas');
        },
      });
  }

  toggleListaCompleta(): void {
    if (this.listaCompletaVisivel) {
      this.listaCompletaVisivel = false;
      return;
    }
    if (this.formulasCompletas.length) {
      this.listaCompletaVisivel = true;
      return;
    }
    this.carregarListaCompleta();
  }

  carregarListaCompleta(): void {
    if (!this.unidade || !this.preview) return;
    this.loadingListaCompleta = true;
    this.error = '';
    this.sincronizacaoService
      .listarFormulasSemFimLimpeza({
        unidade: this.unidade,
        dataLimite: this.dataLimite,
        etapasFinais: [...this.etapasSelecionadas],
      })
      .subscribe({
        next: (res) => {
          this.formulasCompletas = res.formulas;
          this.listaCompletaVisivel = true;
          this.loadingListaCompleta = false;
        },
        error: (err) => {
          this.loadingListaCompleta = false;
          this.error =
            err?.error?.message ??
            'Erro ao carregar lista completa de fórmulas.';
          this.errorModalService.show(this.error, 'Limpeza de etapas');
        },
      });
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) return '';
    const parte = String(iso).trim().slice(0, 10);
    const [y, m, d] = parte.split('-');
    if (!y || !m || !d) return parte;
    return `${d}/${m}/${y}`;
  }

  private resetListaCompleta(): void {
    this.listaCompletaVisivel = false;
    this.loadingListaCompleta = false;
    this.formulasCompletas = [];
  }

  executarLimpeza(): void {
    if (!this.podeExecutar() || !this.unidade) return;
    this.error = '';
    this.loadingExecucao = true;
    this.sincronizacaoService
      .limparProducaoEtapasAntigas({
        unidade: this.unidade,
        dataLimite: this.dataLimite,
        etapasFinais: [...this.etapasSelecionadas],
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.preview = res;
          this.loadingExecucao = false;
          this.confirmacaoTexto = '';
          this.limpezaConcluida.emit();
        },
        error: (err) => {
          this.loadingExecucao = false;
          this.error =
            err?.error?.message ?? 'Erro ao executar limpeza de etapas.';
          this.errorModalService.show(this.error, 'Limpeza de etapas');
        },
      });
  }

  private carregarEtapas(): void {
    if (!this.unidade) return;
    this.loadingEtapas = true;
    this.error = '';
    this.sincronizacaoService
      .listarEtapasDisponiveisLimpeza(this.unidade)
      .subscribe({
        next: (lista) => {
          this.etapasDisponiveis = lista;
          this.loadingEtapas = false;
        },
        error: (err) => {
          this.loadingEtapas = false;
          this.etapasDisponiveis = [];
          this.error =
            err?.error?.message ??
            'Erro ao carregar etapas da unidade.';
        },
      });
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const unidade = this.authService.getCurrentUser()?.unidade?.trim();
    if (!unidade) {
      return null;
    }
    return unidade as Unidade;
  }

  private formatarYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
