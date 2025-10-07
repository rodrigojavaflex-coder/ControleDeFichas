import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';
import { CreateUsuarioDto, UpdateUsuarioDto, Usuario, Perfil } from '../../models/usuario.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.html',
  styleUrls: ['./user-form.css']
})
export class UserFormComponent implements OnInit {
  userForm: FormGroup;
  isEditMode = false;
  userId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;

  // Perfis
  availableProfiles: Perfil[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.userForm = this.createForm();
    this.availableProfiles = [];
  }

  ngOnInit(): void {
  this.loadProfiles();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.minLength(6)]],
  isActive: [true],
  perfilId: ['', Validators.required]
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
      },
      error: (error) => {
        console.error('Erro ao carregar perfis:', error);
        // Mesmo em caso de erro, verificar modo de edição
        this.checkEditMode();
      }
    });
  }

  private loadUser(id: string): void {
    this.loading = true;
    this.error = null;

    this.userService.getUserById(id).subscribe({
      next: (user) => {
        this.userForm.patchValue({
          name: user.nome,
          email: user.email,
          isActive: user.ativo,
          perfilId: user.perfil?.id
        });
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
      perfilId: formValue.perfilId
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
    const updateUsuarioDto: UpdateUsuarioDto = {
      nome: formValue.name,
      email: formValue.email,
      ativo: formValue.isActive,
      perfilId: formValue.perfilId
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
  get name() { return this.userForm.get('name'); }
  get email() { return this.userForm.get('email'); }
  get password() { return this.userForm.get('password'); }
  get isActive() { return this.userForm.get('isActive'); }

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


  private getFieldName(controlName: string): string {
    const fieldNames: { [key: string]: string } = {
      name: 'Nome',
      email: 'Email',
      password: 'Senha'
    };
    return fieldNames[controlName] || controlName;
  }
}
