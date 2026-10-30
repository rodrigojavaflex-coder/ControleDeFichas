import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { BackfillPfcrmRetratosResponse } from '../../models/sincronizacao.model';
import { AuthService } from '../../services/auth.service';
import { Unidade } from '../../models/usuario.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

type Fase = 'idle' | 'preview' | 'aplicando';

export interface BackfillFalhaLinha {
  tipo: string;
  unidade: string;
  crm: string;
  uf: string;
  motivo: string;
  raw: string;
}

@Component({
  selector: 'app-backfill-pfcrm-retratos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './backfill-pfcrm-retratos-modal.html',
  styleUrls: ['./backfill-pfcrm-retratos-modal.css'],
})
export class BackfillPfcrmRetratosModalComponent {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly authService = inject(AuthService);
  private readonly errorModalService = inject(ErrorModalService);

  readonly unidades = Object.values(Unidade);

  visible = false;
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  fase: Fase = 'idle';
  statusMsg = '';
  error = '';
  preview: BackfillPfcrmRetratosResponse | null = null;
  result: BackfillPfcrmRetratosResponse | null = null;

  @Output() concluido = new EventEmitter<BackfillPfcrmRetratosResponse>();

  get loading(): boolean {
    return this.fase === 'preview' || this.fase === 'aplicando';
  }

  abrir(): void {
    this.error = '';
    this.preview = null;
    this.result = null;
    this.fase = 'idle';
    this.statusMsg = '';
    const u = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!u;
    this.unidade = u ?? '';
    this.visible = true;
  }

  fechar(): void {
    if (this.loading) return;
    this.visible = false;
  }

  /** Evita exibir prévia de outro escopo após trocar a unidade. */
  onUnidadeChange(): void {
    this.preview = null;
    this.result = null;
    this.statusMsg = '';
    this.error = '';
    this.fase = 'idle';
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const currentUser = this.authService.getCurrentUser();
    const u = currentUser?.unidade?.trim();
    if (!u) return null;
    return Object.values(Unidade).includes(u as Unidade) ? (u as Unidade) : null;
  }

  executarPrevia(): void {
    this.executar(false);
  }

  executarAplicar(): void {
    const escopo = this.unidade || 'TODAS as unidades';
    if (
      !confirm(
        `Preencher PFCRM nos retratos fechados (${escopo})?\n\nSó grava a profissão (referência). Não recalcula valores.`,
      )
    ) {
      return;
    }
    this.executar(true);
  }

  private executar(aplicar: boolean): void {
    this.error = '';
    this.fase = aplicar ? 'aplicando' : 'preview';
    this.statusMsg = aplicar
      ? 'Aplicando PFCRM nos retratos… isso pode levar alguns segundos.'
      : 'Contando pendências nos retratos fechados…';
    if (aplicar) {
      this.result = null;
    } else {
      this.preview = null;
      this.result = null;
    }

    const body: { aplicar: boolean; unidade?: string } = { aplicar };
    if (this.unidade) body.unidade = this.unidade;

    this.sincronizacaoService.backfillPfcrmRetratos(body).subscribe({
      next: (res) => {
        this.fase = 'idle';
        if (aplicar) {
          this.result = res;
          this.preview = null;
          this.statusMsg = 'Concluído — pode trocar a unidade e rodar de novo.';
          this.concluido.emit(res);
        } else {
          this.preview = res;
          this.statusMsg = 'Prévia pronta — revise o resumo e clique em Aplicar.';
        }
      },
      error: (err) => {
        this.fase = 'idle';
        this.statusMsg = '';
        const msg = extrairMensagemErroApi(err);
        this.error = msg;
        this.errorModalService.show(msg);
      },
    });
  }

  get resumoAtivo(): BackfillPfcrmRetratosResponse | null {
    return this.result ?? this.preview;
  }

  /** Ex.: "medico UBERABA 4566/MG — ambíguo" */
  get falhasTabela(): BackfillFalhaLinha[] {
    const amostra = this.resumoAtivo?.amostraFalhas ?? [];
    return amostra.map((raw) => this.parseFalha(raw));
  }

  private parseFalha(raw: string): BackfillFalhaLinha {
    const m = raw
      .trim()
      .match(
        /^(medico|carteira)\s+(\S+)\s+(\d+)\s*\/\s*([A-Za-z]{2})\s*[—\-–]\s*(.+)$/i,
      );
    if (!m) {
      return {
        tipo: '—',
        unidade: '—',
        crm: '—',
        uf: '—',
        motivo: raw,
        raw,
      };
    }
    return {
      tipo: m[1].toLowerCase() === 'medico' ? 'Médico' : 'Carteira',
      unidade: m[2],
      crm: m[3],
      uf: m[4].toUpperCase(),
      motivo: m[5].trim(),
      raw,
    };
  }
}
