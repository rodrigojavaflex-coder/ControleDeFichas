import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService, ThemeService } from '../../services/index';
import { User } from '../../models/user.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmationModalComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();
  
  currentUser$ = this.authService.currentUser$;
  currentTheme$ = this.themeService.currentTheme$;
  
  // Propriedades para o modal de confirmação
  showLogoutModal = false;
  
  // Propriedade para controlar o dropdown do avatar
  showUserDropdown = false;

  ngOnInit() {
    // Observar mudanças nos estados do menu se necessário
  }

  ngOnDestroy() {
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
    this.closeUserDropdown();
  }
  
  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
