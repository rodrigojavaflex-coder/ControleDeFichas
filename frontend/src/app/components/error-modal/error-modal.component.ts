import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-error-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-backdrop" *ngIf="visible">
      <div class="error-modal" [ngClass]="currentTheme">
        <div class="modal-header">
          <h3 class="modal-title">{{ title || 'Erro' }}</h3>
          <button type="button" class="close-icon" (click)="close()">×</button>
        </div>
        <div class="modal-body">
          <p [innerHTML]="message"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" (click)="close()">OK</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .error-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .error-modal {
        position: relative;
        max-width: 400px;
        width: 90%;
        border-radius: 6px;
        transition: background 0.3s, color 0.3s;
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid #ccc;
      }
      .modal-title {
        margin: 0;
        font-size: 1.25rem;
      }
      .close-icon {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
      }
      .modal-body {
        padding: 1rem;
      }
      .modal-footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #ccc;
        text-align: right;
      }
      /* Tema claro */
      .light {
        background: #fff;
        color: #000;
      }
      /* Tema escuro */
      .dark {
        background: #333;
        color: #fff;
      }
      .btn-primary {
        padding: 0.5rem 1rem;
        font-size: 1rem;
      }
    `
  ]
})
export class ErrorModalComponent implements OnInit {
  @Input() visible = false;
  @Input() title?: string;
  @Input() message = '';
  @Output() closed = new EventEmitter<void>();

  close() {
    this.visible = false;
    this.closed.emit();
  }

  // Tema atual (light | dark)
  currentTheme: Theme = 'light';
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    this.themeService.currentTheme$.subscribe(theme => this.currentTheme = theme);
  }
}