import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Venda } from '../../models/venda.model';
import { TipoDaBaixa, LancarBaixaDto, Baixa } from '../../models/baixa.model';
import { BaixasService } from '../../services/baixas.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-baixa-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './baixa-form-modal.html',
  styleUrls: ['./baixa-form-modal.css'],
})
export class BaixaFormModalComponent implements OnChanges {
  private readonly baixasService = inject(BaixasService);
  private readonly errorModalService = inject(ErrorModalService);

  @Input() showModal = false;
  @Input() venda: Venda | null = null;
  @Input() baixaEdicao: Baixa | null = null;
  @Input() totalBaixasExistentes = 0;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = false;
  showCloseConfirmationModal = false;
  showDataFuturaModal = false;
  dataFuturaConfirmada = false;

  baixaData: LancarBaixaDto = this.criarBaixaDataPadrao();
  valorDisplay = '0,00';

  TipoDaBaixa = TipoDaBaixa;
  tiposBaixa = Object.values(TipoDaBaixa);

  get modoEdicao(): boolean {
    return !!this.baixaEdicao;
  }

  get tituloModal(): string {
    return this.modoEdicao ? 'Editar Baixa' : 'Lançar Baixa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal']?.currentValue || changes['baixaEdicao']) {
      this.inicializarFormulario();
    }
  }

  onClose(): void {
    if (this.loading) {
      return;
    }

    if (this.hasUnsavedChanges()) {
      this.showCloseConfirmationModal = true;
      return;
    }

    this.fechar();
  }

  onCloseConfirmed(): void {
    this.showCloseConfirmationModal = false;
    this.fechar();
  }

  onCloseCancelled(): void {
    this.showCloseConfirmationModal = false;
  }

  onSubmit(): void {
    if (!this.venda || !this.isFormValid()) {
      return;
    }

    if (this.isDataFutura(this.baixaData.dataBaixa) && !this.dataFuturaConfirmada) {
      this.showDataFuturaModal = true;
      return;
    }

    this.dataFuturaConfirmada = false;
    this.processarBaixa();
  }

  onDataFuturaConfirmed(): void {
    this.showDataFuturaModal = false;
    this.dataFuturaConfirmada = true;
    this.onSubmit();
  }

  onDataFuturaCancelled(): void {
    this.showDataFuturaModal = false;
    this.dataFuturaConfirmada = false;
  }

  getValorRestante(): number {
    if (!this.venda) {
      return 0;
    }

    const valorCliente = this.venda.valorCliente || 0;
    return Math.max(0, Number((valorCliente - this.totalBaixasExistentes).toFixed(2)));
  }

  canPreencherSaldoRestante(): boolean {
    return this.getValorRestante() > 0;
  }

  preencherSaldoRestante(): void {
    const restante = this.getValorRestante();
    if (restante <= 0) {
      this.errorModalService.show('Não há saldo restante para preencher.', 'Atenção');
      return;
    }

    this.baixaData.valorBaixa = restante;
    this.valorDisplay = this.formatCurrencyDisplay(restante);
  }

  getTipoBaixaLabel(tipo: TipoDaBaixa): string {
    const labels = {
      [TipoDaBaixa.DINHEIRO]: 'Dinheiro',
      [TipoDaBaixa.CARTAO_PIX]: 'Cartão/PIX',
      [TipoDaBaixa.DEPOSITO]: 'Depósito',
    };
    return labels[tipo] || tipo;
  }

  formatDateDisplay(date: string | Date | null | undefined): string {
    if (!date) {
      return '-';
    }

    if (typeof date === 'string') {
      const parte = date.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(parte)) {
        const [ano, mes, dia] = parte.split('-');
        return `${dia}/${mes}/${ano}`;
      }
    }

    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }

    return '-';
  }

  formatCurrencyInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 8) {
      value = value.substring(0, 8);
    }

    if (value === '') {
      this.baixaData.valorBaixa = 0;
      this.valorDisplay = '';
      return;
    }

    const numValue = parseInt(value, 10) / 100;
    this.baixaData.valorBaixa = numValue;
    this.valorDisplay = value
      .replace(/(\d{1,5})(\d{2})$/, '$1,$2')
      .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  }

  formatCurrencyOnBlur(): void {
    const value = this.baixaData.valorBaixa;
    if (value !== null && value !== undefined && value !== 0) {
      this.valorDisplay = this.formatCurrencyDisplay(value);
    } else {
      this.valorDisplay = '0,00';
    }
  }

  onValorFocus(): void {
    if (this.valorDisplay === '0,00' || this.valorDisplay === '') {
      this.valorDisplay = '';
      this.baixaData.valorBaixa = 0;
    }
  }

  private fechar(): void {
    this.resetForm();
    this.close.emit();
  }

  private inicializarFormulario(): void {
    if (!this.showModal) {
      return;
    }

    if (this.baixaEdicao) {
      const dataBaixa =
        typeof this.baixaEdicao.dataBaixa === 'string'
          ? this.baixaEdicao.dataBaixa.split('T')[0]
          : (this.baixaEdicao.dataBaixa as Date).toISOString().split('T')[0];

      this.baixaData = {
        tipoDaBaixa: this.baixaEdicao.tipoDaBaixa,
        valorBaixa: this.baixaEdicao.valorBaixa,
        dataBaixa,
        observacao: this.baixaEdicao.observacao || '',
      };
      this.valorDisplay = this.formatCurrencyDisplay(this.baixaEdicao.valorBaixa);
      return;
    }

    this.resetForm();
  }

  private processarBaixa(): void {
    if (!this.venda) {
      return;
    }

    this.loading = true;

    if (this.modoEdicao && this.baixaEdicao) {
      const updateBaixaDto = {
        tipoDaBaixa: this.baixaData.tipoDaBaixa,
        valorBaixa: this.baixaData.valorBaixa,
        dataBaixa: this.baixaData.dataBaixa,
        observacao: this.baixaData.observacao,
      };

      this.baixasService.updateBaixa(this.baixaEdicao.id, updateBaixaDto).subscribe({
        next: () => {
          this.loading = false;
          this.resetForm();
          this.saved.emit();
          this.close.emit();
        },
        error: (error) => {
          this.loading = false;
          const message = error.error?.message || 'Erro ao atualizar baixa';
          this.errorModalService.show(message, 'Erro');
        },
      });
      return;
    }

    const createBaixaDto = {
      idvenda: this.venda.id,
      tipoDaBaixa: this.baixaData.tipoDaBaixa,
      valorBaixa: this.baixaData.valorBaixa,
      dataBaixa: this.baixaData.dataBaixa,
      observacao: this.baixaData.observacao,
    };

    this.baixasService.createBaixa(createBaixaDto).subscribe({
      next: () => {
        this.loading = false;
        this.resetForm();
        this.saved.emit();
        this.close.emit();
      },
      error: (error) => {
        this.loading = false;
        const message = error.error?.message || 'Erro ao lançar baixa';
        this.errorModalService.show(message, 'Erro');
      },
    });
  }

  private isFormValid(): boolean {
    if (!this.baixaData.tipoDaBaixa) {
      this.errorModalService.show('Selecione o tipo da baixa', 'Campo Obrigatório');
      return false;
    }

    if (!this.baixaData.valorBaixa || this.baixaData.valorBaixa <= 0) {
      this.errorModalService.show('Informe um valor válido para a baixa', 'Campo Obrigatório');
      return false;
    }

    if (!this.baixaData.dataBaixa) {
      this.errorModalService.show('Selecione a data da baixa', 'Campo Obrigatório');
      return false;
    }

    let totalBaixasAtual = this.totalBaixasExistentes;

    if (this.modoEdicao && this.baixaEdicao) {
      totalBaixasAtual -= this.baixaEdicao.valorBaixa || 0;
    }

    const totalComNovaBaixa = totalBaixasAtual + this.baixaData.valorBaixa;
    const valorCliente = this.venda?.valorCliente || 0;

    if (totalComNovaBaixa > valorCliente) {
      const diferenca = totalComNovaBaixa - valorCliente;
      const valorRestante = valorCliente - totalBaixasAtual;
      this.errorModalService.show(
        `O valor da baixa ultrapassa o valor total em ${this.formatCurrency(diferenca)}. Valor restante: ${this.formatCurrency(valorRestante)}`,
        'Valor Inválido',
      );
      return false;
    }

    return true;
  }

  private hasUnsavedChanges(): boolean {
    if (this.modoEdicao && this.baixaEdicao) {
      const dataOriginal =
        typeof this.baixaEdicao.dataBaixa === 'string'
          ? this.baixaEdicao.dataBaixa.split('T')[0]
          : this.baixaEdicao.dataBaixa;

      return (
        this.baixaData.tipoDaBaixa !== this.baixaEdicao.tipoDaBaixa ||
        this.baixaData.valorBaixa !== this.baixaEdicao.valorBaixa ||
        this.baixaData.dataBaixa !== dataOriginal ||
        (this.baixaData.observacao || '') !== (this.baixaEdicao.observacao || '')
      );
    }

    if (this.baixaData.valorBaixa > 0) {
      return true;
    }

    if (this.baixaData.observacao?.trim()) {
      return true;
    }

    if (this.baixaData.tipoDaBaixa !== TipoDaBaixa.CARTAO_PIX) {
      return true;
    }

    const hoje = new Date().toISOString().split('T')[0];
    return this.baixaData.dataBaixa !== hoje;
  }

  private isDataFutura(dataBaixa: string): boolean {
    if (!dataBaixa) {
      return false;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInformada = new Date(dataBaixa);
    dataInformada.setHours(0, 0, 0, 0);

    return dataInformada > hoje;
  }

  private resetForm(): void {
    this.baixaData = this.criarBaixaDataPadrao();
    this.valorDisplay = '0,00';
    this.dataFuturaConfirmada = false;
  }

  private criarBaixaDataPadrao(): LancarBaixaDto {
    return {
      tipoDaBaixa: TipoDaBaixa.CARTAO_PIX,
      valorBaixa: 0,
      dataBaixa: new Date().toISOString().split('T')[0],
      observacao: '',
    };
  }

  private formatCurrencyDisplay(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }
}
