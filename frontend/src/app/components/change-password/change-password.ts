import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container mt-4">
      <h2>Alterar Senha</h2>
      
      <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()" class="mt-4">
        <div class="mb-3">
          <label for="currentPassword" class="form-label">Senha Atual</label>
          <input
            type="password"
            class="form-control"
            id="currentPassword"
            formControlName="currentPassword"
          >
          <div class="text-danger" *ngIf="f['currentPassword'].touched && f['currentPassword'].errors?.['required']">
            Senha atual é obrigatória
          </div>
        </div>

        <div class="mb-3">
          <label for="newPassword" class="form-label">Nova Senha</label>
          <input
            type="password"
            class="form-control"
            id="newPassword"
            formControlName="newPassword"
          >
          <div class="text-danger" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['required']">
            Nova senha é obrigatória
          </div>
          <div class="text-danger" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['minlength']">
            A senha deve ter no mínimo 6 caracteres
          </div>
          <div class="text-danger" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['pattern']">
            A senha deve conter pelo menos uma letra e um número
          </div>
        </div>

        <div class="mb-3">
          <label for="confirmPassword" class="form-label">Confirmar Nova Senha</label>
          <input
            type="password"
            class="form-control"
            id="confirmPassword"
            formControlName="confirmPassword"
          >
          <div class="text-danger" *ngIf="f['confirmPassword'].touched && f['confirmPassword'].errors?.['required']">
            Confirmação de senha é obrigatória
          </div>
          <div class="text-danger" *ngIf="f['confirmPassword'].touched && passwordForm.errors?.['passwordMismatch']">
            As senhas não conferem
          </div>
        </div>

        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-primary" [disabled]="passwordForm.invalid || loading">
            {{ loading ? 'Alterando...' : 'Alterar Senha' }}
          </button>
          <button type="button" class="btn btn-secondary" (click)="onCancel()">Cancelar</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .container {
      max-width: 500px;
    }
  `]
})
export class ChangePasswordComponent implements OnInit {
  passwordForm!: FormGroup;
  loading = false;
  userId!: string;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.userId = this.route.snapshot.params['id'];
    
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validator: this.passwordMatchValidator
    });
  }

  get f() {
    return this.passwordForm.controls;
  }

  passwordMatchValidator(g: FormGroup) {
    const newPassword = g.get('newPassword');
    const confirmPassword = g.get('confirmPassword');
    return newPassword && confirmPassword && newPassword.value === confirmPassword.value
      ? null 
      : { passwordMismatch: true };
  }

  async onSubmit() {
    if (this.passwordForm.invalid || this.loading) {
      return;
    }

    this.loading = true;

    try {
      await this.userService.changePassword(this.userId, this.passwordForm.value).toPromise();
      alert('Senha alterada com sucesso!');
      this.router.navigate(['/users']);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      const err = error as any;
      if (err?.error?.message) {
        alert(err.error.message);
      } else {
        alert('Erro ao alterar senha');
      }
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    this.router.navigate(['/users']);
  }
}