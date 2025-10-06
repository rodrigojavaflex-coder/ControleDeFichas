import { Directive, OnInit, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorModalService } from '../services';

/**
 * Componente base genérico para listagens com suporte a carregamento, erros e modal de exclusão.
 * Os componentes concretos devem implementar loadItems(), deleteItem(id) e getId(item).
 */
@Directive()
export abstract class BaseListComponent<T> implements OnInit {
  items: T[] = [];
  loading = false;
  error = '';
  showDeleteModal = false;
  itemToDelete: T | null = null;
  deleteModalMessage = '';

  // Serviço de modal de erro injetado uma única vez
  protected errorModalService = inject(ErrorModalService);

  ngOnInit(): void {
    this.loadItems();
  }

  /** Carrega a lista de itens */
  protected abstract loadItems(): void;
  /** Executa a exclusão de um item pelo ID */
  protected abstract deleteItem(id: string): Observable<any>;
  /** Retorna o identificador de um item */
  protected abstract getId(item: T): string;

  /** Abre modal de confirmação de exclusão */
  confirmDelete(item: T, message: string): void {
    this.itemToDelete = item;
    this.deleteModalMessage = message;
    this.showDeleteModal = true;
  }

  /** Confirmação e chamada ao serviço de exclusão */
  onDeleteConfirmed(): void {
    if (!this.itemToDelete) return;
    this.deleteItem(this.getId(this.itemToDelete))
      .pipe(
        finalize(() => this.closeDeleteModal())
      )
      .subscribe({
        next: () => this.loadItems(),
        error: (err: HttpErrorResponse) => {
          const serverMsg = err.error?.message || 'Erro ao excluir';
          this.errorModalService.show(serverMsg);
        }
      });
  }

  /** Cancela exclusão e fecha modal */
  onDeleteCancelled(): void {
    this.closeDeleteModal();
  }

  private closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.itemToDelete = null;
  }
}