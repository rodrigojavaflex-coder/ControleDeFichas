import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';
import { CreateUsuarioDto, UpdateUsuarioDto, Usuario, Perfil, Unidade } from '../../models/usuario.model';
import { PageContextService } from '../../services/page-context.service';
import { AutocompleteComponent } from '../autocomplete/autocomplete';
import { VendedoresService } from '../../services/vendedores.service';
import {
  MultiSelectDropdownComponent,
  MultiSelectOption,
} from '../multi-select-dropdown/multi-select-dropdown';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AutocompleteComponent,
    MultiSelectDropdownComponent,
  ],
  templateUrl: './user-form.html',
  styleUrls: ['./user-form.css']
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pageContextService = inject(PageContextService);
  private vendedoresService = inject(VendedoresService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('vendedorAutocomplete') vendedorAutocomplete?: AutocompleteComponent;

  userForm: FormGroup;
  isEditMode = false;
  userId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;
  temUnidadePrincipal = false;

  availableProfiles: Perfil[] = [];

  get perfilSelectOptions(): MultiSelectOption[] {
    return this.availableProfiles.map((p) => ({
      value: p.id,
      label: p.nomePerfil,
    }));
  }

  get unidadeProdutividadeSelectOptions(): MultiSelectOption[] {
    return this.unidades.map((u) => ({ value: u, label: u }));
  }

  // Unidades
  Unidade = Unidade;
  unidades = Object.values(Unidade);

  constructor() {
    this.userForm = this.createForm();
    this.availableProfiles = [];
  }

  ngOnInit(): void {
    this.loadProfiles();
    this.userForm.get('unidade')?.valueChanges.subscribe((unidade) => {
      this.onUnidadeChange(unidade);
    });
  }

  onUnidadeSelectChange(): void {
    this.onUnidadeChange(this.userForm.get('unidade')?.value);
    this.cdr.detectChanges();
  }

  private onUnidadeChange(unidade: Unidade | string | null | undefined): void {
    this.temUnidadePrincipal = !!unidade && String(unidade).trim() !== '';
    if (!this.temUnidadePrincipal) {
      this.userForm.patchValue({ unidadesProdutividade: [] }, { emitEvent: false });
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.minLength(6)]],
      isActive: [true],
      perfilIds: [[], Validators.required],
      unidade: [''], // Campo opcional para unidade
      unidadesProdutividade: [[] as Unidade[]],
      vendedorId: [''] // Campo opcional para vendedor
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      this.isEditMode = true;
      this.userId = id;
      this.loadUser(id);
      // Em modo de edição, senha não é obrigatória
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    } else {
      this.isEditMode = false;
      // Em modo de criação, senha é obrigatória
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  private loadProfiles(): void {
    this.userService.getProfiles().subscribe({
      next: (profiles) => {
        this.availableProfiles = profiles;
        // Após carregar perfis, prosseguir com checagem de modo (create/edit)
        this.checkEditMode();
        this.setPageContext();
      },
      error: (error) => {
        console.error('Erro ao carregar perfis:', error);
        // Mesmo em caso de erro, verificar modo de edição
        this.checkEditMode();
        this.setPageContext();
      }
    });
  }

  private setPageContext(): void {
    this.pageContextService.setContext({
      title: 'Cadastro de Usuário',
      description: this.isEditMode ? 'Edite as informações do usuário' : 'Cadastre um novo usuário'
    });
  }

  private loadUser(id: string): void {
    this.loading = true;
    this.error = null;

    this.userService.getUserById(id).subscribe({
      next: (user) => {
        console.log('🔍 UserForm - Usuário carregado:', user);
        console.log('🔍 UserForm - Vendedor:', user.vendedor);
        
        this.userForm.patchValue({
          name: user.nome,
          email: user.email,
          isActive: user.ativo,
          perfilIds:
            user.perfis?.map((p) => p.id) ??
            (user.perfil?.id ? [user.perfil.id] : []),
          unidade: user.unidade || '',
          unidadesProdutividade: user.unidadesProdutividade ?? [],
          vendedorId: user.vendedor?.id || ''
        });
        this.onUnidadeChange(user.unidade || '');

        // Se o usuário tiver vendedor, definir no autocomplete
        if (user.vendedor) {
          console.log('🔍 UserForm - Tentando definir vendedor no autocomplete:', user.vendedor);
          // Usar setTimeout com delay maior para garantir que o autocomplete esteja renderizado
          // Tentar múltiplas vezes para garantir que o ViewChild esteja disponível
          const trySetVendedor = (attempts: number = 0) => {
            if (attempts > 5) {
              console.warn('⚠️ UserForm - Não foi possível definir vendedor no autocomplete após múltiplas tentativas');
              return;
            }
            
            setTimeout(() => {
              if (this.vendedorAutocomplete) {
                console.log('✅ UserForm - Vendedor definido no autocomplete');
                this.vendedorAutocomplete.setSelectedItem(user.vendedor!);
              } else {
                console.log(`🔄 UserForm - Tentativa ${attempts + 1}: autocomplete ainda não disponível`);
                trySetVendedor(attempts + 1);
              }
            }, 100 * (attempts + 1));
          };
          
          trySetVendedor();
        } else {
          console.log('ℹ️ UserForm - Usuário não tem vendedor associado');
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar usuário:', error);
        this.error = 'Erro ao carregar dados do usuário';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const formValue = this.userForm.value;

    if (this.isEditMode && this.userId) {
      this.updateUser(formValue);
    } else {
      this.createUser(formValue);
    }
  }

  private createUser(formValue: any): void {
    const createUsuarioDto: CreateUsuarioDto = {
      nome: formValue.name,
      email: formValue.email,
      senha: formValue.password,
      ativo: formValue.isActive,
      perfilIds: formValue.perfilIds ?? [],
      unidade: formValue.unidade || null,
      unidadesProdutividade: this.normalizarUnidadesProdutividade(
        formValue.unidade,
        formValue.unidadesProdutividade,
      ),
    };

    this.userService.createUser(createUsuarioDto).subscribe({
      next: (user) => {
        this.router.navigate(['/users']);
      },
      error: (error) => {
        console.error('Erro ao criar usuário:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private updateUser(formValue: any): void {
    // Obter vendedorId do autocomplete se selecionado
    const vendedorId = this.vendedorAutocomplete?.selectedItem?.id || formValue.vendedorId || null;
    
    const updateUsuarioDto: UpdateUsuarioDto = {
      nome: formValue.name,
      email: formValue.email,
      ativo: formValue.isActive,
      perfilIds: formValue.perfilIds ?? [],
      unidade: formValue.unidade || null,
      unidadesProdutividade: this.normalizarUnidadesProdutividade(
        formValue.unidade,
        formValue.unidadesProdutividade,
      ),
      vendedorId: vendedorId,
    };

    // Adiciona senha apenas se foi informada
    if (formValue.password && formValue.password.trim()) {
      updateUsuarioDto.senha = formValue.password;
    }

    this.userService.updateUser(this.userId!, updateUsuarioDto).subscribe({
      next: (user) => {
        this.router.navigate(['/users']);
      },
      error: (error) => {
        console.error('Erro ao atualizar usuário:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private handleSubmitError(error: any): void {
    this.isSubmitting = false;
    
    if (error.status === 400) {
      this.error = 'Dados inválidos. Verifique os campos e tente novamente.';
    } else if (error.status === 409) {
      // Usar a mensagem específica vinda do backend se disponível
      this.error = error.error?.message || 'Já existe um usuário cadastrado com este email.';
    } else if (error.status === 404) {
      this.error = 'Usuário não encontrado.';
    } else {
      this.error = 'Erro interno do servidor. Tente novamente mais tarde.';
    }
  }

  onCancel(): void {
    this.router.navigate(['/users']);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });
  }

  // Getters para facilitar acesso aos controles no template
  get name() { return this.userForm.get('name')!; }
  get email() { return this.userForm.get('email')!; }
  get password() { return this.userForm.get('password')!; }
  get isActive() { return this.userForm.get('isActive')!; }
  get unidade() { return this.userForm.get('unidade')!; }

  // Métodos para verificar erros
  hasError(controlName: string, errorType: string): boolean {
    const control = this.userForm.get(controlName);
    return control ? control.hasError(errorType) && control.touched : false;
  }

  getErrorMessage(controlName: string): string {
    const control = this.userForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    const errors = control.errors;
    
    if (errors['required']) {
      return `${this.getFieldName(controlName)} é obrigatório`;
    }
    
    if (errors['email']) {
      return 'Email deve ter um formato válido';
    }
    
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `${this.getFieldName(controlName)} deve ter pelo menos ${requiredLength} caracteres`;
    }
    
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `${this.getFieldName(controlName)} deve ter no máximo ${requiredLength} caracteres`;
    }

    return 'Campo inválido';
  }

  private normalizarUnidadesProdutividade(
    unidade: Unidade | string | null | undefined,
    unidadesProdutividade: Unidade[] | null | undefined,
  ): Unidade[] | null {
    if (!unidade || String(unidade).trim() === '') {
      return null;
    }
    const lista = (unidadesProdutividade ?? []).filter(Boolean) as Unidade[];
    if (!lista.length) {
      return null;
    }
    const unicas = [...new Set(lista)];
    const u = unidade as Unidade;
    if (!unicas.includes(u)) {
      unicas.unshift(u);
    }
    return unicas.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private getFieldName(controlName: string): string {
    const fieldNames: { [key: string]: string } = {
      name: 'Nome',
      email: 'Email',
      password: 'Senha'
    };
    return fieldNames[controlName] || controlName;
  }
}
