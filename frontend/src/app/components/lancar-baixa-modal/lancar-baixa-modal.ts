import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Venda, VendaStatus } from '../../models/venda.model';
import { TipoDaBaixa, LancarBaixaDto, Baixa } from '../../models/baixa.model';
import { BaixasService } from '../../services/baixas.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { VendaService } from '../../services/vendas.service';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-lancar-baixa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './lancar-baixa-modal.html',
  styleUrls: ['./lancar-baixa-modal.css']
})
export class LancarBaixaModalComponent {
  private baixasService = inject(BaixasService);
  private errorModalService = inject(ErrorModalService);
  private vendaService = inject(VendaService);
  private authService = inject(AuthService);
  private configuracaoService = inject(ConfiguracaoService);

      @Input() set showModal(value: boolean) {
    this._showModal = value;
    if (value && this.venda) {
      this.loadBaixasExistentes();
      this.loadConfiguracao();
    }
  }

  get showModal(): boolean {
    return this._showModal;
  }

  private _showModal = false;

  @Input() set venda(value: Venda | null) {
    this._venda = value;
    if (this.showModal && value) {
      this.loadBaixasExistentes();
      this.loadConfiguracao();
    }
  }

  get venda(): Venda | null {
    return this._venda;
  }

  private _venda: Venda | null = null;
  configuracao: Configuracao | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() baixaLancada = new EventEmitter<Venda>();
  @Output() modalClosed = new EventEmitter<void>();

  // Estados
  loading = false;
  loadingBaixas = false;
  deletingBaixaId: string | null = null;

  // Modal de confirmação de exclusão de baixa
  showDeleteBaixaModal = false;
  baixaToDelete: Baixa | null = null;
  deleteModalMessage = '';

  // Baixas existentes da venda
  baixasExistentes: Baixa[] = [];

  // Dados da baixa
  baixaData: LancarBaixaDto = {
    tipoDaBaixa: TipoDaBaixa.CARTAO_PIX,
    valorBaixa: 0,
    dataBaixa: new Date().toISOString().split('T')[0],
    observacao: ''
  };

  // Variável para edição de baixa
  baixaEmEdicao: Baixa | null = null;
  modoEdicao = false;

  // Variável para exibição formatada do valor
  valorDisplay = '0,00';

  // Enums para template
  TipoDaBaixa = TipoDaBaixa;
  tiposBaixa = Object.values(TipoDaBaixa);
  Permission = Permission;

  onClose(): void {
    if (!this.loading) {
      this.resetForm();
      this.close.emit();
      this.modalClosed.emit();
    }
  }

  onSubmit(): void {
    if (!this.venda || !this.isFormValid()) {
      return;
    }

    this.loading = true;

    if (this.modoEdicao && this.baixaEmEdicao) {
      // Modo EDIÇÃO - Atualizar baixa existente
      const updateBaixaDto = {
        tipoDaBaixa: this.baixaData.tipoDaBaixa,
        valorBaixa: this.baixaData.valorBaixa,
        dataBaixa: this.baixaData.dataBaixa,
        observacao: this.baixaData.observacao
      };

      this.baixasService.updateBaixa(this.baixaEmEdicao.id, updateBaixaDto).subscribe({
        next: (baixaAtualizada) => {
          this.loading = false;
          this.resetForm();
          this.modoEdicao = false;
          this.baixaEmEdicao = null;
          // Recarregar baixas para atualizar a lista do modal
          this.loadBaixasExistentes();
        },
        error: (error) => {
          this.loading = false;
          const message = error.error?.message || 'Erro ao atualizar baixa';
          this.errorModalService.show(message, 'Erro');
        }
      });
    } else {
      // Modo CRIAÇÃO - Criar nova baixa
      const createBaixaDto = {
        idvenda: this.venda.id,
        tipoDaBaixa: this.baixaData.tipoDaBaixa,
        valorBaixa: this.baixaData.valorBaixa,
        dataBaixa: this.baixaData.dataBaixa,
        observacao: this.baixaData.observacao
      };

      this.baixasService.createBaixa(createBaixaDto).subscribe({
        next: (baixaCriada) => {
          this.loading = false;
          this.resetForm();
          // Recarregar baixas para atualizar a lista do modal
          this.loadBaixasExistentes();
        },
        error: (error) => {
          this.loading = false;
          const message = error.error?.message || 'Erro ao lançar baixa';
          this.errorModalService.show(message, 'Erro');
        }
      });
    }
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

    // Validar se a soma das baixas não é maior que o valor do cliente
    let totalBaixasAtual = this.getTotalBaixas();
    
    // Se está em modo edição, subtrair o valor anterior para não contar em duplicata
    if (this.modoEdicao && this.baixaEmEdicao) {
      totalBaixasAtual -= (this.baixaEmEdicao.valorBaixa || 0);
    }
    
    const totalComNovaBaixa = totalBaixasAtual + this.baixaData.valorBaixa;
    const valorCliente = this.venda?.valorCliente || 0;

    if (totalComNovaBaixa > valorCliente) {
      const diferenca = totalComNovaBaixa - valorCliente;
      const valorRestante = valorCliente - totalBaixasAtual;
      this.errorModalService.show(
        `O valor da baixa ultrapassa o valor total em ${this.formatCurrency(diferenca)}. Valor restante: ${this.formatCurrency(valorRestante)}`,
        'Valor Inválido'
      );
      return false;
    }

    return true;
  }

