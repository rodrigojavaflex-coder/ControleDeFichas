import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService } from '../../services/index';
import { Usuario, Permission } from '../../models/usuario.model';
import {
  getNavigationMenuIconHtml,
  NAV_LOGOUT_ICON_SVG_HTML,
} from './navigation-lucide-svgs';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

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
  imports: [CommonModule, RouterModule, ConfirmationModalComponent],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.css']
})
export class NavigationComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  readonly logoutIconHtml: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    NAV_LOGOUT_ICON_SVG_HTML,
  );
  private destroy$ = new Subject<void>();

  currentUser: Usuario | null = null;
  visibleMenuItems: MenuItem[] = [];
  showLogoutModal = false;

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
          requiredPermissions: [Permission.AUDIT_VIEW]
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
      label: 'Fichas',
      icon: 'feather-layers',
      requiredPermissions: [],
      children: [
        {
          label: 'Fichas Técnicas',
          route: '/fichas-tecnicas',
          icon: 'feather-layers',
          requiredPermissions: [
            Permission.FICHA_TECNICA_CREATE,
            Permission.FICHA_TECNICA_READ,
            Permission.FICHA_TECNICA_UPDATE,
            Permission.FICHA_TECNICA_DELETE,
          ],
        },
      ],
    },
    {
      label: 'Vendas',
      icon: 'feather-shopping-cart',
      requiredPermissions: [],
      children: [
        {
          label: 'Vendas',
          route: '/vendas',
          icon: 'feather-shopping-cart',
          requiredPermissions: [
            Permission.VENDA_CREATE,
            Permission.VENDA_READ,
            Permission.VENDA_UPDATE,
            Permission.VENDA_DELETE,
          ],
        },
        {
          label: 'Fechamento',
          route: '/fechamento-vendas',
          icon: 'feather-check-circle',
          requiredPermissions: [Permission.VENDA_ACESSAR_FECHAMENTO],
        },
      ],
    },
    {
      label: 'Orçamentos',
      icon: 'feather-file-text',
      requiredPermissions: [],
      children: [
        {
          label: 'Indicadores',
          route: '/orcamentos/dashboard',
          icon: 'feather-bar-chart-2',
          requiredPermissions: [Permission.ORCAMENTO_DASHBOARD_READ],
        },
        {
          label: 'Orçamentos',
          route: '/orcamentos',
          icon: 'feather-file-text',
          requiredPermissions: [
            Permission.ORCAMENTO_REJEITADO_READ,
            Permission.ORCAMENTO_APROVADO_READ,
          ],
        },
      ],
    },
    {
      label: 'Cadastros',
      icon: 'feather-user',
      requiredPermissions: [],
      children: [
        {
          label: 'Cargos',
          route: '/folha/cargos',
          icon: 'feather-briefcase',
          requiredPermissions: [
            Permission.FOLHA_CARGO_CREATE,
            Permission.FOLHA_CARGO_READ,
            Permission.FOLHA_CARGO_UPDATE,
            Permission.FOLHA_CARGO_DELETE,
          ],
        },
        {
          label: 'Clientes',
          route: '/clientes',
          icon: 'feather-user',
          requiredPermissions: [
            Permission.CLIENTE_CREATE,
            Permission.CLIENTE_READ,
            Permission.CLIENTE_UPDATE,
            Permission.CLIENTE_DELETE,
          ],
        },
        {
          label: 'Eventos',
          route: '/folha/verbas',
          icon: 'feather-list',
          requiredPermissions: [
            Permission.FOLHA_VERBA_CREATE,
            Permission.FOLHA_VERBA_READ,
            Permission.FOLHA_VERBA_UPDATE,
            Permission.FOLHA_VERBA_DELETE,
          ],
        },
        {
          label: 'Funcionários',
          route: '/folha/funcionarios',
          icon: 'feather-users',
          requiredPermissions: [
            Permission.FOLHA_FUNCIONARIO_CREATE,
            Permission.FOLHA_FUNCIONARIO_READ,
            Permission.FOLHA_FUNCIONARIO_UPDATE,
            Permission.FOLHA_FUNCIONARIO_DELETE,
          ],
        },
        {
          label: 'Motivos de rejeição',
          route: '/orcamentos/motivos-rejeicao',
          icon: 'feather-list',
          requiredPermissions: [
            Permission.ORCAMENTO_MOTIVO_CREATE,
            Permission.ORCAMENTO_MOTIVO_READ,
            Permission.ORCAMENTO_MOTIVO_UPDATE,
            Permission.ORCAMENTO_MOTIVO_DELETE,
          ],
        },
        {
          label: 'Prescritores',
          route: '/prescritores',
          icon: 'feather-user-plus',
          requiredPermissions: [
            Permission.PRESCRITOR_CREATE,
            Permission.PRESCRITOR_READ,
            Permission.PRESCRITOR_UPDATE,
            Permission.PRESCRITOR_DELETE,
          ],
        },
        {
          label: 'Setores',
          route: '/folha/setores',
          icon: 'feather-aperture',
          requiredPermissions: [
            Permission.FOLHA_SETOR_CREATE,
            Permission.FOLHA_SETOR_READ,
            Permission.FOLHA_SETOR_UPDATE,
            Permission.FOLHA_SETOR_DELETE,
          ],
        },
        {
          label: 'Tipo de Folha',
          route: '/folha/tipos',
          icon: 'feather-layers',
          requiredPermissions: [
            Permission.FOLHA_TIPO_CREATE,
            Permission.FOLHA_TIPO_READ,
            Permission.FOLHA_TIPO_UPDATE,
            Permission.FOLHA_TIPO_DELETE,
          ],
        },
        {
          label: 'Vendedores',
          route: '/vendedores',
          icon: 'feather-user-check',
          requiredPermissions: [
            Permission.VENDEDOR_CREATE,
            Permission.VENDEDOR_READ,
            Permission.VENDEDOR_UPDATE,
            Permission.VENDEDOR_DELETE,
          ],
        },
      ],
    },
    {
      label: 'Folha',
      icon: 'feather-briefcase',
      requiredPermissions: [],
      children: [
        {
          label: 'Lançamentos',
          route: '/folha/lancamentos',
          icon: 'feather-edit-3',
          requiredPermissions: [
            Permission.FOLHA_LANCAMENTO_CREATE,
            Permission.FOLHA_LANCAMENTO_READ,
            Permission.FOLHA_LANCAMENTO_UPDATE,
            Permission.FOLHA_LANCAMENTO_DELETE,
          ],
        },
        {
          label: 'Controle',
          route: '/folha/controle',
          icon: 'feather-lock',
          requiredPermissions: [
            Permission.FOLHA_FECHAMENTO_READ,
            Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
            Permission.FOLHA_FECHAMENTO_FECHAR,
            Permission.FOLHA_FECHAMENTO_REABRIR,
          ],
        },
        {
          label: 'Atendimento WhatsApp',
          route: '/folha/atendimento-whatsapp',
          icon: 'brand-whatsapp',
          requiredPermissions: [Permission.FOLHA_WHATSAPP_READ],
        },
      ],
    },
    {
      label: 'Produção',
      icon: 'feather-layers',
      requiredPermissions: [],
      children: [
        {
          label: 'Configuração de produção',
          route: '/producao/config',
          icon: 'feather-settings',
          requiredPermissions: [
            Permission.PRODUCAO_CONFIG_READ,
            Permission.PRODUCAO_CONFIG_UPDATE,
          ],
        },
        {
          label: 'Produtividade',
          route: '/producao/produtividade',
          icon: 'feather-bar-chart-2',
          requiredPermissions: [Permission.PRODUCAO_PRODUTIVIDADE_READ],
        },
      ],
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
        },
        {
          label: 'Fechamento de Caixa',
          route: '/relatorios/fechamento-caixa',
          icon: 'feather-dollar-sign',
          requiredPermissions: [Permission.VENDA_FECHAR_CAIXA]
        },
        {
          label: 'Acompanhar (Vendas)',
          route: '/relatorios/acompanhar-vendas',
          icon: 'feather-file-text',
          requiredPermissions: [Permission.VENDA_ACOMPANHAR]
        },
        {
          label: 'Análise de Valores',
          route: '/relatorios/analise-valores',
          icon: 'feather-trending-up',
          requiredPermissions: [Permission.VENDA_ANALISE_VALORES]
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

  /** Abre confirmação antes de sair (mesmo fluxo do header). */
  logout(): void {
    this.showLogoutModal = true;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.navigationService.closeOnNavigation();
    void this.authService.logout();
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  /**
   * Verifica se uma rota está ativa
   */
  isRouteActive(route: string): boolean {
    return this.router.url === route;
  }

  isHomeActive(): boolean {
    const url = this.router.url.split('?')[0];
    return url === '/' || url === '';
  }

  /**
   * Verifica se um submenu está ativo (algum filho está ativo)
   */
  isSubmenuActive(item: MenuItem): boolean {
    if (!item.children) return false;
    return item.children.some(child => {
      if (child.route && this.isRouteActive(child.route)) return true;
      if (child.children) return this.isSubmenuActive(child);
      return false;
    });
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

  /** SVG Lucide (estilo Feather) para itens do menu — ver `navigation-lucide-svgs.ts`. */
  menuIcon(key?: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getNavigationMenuIconHtml(key));
  }
}
