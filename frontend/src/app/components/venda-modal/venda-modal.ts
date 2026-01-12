import { Component, Input, Output, EventEmitter, OnInit, OnChanges, inject, ViewEncapsulation, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Venda, VendaOrigem, VendaStatus, Unidade } from '../../models/venda.model';
import { Permission } from '../../models/usuario.model';
import { VendaService } from '../../services/vendas.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AutocompleteComponent } from '../autocomplete/autocomplete';
import { ClienteQuickCreateModalComponent } from '../cliente-quick-create-modal/cliente-quick-create-modal';
import { PrescritorQuickCreateModalComponent } from '../prescritor-quick-create-modal/prescritor-quick-create-modal';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ClientesService } from '../../services/clientes.service';
import { VendedoresService } from '../../services/vendedores.service';
import { PrescritoresService } from '../../services/prescritores.service';
import { Cliente } from '../../models/cliente.model';
import { Vendedor } from '../../models/vendedor.model';
import { Prescritor } from '../../models/prescritor.model';

@Component({
  selector: 'app-venda-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AutocompleteComponent, ClienteQuickCreateModalComponent, PrescritorQuickCreateModalComponent, ConfirmationModalComponent],
  templateUrl: './venda-modal.html',
  styleUrls: ['./venda-modal.css'],
  encapsulation: ViewEncapsulation.None
})
export class VendaModalComponent implements OnInit, OnChanges {
  @Input() venda: Venda | null = null;
  @Input() showModal = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Venda>();

  private fb = inject(FormBuilder);
  private vendaService = inject(VendaService);
  private authService = inject(AuthService);
  private errorModalService = inject(ErrorModalService);
  private clientesService = inject(ClientesService);
  private vendedoresService = inject(VendedoresService);
  private prescritoresService = inject(PrescritoresService);

  @ViewChild('clienteAutocomplete') clienteAutocomplete?: AutocompleteComponent;
  @ViewChild('vendedorAutocomplete') vendedorAutocomplete?: AutocompleteComponent;
  @ViewChild('prescritorAutocomplete') prescritorAutocomplete?: AutocompleteComponent;
  @ViewChild('protocoloInput', { read: ElementRef }) protocoloInput?: ElementRef<HTMLInputElement>;

  vendaForm!: FormGroup;
  isEditing = false;
  isLoading = false;
  unidadeDisabled = false;
  podeVisualizarValorCompra = false;
  showClienteQuickCreateModal = false;
  quickCreateClienteNome = '';
  showPrescritorQuickCreateModal = false;
  quickCreatePrescritorNome = '';
  showConfirmCloseModal = false;

  // Enums para template
  VendaOrigem = VendaOrigem;
  VendaStatus = VendaStatus;
  Unidade = Unidade;
  unidades = Object.values(Unidade);
  origens = Object.values(VendaOrigem);
  Permission = Permission;

  ngOnInit() {
    this.initializeForm();
    this.configureUnidadeField();
    this.podeVisualizarValorCompra = this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
  }

