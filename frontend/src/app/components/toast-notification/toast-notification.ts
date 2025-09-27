import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-toast-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" [class.show]="isVisible" [class]="'theme-' + currentTheme">
      <div class="toast" [class]="'toast-' + type">
        <div class="toast-content">
          <span class="toast-message">{{ message }}</span>
        </div>
        <button class="toast-close" (click)="onClose()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100%);
      z-index: 1100;
      opacity: 0;
      transition: all 0.5s ease;
    }

    .toast-container.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .toast {
      background: var(--bg-primary, white);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 300px;
      max-width: 400px;
      border-left: 4px solid;
    }

    .toast-success {
      border-left-color: #10b981;
      background: var(--bg-success, #f0fdf4);
    }

    .toast-error {
      border-left-color: #dc2626;
      background: var(--bg-error, #fef2f2);
    }

    .toast-info {
      border-left-color: #3b82f6;
      background: var(--bg-info, #f0f9ff);
    }

    /* Tema escuro específico para toast */
    .theme-dark .toast {
      background: #2d3748 !important;
    }

    .theme-dark .toast-success {
      background: #2d3748 !important;
      border-left-color: #38a169;
    }

    .theme-dark .toast-error {
      background: #2d3748 !important;
      border-left-color: #e53e3e;
    }

    .theme-dark .toast-info {
      background: #2d3748 !important;
      border-left-color: #4299e1;
    }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .toast-message {
      font-weight: 500;
      color: var(--text-primary, #374151);
    }

    .toast-close {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--text-secondary, #6b7280);
      border-radius: 4px;
      transition: background 0.2s ease;
    }

    .toast-close:hover {
      background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    }
  `]
})
export class ToastNotificationComponent implements OnInit {
  @Input() isVisible = false;
  @Input() message = '';
  @Input() type: 'success' | 'error' | 'info' = 'info';
  @Input() duration = 5000;
  @Output() closed = new EventEmitter<void>();

  private themeService = inject(ThemeService);
  currentTheme: string = 'light';
  private timeoutId?: number;

  ngOnInit() {
    this.themeService.currentTheme$.subscribe(theme => {
      this.currentTheme = theme;
    });
  }

  ngOnChanges() {
    if (this.isVisible && this.duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.onClose();
      }, this.duration);
    }
  }

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  onClose() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.closed.emit();
  }
}