import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientesService } from '../../services/clientes.service';
import { CreateClienteDto, UpdateClienteDto, Cliente } from '../../models/cliente.model';
import { Unidade, Permission } from '../../models/usuario.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cliente-form.html',
  styleUrls: ['./cliente-form.css']
})
export class ClienteFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientesService = inject(ClientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorModalService = inject(ErrorModalService);
  private pageContextService = inject(PageContextService);
  private authService = inject(AuthService);

  clienteForm: FormGroup;
  isEditMode = false;
  clienteId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;

  Unidade = Unidade;
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  constructor() {
    this.clienteForm = this.createForm();
  }

  ngOnInit(): void {
    this.checkEditMode();
    
    // Verificar permissões
    if (this.isEditMode) {
      if (!this.authService.hasPermission(Permission.CLIENTE_UPDATE)) {
        this.errorModalService.show('Você não possui permissão para editar clientes', 'Acesso Negado');
        this.router.navigate(['/clientes']);
        return;
      }
    } else {
      if (!this.authService.hasPermission(Permission.CLIENTE_CREATE)) {
        this.errorModalService.show('Você não possui permissão para criar clientes', 'Acesso Negado');
        this.router.navigate(['/clientes']);
        return;
      }
    }

    this.configureUnidadeField();
    this.pageContextService.setContext({
      title: 'Cadastro de Cliente',
      description: this.isEditMode ? 'Edite as informações do cliente' : 'Cadastre um novo cliente'
    });
  }

  private configureUnidadeField(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade) {
      // Usuário tem unidade definida - preencher e desabilitar campo
      this.unidadeDisabled = true;
      this.clienteForm.patchValue({
        unidade: currentUser.unidade
      });
      this.clienteForm.get('unidade')?.disable();
    } else {
      // Usuário não tem unidade - deixar campo habilitado
      this.unidadeDisabled = false;
      this.clienteForm.get('unidade')?.enable();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(500)]],
      cdcliente: [''],
      cpf: [''],
      dataNascimento: [''],
      email: ['', [Validators.email]],
      telefone: ['', [Validators.maxLength(20)]],
      unidade: ['', Validators.required]
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      this.isEditMode = true;
      this.clienteId = id;
      this.loadCliente(id);
    } else {
      this.isEditMode = false;
    }
  }

  private loadCliente(id: string): void {
    this.loading = true;
    this.error = null;

    this.clientesService.findOne(id).subscribe({
      next: (cliente) => {
        this.clienteForm.patchValue({
          nome: cliente.nome,
          cdcliente: cliente.cdcliente || '',
          cpf: cliente.cpf || '',
          dataNascimento: cliente.dataNascimento ? cliente.dataNascimento.split('T')[0] : '',
          email: cliente.email || '',
          telefone: cliente.telefone || '',
          unidade: cliente.unidade
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar cliente:', error);
        this.error = 'Erro ao carregar dados do cliente';
        this.loading = false;
        this.errorModalService.show('Erro ao carregar dados do cliente', 'Erro');
      }
    });
  }

  onSubmit(): void {
    if (this.clienteForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    // Se unidade estiver desabilitada, incluir o valor no formValue
    const formValue = { ...this.clienteForm.value };
    if (this.unidadeDisabled) {
      formValue.unidade = this.clienteForm.get('unidade')?.value;
    }

    if (this.isEditMode && this.clienteId) {
      this.updateCliente(formValue);
    } else {
      this.createCliente(formValue);
    }
  }

  private createCliente(formValue: any): void {
    const createClienteDto: CreateClienteDto = {
      nome: formValue.nome,
      cdcliente: formValue.cdcliente ? parseInt(formValue.cdcliente) : undefined,
      cpf: formValue.cpf || undefined,
      dataNascimento: formValue.dataNascimento || undefined,
      email: formValue.email || undefined,
      telefone: formValue.telefone || undefined,
      unidade: formValue.unidade
    };

    this.clientesService.create(createClienteDto).subscribe({
      next: () => {
        this.router.navigate(['/clientes']);
      },
      error: (error) => {
        console.error('Erro ao criar cliente:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private updateCliente(formValue: any): void {
    const updateClienteDto: UpdateClienteDto = {
      nome: formValue.nome,
      cdcliente: formValue.cdcliente ? parseInt(formValue.cdcliente) : undefined,
      cpf: formValue.cpf || undefined,
      dataNascimento: formValue.dataNascimento || undefined,
      email: formValue.email || undefined,
      telefone: formValue.telefone || undefined,
      unidade: formValue.unidade
    };

    this.clientesService.update(this.clienteId!, updateClienteDto).subscribe({
      next: () => {
        this.router.navigate(['/clientes']);
      },
      error: (error) => {
        console.error('Erro ao atualizar cliente:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private handleSubmitError(error: any): void {
    this.isSubmitting = false;
    const errorMessage = error?.error?.message || 'Erro ao salvar cliente';
    this.error = errorMessage;
    this.errorModalService.show(errorMessage, 'Erro');
  }

  private markFormGroupTouched(): void {
    Object.keys(this.clienteForm.controls).forEach(key => {
      const control = this.clienteForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.router.navigate(['/clientes']);
  }

  get nome() {
    return this.clienteForm.get('nome');
  }

  get email() {
    return this.clienteForm.get('email');
  }

  get unidade() {
    return this.clienteForm.get('unidade');
  }

  getErrorMessage(fieldName: string): string {
    const control = this.clienteForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName === 'nome' ? 'Nome' : 'Unidade'} é obrigatório`;
    }
    if (control?.hasError('email')) {
      return 'Email inválido';
    }
    if (control?.hasError('maxlength')) {
      return `Campo excede o tamanho máximo permitido`;
    }
    return 'Campo inválido';
  }
}

