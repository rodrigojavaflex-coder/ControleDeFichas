import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { AtualizarDataNascimentoPrescritoresResponse } from '../../models/sincronizacao.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-atualizar-data-nascimento-prescritores-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './atualizar-data-nascimento-prescritores-modal.html',
  styleUrls: ['./atualizar-data-nascimento-prescritores-modal.css'],
})
export class AtualizarDataNascimentoPrescritoresModalComponent {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);

  readonly limiteLista = 100;
  unidades = Object.values(Unidade);

  visible = false;
  loading = false;
  error = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  result: AtualizarDataNascimentoPrescritoresResponse | null = null;

  @Output() atualizacaoConcluida = new EventEmitter<void>();

  abrir(): void {
    this.error = '';
    this.result = null;
    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? '';
    this.visible = true;
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const u = this.authService.getCurrentUser()?.unidade?.trim();
    if (!u) return null;
    return Object.values(Unidade).includes(u as Unidade) ? (u as Unidade) : null;
  }

  fechar(): void {
    if (this.loading) return;
    this.visible = false;
  }

  prever(): void {
    this.executar(false);
  }

  aplicar(): void {
    this.executar(true);
  }

  formatarData(valor: string | null | undefined): string {
    if (!valor) return '—';
    const match = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return valor;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  private executar(aplicar: boolean): void {
    this.loading = true;
    this.error = '';
    this.sincronizacaoService
      .atualizarDataNascimentoPrescritores({
        aplicar,
        unidade: this.unidade || undefined,
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
          if (res.erros?.length) {
            this.error = res.erros.join(' ');
          }
          if (aplicar && res.atualizados > 0) {
            this.atualizacaoConcluida.emit();
          }
        },
        error: (err) => {
          this.loading = false;
          const msg = extrairMensagemErroApi(err);
          this.error = msg;
          this.errorModalService.show(msg, 'Erro');
        },
      });
  }
}