  private resetForm(): void {
    this.baixaData = {
      tipoDaBaixa: TipoDaBaixa.CARTAO_PIX,
      valorBaixa: 0,
      dataBaixa: new Date().toISOString().split('T')[0],
      observacao: ''
    };
    this.valorDisplay = '0,00';
    this.modoEdicao = false;
    this.baixaEmEdicao = null;
  }

  cancelarEdicao(): void {
    this.resetForm();
  }

  getTipoBaixaLabel(tipo: TipoDaBaixa): string {
    const labels = {
      [TipoDaBaixa.DINHEIRO]: 'Dinheiro',
      [TipoDaBaixa.CARTAO_PIX]: 'Cartão/PIX',
      [TipoDaBaixa.DEPOSITO]: 'Depósito',
      [TipoDaBaixa.OUTROS]: 'Outros'
    };
    return labels[tipo] || tipo;
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Formatação de Moeda para input
  formatCurrencyInput(event: any): void {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    
    // Limitar a 8 dígitos (para valores até 999.999,99)
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
    
    // Atualizar display sem formatação durante digitação
    this.valorDisplay = value.replace(/(\d{1,5})(\d{2})$/, '$1,$2').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  }

  private formatCurrencyDisplay(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatCurrencyOnBlur(): void {
    const value = this.baixaData.valorBaixa;
    if (value !== null && value !== undefined && value !== 0) {
      this.valorDisplay = this.formatCurrencyDisplay(value);
    } else {
      // Se for 0 ou vazio, mostrar 0,00
      this.valorDisplay = '0,00';
    }
  }

  onValorFocus(): void {
    if (this.valorDisplay === '0,00' || this.valorDisplay === '') {
      this.valorDisplay = '';
      this.baixaData.valorBaixa = 0;
    }
  }

  getStatusLabel(status: VendaStatus): string {
    const labels = {
      [VendaStatus.REGISTRADO]: 'Registrado',
      [VendaStatus.CANCELADO]: 'Cancelado',
      [VendaStatus.PAGO]: 'Pago',
      [VendaStatus.PAGO_PARCIAL]: 'Pago Parcial',
      [VendaStatus.FECHADO]: 'Fechado'
    };
    return labels[status] || status;
  }

  getStatusClass(status: VendaStatus): string {
    const classes = {
      [VendaStatus.REGISTRADO]: 'status-registrado',
      [VendaStatus.CANCELADO]: 'status-cancelado',
      [VendaStatus.PAGO]: 'status-pago',
      [VendaStatus.PAGO_PARCIAL]: 'status-pago-parcial',
      [VendaStatus.FECHADO]: 'status-fechado'
    };
    return classes[status] || '';
  }

  private loadBaixasExistentes(): void {
    if (!this.venda) return;

    this.loadingBaixas = true;
    this.baixasService.getBaixas({ idvenda: this.venda.id }).subscribe({
      next: (response) => {
        this.baixasExistentes = response.data;
        this.loadingBaixas = false;
      },
      error: (error) => {
        console.error('Erro ao carregar baixas existentes:', error);
        this.loadingBaixas = false;
        // Não mostra erro para o usuário, apenas log no console
      }
    });
  }

  getTotalBaixas(): number {
    if (!this.baixasExistentes || this.baixasExistentes.length === 0) {
      return 0;
    }
    return this.baixasExistentes.reduce((total, baixa) => {
      const valor = baixa.valorBaixa || 0;
      return total + valor;
    }, 0);
  }

  getValorRestante(): number {
    if (!this.venda) return 0;
    const valorCliente = this.venda.valorCliente || 0;
    const totalBaixas = this.getTotalBaixas();
    return valorCliente - totalBaixas;
  }

  hasPermission(permission: Permission): boolean {
    return this.authService.hasPermission(permission);
  }

  onEditarBaixa(baixa: Baixa): void {
    if (!this.hasPermission(Permission.VENDA_UPDATE)) {
      this.errorModalService.show('Você não possui permissão para editar baixas', 'Permissão Negada');
      return;
    }

    // Validar se venda tem fechamento registrado
    if (this.venda && this.venda.dataFechamento) {
      this.errorModalService.show(
        `Não é possível editar baixas de uma venda com fechamento registrado em ${this.formatDateDisplay(this.venda.dataFechamento)}.`,
        'Venda Fechada'
      );
      return;
    }

    // Ativar modo edição e armazenar a baixa sendo editada
    this.modoEdicao = true;
    this.baixaEmEdicao = baixa;
    
    // Preencher formulário com dados da baixa para edição
    this.baixaData = {
      tipoDaBaixa: baixa.tipoDaBaixa,
      valorBaixa: baixa.valorBaixa,
      dataBaixa: baixa.dataBaixa as any,
      observacao: baixa.observacao || ''
    };
    this.valorDisplay = this.formatCurrencyDisplay(baixa.valorBaixa);
    
    // Scroll para o formulário
    setTimeout(() => {
      const formulario = document.querySelector('form');
      formulario?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  onRemoverBaixa(baixa: Baixa): void {
    if (!this.hasPermission(Permission.VENDA_REMOVE_BAIXA)) {
      this.errorModalService.show('Você não possui permissão para remover baixas', 'Permissão Negada');
      return;
    }

    // Validar se venda tem fechamento registrado
    if (this.venda && this.venda.dataFechamento) {
      this.errorModalService.show(
        `Não é possível remover baixas de uma venda com fechamento registrado em ${this.formatDateDisplay(this.venda.dataFechamento)}.`,
        'Venda Fechada'
      );
      return;
    }

    this.baixaToDelete = baixa;
    this.deleteModalMessage = `Tem certeza que deseja excluir a baixa "${this.formatCurrency(baixa.valorBaixa)}"? Esta ação não pode ser desfeita.`;
    this.showDeleteBaixaModal = true;
  }

  onDeleteBaixaConfirmed(): void {
    if (!this.baixaToDelete) return;

    this.deletingBaixaId = this.baixaToDelete.id;
    this.baixasService.deleteBaixa(this.baixaToDelete.id).subscribe({
      next: () => {
        this.deletingBaixaId = null;
        this.closeDeleteBaixaModal();
        // Recarregar baixas após remover (sem fechar o modal)
        this.loadBaixasExistentes();
      },
      error: (error) => {
        this.deletingBaixaId = null;
        const message = error.error?.message || 'Erro ao remover baixa';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  onDeleteBaixaCancelled(): void {
    this.closeDeleteBaixaModal();
  }

  private closeDeleteBaixaModal(): void {
    this.showDeleteBaixaModal = false;
    this.baixaToDelete = null;
    this.deleteModalMessage = '';
  }

  private loadConfiguracao(): void {
    this.configuracaoService.getConfiguracao().subscribe({
      next: config => (this.configuracao = config),
      error: () => (this.configuracao = null)
    });
  }

  onImprimirRecibo(baixa: Baixa): void {
    if (!this.venda) {
      return;
    }

    const popup = window.open('', '_blank', 'width=720,height=900');
    if (!popup) {
      this.errorModalService.show(
        'Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.',
        'Erro'
      );
      return;
    }

    const vendedor = this.venda.vendedor || 'Não informado';
    const cliente = this.venda.cliente || 'Cliente não informado';
    const protocolo = this.venda.protocolo || '-';
    const valorPago = this.formatCurrency(baixa.valorBaixa || 0);
    const tipoLabel = this.getTipoBaixaLabel(baixa.tipoDaBaixa);
    const dataPagamento = this.formatDateDisplay(baixa.dataBaixa);
    const totalCliente = this.formatCurrency(this.venda.valorCliente || 0);
    const totalBaixado = this.formatCurrency(this.getTotalBaixas());
    const valorRestante = this.formatCurrency(Math.max(this.getValorRestante(), 0));
    const observacao = baixa.observacao || 'Sem observações';
    const usuarioAtual = this.authService.getCurrentUser();
    const usuarioLabel = usuarioAtual?.nome || usuarioAtual?.email || 'Usuário não identificado';
    const geradoEm = new Date().toLocaleString('pt-BR');

    const logoUrl = this.getLogoUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : '';

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Recibo de Pagamento - Protocolo ${protocolo}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
            .recibo-container { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e0; padding: 24px; }
            header { text-align: center; margin-bottom: 24px; }
            header .logo { max-height: 60px; margin-bottom: 8px; }
            header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; text-transform: uppercase; }
            .value-highlight { font-size: 28px; font-weight: 700; color: #16a34a; margin: 12px 0 0; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 16px; font-size: 13px; }
            .info-grid span { font-weight: 600; color: #475569; }
            .descricao { margin: 16px 0; font-size: 14px; line-height: 1.5; }
            .descricao strong { font-weight: 600; }
            .metadados, .totais { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; margin-bottom: 12px; }
            .metadados span, .totais span { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; }
            .assinatura { margin-top: 40px; text-align: center; }
            .assinatura .linha { width: 70%; margin: 0 auto 8px; border-bottom: 1px solid #94a3b8; }
            footer { margin-top: 32px; text-align: right; font-size: 12px; color: #475569; }
            .print-actions { text-align: right; margin-bottom: 12px; }
            .print-actions button { background: #0ea5e9; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
            @media print { .print-actions { display: none; } body { padding: 0; } .recibo-container { border: none; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button onclick="window.print()">Imprimir</button>
          </div>
          <div class="recibo-container">
            <header>
              ${logoHtml}
              <h1>Recibo de Pagamento</h1>
              <div class="value-highlight">${valorPago}</div>
            </header>
            <div class="info-grid">
              <div><span>Protocolo:</span> ${protocolo}</div>
              <div><span>Cliente:</span> ${cliente}</div>
              <div><span>Vendedor:</span> ${vendedor}</div>
              <div><span>Tipo de Pagamento:</span> ${tipoLabel}</div>
              <div><span>Data do Pagamento:</span> ${dataPagamento}</div>
              <div><span>Emitido por:</span> ${usuarioLabel}</div>
            </div>
            <p class="descricao">
              Recebemos de <strong>${cliente}</strong> o valor de <strong>${valorPago}</strong>,
              referente ao protocolo <strong>${protocolo}</strong>, com pagamento realizado em
              <strong>${dataPagamento}</strong> via <strong>${tipoLabel}</strong>.
            </p>
            <div class="metadados">
              <span><strong>Total do Cliente:</strong> ${totalCliente}</span>
              <span><strong>Total Pago:</strong> ${totalBaixado}</span>
              <span><strong>Saldo Restante:</strong> ${valorRestante}</span>
            </div>
            <div class="descricao">
              <strong>Observações:</strong><br />
              ${observacao}
            </div>
            <div class="assinatura">
              <div class="linha"></div>
              <div>Assinatura do Responsável</div>
            </div>
            <footer>
              Recibo emitido em ${geradoEm}
            </footer>
          </div>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
  }

  private formatDateDisplay(date: string | Date | null | undefined): string {
    if (!date) {
      return '-';
    }

    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }

    return '-';
  }

  private getLogoUrl(): string | null {
    if (!this.configuracao?.logoRelatorio) {
      return null;
    }

    const backendUrl = environment.apiUrl.replace(/\/api$/, '');
    return this.configuracao.logoRelatorio.startsWith('/uploads')
      ? backendUrl + this.configuracao.logoRelatorio
      : this.configuracao.logoRelatorio;
  }
}
