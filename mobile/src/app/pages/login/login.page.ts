import { Component, ElementRef, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  IonIcon,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, eyeOffOutline, eyeOutline, fingerPrintOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { MobileVersionCheckService } from '../../services/mobile-version-check.service';
import { AppUpdateRequiredService } from '../../services/app-update-required.service';
import { SavedLoginAccount } from '../../models/usuario.model';
import { PasswordToggleButtonComponent } from '../../components/password-toggle-button.component';
import { APP_VERSION } from '../../constants/app-version';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonSpinner,
    IonIcon,
    PasswordToggleButtonComponent,
  ],
})
export class LoginPage implements OnInit {
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private errorMessageService = inject(ErrorMessageService);
  private mobileVersionCheck = inject(MobileVersionCheckService);
  private appUpdateRequired = inject(AppUpdateRequiredService);

  readonly appVersion = APP_VERSION;
  readonly updateBlocked = this.appUpdateRequired.required;

  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('savedAccountsList') savedAccountsList?: ElementRef<HTMLElement>;

  loginForm: FormGroup;
  isLoading = false;
  isBiometricLoading = false;
  errorMessage = '';
  biometricAvailable = false;
  biometricEnabled = false;
  biometricEmail: string | null = null;
  savedAccounts: SavedLoginAccount[] = [];
  selectedEmail: string | null = null;
  usingOtherEmail = false;
  rememberEmail = true;
  showPassword = false;
  managingSavedEmails = false;
  private scrollSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private ignoreScrollSync = false;

