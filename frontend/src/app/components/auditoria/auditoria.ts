import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuditoriaService, UserService } from '../../services';
import { 
  Auditoria, 
  AuditLogFilters, 
  PaginatedAuditResponse,
  AuditAction,
  AUDIT_ACTION_DESCRIPTIONS,
  RollbackResult,
  UndoableChange,
  getEntityDisplayName
} from '../../models/auditoria.model';
import { Usuario } from '../../models/usuario.model';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, FormsModule],
  templateUrl: './auditoria.html',
  styleUrls: ['./auditoria.css']
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

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

  // Funcionalidades de rollback
  undoableChanges: UndoableChange[] = [];
  showUndoablePanel = false;
  undoingLogId: string | null = null;
  undoResult: RollbackResult | null = null;
  showUndoConfirm = false;
  logToUndo: Auditoria | UndoableChange | null = null;

  constructor(
    private auditoriaService: AuditoriaService,
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
    this.loading = true;
    this.error = null;

    this.auditoriaService.getAuditLogs(this.filters)
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
  getUserName(log: Auditoria | UndoableChange): string {
    // Priorizar dados do usuário que vêm com o log (relação do backend)
    if (log.usuario) {
      return log.usuario.name;  // Corrigido: backend retorna "name" não "nome"
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
   * Carregar alterações que podem ser desfeitas
   */
  loadUndoableChanges(): void {
    this.auditoriaService.getUndoableChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (changes: Auditoria[]) => {
          this.undoableChanges = changes.map(change => ({
            id: change.id,
            acao: change.acao,
            descricao: change.descricao || '',
            usuarioId: change.usuarioId,
            usuario: change.usuario,
            criadoEm: change.criadoEm,
            canUndo: this.canUndo(change),
            undoTimeLimit: new Date(change.criadoEm.getTime() + 24 * 60 * 60 * 1000)
          }));
        },
        error: (error) => {
          console.error('Erro ao carregar alterações desfaíveis:', error);
        }
      });
  }

  /**
   * Verificar se uma alteração pode ser desfeita
   */
  canUndo(log: Auditoria): boolean {
    const timeLimit = new Date(log.criadoEm.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    return now <= timeLimit;
  }

  /**
   * Mostrar painel de alterações desfaíveis
   */
  toggleUndoablePanel(): void {
    this.showUndoablePanel = !this.showUndoablePanel;
    if (this.showUndoablePanel) {
      this.loadUndoableChanges();
    }
  }

  /**
   * Confirmar undo de uma alteração
   */
  confirmUndo(log: Auditoria | UndoableChange): void {
    this.logToUndo = log;
    this.showUndoConfirm = true;
  }

  /**
   * Cancelar undo
   */
  cancelUndo(): void {
    this.logToUndo = null;
    this.showUndoConfirm = false;
  }

  /**
   * Executar rollback
   */
  executeUndo(): void {
    if (!this.logToUndo) return;

    this.undoingLogId = this.logToUndo.id;
    this.undoResult = null;

    this.auditoriaService.undoChange(this.logToUndo.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: RollbackResult) => {
          this.undoResult = result;
          this.undoingLogId = null;

          if (result.success) {
            // Recarregar logs e alterações desfaíveis
            this.loadAuditLogs();
            this.loadUndoableChanges();
          }

          // Fechar modal de confirmação após um tempo
          setTimeout(() => {
            this.showUndoConfirm = false;
            this.logToUndo = null;
            this.undoResult = null;
          }, 3000);
        },
        error: (error) => {
          this.undoResult = {
            success: false,
            message: 'Erro ao executar rollback: ' + (error.error?.message || error.message)
          };
          this.undoingLogId = null;

          setTimeout(() => {
            this.undoResult = null;
          }, 5000);
        }
      });
  }

  /**
   * Verificar se um log pode ser desfeito (baseado na lista de alterações desfaíveis)
   */
  isUndoable(log: Auditoria): boolean {
    return this.undoableChanges.some(change => change.id === log.id);
  }

  /**
   * Formatar tempo restante para undo
   */
  formatTimeRemaining(log: Auditoria | UndoableChange): string {
    const timeLimit = new Date(log.criadoEm.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = timeLimit.getTime() - now.getTime();

    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  }

  /**
   * Obter nome amigável da entidade para exibição
   */
  getEntityDisplayName(tableName: string | null | undefined): string {
    return getEntityDisplayName(tableName || '');
  }
}
