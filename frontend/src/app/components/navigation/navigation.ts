import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService } from '../../services/index';
import { Usuario, Permission } from '../../models/usuario.model';

interface MenuItem {
  label: string;
  route?: string;
  icon?: string;
  requiredPermissions: Permission[];
  children?: MenuItem[];
  isOpen?: boolean;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.css']
})
export class NavigationComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  currentUser: Usuario | null = null;
  visibleMenuItems: MenuItem[] = [];

  // Estados do menu através do serviço
  get isMobileOpen() { return this.navigationService.isMobileOpen; }

  // Definir todos os itens de menu disponíveis
  private allMenuItems: MenuItem[] = [
    {
      label: 'Sistema',
      icon: 'feather-cog',
      requiredPermissions: [],
      children: [
        {
          label: 'Auditoria',
          route: '/auditoria',
          icon: 'feather-eye',
          requiredPermissions: [Permission.AUDIT_VIEW, Permission.AUDIT_MANAGE]
        },
        {
          label: 'Usuários',
          route: '/users',
          icon: 'feather-users',
          requiredPermissions: [Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE]
        },
        {
          label: 'Perfis',
          route: '/perfil',
          icon: 'feather-shield',
          requiredPermissions: [
            Permission.PROFILE_CREATE,
            Permission.PROFILE_READ,
            Permission.PROFILE_UPDATE,
            Permission.PROFILE_DELETE
          ]
        },
        {
          label: 'Configuração',
          route: '/configuracao',
          icon: 'feather-sliders',
          requiredPermissions: [Permission.CONFIGURACAO_ACCESS]
        }
      ]
    },
    {
      label: 'Cadastro',
      icon: 'feather-file-text',
      requiredPermissions: [],
      children: [
        {
          label: 'Fichas Técnicas',
          route: '/fichas-tecnicas',
          icon: 'feather-layers',
          requiredPermissions: [Permission.FICHA_TECNICA_CREATE, Permission.FICHA_TECNICA_READ, Permission.FICHA_TECNICA_UPDATE, Permission.FICHA_TECNICA_DELETE]
        },
        {
          label: 'Vendas',
          route: '/vendas',
          icon: 'feather-shopping-cart',
          requiredPermissions: [Permission.VENDA_CREATE, Permission.VENDA_READ, Permission.VENDA_UPDATE, Permission.VENDA_DELETE]
        }
      ]
    },
    {
      label: 'Relatórios',
      icon: 'feather-bar-chart-2',
      requiredPermissions: [],
      children: [
        {
          label: 'Baixas',
          route: '/relatorios/baixas',
          icon: 'feather-file-text',
          requiredPermissions: [Permission.VENDA_BAIXAR]
        }
      ]
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
   * Verifica se o menu deve estar visível (sempre true agora)
   */
  get shouldShowExpanded(): boolean {
    return true; // Menu sempre expandido quando visível
  }

  /**
   * Atualiza os itens de menu visíveis baseado nas permissões do usuário
   */
  private updateVisibleMenuItems() {
    if (!this.currentUser) {
      this.visibleMenuItems = [];
      return;
    }

    this.visibleMenuItems = this.allMenuItems
      .map(menuItem => this.filterMenuItem(menuItem))
      .filter(item => item !== null) as MenuItem[];
  }

  /**
   * Filtra um item de menu e seus filhos baseado nas permissões
   */
  private filterMenuItem(menuItem: MenuItem): MenuItem | null {
    // Se tem filhos, processar recursivamente
    if (menuItem.children) {
      const filteredChildren = menuItem.children
        .map(child => this.filterMenuItem(child))
        .filter(child => child !== null) as MenuItem[];

      // Se tem filhos visíveis, mostrar o item pai
      if (filteredChildren.length > 0) {
        return {
          ...menuItem,
          children: filteredChildren,
          isOpen: false
        };
      }
      return null;
    }

    // Para itens folha, verificar permissões
    if (menuItem.requiredPermissions.length === 0) {
      return menuItem;
    }

    return this.authService.hasAnyPermission(menuItem.requiredPermissions) ? menuItem : null;
  }

  /**
   * Realiza logout do usuário
   */
  async logout() {
    // Fechar o menu antes de fazer logout
    this.navigationService.closeOnNavigation();
    
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

  /**
   * Verifica se um submenu está ativo (algum filho está ativo)
   */
  isSubmenuActive(item: MenuItem): boolean {
    if (!item.children) return false;
    return item.children.some(child => child.route && this.isRouteActive(child.route));
  }

  /**
   * Manipula o clique em um item do menu
   */
  onMenuItemClick(): void {
    this.navigationService.closeOnNavigation();
  }

  /**
   * Alterna a visibilidade de um submenu
   */
  toggleSubmenu(item: MenuItem): void {
    if (item.children) {
      item.isOpen = !item.isOpen;
    }
  }
}
