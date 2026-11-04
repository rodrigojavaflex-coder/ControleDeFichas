import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ComercialAnaliseService } from '../../services/comercial-analise.service';
import { ErrorModalService } from '../../services/error-modal.service';
import {
  ComercialAnaliseHomeDestaque,
  ComercialAnaliseHomeResponse,
  ComercialAnaliseHomeUnidadeCard,
} from '../../models/comercial-analise.model';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-home-widget-comercial-analise',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-widget-comercial-analise.html',
  styleUrls: ['./home-widget-comercial-analise.css'],
})
export class HomeWidgetComercialAnaliseComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private analise = inject(ComercialAnaliseService);
  private errors = inject(ErrorModalService);
  private destroy$ = new Subject<void>();

  @Output() carregandoChange = new EventEmitter<boolean>();

  carregando = false;
  resumo: ComercialAnaliseHomeResponse | null = null;

  private readonly moedaFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  private readonly percentualFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    if (this.carregando) {
      this.setCarregando(false);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get podeAbrirAnalise(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ANALISE_READ);
  }

  get cards(): ComercialAnaliseHomeUnidadeCard[] {
    return this.resumo?.itens ?? [];
  }

  get temComparacao(): boolean {
    return this.resumo?.temComparacao === true;
  }

  /** Ex.: "Semanas fechadas: 19 a 25 Out vs 26 Out a 01 Nov". */
  get tituloComparativo(): string {
    if (!this.resumo) return 'Semanas fechadas';
    if (!this.temComparacao || !this.resumo.semanaAnterior) {
      return 'Semanas fechadas: sem semana anterior';
    }
    const ant =
      this.resumo.semanaAnterior.labelCurto ||
      this.resumo.semanaAnterior.label;
    const atu =
      this.resumo.semanaAtual.labelCurto || this.resumo.semanaAtual.label;
    return `Semanas fechadas: ${ant} vs ${atu}`;
  }

  atualizar(): void {
    this.carregar();
  }

  /**
   * 1º e 2º nome; com 2 partes devolve em duas linhas
   * (ex.: GABRIELA\nGARCIA) para caber na coluna do card.
   */
  nomeCurto(nome: string | null | undefined): string {
    const partes = String(nome || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return '—';
    if (partes.length === 1) return partes[0];
    return `${partes[0]}\n${partes[1]}`;
  }

  formatarMoeda(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return this.moedaFormatter.format(Number(valor));
  }

  formatarDelta(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    const n = Number(valor);
    const sinal = n > 0 ? '+' : '';
    return `${sinal}${this.moedaFormatter.format(n)}`;
  }

  formatarPercentual(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    const n = Number(valor);
    const sinal = n > 0 ? '+' : '';
    return `${sinal}${this.percentualFormatter.format(n)}%`;
  }

  classeDelta(destaque: ComercialAnaliseHomeDestaque | null): string {
    if (!destaque) return '';
    if (destaque.delta > 0) return 'is-crescimento';
    if (destaque.delta < 0) return 'is-queda';
    return '';
  }

  private carregar(): void {
    this.setCarregando(true);
    this.analise
      .resumoHome()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.resumo = res;
          this.setCarregando(false);
        },
        error: (e: { error?: { message?: string } }) => {
          this.setCarregando(false);
          this.errors.show(
            e?.error?.message ??
              'Não foi possível carregar o resumo da análise comercial.',
            'Erro',
            { retryLabel: 'Tentar de novo', onRetry: () => this.carregar() },
          );
        },
      });
  }

  private setCarregando(valor: boolean): void {
    if (this.carregando === valor) return;
    this.carregando = valor;
    this.carregandoChange.emit(valor);
  }
}
