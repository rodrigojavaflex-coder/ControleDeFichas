import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ComercialAcompanhamentoService } from '../../services/comercial-acompanhamento.service';
import {
  ComercialAcompanhamentoItem,
  ComercialAcompanhamentoUnidadeCard,
} from '../../models/comercial-acompanhamento.model';
import { Permission } from '../../models/usuario.model';
import { ComercialVendedorCardComponent } from '../comercial/comercial-vendedor-card';
import { nomeMesPt } from '../folha/folha-meses';

@Component({
  selector: 'app-home-widget-comercial-unidade',
  standalone: true,
  imports: [CommonModule, RouterModule, ComercialVendedorCardComponent],
  templateUrl: './home-widget-comercial-unidade.html',
  styleUrls: ['./home-widget-comercial-unidade.css'],
  encapsulation: ViewEncapsulation.None,
})
export class HomeWidgetComercialUnidadeComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private comercialAcomp = inject(ComercialAcompanhamentoService);
  private destroy$ = new Subject<void>();

  @Output() carregandoChange = new EventEmitter<boolean>();

  carregando = false;
  erro: string | null = null;
  competencia = '';
  cards: ComercialAcompanhamentoUnidadeCard[] = [];

  modalAberto = false;
  modalCard: ComercialAcompanhamentoUnidadeCard | null = null;

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

  get podeAbrirAcompanhamento(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ACOMPANHAMENTO_READ);
  }

  atualizar(): void {
    this.carregar();
  }

  abrirCompleto(card: ComercialAcompanhamentoUnidadeCard): void {
    this.modalCard = card;
    this.modalAberto = true;
  }

  fecharCompleto(): void {
    this.modalAberto = false;
    this.modalCard = null;
  }

  formatarMoeda(valor: number | null | undefined): string {
    const n = Number(valor ?? 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarPercentualMeta(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return `${Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  formatarData(ymd: string | null | undefined): string {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  }

  valorTotalRecebido(item: ComercialAcompanhamentoItem): number {
    return (
      Number(item.valorRecebidoRequisicao || 0) +
      Number(item.valorRecebidoMarcaPropria || 0)
    );
  }

  valorTotalProjetado(item: ComercialAcompanhamentoItem): number {
    return (
      Number(item.valorProjetadoRequisicao || 0) +
      Number(item.valorProjetadoMarcaPropria || 0)
    );
  }

  valorMetaTotalGeral(item: ComercialAcompanhamentoItem): number | null {
    const temReq = this.temMetaCadastrada(item.valorMetaRequisicao);
    const temMp = this.temMetaCadastrada(item.valorMetaMarcaPropria);
    if (!temReq && !temMp) return null;
    return (
      (temReq ? Number(item.valorMetaRequisicao) : 0) +
      (temMp ? Number(item.valorMetaMarcaPropria) : 0)
    );
  }

  metaTotalGeralParcial(item: ComercialAcompanhamentoItem): boolean {
    const temReq = this.temMetaCadastrada(item.valorMetaRequisicao);
    const temMp = this.temMetaCadastrada(item.valorMetaMarcaPropria);
    return (temReq && !temMp) || (!temReq && temMp);
  }

  percentualSobreMetaTotal(
    valor: number | null | undefined,
    meta: number | null | undefined,
  ): number | null {
    if (!this.temMetaCadastrada(meta)) return null;
    return (Number(valor || 0) / Number(meta)) * 100;
  }

  temMetaCadastrada(valor: number | null | undefined): boolean {
    return valor != null && valor > 0;
  }

  larguraBarraMeta(valor: number | null | undefined): number {
    if (valor == null || !Number.isFinite(valor) || valor <= 0) return 0;
    return Math.min(100, valor);
  }

  arcoMetaRing(valor: number | null | undefined): string {
    const circunferencia = 2 * Math.PI * 15.5;
    const pct = this.larguraBarraMeta(valor) / 100;
    const preenchido = circunferencia * pct;
    return `${preenchido.toFixed(2)} ${(circunferencia - preenchido).toFixed(2)}`;
  }

  classeCorAnelMeta(valor: number | null | undefined): string {
    const pct = Number(valor);
    if (!Number.isFinite(pct)) return 'is-vermelho';
    if (pct >= 100) return 'is-verde';
    if (pct < 80) return 'is-vermelho';
    return 'is-azul';
  }

  private carregar(): void {
    this.setCarregando(true);
    this.erro = null;
    this.comercialAcomp
      .unidadeCards()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.cards = res.itens ?? [];
          const [ano, mes] = res.anoMes.split('-').map((n) => Number(n));
          this.competencia =
            Number.isFinite(mes) && Number.isFinite(ano)
              ? `${nomeMesPt(mes)} ${ano}`
              : res.anoMes;
          if (this.modalAberto && this.modalCard) {
            const atualizado = this.cards.find(
              (c) => c.unidade === this.modalCard!.unidade,
            );
            if (atualizado) {
              this.modalCard = atualizado;
            }
          }
          this.setCarregando(false);
        },
        error: (e: { error?: { message?: string } }) => {
          this.setCarregando(false);
          this.erro =
            e?.error?.message ??
            'Não foi possível carregar o resumo da unidade.';
        },
      });
  }

  private setCarregando(valor: boolean): void {
    if (this.carregando === valor) return;
    this.carregando = valor;
    this.carregandoChange.emit(valor);
  }
}
