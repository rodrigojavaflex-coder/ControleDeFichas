import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError, finalize, of } from 'rxjs';

import { AuditoriaService, UserService } from '../../services';
import { PageContextService } from '../../services/page-context.service';
import {
  Auditoria, 
  AuditLogFilters, 
  PaginatedAuditResponse,
  AuditAction,
  AUDIT_ACTION_DESCRIPTIONS,
  getEntityDisplayName
} from '../../models/auditoria.model';
import { Usuario } from '../../models/usuario.model';
import { AuditoriaDadosViewComponent } from './auditoria-dados-view';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule, AuditoriaDadosViewComponent],
  templateUrl: './auditoria.html',
  styleUrls: ['./auditoria.css']
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private reload$ = new Subject<void>();

  // Dados
  auditLogs: Auditoria[] = [];
  users: Usuario[] = [];
  loading = false;
  error: string | null = null;

  // Paginação
  totalItems = 0;
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 0;

  // Filtros
  filters: AuditLogFilters = {
    page: 1,
    limit: 20
  };

  searchText = '';
  selectedUserId = '';
  selectedAction = '';
  selectedEntityType = '';
  startDate = '';
  endDate = '';

  // Enums para template
  auditActions = Object.values(AuditAction);
  
  // Descrições para template
  actionDescriptions = AUDIT_ACTION_DESCRIPTIONS;

  // Controles de UI
  showFilters = false;
  selectedLog: Auditoria | null = null;
  showLogDetails = false;
  showRawJson = false;
  detailsLoading = false;

  constructor(
    private auditoriaService: AuditoriaService,
    private userService: UserService,
    private pageContextService: PageContextService,
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchText => {
      const term = (searchText || '').trim();
      if (term.length === 1) {
        return;
      }
      this.filters.search = term.length >= 2 ? term : undefined;
      this.filters.page = 1;
      this.currentPage = 1;
      this.reload$.next();
    });

    this.reload$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error = null;
        return this.auditoriaService.getAuditLogs(this.filters).pipe(
          catchError((error) => {
            console.error('Erro:', error);
            this.error = 'Erro ao carregar logs de auditoria';
            return of({
              data: [] as Auditoria[],
              meta: {
                total: 0,
                page: 1,
                limit: this.itemsPerPage,
                totalPages: 0,
                hasPreviousPage: false,
                hasNextPage: false
              }
            } as PaginatedAuditResponse);
          }),
          finalize(() => {
            this.loading = false;
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((response: PaginatedAuditResponse) => {
      this.auditLogs = response.data;
      this.totalItems = response.meta.total;
      this.currentPage = response.meta.page;
      this.itemsPerPage = response.meta.limit;
      this.totalPages = response.meta.totalPages;
    });
  }

  ngOnInit(): void {
    this.pageContextService.setContext({
      title: 'Logs de Auditoria',
      description: 'Consulte o histórico de ações do sistema, filtros e detalhes dos registros auditados.'
    });
    this.loadUsers();
    this.loadAuditLogs();
  }

  ngOnDestroy(): void {
    this.pageContextService.resetContext();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carregar usuários para filtros
   */
  private loadUsers(): void {
    this.userService.getUsers({ page: 1, limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.data;
        },
        error: (error) => {
          console.error('Erro ao carregar usuários:', error);
          // Fallback: tentar com limit menor se ainda falhar
          if (error.status === 400 && error.error?.message?.includes('limit must not be greater than')) {
            this.userService.getUsers({ page: 1, limit: 50 })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (fallbackResponse) => {
                  this.users = fallbackResponse.data;
                },
                error: (fallbackError) => {
                  console.error('Erro no fallback ao carregar usuários:', fallbackError);
                }
              });
          }
        }
      });
  }

  /**
   * Carregar logs de auditoria
   */
  loadAuditLogs(): void {
    this.reload$.next();
  }

  /**
   * Buscar por texto
   */
  onSearchChange(): void {
    this.searchSubject.next(this.searchText);
  }

  /**
   * Aplicar filtros
   */
  applyFilters(): void {
    this.filters = {
      ...this.filters,
      page: 1,
      usuarioId: this.selectedUserId || undefined,
      acao: this.selectedAction as AuditAction || undefined,
      entidade: this.selectedEntityType || undefined,
      startDate: this.startDate ? new Date(this.startDate).toISOString() : undefined,
      endDate: this.endDate ? new Date(this.endDate).toISOString() : undefined
    };
    
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  /**
   * Limpar filtros
   */
  clearFilters(): void {
    this.searchText = '';
    this.selectedUserId = '';
    this.selectedAction = '';
    this.selectedEntityType = '';
    this.startDate = '';
    this.endDate = '';

    this.filters = {
      page: 1,
      limit: this.itemsPerPage
    };
    
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  /**
   * Mudar página
   */
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.filters.page = page;
      this.loadAuditLogs();
    }
  }

  /**
   * Mostrar detalhes do log
   */
  showDetails(log: Auditoria): void {
    this.selectedLog = log;
    this.showRawJson = false;
    this.showLogDetails = true;
    this.detailsLoading = true;

    this.auditoriaService.getAuditLog(log.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => {
          if (this.selectedLog?.id === full.id) {
            this.selectedLog = full;
          }
          this.detailsLoading = false;
        },
        error: () => {
          this.detailsLoading = false;
        }
      });
  }

  /**
   * Fechar detalhes
   */
  closeDetails(): void {
    this.selectedLog = null;
    this.showLogDetails = false;
    this.showRawJson = false;
    this.detailsLoading = false;
  }

  /**
   * Formatar data
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR');
  }

  /**
   * Classe visual do badge conforme a ação auditada
   */
  getActionBadgeClass(acao: AuditAction | string | null | undefined): string {
    const classes: Record<string, string> = {
      [AuditAction.LOGIN]: 'action-login',
      [AuditAction.LOGOUT]: 'action-logout',
      [AuditAction.LOGIN_FAILED]: 'action-login-failed',
      [AuditAction.CREATE]: 'action-create',
      [AuditAction.READ]: 'action-read',
      [AuditAction.UPDATE]: 'action-update',
      [AuditAction.DELETE]: 'action-delete',
      [AuditAction.CHANGE_PASSWORD]: 'action-change-password',
    };
    return classes[acao ?? ''] ?? 'action-unknown';
  }

  /**
   * Obter nome do usuário
   */
  getUserName(log: Auditoria): string {
    // Priorizar dados do usuário que vêm com o log (relação do backend)
    if (log.usuario) {
      return log.usuario.nome;  // Backend retorna "nome"
    }
    
    // Fallback: buscar nos usuários carregados separadamente
    if (log.usuarioId) {
      const user = this.users.find(u => u.id === log.usuarioId);
      if (user) {
        return user.nome;
      }
      return `ID: ${log.usuarioId}`;
    }
    
    return 'Sistema';
  }

  /**
   * Formatar JSON para exibição
   */
  formatJson(data: any): string {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  }

  /**
   * Obter array de páginas para exibição
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Alternar exibição de filtros
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Obter nome amigável da entidade para exibição
   */
  getEntityDisplayName(tableName: string | null | undefined): string {
    return getEntityDisplayName(tableName || '');
  }
}