  private configureUnidadeField() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade) {
      // Usuário tem unidade definida - preencher e desabilitar campo
      this.unidadeDisabled = true;
      this.vendaForm.patchValue({
        unidade: currentUser.unidade
      });
      this.vendaForm.get('unidade')?.disable();
    } else {
      // Usuário não tem unidade - deixar campo habilitado
      this.unidadeDisabled = false;
      this.vendaForm.get('unidade')?.enable();
    }
  }

  ngOnChanges(changes: any) {
    if (changes['showModal'] && this.showModal && this.venda) {
      this.isEditing = true;
      this.initializeFormWithData(this.venda);
      // Focar no protocolo após um pequeno delay para garantir que o modal está renderizado
      setTimeout(() => this.focusProtocolo(), 100);
    } else if (changes['showModal'] && this.showModal && !this.venda) {
      this.isEditing = false;
      this.resetForm();
      // Focar no protocolo após resetar o formulário
      setTimeout(() => this.focusProtocolo(), 100);
    }
  }

  private focusProtocolo(): void {
    if (this.protocoloInput?.nativeElement) {
      this.protocoloInput.nativeElement.focus();
    }
  }

  private initializeForm() {
    this.vendaForm = this.fb.group({
      protocolo: ['', [Validators.required, Validators.minLength(3)]],
      dataVenda: [this.formatDateForInput(new Date()), [Validators.required]],
      clienteId: ['', [Validators.required]],
      origem: [VendaOrigem.GOIANIA, [Validators.required]],
      vendedorId: ['', [Validators.required]],
      prescritorId: [null],
      valorCompra: [null, [Validators.min(0)]],
      valorPago: [null, [Validators.min(0)]],
      valorCliente: [0, [Validators.required, Validators.min(0)]],
      observacao: ['', [Validators.maxLength(500)]],
      status: [{value: VendaStatus.REGISTRADO, disabled: true}, [Validators.required]],
      unidade: ['', [Validators.required]],
      ativo: ['']
    });
  }

  private initializeFormWithData(venda: Venda) {
    // Extrair apenas a data (YYYY-MM-DD) sem conversão de timezone
    let dataVendaFormatted = '';
    
    if (typeof venda.dataVenda === 'string') {
      // Se já é string, extrair apenas a parte da data
      dataVendaFormatted = venda.dataVenda.split('T')[0];
    } else {
      // Fallback: tentar criar Date e extrair data (dataVenda sempre vem como string do backend)
      try {
        const dateObj = new Date(venda.dataVenda as any);
        if (!isNaN(dateObj.getTime())) {
          dataVendaFormatted = dateObj.toISOString().split('T')[0];
        } else {
          dataVendaFormatted = '';
        }
      } catch {
        dataVendaFormatted = '';
      }
    }

    // Verificar se já temos as entidades relacionadas ou precisamos buscar
    const cliente = (venda.cliente && typeof venda.cliente === 'object') ? venda.cliente : null;
    const vendedor = (venda.vendedor && typeof venda.vendedor === 'object') ? venda.vendedor : null;
    const prescritor = (venda.prescritor && typeof venda.prescritor === 'object') ? venda.prescritor : null;

    // Atualizar formulário com os valores
    this.vendaForm.patchValue({
      protocolo: venda.protocolo,
      clienteId: venda.clienteId || '',
      vendedorId: venda.vendedorId || '',
      prescritorId: venda.prescritorId || null,
      dataVenda: dataVendaFormatted,
      valorCompra: venda.valorCompra,
      valorPago: venda.valorPago,
      valorCliente: venda.valorCliente,
      origem: venda.origem,
      observacao: venda.observacao || '',
      status: venda.status,
      unidade: venda.unidade || '',
      ativo: venda.ativo || ''
    }, { emitEvent: false });

    // Buscar entidades relacionadas se não estiverem carregadas
    const observables = [];
    if (!cliente && venda.clienteId) {
      observables.push(this.clientesService.findOne(venda.clienteId).pipe(catchError(() => of(null))));
    } else {
      observables.push(of(cliente));
    }

    if (!vendedor && venda.vendedorId) {
      observables.push(this.vendedoresService.findOne(venda.vendedorId).pipe(catchError(() => of(null))));
    } else {
      observables.push(of(vendedor));
    }

    if (!prescritor && venda.prescritorId) {
      observables.push(this.prescritoresService.findOne(venda.prescritorId).pipe(catchError(() => of(null))));
    } else {
      observables.push(of(prescritor));
    }

    // Buscar todas as entidades em paralelo
    forkJoin(observables).subscribe(([clienteLoaded, vendedorLoaded, prescritorLoaded]) => {
      // Inicializar autocompletes com os itens selecionados
      setTimeout(() => {
        if (clienteLoaded && this.clienteAutocomplete) {
          this.clienteAutocomplete.setSelectedItem(clienteLoaded);
        }
        if (vendedorLoaded && this.vendedorAutocomplete) {
          this.vendedorAutocomplete.setSelectedItem(vendedorLoaded);
        }
        if (prescritorLoaded && this.prescritorAutocomplete) {
          this.prescritorAutocomplete.setSelectedItem(prescritorLoaded);
        }
        // Formatar valores de moeda para exibição
        this.formatCurrencyOnBlur('valorCompra');
        this.formatCurrencyOnBlur('valorCliente');
      }, 100);
    });

    this.podeVisualizarValorCompra = this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
  }

  closeModal() {
    // Verificar se o formulário foi modificado
    if (this.hasUnsavedChanges()) {
      this.showConfirmCloseModal = true;
      return;
    }
    
    // Se não há alterações, fechar diretamente
    this.doCloseModal();
  }

  // Verificar se há alterações não salvas
  hasUnsavedChanges(): boolean {
    // Verificar se o formulário foi modificado (dirty = valores alterados)
    return this.vendaForm.dirty;
  }

  // Método para fechar o modal de fato
  doCloseModal() {
    this.showModal = false;
    this.showConfirmCloseModal = false;
    this.resetForm();
    this.close.emit();
  }

  // Método para confirmar o fechamento
  confirmClose() {
    this.doCloseModal();
  }

  // Método para cancelar o fechamento
  cancelClose() {
    this.showConfirmCloseModal = false;
  }

  private resetForm() {
    // Verificar se o usuário logado tem vendedor associado
    const currentUser = this.authService.getCurrentUser();
    const vendedorIdInicial = currentUser?.vendedor?.id || '';
    
    this.vendaForm.reset({
      protocolo: '',
      dataVenda: this.formatDateForInput(new Date()),
      clienteId: '',
      origem: VendaOrigem.GOIANIA,
      vendedorId: vendedorIdInicial,
      prescritorId: null,
      valorCompra: null,
      valorPago: null,
      valorCliente: 0,
      observacao: '',
      status: VendaStatus.REGISTRADO
    });
    // Garantir que o status fique desabilitado
    this.vendaForm.get('status')?.disable();
    // Reabilitar campos de autocomplete (caso tenham sido desabilitados)
    this.vendaForm.get('clienteId')?.enable({ emitEvent: false });
    this.vendaForm.get('vendedorId')?.enable({ emitEvent: false });
    this.vendaForm.get('prescritorId')?.enable({ emitEvent: false });
    
    // Limpar autocompletes (exceto vendedor se usuário tiver vendedor)
    setTimeout(() => {
      this.clienteAutocomplete?.clearSelection();
      // Se o usuário tem vendedor, pré-selecionar no autocomplete ao invés de limpar
      if (currentUser?.vendedor && this.vendedorAutocomplete) {
        this.vendedorAutocomplete.setSelectedItem(currentUser.vendedor);
      } else {
        this.vendedorAutocomplete?.clearSelection();
      }
      this.prescritorAutocomplete?.clearSelection();
    }, 50);
    // Reconfigurar campo unidade baseado no usuário logado
    this.configureUnidadeField();
  }

  onSubmit() {
    if (this.vendaForm.valid) {
      // Garantir que os valores dos autocompletes estão sincronizados com o FormControl
      // IMPORTANTE: Fazer isso ANTES de qualquer outra operação
      const clienteId = this.clienteAutocomplete?.selectedItem?.id || this.vendaForm.get('clienteId')?.value;
      const vendedorId = this.vendedorAutocomplete?.selectedItem?.id || this.vendaForm.get('vendedorId')?.value;
      const prescritorId = this.prescritorAutocomplete?.selectedItem?.id || this.vendaForm.get('prescritorId')?.value;
      
      // Atualizar FormControl com os valores garantidos
      if (clienteId) {
        this.vendaForm.patchValue({ clienteId }, { emitEvent: false });
      }
      if (vendedorId) {
        this.vendaForm.patchValue({ vendedorId }, { emitEvent: false });
      }
      if (prescritorId) {
        this.vendaForm.patchValue({ prescritorId }, { emitEvent: false });
      }
      
      // Usar getRawValue() para incluir valores de controles desabilitados
      const formValue = this.vendaForm.getRawValue();
      
      // Converter valores de moeda de string para número
      const valorCompraRaw = typeof formValue.valorCompra === 'string' 
        ? parseFloat(formValue.valorCompra.replace(/\D/g, '')) / 100 
        : formValue.valorCompra;
      const valorPagoRaw = typeof formValue.valorPago === 'string'
        ? parseFloat(formValue.valorPago.replace(/\D/g, '')) / 100
        : formValue.valorPago;

      const valorCliente = typeof formValue.valorCliente === 'string' 
        ? parseFloat(formValue.valorCliente.replace(/\D/g, '')) / 100 
        : formValue.valorCliente;

      if (!valorCliente || valorCliente <= 0) {
        this.errorModalService.show('Informe um valor válido para o cliente.', 'Validação');
        return;
      }

      const valorCompra =
        valorCompraRaw !== null &&
        valorCompraRaw !== undefined &&
        !isNaN(valorCompraRaw) &&
        valorCompraRaw > 0
          ? Number(Number(valorCompraRaw).toFixed(2))
          : undefined;
      const valorPago =
        valorPagoRaw !== null &&
        valorPagoRaw !== undefined &&
        !isNaN(valorPagoRaw) &&
        valorPagoRaw > 0
          ? Number(Number(valorPagoRaw).toFixed(2))
          : undefined;

      if (valorCompra !== undefined && valorCompra > valorCliente) {
        this.errorModalService.show('O valor da compra não pode ser maior que o valor do cliente.', 'Validação');
        return;
      }

      // Desabilitar campos durante o submit
      this.vendaForm.get('clienteId')?.disable({ emitEvent: false });
      this.vendaForm.get('vendedorId')?.disable({ emitEvent: false });
      this.vendaForm.get('prescritorId')?.disable({ emitEvent: false });
      
      this.isLoading = true;
      
      // Garantir que a data está no formato YYYY-MM-DD sem conversão
      const dataVenda = formValue.dataVenda;
      
      // Garantir que os IDs estão presentes no objeto final
      let vendaData: any = {
        ...formValue,
        clienteId: clienteId || formValue.clienteId,
        vendedorId: vendedorId || formValue.vendedorId,
        prescritorId: prescritorId || formValue.prescritorId,
        valorCliente,
        ...(valorCompra !== undefined ? { valorCompra } : {}),
        ...(valorPago !== undefined ? { valorPago } : {}),
        dataVenda: typeof dataVenda === 'string' ? dataVenda : dataVenda.toISOString().split('T')[0]
      };

      // Remover campos vazios ou undefined para edição
      if (this.isEditing) {
        vendaData = Object.keys(vendaData).reduce((obj: any, key: string) => {
          const value = vendaData[key];
          // Manter apenas campos com valores definidos
          if (value !== null && value !== undefined && value !== '') {
            obj[key] = value;
          }
          return obj;
        }, {});
      }

      const operation = this.isEditing
        ? this.vendaService.updateVenda(this.venda!.id, vendaData)
        : this.vendaService.createVenda(vendaData);

      operation.subscribe({
        next: (venda) => {
          this.isLoading = false;
          // Reabilitar campos após sucesso
          this.vendaForm.get('clienteId')?.enable({ emitEvent: false });
          this.vendaForm.get('vendedorId')?.enable({ emitEvent: false });
          this.vendaForm.get('prescritorId')?.enable({ emitEvent: false });
          // Marcar formulário como pristine após salvar com sucesso
          this.vendaForm.markAsPristine();
          this.saved.emit(venda);
          this.closeModal();
        },
        error: (error) => {
          this.isLoading = false;
          // Reabilitar campos após erro
          this.vendaForm.get('clienteId')?.enable({ emitEvent: false });
          this.vendaForm.get('vendedorId')?.enable({ emitEvent: false });
          this.vendaForm.get('prescritorId')?.enable({ emitEvent: false });
          const message = error.error?.message || 'Erro ao salvar venda';
          this.errorModalService.show(message, 'Erro');
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  aplicarDescontoValorPago(): void {
    const valorCompra = this.parseCurrencyControlValue('valorCompra');

    if (valorCompra === null || valorCompra === undefined || valorCompra <= 0) {
      this.errorModalService.show('Informe um valor de compra válido antes de aplicar o desconto.', 'Validação');
      return;
    }

    const valorComDesconto = Number((valorCompra * 0.65).toFixed(2));
    this.vendaForm.get('valorPago')?.setValue(valorComDesconto);
    this.formatCurrencyOnBlur('valorPago');
  }


  private markFormGroupTouched() {
    Object.keys(this.vendaForm.controls).forEach(key => {
      const control = this.vendaForm.get(key);
      control?.markAsTouched();
    });
  }

  private formatDateForInput(date: Date | string): string {
    if (typeof date === 'string') {
      return date; // Se já é string, retornar diretamente
    }
    // Usar data local para evitar problemas de timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseCurrencyControlValue(controlName: string): number | null {
    const control = this.vendaForm.get(controlName);
    const value = control?.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    const cleaned = value.toString().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  getFieldError(fieldName: string): string {
    const field = this.vendaForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (field.errors['minlength']) {
        return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      }
      if (field.errors['maxlength']) {
        return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
      }
      if (field.errors['min']) {
        return 'Valor deve ser maior que zero';
      }
      if (field.errors['uuid']) {
        return 'ID inválido';
      }
    }
    return '';
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.vendaForm.get(fieldName);
    return !!(field?.errors && field.touched);
  }

  getOrigemLabel(origem: VendaOrigem): string {
    const labels = {
      [VendaOrigem.GOIANIA]: 'Goiânia',
      [VendaOrigem.INHUMAS]: 'Inhumas',
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
      [VendaOrigem.RIBEIRAO_PRETO]: 'Ribeirão Preto',
      [VendaOrigem.OUTRO]: 'Outro'
    };
    return labels[origem] || origem;
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

  // Formatação de Moeda
  formatCurrency(event: any, fieldName: string): void {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    
    if (value === '') {
      this.vendaForm.get(fieldName)?.setValue(0, { emitEvent: false });
      return;
    }

    const numValue = parseInt(value, 10) / 100;
    this.vendaForm.get(fieldName)?.setValue(numValue, { emitEvent: false });
    
    // Formatar para exibição
    input.value = this.formatCurrencyDisplay(numValue);
  }

  private formatCurrencyDisplay(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('R$', '').trim();
  }

  formatCurrencyOnBlur(fieldName: string): void {
    const value = this.vendaForm.get(fieldName)?.value;
    if (value !== null && value !== undefined && value !== '') {
      const numValue = typeof value === 'string' ? parseFloat(value.replace(/\D/g, '')) / 100 : value;
      const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numValue);
      const input = document.querySelector(`#${fieldName}`) as HTMLInputElement;
      if (input) {
        input.value = formatted;
      }
    }
  }

  onCreateCliente(nome: string): void {
    this.quickCreateClienteNome = nome;
    this.showClienteQuickCreateModal = true;
  }

  onClienteCreated(cliente: Cliente): void {
    // Selecionar o cliente recém-criado no autocomplete
    if (this.clienteAutocomplete) {
      this.clienteAutocomplete.setSelectedItem(cliente);
    }
    this.showClienteQuickCreateModal = false;
    this.quickCreateClienteNome = '';
  }

  onClienteCreateCancelled(): void {
    this.showClienteQuickCreateModal = false;
    this.quickCreateClienteNome = '';
  }

  onCreatePrescritor(nome: string): void {
    this.quickCreatePrescritorNome = nome;
    this.showPrescritorQuickCreateModal = true;
  }

  onPrescritorCreated(prescritor: Prescritor): void {
    // Selecionar o prescritor recém-criado no autocomplete
    if (this.prescritorAutocomplete) {
      this.prescritorAutocomplete.setSelectedItem(prescritor);
    }
    this.showPrescritorQuickCreateModal = false;
    this.quickCreatePrescritorNome = '';
  }

  onPrescritorCreateCancelled(): void {
    this.showPrescritorQuickCreateModal = false;
    this.quickCreatePrescritorNome = '';
  }
}
