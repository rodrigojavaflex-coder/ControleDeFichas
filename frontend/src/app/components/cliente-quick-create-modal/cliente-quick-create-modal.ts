import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientesService } from '../../services/clientes.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { Cliente, CreateClienteDto } from '../../models/cliente.model';
import { Unidade, Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-cliente-quick-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cliente-quick-create-modal.html',
  styleUrls: ['./cliente-quick-create-modal.css']
})
export class ClienteQuickCreateModalComponent implements OnInit {
  @Input() initialNome: string = '';
  @Input() showModal: boolean = true;
  @Output() created = new EventEmitter<Cliente>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private clientesService = inject(ClientesService);
  private authService = inject(AuthService);
  private errorModalService = inject(ErrorModalService);

  quickForm!: FormGroup;
  isLoading = false;
  showAdditionalFields = false;

  Unidade = Unidade;
  unidades = Object.values(Unidade);

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    const userUnidade = currentUser?.unidade;

    // Criar form com todos os campos
    this.quickForm = this.fb.group({
      nome: [this.initialNome?.toUpperCase() || '', [Validators.required, Validators.maxLength(500)]],
      unidade: [userUnidade || '', [Validators.required]],
      cdcliente: [''],
      cpf: [''],
      dataNascimento: [''],
      email: ['', [Validators.email]],
      telefone: ['']
    });

    // Se o usuário tem unidade, desabilitar o campo programaticamente
    if (userUnidade) {
      this.quickForm.get('unidade')?.disable();
    }

    // Desabilitar campos adicionais inicialmente
    this.quickForm.get('cdcliente')?.disable();
    this.quickForm.get('cpf')?.disable();
    this.quickForm.get('dataNascimento')?.disable();
    this.quickForm.get('email')?.disable();
    this.quickForm.get('telefone')?.disable();
  }

  toggleAdditionalFields(): void {
    this.showAdditionalFields = !this.showAdditionalFields;
    
    if (this.showAdditionalFields) {
      // Habilitar campos adicionais
      this.quickForm.get('cdcliente')?.enable();
      this.quickForm.get('cpf')?.enable();
      this.quickForm.get('dataNascimento')?.enable();
      this.quickForm.get('email')?.enable();
      this.quickForm.get('telefone')?.enable();
    } else {
      // Desabilitar e limpar campos adicionais
      this.quickForm.get('cdcliente')?.disable();
      this.quickForm.get('cdcliente')?.setValue('');
      this.quickForm.get('cpf')?.disable();
      this.quickForm.get('cpf')?.setValue('');
      this.quickForm.get('dataNascimento')?.disable();
      this.quickForm.get('dataNascimento')?.setValue('');
      this.quickForm.get('email')?.disable();
      this.quickForm.get('email')?.setValue('');
      this.quickForm.get('telefone')?.disable();
      this.quickForm.get('telefone')?.setValue('');
    }
  }

  onNomeInput(event: any): void {
    const value = event.target.value;
    const upperValue = value.toUpperCase();
    // Atualizar o valor no form control
    this.quickForm.get('nome')?.setValue(upperValue, { emitEvent: false });
    // Atualizar o valor no input
    event.target.value = upperValue;
  }

  onSubmit(): void {
    if (this.quickForm.valid) {
      this.isLoading = true;

      // Desabilitar campos durante o submit
      this.quickForm.disable();

      // Usar getRawValue() para incluir valores de campos desabilitados
      const formValue = this.quickForm.getRawValue();

      const createDto: CreateClienteDto = {
        nome: formValue.nome.trim().toUpperCase(),
        unidade: formValue.unidade,
        cdcliente: formValue.cdcliente ? Number(formValue.cdcliente) : undefined,
        cpf: formValue.cpf?.trim() || undefined,
        dataNascimento: formValue.dataNascimento || undefined,
        email: formValue.email?.trim() || undefined,
        telefone: formValue.telefone?.trim() || undefined
      };

      this.clientesService.create(createDto).subscribe({
        next: (cliente) => {
          this.isLoading = false;
          this.quickForm.enable();
          // Reaplicar disabled se necessário
          if (this.authService.getCurrentUser()?.unidade) {
            this.quickForm.get('unidade')?.disable();
          }
          // Reaplicar disabled nos campos adicionais se não estiverem visíveis
          if (!this.showAdditionalFields) {
            this.quickForm.get('cdcliente')?.disable();
            this.quickForm.get('cpf')?.disable();
            this.quickForm.get('dataNascimento')?.disable();
            this.quickForm.get('email')?.disable();
            this.quickForm.get('telefone')?.disable();
          }
          this.created.emit(cliente);
        },
        error: (error) => {
          this.isLoading = false;
          this.quickForm.enable();
          // Reaplicar disabled se necessário
          if (this.authService.getCurrentUser()?.unidade) {
            this.quickForm.get('unidade')?.disable();
          }
          // Reaplicar disabled nos campos adicionais se não estiverem visíveis
          if (!this.showAdditionalFields) {
            this.quickForm.get('cdcliente')?.disable();
            this.quickForm.get('cpf')?.disable();
            this.quickForm.get('dataNascimento')?.disable();
            this.quickForm.get('email')?.disable();
            this.quickForm.get('telefone')?.disable();
          }
          const message = error.error?.message || 'Erro ao criar cliente';
          this.errorModalService.show(message, 'Erro');
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  closeModal(): void {
    if (!this.isLoading) {
      this.cancelled.emit();
    }
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.quickForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.quickForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return `${fieldName === 'nome' ? 'Nome' : 'Unidade'} é obrigatório`;
    }
    if (field.errors['maxlength']) {
      return `Nome não pode ter mais que 500 caracteres`;
    }
    if (field.errors['email']) {
      return 'Email inválido';
    }

    return 'Campo inválido';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.quickForm.controls).forEach(key => {
      this.quickForm.get(key)?.markAsTouched();
    });
  }
}
