import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ComercialAcompanhamentoService } from '../../services/comercial-acompanhamento.service';
import {
  ComercialAcompanhamentoItem,
  ComercialAcompanhamentoMeuCard,
} from '../../models/comercial-acompanhamento.model';
import { Permission } from '../../models/usuario.model';
import { ComercialVendedorCardComponent } from '../comercial/comercial-vendedor-card';
import { nomeMesPt } from '../folha/folha-meses';

@Component({
  selector: 'app-home-widget-comercial-meu',
  standalone: true,
  imports: [CommonModule, ComercialVendedorCardComponent],
  templateUrl: './home-widget-comercial-meu.html',
  styleUrls: ['./home-widget-comercial-meu.css'],
})
export class HomeWidgetComercialMeuComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private comercialAcomp = inject(ComercialAcompanhamentoService);
  private destroy$ = new Subject<void>();

  @Output() carregandoChange = new EventEmitter<boolean>();

  cardCarregando = false;
  cardItem: ComercialAcompanhamentoItem | null = null;
  cardCompetencia = '';
  cardUnidade = '';
  cardErro: string | null = null;

  ngOnInit(): void {
    this.carregarMeuCard();
  }

  ngOnDestroy(): void {
    if (this.cardCarregando) {
      this.setCarregando(false);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get podeAbrirAcompanhamento(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ACOMPANHAMENTO_READ);
  }

  get podeVerComissao(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ACOMPANHAMENTO_COMISSAO);
  }

  atualizar(): void {
    this.carregarMeuCard();
  }

  private carregarMeuCard(): void {
    this.cardErro = null;
    this.setCarregando(true);
    this.comercialAcomp
      .meuCard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ComercialAcompanhamentoMeuCard) => {
          this.cardItem = res.item;
          this.cardUnidade = res.unidade;
          const [ano, mes] = res.anoMes.split('-').map((n: string) => Number(n));
          this.cardCompetencia =
            Number.isFinite(mes) && Number.isFinite(ano)
              ? `${nomeMesPt(mes)} ${ano}`
              : res.anoMes;
          this.setCarregando(false);
        },
        error: (e: { error?: { message?: string } }) => {
          this.setCarregando(false);
          this.cardErro =
            e?.error?.message ?? 'Não foi possível carregar o card comercial.';
        },
      });
  }

  private setCarregando(valor: boolean): void {
    if (this.cardCarregando === valor) return;
    this.cardCarregando = valor;
    this.carregandoChange.emit(valor);
  }
}
