import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { PasswordToggleButtonComponent } from '../../components/password-toggle-button.component';

@Component({
  selector: 'app-alterar-senha',
  templateUrl: './alterar-senha.page.html',
  styleUrls: ['../login/login.page.scss', './alterar-senha.page.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonButton,
    IonContent,
    IonSpinner,
    PasswordToggleButtonComponent,
  ],
})
export class AlterarSenhaPage {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastController = inject(ToastController);

  private readonly strongPassword = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;

  isLoading = false;
  errorMessage = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  form: FormGroup = this.formBuilder.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(50)]],
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(50),
        Validators.pattern(this.strongPassword),
      ],
    ],
    confirmPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(50)]],
  });

  ionViewWillEnter(): void {
    this.errorMessage = '';
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  get passwordsMismatch(): boolean {
    const newPassword = String(this.form.get('newPassword')?.value ?? '');
    const confirmPassword = String(this.form.get('confirmPassword')?.value ?? '');
    return confirmPassword.length > 0 && newPassword !== confirmPassword;
  }

  voltar(): void {
    void this.router.navigate(['/home']);
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue() as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    if (newPassword !== confirmPassword) {
      this.errorMessage = 'As senhas não conferem.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.form.disable();

    try {
      await this.authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      this.form.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      const toast = await this.toastController.create({
        message: 'Senha alterada com sucesso.',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await toast.present();
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a senha. Tente novamente.';
      const toast = await this.toastController.create({
        message: this.errorMessage,
        duration: 3500,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.isLoading = false;
      this.form.enable();
    }
  }
}
