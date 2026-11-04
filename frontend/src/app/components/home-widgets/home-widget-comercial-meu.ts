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

/** Mesmo piso da tela de acompanhamento (RN-COM-004). */
const ANO_COMPETENCIA_MIN = 2026;

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
  cardAnoMes = '';
  cardUnidade = '';
  cardErro: string | null = null;

  /** Competência selecionada no widget (null = deixa a API usar o mês corrente). */
  private anoFiltro: number | null = null;
  private mesFiltro: number | null = null;

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

  get podeMesAnterior(): boolean {
    const { ano, mes } = this.competenciaAtual();
    return !(ano <= ANO_COMPETENCIA_MIN && mes <= 1);
  }

  get podeMesProximo(): boolean {
    const { ano, mes } = this.competenciaAtual();
    const { ano: anoMax, mes: mesMax } = this.competenciaCorrente();
    return !(ano > anoMax || (ano === anoMax && mes >= mesMax));
  }

  atualizar(): void {
    this.carregarMeuCard();
  }

  navegarMesAnterior(): void {
    this.navegarMes(-1);
  }

  navegarMesProximo(): void {
    this.navegarMes(1);
  }

  private navegarMes(delta: number): void {
    if (this.cardCarregando) return;
    const atual = this.competenciaAtual();
    let mes = atual.mes + delta;
    let ano = atual.ano;
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    } else if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    const corrente = this.competenciaCorrente();
    if (ano < ANO_COMPETENCIA_MIN) return;
    if (
      ano > corrente.ano ||
      (ano === corrente.ano && mes > corrente.mes)
    ) {
      return;
    }
    this.anoFiltro = ano;
    this.mesFiltro = mes;
    this.carregarMeuCard();
  }

  private competenciaCorrente(): { ano: number; mes: number } {
    // Espelho aproximado do America/Sao_Paulo do backend (cliente BR).
    const agora = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );
    return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  }

  private competenciaAtual(): { ano: number; mes: number } {
    if (this.anoFiltro != null && this.mesFiltro != null) {
      return { ano: this.anoFiltro, mes: this.mesFiltro };
    }
    if (this.cardAnoMes) {
      const [ano, mes] = this.cardAnoMes.split('-').map((n) => Number(n));
      if (Number.isFinite(ano) && Number.isFinite(mes)) {
        return { ano, mes };
      }
    }
    return this.competenciaCorrente();
  }

  private carregarMeuCard(): void {
    this.cardErro = null;
    this.setCarregando(true);
    const competencia =
      this.anoFiltro != null && this.mesFiltro != null
        ? { ano: this.anoFiltro, mes: this.mesFiltro }
        : undefined;
    this.comercialAcomp
      .meuCard(competencia)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ComercialAcompanhamentoMeuCard) => {
          this.cardItem = res.item;
          this.cardUnidade = res.unidade;
          this.cardAnoMes = res.anoMes;
          const [ano, mes] = res.anoMes.split('-').map((n: string) => Number(n));
          if (Number.isFinite(ano) && Number.isFinite(mes)) {
            this.anoFiltro = ano;
            this.mesFiltro = mes;
            this.cardCompetencia = `${nomeMesPt(mes)} ${ano}`;
          } else {
            this.cardCompetencia = res.anoMes;
          }
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
