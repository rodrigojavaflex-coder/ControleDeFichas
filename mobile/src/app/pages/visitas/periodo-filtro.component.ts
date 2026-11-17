import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodoHistoricoFiltro, PeriodoHistoricoModo, ComparacaoDiasHistorico, FiltroDiasHistorico } from '../../models/visita.model';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

@Component({
  selector: 'app-periodo-filtro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './periodo-filtro.component.html',
  styleUrls: ['./periodo-filtro.component.scss'],
})
export class PeriodoFiltroComponent {
  @Input() mostrarDias = true;
  /** Só o bloco de dias, para o card separado da aba Histórico. */
  @Input() somenteDias = false;
  @Output() alterado = new EventEmitter<PeriodoHistoricoFiltro | null>();
  @Output() diasAlterado = new EventEmitter<FiltroDiasHistorico | null>();

  readonly meses = MESES;
  modo: PeriodoHistoricoModo | null = null;
  ano = this.hoje().ano;
  mes = this.hoje().mes;
  dataInicio = '';
  dataFim = '';
  aviso = '';
  modoDias: ComparacaoDiasHistorico | null = null;
  diasTexto: string | number | null = '';
  private diasTimer: ReturnType<typeof setTimeout> | null = null;

  readonly anos = Array.from({ length: 6 }, (_, i) => this.hoje().ano - i);

  escolher(modo: PeriodoHistoricoModo): void {
    this.modo = modo;
    this.aviso = '';
    if (modo === 'personalizado') {
      this.alterado.emit({ periodo: 'personalizado' });
      return;
    }
    this.emitir();
  }

  limpar(): void {
    this.modo = null;
    this.dataInicio = '';
    this.dataFim = '';
    this.aviso = '';
    const hoje = this.hoje();
    this.ano = hoje.ano;
    this.mes = hoje.mes;
    this.alterado.emit(null);
  }

  aoMudarAnoMes(): void {
    if (this.modo === 'ano' || this.modo === 'mes') {
      this.emitir();
    }
  }

  aoMudarDatas(): void {
    if (this.modo !== 'personalizado') return;
    this.aviso = '';
    if (!this.dataInicio || !this.dataFim) return;
    if (this.dataFim < this.dataInicio) {
      this.aviso = 'A data final precisa ser igual ou posterior à inicial.';
      return;
    }
    this.emitir();
  }

  escolherDias(modo: ComparacaoDiasHistorico): void {
    this.modoDias = modo;
    this.agendarDias();
  }

  limparDias(): void {
    this.modoDias = null;
    this.diasTexto = '';
    if (this.diasTimer) clearTimeout(this.diasTimer);
    this.diasAlterado.emit(null);
  }

  aoMudarDias(): void {
    this.agendarDias();
  }

  private agendarDias(): void {
    if (this.diasTimer) clearTimeout(this.diasTimer);
    this.diasTimer = setTimeout(() => this.emitirDias(), 350);
  }

  private emitirDias(): void {
    if (!this.modoDias) {
      this.diasAlterado.emit(null);
      return;
    }
    const bruto = this.diasTexto;
    if (bruto == null || bruto === '') {
      this.diasAlterado.emit(null);
      return;
    }
    const dias = typeof bruto === 'number' ? bruto : Number(String(bruto).trim());
    if (!Number.isInteger(dias) || dias < 0 || dias > 3650) return;
    this.diasAlterado.emit({ comparacao: this.modoDias, dias });
  }

  private emitir(): void {
    if (this.modo === 'ano') {
      this.alterado.emit({ periodo: 'ano', ano: Number(this.ano) });
      return;
    }
    if (this.modo === 'mes') {
      this.alterado.emit({
        periodo: 'mes',
        ano: Number(this.ano),
        mes: Number(this.mes),
      });
      return;
    }
    if (this.modo === 'personalizado' && this.dataInicio && this.dataFim) {
      this.alterado.emit({
        periodo: 'personalizado',
        dataInicio: this.dataInicio,
        dataFim: this.dataFim,
      });
    }
  }

  private hoje(): { ano: number; mes: number } {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    return {
      ano: Number(partes.find((parte) => parte.type === 'year')?.value),
      mes: Number(partes.find((parte) => parte.type === 'month')?.value),
    };
  }
}
