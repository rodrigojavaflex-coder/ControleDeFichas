import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { VendedoresService } from '../../services/vendedores.service';
import { CreateVendedorDto, UpdateVendedorDto, Vendedor } from '../../models/vendedor.model';
import { Unidade, Permission } from '../../models/usuario.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-vendedor-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './vendedor-form.html',
  styleUrls: ['./vendedor-form.css']
})
export class VendedorFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendedoresService = inject(VendedoresService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorModalService = inject(ErrorModalService);
  private pageContextService = inject(PageContextService);
  private authService = inject(AuthService);

  vendedorForm: FormGroup;
  isEditMode = false;
  vendedorId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;

  Unidade = Unidade;
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  constructor() {
    this.vendedorForm = this.createForm();
  }

  ngOnInit(): void {
    this.checkEditMode();
    
    // Verificar permissões
    if (this.isEditMode) {
      if (!this.authService.hasPermission(Permission.VENDEDOR_UPDATE)) {
        this.errorModalService.show('Você não possui permissão para editar vendedores', 'Acesso Negado');
        this.router.navigate(['/vendedores']);
        return;
      }
    } else {
      if (!this.authService.hasPermission(Permission.VENDEDOR_CREATE)) {
        this.errorModalService.show('Você não possui permissão para criar vendedores', 'Acesso Negado');
        this.router.navigate(['/vendedores']);
        return;
      }
    }

    this.configureUnidadeField();
    this.pageContextService.setContext({
      title: 'Cadastro de Vendedor',
      description: this.isEditMode ? 'Edite as informações do vendedor' : 'Cadastre um novo vendedor'
    });
  }

  private configureUnidadeField(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade) {
      // Usuário tem unidade definida - preencher e desabilitar campo
      this.unidadeDisabled = true;
      this.vendedorForm.patchValue({
        unidade: currentUser.unidade
      });
      this.vendedorForm.get('unidade')?.disable();
    } else {
      // Usuário não tem unidade - deixar campo habilitado
      this.unidadeDisabled = false;
      this.vendedorForm.get('unidade')?.enable();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(500)]],
      cdVendedor: [''],
      unidade: ['', Validators.required]
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      this.isEditMode = true;
      this.vendedorId = id;
      this.loadVendedor(id);
    } else {
      this.isEditMode = false;
    }
  }

  private loadVendedor(id: string): void {
    this.loading = true;
    this.error = null;

    this.vendedoresService.findOne(id).subscribe({
      next: (vendedor) => {
        this.vendedorForm.patchValue({
          nome: vendedor.nome,
          cdVendedor: vendedor.cdVendedor || '',
          unidade: vendedor.unidade
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar vendedor:', error);
        this.error = 'Erro ao carregar dados do vendedor';
        this.loading = false;
        this.errorModalService.show('Erro ao carregar dados do vendedor', 'Erro');
      }
    });
  }

  onSubmit(): void {
    if (this.vendedorForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    // Se unidade estiver desabilitada, incluir o valor no formValue
    const formValue = { ...this.vendedorForm.value };
    if (this.unidadeDisabled) {
      formValue.unidade = this.vendedorForm.get('unidade')?.value;
    }

    if (this.isEditMode && this.vendedorId) {
      this.updateVendedor(formValue);
    } else {
      this.createVendedor(formValue);
    }
  }

  private createVendedor(formValue: any): void {
    const createVendedorDto: CreateVendedorDto = {
      nome: formValue.nome,
      cdVendedor: formValue.cdVendedor ? parseInt(formValue.cdVendedor) : undefined,
      unidade: formValue.unidade
    };

    this.vendedoresService.create(createVendedorDto).subscribe({
      next: () => {
        this.router.navigate(['/vendedores']);
      },
      error: (error) => {
        console.error('Erro ao criar vendedor:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private updateVendedor(formValue: any): void {
    const updateVendedorDto: UpdateVendedorDto = {
      nome: formValue.nome,
      cdVendedor: formValue.cdVendedor ? parseInt(formValue.cdVendedor) : undefined,
      unidade: formValue.unidade
    };

    this.vendedoresService.update(this.vendedorId!, updateVendedorDto).subscribe({
      next: () => {
        this.router.navigate(['/vendedores']);
      },
      error: (error) => {
        console.error('Erro ao atualizar vendedor:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private handleSubmitError(error: any): void {
    this.isSubmitting = false;
    const errorMessage = error?.error?.message || 'Erro ao salvar vendedor';
    this.error = errorMessage;
    this.errorModalService.show(errorMessage, 'Erro');
  }

  private markFormGroupTouched(): void {
    Object.keys(this.vendedorForm.controls).forEach(key => {
      const control = this.vendedorForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.router.navigate(['/vendedores']);
  }

  get nome() {
    return this.vendedorForm.get('nome');
  }

  get unidade() {
    return this.vendedorForm.get('unidade');
  }

  getErrorMessage(fieldName: string): string {
    const control = this.vendedorForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName === 'nome' ? 'Nome' : 'Unidade'} é obrigatório`;
    }
    if (control?.hasError('maxlength')) {
      return `Campo excede o tamanho máximo permitido`;
    }
    return 'Campo inválido';
  }
}

