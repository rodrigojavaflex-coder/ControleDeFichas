import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlobalBlockingOverlayService } from '../../services/global-blocking-overlay.service';

@Component({
  selector: 'app-global-blocking-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-blocking-overlay.component.html',
  styleUrls: ['./global-blocking-overlay.component.css'],
})
export class GlobalBlockingOverlayComponent {
  readonly blocking = inject(GlobalBlockingOverlayService);

  progressPercent(state: {
    progressCurrent: number;
    progressTotal: number;
  }): number {
    if (!state.progressTotal || state.progressTotal <= 0) return 0;
    const pct = Math.round((state.progressCurrent / state.progressTotal) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  progressText(state: {
    progressCurrent: number;
    progressTotal: number;
  }): string {
    if (!state.progressTotal || state.progressTotal <= 0) {
      return 'Processando…';
    }
    return `${state.progressCurrent} de ${state.progressTotal}`;
  }

  dismiss(): void {
    this.blocking.hide();
  }
}
