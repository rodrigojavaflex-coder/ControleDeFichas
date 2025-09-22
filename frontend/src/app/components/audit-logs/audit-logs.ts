import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuditService, UserService } from '../../services';
import { 
  AuditLog, 
  AuditLogFilters, 
  PaginatedAuditResponse,
  AuditAction,
  AuditLevel,
  AUDIT_ACTION_DESCRIPTIONS,
  AUDIT_LEVEL_DESCRIPTIONS,
  AUDIT_LEVEL_COLORS
} from '../../models/audit.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.html',
  styleUrls: ['./audit-logs.css']
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Dados
  auditLogs: AuditLog[] = [];
  users: User[] = [];
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
  selectedLevel = '';
  selectedSuccess = '';
  selectedEntityType = '';
  startDate = '';
  endDate = '';

  // Enums para template
  auditActions = Object.values(AuditAction);
  auditLevels = Object.values(AuditLevel);
  
  // Descrições para template
  actionDescriptions = AUDIT_ACTION_DESCRIPTIONS;
  levelDescriptions = AUDIT_LEVEL_DESCRIPTIONS;
  levelColors = AUDIT_LEVEL_COLORS;

  // Controles de UI
  showFilters = false;
  selectedLog: AuditLog | null = null;
  showLogDetails = false;

  constructor(
    private auditService: AuditService,
    private userService: UserService,
    private router: Router
  ) {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchText => {
      this.filters.search = searchText || undefined;
      this.filters.page = 1;
      this.currentPage = 1;
      this.loadAuditLogs();
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadAuditLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carregar usuários para filtros
   */
  private loadUsers(): void {
    this.userService.getUsers({ page: 1, limit: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.data;
        },
        error: (error) => {
          console.error('Erro ao carregar usuários:', error);
        }
      });
  }

  /**
   * Carregar logs de auditoria
   */
  loadAuditLogs(): void {
    this.loading = true;
    this.error = null;

    this.auditService.getAuditLogs(this.filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PaginatedAuditResponse) => {
          this.auditLogs = response.data;
          this.totalItems = response.meta.total;
          this.currentPage = response.meta.page;
          this.itemsPerPage = response.meta.limit;
          this.totalPages = response.meta.totalPages;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Erro ao carregar logs de auditoria';
          this.loading = false;
          console.error('Erro:', error);
        }
      });
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
      userId: this.selectedUserId || undefined,
      action: this.selectedAction as AuditAction || undefined,
      level: this.selectedLevel as AuditLevel || undefined,
      success: this.selectedSuccess ? (this.selectedSuccess === 'true') : undefined,
      entityType: this.selectedEntityType || undefined,
      startDate: this.startDate ? new Date(this.startDate) : undefined,
      endDate: this.endDate ? new Date(this.endDate) : undefined
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
    this.selectedLevel = '';
    this.selectedSuccess = '';
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
  showDetails(log: AuditLog): void {
    this.selectedLog = log;
    this.showLogDetails = true;
  }

  /**
   * Fechar detalhes
   */
  closeDetails(): void {
    this.selectedLog = null;
    this.showLogDetails = false;
  }

  /**
   * Formatar data
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR');
  }

  /**
   * Obter nome do usuário
   */
  getUserName(log: AuditLog): string {
    // Priorizar dados do usuário que vêm com o log (relação do backend)
    if (log.user) {
      return log.user.name;
    }
    
    // Fallback: buscar nos usuários carregados separadamente
    if (log.userId) {
      const user = this.users.find(u => u.id === log.userId);
      if (user) {
        return user.name;
      }
      return `ID: ${log.userId}`;
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
}