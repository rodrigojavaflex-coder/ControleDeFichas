import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { SincronizacaoLogErro } from '../../models/sincronizacao.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-sincronizacao-logs-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sincronizacao-logs-modal.html',
  styleUrls: ['./sincronizacao-logs-modal.css'],
})
export class SincronizacaoLogsModalComponent {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);

  visible = false;
  loading = false;
  limpando = false;
  error = '';
  filtroAgente = '';
  filtroNivel: '' | 'info' | 'warn' | 'error' = '';
  logs: SincronizacaoLogErro[] = [];

  readonly agentesFiltro = [
    { value: '', label: 'Todos' },
    { value: 'inhumas', label: 'Inhumas' },
    { value: 'uberaba', label: 'Uberaba' },
    { value: 'neropolis', label: 'Nerópolis' },
  ];

  readonly niveisFiltro: { value: '' | 'info' | 'warn' | 'error'; label: string }[] =
    [
      { value: '', label: 'Todos' },
      { value: 'info', label: 'Sucesso' },
      { value: 'warn', label: 'Alertas' },
      { value: 'error', label: 'Erros' },
    ];

  abrir(agente?: string): void {
    this.error = '';
    this.filtroAgente = agente ?? '';
    this.filtroNivel = '';
    this.visible = true;
    this.carregar();
  }

  fechar(): void {
    if (this.loading || this.limpando) {
      return;
    }
    this.visible = false;
  }

  onFiltroChange(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.error = '';
    this.sincronizacaoService
      .listarLogsErro({
        agente: this.filtroAgente || undefined,
        nivel: this.filtroNivel || undefined,
        limit: 200,
      })
      .subscribe({
        next: (logs) => {
          this.logs = logs;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = extrairMensagemErroApi(
            err,
            'Não foi possível carregar os logs.',
          );
        },
      });
  }

  limparLogs(): void {
    if (this.limpando || this.loading) {
      return;
    }
    const escopo = this.filtroAgente
      ? `do agente ${this.filtroAgente}`
      : 'de todos os agentes';
    if (
      !confirm(
        `Limpar logs ${escopo}? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    this.limpando = true;
    this.error = '';
    this.sincronizacaoService
      .limparLogsErro(this.filtroAgente || undefined)
      .subscribe({
        next: (res) => {
          this.limpando = false;
          this.logs = [];
          this.error = '';
          if (res.removidos === 0) {
            this.error = 'Nenhum log para remover.';
          }
        },
        error: (err) => {
          this.limpando = false;
          this.errorModalService.show(
            extrairMensagemErroApi(err, 'Não foi possível limpar os logs.'),
          );
        },
      });
  }

  formatarDataHora(iso: string | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  rotuloAgente(agente: string): string {
    const map: Record<string, string> = {
      inhumas: 'Inhumas',
      uberaba: 'Uberaba',
      neropolis: 'Nerópolis',
    };
    return map[agente] ?? agente;
  }
}
