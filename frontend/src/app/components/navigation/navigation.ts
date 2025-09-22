import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService } from '../../services/index';
import { User, Permission } from '../../models/user.model';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  requiredPermissions: Permission[];
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation.html',
  styleUrl: './navigation.css'
})
export class NavigationComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  visibleMenuItems: MenuItem[] = [];

  // Estados do menu através do serviço
  get isExpanded() { return this.navigationService.isExpanded; }
  get isPinned() { return this.navigationService.isPinned; }
  get isMobileOpen() { return this.navigationService.isMobileOpen; }

  // Definir todos os itens de menu disponíveis
  private allMenuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon: '📊',
      requiredPermissions: []
    },
    {
      label: 'Usuários',
      route: '/users',
      icon: '👥',
      requiredPermissions: [Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE]
    },
    {
      label: 'Fichas Técnicas',
      route: '/fichas-tecnicas',
      icon: '📋',
      requiredPermissions: [Permission.FICHA_TECNICA_CREATE, Permission.FICHA_TECNICA_READ, Permission.FICHA_TECNICA_UPDATE, Permission.FICHA_TECNICA_DELETE]
    },
    {
      label: 'Auditoria',
      route: '/audit',
      icon: '🔍',
      requiredPermissions: [Permission.AUDIT_VIEW, Permission.AUDIT_MANAGE]
    },
    {
      label: 'Relatórios',
      route: '/reports',
      icon: '📈',
      requiredPermissions: [Permission.REPORTS_VIEW, Permission.REPORTS_EXPORT]
    },
    {
      label: 'Configurações',
      route: '/settings',
      icon: '⚙️',
      requiredPermissions: [Permission.SYSTEM_CONFIG, Permission.ADMIN_FULL]
    }
  ];

  ngOnInit() {
    // Observar mudanças no usuário atual
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.updateVisibleMenuItems();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Alterna entre expandido/colapsado
   */
  toggleExpanded() {
    this.navigationService.toggleExpanded();
  }

  /**
   * Alterna entre fixado/não fixado
   */
  togglePinned() {
    this.navigationService.togglePinned();
  }

  /**
   * Controle de hover para menu não fixado
   */
  onMouseEnter() {
    if (!this.isPinned) {
      this.navigationService.setExpanded(true);
    }
  }

  /**
   * Controle de hover para menu não fixado
   */
  onMouseLeave() {
    if (!this.isPinned) {
      this.navigationService.setExpanded(false);
    }
  }

  /**
   * Verifica se o menu deve estar visível (expandido)
   */
  get shouldShowExpanded(): boolean {
    return this.isPinned ? this.isExpanded : this.isExpanded;
  }

  /**
   * Atualiza os itens de menu visíveis baseado nas permissões do usuário
   */
  private updateVisibleMenuItems() {
    if (!this.currentUser) {
      this.visibleMenuItems = [];
      return;
    }

    this.visibleMenuItems = this.allMenuItems.filter(menuItem => {
      // Se não requer permissões, mostrar sempre
      if (menuItem.requiredPermissions.length === 0) {
        return true;
      }

      // Verificar se usuário tem pelo menos uma das permissões necessárias
      return this.authService.hasAnyPermission(menuItem.requiredPermissions);
    });
  }

  /**
   * Realiza logout do usuário
   */
  async logout() {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, navegar para login
      this.router.navigate(['/login']);
    }
  }

  /**
   * Verifica se uma rota está ativa
   */
  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }
}