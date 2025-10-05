import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgIf, NgClass } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgClass],
  template: `
    <!-- Modal Backdrop -->
    <div class="modal-backdrop" [class.show]="isVisible" (click)="onClose()" *ngIf="isVisible">
      <!-- Modal Content -->
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <h3 class="modal-title">Alterar Senha</h3>
          <button type="button" class="btn-close" (click)="onClose()" aria-label="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <!-- Modal Body -->
        <div class="modal-body">
          <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()">
            <!-- Senha Atual -->
            <div class="form-group">
              <label for="currentPassword" class="form-label">
                <i class="fas fa-lock"></i>
                Senha Atual
              </label>
              <div class="input-eye-wrapper">
                <input
                  [type]="showCurrentPassword ? 'text' : 'password'"
                  class="form-control"
                  id="currentPassword"
                  formControlName="currentPassword"
                  placeholder="Digite sua senha atual"
                  [class.is-invalid]="f['currentPassword'].touched && f['currentPassword'].invalid"
                />
                <button type="button" class="btn-eye" (click)="showCurrentPassword = !showCurrentPassword" tabindex="-1">
                  <i class="fas" [ngClass]="showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
              <div class="invalid-feedback" *ngIf="f['currentPassword'].touched && f['currentPassword'].errors?.['required']">
                Senha atual é obrigatória
              </div>
            </div>
            <!-- Nova Senha -->
            <div class="form-group">
              <label for="newPassword" class="form-label">
                <i class="fas fa-key"></i>
                Nova Senha
              </label>
              <div class="input-eye-wrapper">
                <input
                  [type]="showNewPassword ? 'text' : 'password'"
                  class="form-control"
                  id="newPassword"
                  formControlName="newPassword"
                  placeholder="Digite a nova senha"
                  [class.is-invalid]="f['newPassword'].touched && f['newPassword'].invalid"
                />
                <button type="button" class="btn-eye" (click)="showNewPassword = !showNewPassword" tabindex="-1">
                  <i class="fas" [ngClass]="showNewPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
              <div class="invalid-feedback" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['required']">
                Nova senha é obrigatória
              </div>
              <div class="invalid-feedback" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['minlength']">
                A senha deve ter no mínimo 6 caracteres
              </div>
              <div class="invalid-feedback" *ngIf="f['newPassword'].touched && f['newPassword'].errors?.['pattern']">
                A senha deve conter pelo menos uma letra e um número
              </div>
            </div>
            <!-- Confirmar Nova Senha -->
            <div class="form-group">
              <label for="confirmPassword" class="form-label">
                <i class="fas fa-check-circle"></i>
                Confirmar Nova Senha
              </label>
              <div class="input-eye-wrapper">
                <input
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  class="form-control"
                  id="confirmPassword"
                  formControlName="confirmPassword"
                  placeholder="Confirme a nova senha"
                  [class.is-invalid]="f['confirmPassword'].touched && (f['confirmPassword'].invalid || passwordForm.errors?.['passwordMismatch'])"
                />
                <button type="button" class="btn-eye" (click)="showConfirmPassword = !showConfirmPassword" tabindex="-1">
                  <i class="fas" [ngClass]="showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
              </div>
              <div class="invalid-feedback" *ngIf="f['confirmPassword'].touched && f['confirmPassword'].errors?.['required']">
                Confirmação de senha é obrigatória
              </div>
              <div class="invalid-feedback" *ngIf="f['confirmPassword'].touched && passwordForm.errors?.['passwordMismatch']">
                As senhas não conferem
              </div>
            </div>

            <!-- Critérios da senha -->
            <div class="password-requirements">
              <small class="text-muted">
                <i class="fas fa-info-circle"></i>
                A senha deve conter pelo menos 6 caracteres, incluindo letras e números
              </small>
            </div>
          </form>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary" 
            (click)="onClose()"
            [disabled]="loading"
          >
            <i class="fas fa-times"></i>
            Cancelar
          </button>
          <button 
            type="button" 
            class="btn btn-primary" 
            (click)="onSubmit()"
            [disabled]="passwordForm.invalid || loading"
          >
            <i class="fas fa-save" *ngIf="!loading"></i>
            <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
            {{ loading ? 'Alterando...' : 'Alterar Senha' }}
          </button>
        </div>
      </div>
    </div>
  `,
    styleUrls: ['./change-password-modal.css']
})
export class ChangePasswordModalComponent implements OnInit {
  @Input() isVisible = false;
  @Input() userId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() passwordChanged = new EventEmitter<void>();
  @Output() successMessage = new EventEmitter<string>();
  @Output() errorMessage = new EventEmitter<string>();

  passwordForm!: FormGroup;
  loading = false;

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
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
      this.successMessage.emit('Senha alterada com sucesso!');
      this.resetForm();
      this.passwordChanged.emit();
      this.onClose();
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      const errorMsg = this.getErrorMessage(error);
      this.errorMessage.emit(errorMsg);
    } finally {
      this.loading = false;
    }
  }

  onClose() {
    this.resetForm();
    this.closed.emit();
  }

  private resetForm() {
    this.passwordForm.reset();
    this.loading = false;
  }

  private getErrorMessage(error: any): string {
    const err = error as any;
    if (err?.error?.message) {
      return err.error.message;
    } else {
      return 'Erro ao alterar senha';
    }
  }
}