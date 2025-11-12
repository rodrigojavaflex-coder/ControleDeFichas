import { Component, Input, Output, EventEmitter, OnInit, OnChanges, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Venda, VendaOrigem, VendaStatus, Unidade } from '../../models/venda.model';
import { VendaService } from '../../services/vendas.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';

@Component({
  selector: 'app-venda-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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

  vendaForm!: FormGroup;
  isEditing = false;
  isLoading = false;
  unidadeDisabled = false;

  // Enums para template
  VendaOrigem = VendaOrigem;
  VendaStatus = VendaStatus;
  Unidade = Unidade;
  unidades = Object.values(Unidade);

  ngOnInit() {
    this.initializeForm();
    this.configureUnidadeField();
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
    } else if (changes['showModal'] && this.showModal && !this.venda) {
      this.isEditing = false;
      this.resetForm();
    }
  }

  private initializeForm() {
    this.vendaForm = this.fb.group({
      protocolo: ['', [Validators.required, Validators.minLength(3)]],
      dataVenda: [this.formatDateForInput(new Date()), [Validators.required]],
      cliente: ['', [Validators.required, Validators.minLength(2)]],
      origem: [VendaOrigem.GOIANIA, [Validators.required]],
      vendedor: ['', [Validators.required, Validators.minLength(2)]],
      valorCompra: [0, [Validators.required, Validators.min(0)]],
      valorCliente: [0, [Validators.required, Validators.min(0)]],
      observacao: [''],
      status: [{value: VendaStatus.REGISTRADO, disabled: true}, [Validators.required]],
      unidade: [''],
      ativo: ['']
    });
  }

  private initializeFormWithData(venda: any) {
    // Extrair apenas a data (YYYY-MM-DD) sem conversão de timezone
    let dataVendaFormatted = '';
    
    if (typeof venda.dataVenda === 'string') {
      // Se já é string, extrair apenas a parte da data
      dataVendaFormatted = venda.dataVenda.split('T')[0];
    } else if (venda.dataVenda instanceof Date) {
      // Se é Date, converter para ISO string e extrair data
      dataVendaFormatted = venda.dataVenda.toISOString().split('T')[0];
    } else {
      // Fallback: tentar criar Date e extrair data
      dataVendaFormatted = new Date(venda.dataVenda).toISOString().split('T')[0];
    }

    // Atualizar formulário com os valores
    this.vendaForm.patchValue({
      protocolo: venda.protocolo,
      cliente: venda.cliente,
      vendedor: venda.vendedor,
      dataVenda: dataVendaFormatted,
      valorCompra: venda.valorCompra,
      valorCliente: venda.valorCliente,
      origem: venda.origem,
      observacao: venda.observacao || '',
      status: venda.status,
      unidade: venda.unidade || '',
      ativo: venda.ativo || ''
    }, { emitEvent: false });

    // Aguardar o ciclo de detecção de mudanças do Angular
    setTimeout(() => {
      // Formatar valores de moeda para exibição
      this.formatCurrencyOnBlur('valorCompra');
      this.formatCurrencyOnBlur('valorCliente');
    }, 50);
  }

  closeModal() {
    this.showModal = false;
    this.resetForm();
    this.close.emit();
  }

  private resetForm() {
    this.vendaForm.reset({
      protocolo: '',
      dataVenda: this.formatDateForInput(new Date()),
      cliente: '',
      origem: VendaOrigem.GOIANIA,
      vendedor: '',
      valorCompra: 0,
      valorCliente: 0,
      observacao: '',
      status: VendaStatus.REGISTRADO
    });
    // Garantir que o status fique desabilitado
    this.vendaForm.get('status')?.disable();
    // Reconfigurar campo unidade baseado no usuário logado
    this.configureUnidadeField();
  }

  onSubmit() {
    if (this.vendaForm.valid) {
      this.isLoading = true;

      // Usar getRawValue() para incluir valores de controles desabilitados
      const formValue = this.vendaForm.getRawValue();
      
      // Converter valores de moeda de string para número
      const valorCompra = typeof formValue.valorCompra === 'string' 
        ? parseFloat(formValue.valorCompra.replace(/\D/g, '')) / 100 
        : formValue.valorCompra;
      
      const valorCliente = typeof formValue.valorCliente === 'string' 
        ? parseFloat(formValue.valorCliente.replace(/\D/g, '')) / 100 
        : formValue.valorCliente;
      
      // Garantir que a data está no formato YYYY-MM-DD sem conversão
      const dataVenda = formValue.dataVenda;
      
      let vendaData: any = {
        ...formValue,
        valorCompra,
        valorCliente,
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
          this.saved.emit(venda);
          this.closeModal();
        },
        error: (error) => {
          this.isLoading = false;
          const message = error.error?.message || 'Erro ao salvar venda';
          this.errorModalService.show(message, 'Erro');
        }
      });
    } else {
      this.markFormGroupTouched();
    }
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

  getFieldError(fieldName: string): string {
    const field = this.vendaForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (field.errors['minlength']) {
        return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      }
      if (field.errors['min']) {
        return 'Valor deve ser maior que zero';
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
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
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
}