  constructor() {
    const pwdValidators = [Validators.required, Validators.minLength(6)];
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', pwdValidators],
    });

    addIcons({ fingerPrintOutline, chevronForwardOutline, eyeOutline, eyeOffOutline });
  }

  get showSavedAccounts(): boolean {
    return this.savedAccounts.length > 0 && !this.usingOtherEmail;
  }

  get showEmailField(): boolean {
    return !this.showSavedAccounts;
  }

  get showBiometricButton(): boolean {
    if (!this.biometricAvailable || !this.biometricEnabled || !this.biometricEmail) {
      return false;
    }
    return this.currentEmail === this.biometricEmail;
  }

  private get currentEmail(): string {
    return this.authService.normalizeLoginEmail(this.loginForm.get('email')?.value ?? '');
  }

  async ngOnInit(): Promise<void> {
    this.mobileVersionCheck.checkAgainstServer().subscribe();
    await this.bootstrapLoginState();
  }

  async ionViewWillEnter(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = false;
    this.isBiometricLoading = false;
    this.showPassword = false;
    this.managingSavedEmails = false;
    this.loginForm.patchValue({ password: '' });
    this.mobileVersionCheck.checkAgainstServer().subscribe();
    await this.bootstrapLoginState();
  }

  selectAccount(account: SavedLoginAccount, options?: { scroll?: boolean }): void {
    const emailChanged = this.selectedEmail !== account.email;
    this.usingOtherEmail = false;
    this.selectedEmail = account.email;
    this.loginForm.patchValue({
      email: account.email,
      password: emailChanged ? '' : this.loginForm.get('password')?.value,
    });
    this.errorMessage = '';
    if (options?.scroll !== false) {
      this.scrollAccountIntoView(account.email);
    }
    this.focusPassword();
  }

  onSavedAccountsScroll(): void {
    if (this.ignoreScrollSync) {
      return;
    }
    if (this.scrollSyncTimer) {
      clearTimeout(this.scrollSyncTimer);
    }
    this.scrollSyncTimer = setTimeout(() => this.syncSelectedAccountFromScroll(), 80);
  }

  useOtherEmail(): void {
    this.usingOtherEmail = true;
    this.selectedEmail = null;
    this.loginForm.patchValue({ email: '', password: '' });
    this.focusEmail();
  }

  showSavedAccountList(): void {
    this.managingSavedEmails = false;
    this.usingOtherEmail = false;
    const first = this.savedAccounts[0];
    if (first) {
      this.selectAccount(first);
      return;
    }
    this.loginForm.patchValue({ email: '', password: '' });
  }

  openSavedAccountsManager(): void {
    this.managingSavedEmails = true;
    this.errorMessage = '';
  }

  closeSavedAccountsManager(): void {
    this.managingSavedEmails = false;
    if (this.savedAccounts.length === 0) {
      this.usingOtherEmail = true;
      this.selectedEmail = null;
      this.loginForm.patchValue({ email: '', password: '' });
      this.focusEmail();
      return;
    }
    if (this.usingOtherEmail) {
      return;
    }
    const current =
      this.savedAccounts.find((account) => account.email === this.selectedEmail) ??
      this.savedAccounts[0];
    this.selectAccount(current);
  }

  async confirmRemoveAccount(account: SavedLoginAccount): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Remover e-mail salvo?',
      message: `O e-mail ${account.email} deixará de aparecer nesta tela.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'confirm' },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') {
      return;
    }

    this.savedAccounts = await this.authService.removeSavedLoginAccount(account.email);
    if (this.selectedEmail === account.email) {
      const next = this.savedAccounts[0];
      if (next) {
        this.selectAccount(next, { scroll: false });
      } else {
        this.selectedEmail = null;
        this.loginForm.patchValue({ email: '', password: '' });
      }
    }

    if (this.savedAccounts.length === 0) {
      this.managingSavedEmails = false;
      this.usingOtherEmail = true;
      this.focusEmail();
    }
  }

  accountInitial(account: SavedLoginAccount): string {
    const source = account.nome?.trim() || account.email;
    return source.slice(0, 1).toUpperCase();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.updateBlocked() || this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.loginForm.disable();

    try {
      const email = this.resolveLoginEmail();
      const password = this.loginForm.get('password')!.value;
      if (!email) {
        this.errorMessage = 'Selecione um e-mail salvo ou informe outro.';
        return;
      }
      this.loginForm.patchValue({ email });
      await this.authService.login(email, password, { navigate: false });
      await this.persistRememberedAccount(email);
      await this.maybeEnableBiometrics(email, password);
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: unknown) {
      this.errorMessage = this.errorMessageService.fromApi(
        error,
        'Erro ao fazer login. Tente novamente.',
      );
      const toast = await this.toastController.create({
        message: this.errorMessage,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.isLoading = false;
      this.loginForm.enable();
    }
  }

  async onBiometricLogin(): Promise<void> {
    if (
      this.updateBlocked() ||
      this.isBiometricLoading ||
      this.isLoading ||
      !this.showBiometricButton
    ) {
      return;
    }

    this.isBiometricLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.loginWithBiometrics();
      const user = this.authService.getCurrentUser();
      if (user?.email) {
        await this.persistRememberedAccount(user.email, user.nome);
      }
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: unknown) {
      this.errorMessage = this.errorMessageService.fromApi(
        error,
        'Erro ao autenticar com biometria. Tente novamente.',
      );
      await this.refreshBiometricState();
      const toast = await this.toastController.create({
        message: this.errorMessage,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.isBiometricLoading = false;
    }
  }

  private async bootstrapLoginState(): Promise<void> {
    this.rememberEmail = await this.authService.getRememberEmailPreference();
    this.savedAccounts = await this.authService.listSavedLoginAccounts();
    await this.refreshBiometricState();

    if (this.savedAccounts.length === 0) {
      this.usingOtherEmail = true;
      this.selectedEmail = null;
      this.loginForm.patchValue({ email: '', password: '' });
      return;
    }

    this.usingOtherEmail = false;
    const preferred = this.savedAccounts.find((account) => account.email === this.selectedEmail)
      ?? this.savedAccounts.find((account) => account.email === this.biometricEmail)
      ?? this.savedAccounts[0];
    this.selectAccount(preferred);
  }

  private resolveLoginEmail(): string {
    if (this.showSavedAccounts) {
      return this.authService.normalizeLoginEmail(this.selectedEmail ?? '');
    }
    return this.authService.normalizeLoginEmail(this.loginForm.get('email')?.value ?? '');
  }

  private scrollAccountIntoView(email: string): void {
    this.ignoreScrollSync = true;
    const scroll = (): void => {
      const container = this.savedAccountsList?.nativeElement;
      const card = container?.querySelector<HTMLElement>(`[data-email="${this.cssEscape(email)}"]`);
      card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      setTimeout(() => {
        this.ignoreScrollSync = false;
      }, 350);
    };
    setTimeout(scroll, 0);
  }

  private syncSelectedAccountFromScroll(): void {
    const container = this.savedAccountsList?.nativeElement;
    if (!container || this.savedAccounts.length === 0) {
      return;
    }

    const containerLeft = container.getBoundingClientRect().left;
    let closestEmail = this.selectedEmail;
    let closestDistance = Number.POSITIVE_INFINITY;

    container.querySelectorAll<HTMLElement>('.saved-account-card').forEach((card) => {
      const email = card.dataset['email'];
      if (!email) {
        return;
      }
      const distance = Math.abs(card.getBoundingClientRect().left - containerLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEmail = email;
      }
    });

    const account = this.savedAccounts.find((item) => item.email === closestEmail);
    if (account && account.email !== this.selectedEmail) {
      this.selectAccount(account, { scroll: false });
    }
  }

  private cssEscape(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/"/g, '\\"');
  }

  private async persistRememberedAccount(email: string, nome?: string): Promise<void> {
    const shouldRemember = !this.usingOtherEmail || this.rememberEmail;
    await this.authService.setRememberEmailPreference(shouldRemember);
    if (!shouldRemember) {
      return;
    }

    const user = this.authService.getCurrentUser();
    await this.authService.rememberLoginAccount({
      email,
      nome: nome?.trim() || user?.nome?.trim() || email,
    });
  }

  private async refreshBiometricState(): Promise<void> {
    this.biometricAvailable = await this.authService.isBiometricAvailable();
    this.biometricEnabled = await this.authService.isBiometricEnabled();
    this.biometricEmail = await this.authService.getBiometricEmail();
  }

  private focusPassword(): void {
    setTimeout(() => this.passwordInput?.nativeElement.focus(), 0);
  }

  private focusEmail(): void {
    setTimeout(() => this.emailInput?.nativeElement.focus(), 0);
  }

  private async maybeEnableBiometrics(email: string, password: string): Promise<void> {
    await this.refreshBiometricState();
    if (!this.biometricAvailable || this.biometricEnabled) {
      return;
    }
    if (await this.authService.isBiometricPromptHidden(email)) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Ativar login por digital?',
      message: 'Você poderá entrar mais rápido usando a biometria.',
      inputs: [
        {
          type: 'checkbox',
          label: 'Não mostrar novamente',
          value: 'hide',
          checked: false,
        },
      ],
      buttons: [
        {
          text: 'Agora não',
          role: 'cancel',
        },
        {
          text: 'Ativar',
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role === 'confirm') {
      const enabled = await this.authService.enableBiometricLogin(email, password);
      this.biometricEnabled = enabled;
      this.biometricEmail = enabled ? this.authService.normalizeLoginEmail(email) : this.biometricEmail;
      return;
    }

    if (this.shouldHideBiometricPrompt(data)) {
      await this.authService.hideBiometricPrompt(email);
    }
  }

  private shouldHideBiometricPrompt(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    const values = (data as { values?: unknown }).values;
    return Array.isArray(values) && values.includes('hide');
  }
}
