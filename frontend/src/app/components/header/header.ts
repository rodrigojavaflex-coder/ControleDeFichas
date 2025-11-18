import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService, ThemeService } from '../../services/index';
import { Usuario, Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal';
import { ToastNotificationComponent } from '../toast-notification/toast-notification';
import { PageContextService } from '../../services/page-context.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmationModalComponent, ChangePasswordModalComponent, ToastNotificationComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css', './dropdown-item.css']
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private themeService = inject(ThemeService);
  private pageContextService = inject(PageContextService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  
  currentUser$ = this.authService.currentUser$;
  currentTheme$ = this.themeService.currentTheme$;
  pageContext$ = this.pageContextService.context$;
  
  // Propriedades para o modal de confirmação
  showLogoutModal = false;
  
  // Propriedade para controlar o dropdown do avatar
  showUserDropdown = false;

  // Propriedade para controlar o modal de alteração de senha
  showChangePasswordModal = false;

  // Propriedades para notificações
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';
  loginElapsedLabel = '';
  sessionExpirationLabel = '';
  sessionNearExpiry = false;
  private loginTimestamp: number | null = null;
  private tokenExpiration: number | null = null;
  private timeTicker: any = null;

  ngOnInit() {
    // Observar mudanças de tema para mostrar notificação
    this.themeService.themeChanged
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ message }) => {
        this.showToastMessage(message, 'info');
      });

    this.authService.loginTimestamp$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timestamp => {
        this.loginTimestamp = timestamp;
        this.restartTimeTicker();
      });

    this.authService.tokenExpiration$
      .pipe(takeUntil(this.destroy$))
      .subscribe(expiration => {
        this.tokenExpiration = expiration;
        this.restartTimeTicker();
      });
  }

  ngOnDestroy() {
    if (this.timeTicker) {
      clearInterval(this.timeTicker);
      this.timeTicker = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu() {
    this.navigationService.toggleMobile();
  }

  logout() {
    // Abrir modal de confirmação em vez de fazer logout direto
    this.showLogoutModal = true;
  }

  confirmLogout() {
    this.showLogoutModal = false;
    this.authService.logout();
  }

  cancelLogout() {
    this.showLogoutModal = false;
  }
  
  toggleUserDropdown() {
    this.showUserDropdown = !this.showUserDropdown;
  }
  
  closeUserDropdown() {
    this.showUserDropdown = false;
  }
  
  setTheme(theme: 'light' | 'dark') {
    this.themeService.setTheme(theme);
    // Fechar o dropdown após alterar o tema
    this.showUserDropdown = false;
  }

  changePassword() {
    // Fechar o dropdown antes de abrir o modal
    this.showUserDropdown = false;
    this.showChangePasswordModal = true;
  }

  onChangePasswordClosed() {
    this.showChangePasswordModal = false;
  }

  onPasswordChanged() {
    this.showChangePasswordModal = false;
  }

  onSuccessMessage(message: string) {
    this.toastMessage = message;
    this.toastType = 'success';
    this.showToast = true;
  }

  onErrorMessage(message: string) {
    this.toastMessage = message;
    this.toastType = 'error';
    this.showToast = true;
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
  }

  onToastClosed() {
    this.showToast = false;
  }
  toggleTheme() {
    this.themeService.toggleTheme();
  }

  private restartTimeTicker(): void {
    if (this.timeTicker) {
      clearInterval(this.timeTicker);
      this.timeTicker = null;
    }

    this.updateTimingLabels();

    if (this.loginTimestamp || this.tokenExpiration) {
      this.timeTicker = setInterval(() => this.updateTimingLabels(), 60000);
    }
  }

  private updateTimingLabels(): void {
    if (this.loginTimestamp) {
      const elapsed = Date.now() - this.loginTimestamp;
      this.loginElapsedLabel = this.formatDuration(elapsed);
    } else {
      this.loginElapsedLabel = '';
    }

    if (this.tokenExpiration) {
      const remaining = this.tokenExpiration - Date.now();
      this.sessionNearExpiry = remaining > 0 && remaining <= 10 * 60 * 1000;
      this.sessionExpirationLabel =
        remaining > 0 ? this.formatDuration(remaining) : 'expirada';
    } else {
      this.sessionExpirationLabel = '';
      this.sessionNearExpiry = false;
    }
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds <= 0) {
      return 'agora';
    }

    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes}min`);
    }
    return parts.join(' ');
  }
}
