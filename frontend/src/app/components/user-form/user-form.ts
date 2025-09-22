import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';
import { CreateUserDto, UpdateUserDto, User, PermissionGroup, Permission } from '../../models/user.model';

@Component({
  selector: 'app-user-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css'
})
export class UserFormComponent implements OnInit {
  userForm: FormGroup;
  isEditMode = false;
  userId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;

  // Permissões
  availablePermissions: PermissionGroup = {};
  permissionGroups: string[] = [];
  selectedPermissions: Permission[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.userForm = this.createForm();
  }

  ngOnInit(): void {
    console.log('UserForm ngOnInit - checking edit mode');
    this.loadPermissions();
    this.checkEditMode();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.minLength(6)]],
      isActive: [true]
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('checkEditMode - id from route:', id);
    console.log('current route:', this.route.snapshot.url);
    
    if (id) {
      this.isEditMode = true;
      this.userId = id;
      console.log('Edit mode - loading user:', id);
      this.loadUser(id);
      // Em modo de edição, senha não é obrigatória
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    } else {
      console.log('Create mode - new user');
      this.isEditMode = false;
      // Em modo de criação, senha é obrigatória
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  private loadPermissions(): void {
    this.userService.getPermissions().subscribe({
      next: (permissions) => {
        this.availablePermissions = permissions;
        this.permissionGroups = Object.keys(permissions);
      },
      error: (error) => {
        console.error('Erro ao carregar permissões:', error);
      }
    });
  }

  private loadUser(id: string): void {
    this.loading = true;
    this.error = null;

    this.userService.getUserById(id).subscribe({
      next: (user) => {
        this.userForm.patchValue({
          name: user.name,
          email: user.email,
          isActive: user.isActive
        });
        this.selectedPermissions = user.permissions || [];
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
    console.log('onSubmit called');
    console.log('Form valid:', this.userForm.valid);
    console.log('Is edit mode:', this.isEditMode);
    console.log('User ID:', this.userId);
    
    if (this.userForm.invalid || this.isSubmitting) {
      console.log('Form invalid or submitting, marking as touched');
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const formValue = this.userForm.value;
    console.log('Form value:', formValue);

    if (this.isEditMode && this.userId) {
      console.log('Calling updateUser');
      this.updateUser(formValue);
    } else {
      console.log('Calling createUser');
      this.createUser(formValue);
    }
  }

  private createUser(formValue: any): void {
    console.log('createUser method called with:', formValue);
    
    const createUserDto: CreateUserDto = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
      isActive: formValue.isActive,
      permissions: this.selectedPermissions
    };

    console.log('Sending createUserDto:', createUserDto);

    this.userService.createUser(createUserDto).subscribe({
      next: (user) => {
        console.log('Usuário criado:', user);
        this.router.navigate(['/users']);
      },
      error: (error) => {
        console.error('Erro ao criar usuário:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private updateUser(formValue: any): void {
    const updateUserDto: UpdateUserDto = {
      name: formValue.name,
      email: formValue.email,
      isActive: formValue.isActive,
      permissions: this.selectedPermissions
    };

    // Adiciona senha apenas se foi informada
    if (formValue.password && formValue.password.trim()) {
      updateUserDto.password = formValue.password;
    }

    this.userService.updateUser(this.userId!, updateUserDto).subscribe({
      next: (user) => {
        console.log('Usuário atualizado:', user);
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

  // Métodos para gerenciar permissões
  togglePermission(permission: Permission): void {
    const index = this.selectedPermissions.indexOf(permission);
    if (index > -1) {
      this.selectedPermissions.splice(index, 1);
    } else {
      this.selectedPermissions.push(permission);
    }
  }

  isPermissionSelected(permission: Permission): boolean {
    return this.selectedPermissions.includes(permission);
  }

  selectAllPermissions(groupName: string): void {
    const groupPermissions = this.availablePermissions[groupName];
    if (groupPermissions) {
      groupPermissions.forEach(perm => {
        if (!this.selectedPermissions.includes(perm.key)) {
          this.selectedPermissions.push(perm.key);
        }
      });
    }
  }

  deselectAllPermissions(groupName: string): void {
    const groupPermissions = this.availablePermissions[groupName];
    if (groupPermissions) {
      groupPermissions.forEach(perm => {
        const index = this.selectedPermissions.indexOf(perm.key);
        if (index > -1) {
          this.selectedPermissions.splice(index, 1);
        }
      });
    }
  }

  isGroupFullySelected(groupName: string): boolean {
    const groupPermissions = this.availablePermissions[groupName];
    if (!groupPermissions) return false;
    
    return groupPermissions.every(perm => 
      this.selectedPermissions.includes(perm.key)
    );
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
