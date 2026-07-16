import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  IMPORTACAO_MANUAL_STUCK_MS,
  ImportacaoManualFase,
  ImportacaoManualProgress,
} from '../../models/importacao-manual-progress.model';

@Component({
  selector: 'app-importacao-manual-progress-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './importacao-manual-progress-panel.html',
  styleUrls: ['./importacao-manual-progress-panel.css'],
})
export class ImportacaoManualProgressPanelComponent {
  @Input() progress: ImportacaoManualProgress | null = null;

  get percentual(): number {
    return this.progress?.percentual ?? 0;
  }

  get faseLabel(): string {
    return this.formatFase(this.progress?.fase);
  }

  get contadorLabel(): string {
    if (!this.progress) {
      return '';
    }
    if (this.progress.total > 0) {
      return `${this.progress.atual} / ${this.progress.total}`;
    }
    if (this.progress.segmentosTotal > 0) {
      return `Segmento ${this.progress.segmentoAtual} / ${this.progress.segmentosTotal}`;
    }
    return '';
  }

  get possivelTravamento(): boolean {
    if (!this.progress || this.progress.status !== 'running') {
      return false;
    }
    const atualizadoEm = Date.parse(this.progress.atualizadoEm);
    if (Number.isNaN(atualizadoEm)) {
      return false;
    }
    return Date.now() - atualizadoEm > IMPORTACAO_MANUAL_STUCK_MS;
  }

  get segundosSemAtualizacao(): number {
    if (!this.progress?.atualizadoEm) {
      return 0;
    }
    const atualizadoEm = Date.parse(this.progress.atualizadoEm);
    if (Number.isNaN(atualizadoEm)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - atualizadoEm) / 1000));
  }

  formatLogTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private formatFase(fase?: ImportacaoManualFase): string {
    switch (fase) {
      case 'iniciando':
        return 'Iniciando';
      case 'consultando_agente':
        return 'Agente (Firebird)';
      case 'gravando_postgres':
        return 'PostgreSQL';
      case 'finalizando':
        return 'Finalizando';
      case 'concluido':
        return 'Concluído';
      case 'erro':
        return 'Erro';
      default:
        return 'Processando';
    }
  }
}
