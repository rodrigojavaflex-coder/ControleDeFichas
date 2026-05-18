import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="onOverlayClick($event)">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          @if (cancelText) {
            <button type="button" class="btn btn-secondary" (click)="onCancel()">
              {{ cancelText }}
            </button>
          }
          <button
            type="button"
            class="btn"
            [class.btn-primary]="confirmBtnPrimary()"
            [class.btn-danger]="confirmBtnDanger()"
            (click)="onConfirm()"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
    styleUrls: ['./confirmation-modal.css']
})
export class ConfirmationModalComponent {
  @Input() isVisible = false;
  @Input() title = 'Confirmação';
  @Input() message = 'Tem certeza que deseja continuar?';
  @Input() confirmText = 'Sim';
  @Input() cancelText = 'Cancelar';
  /** Quando há `cancelText`, o botão de confirmação é vermelho por padrão; use `primary` para ações não destrutivas. */
  @Input() confirmVariant: 'danger' | 'primary' = 'danger';

  confirmBtnPrimary(): boolean {
    return !this.cancelText || this.confirmVariant === 'primary';
  }

  confirmBtnDanger(): boolean {
    return !!this.cancelText && this.confirmVariant !== 'primary';
  }

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}