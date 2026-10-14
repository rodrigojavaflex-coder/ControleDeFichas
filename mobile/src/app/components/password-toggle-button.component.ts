import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-password-toggle-button',
  standalone: true,
  imports: [IonIcon],
  template: `
    <button
      type="button"
      class="password-toggle"
      [attr.aria-label]="visible ? hideLabel : showLabel"
      [attr.aria-pressed]="visible"
      [disabled]="disabled"
      (click)="toggled.emit()"
    >
      <ion-icon
        [name]="visible ? 'eye-off-outline' : 'eye-outline'"
        aria-hidden="true"
      ></ion-icon>
    </button>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .password-toggle {
      position: absolute;
      top: 0;
      right: 0;
      width: 44px;
      height: 45px;
      border: 0;
      background: transparent;
      color: var(--ion-color-medium, #64748b);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 8px;
    }

    .password-toggle ion-icon {
      font-size: 1.25rem;
    }

    .password-toggle:hover:not(:disabled),
    .password-toggle:focus-visible:not(:disabled) {
      color: var(--ion-color-primary, #2563eb);
    }

    .password-toggle:focus-visible {
      outline: 2px solid var(--ion-color-primary, #3b82f6);
      outline-offset: -2px;
    }

    .password-toggle:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `],
})
export class PasswordToggleButtonComponent {
  @Input() visible = false;
  @Input() disabled = false;
  @Input() showLabel = 'Mostrar senha';
  @Input() hideLabel = 'Ocultar senha';
  @Output() readonly toggled = new EventEmitter<void>();

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline });
  }
}
