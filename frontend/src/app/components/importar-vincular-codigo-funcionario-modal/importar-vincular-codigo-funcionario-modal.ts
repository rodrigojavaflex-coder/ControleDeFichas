import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoConfigService } from '../../services/producao-config.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  VinculoCodigoFuncionarioPreviewResponse,
  VinculoCodigoFuncionarioPreviewRow,
  VinculoCodigoFuncionarioSituacao,
} from '../../models/producao-config.model';

@Component({
  selector: 'app-importar-vincular-codigo-funcionario-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './importar-vincular-codigo-funcionario-modal.html',
  styleUrls: ['./importar-vincular-codigo-funcionario-modal.css'],
})
export class ImportarVincularCodigoFuncionarioModalComponent {
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private producaoConfig = inject(ProducaoConfigService);

  @Output() importacaoConcluida = new EventEmitter<number>();

  unidades = Object.values(Unidade);

  visible = false;
  error = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  carregandoPreview = false;
  confirmando = false;
  preview: VinculoCodigoFuncionarioPreviewResponse | null = null;
  filtroSituacao: 'atualizaveis' | 'todos' = 'atualizaveis';
  ultimosAtualizados: number | null = null;
  selecionados = new Set<string>();

  abrir(): void {
    this.reset();
    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? '';
    this.visible = true;
  }

  fechar(): void {
    if (this.busy) return;
    this.visible = false;
  }

  get busy(): boolean {
    return this.carregandoPreview || this.confirmando;
  }

  podePreview(): boolean {
    return (
      this.auth.hasPermission(Permission.PRODUCAO_CONFIG_READ) ||
      this.auth.hasPermission(Permission.CONFIGURACAO_ACCESS)
    );
  }

  podeConfirmar(): boolean {
    return (
      this.auth.hasPermission(Permission.PRODUCAO_CONFIG_UPDATE) ||
      this.auth.hasPermission(Permission.CONFIGURACAO_ACCESS)
    );
  }

  podeAnalisar(): boolean {
    return this.podePreview() && !!this.unidade && !this.busy;
  }

  podeConfirmarAtualizacao(): boolean {
    return (
      this.podeConfirmar() &&
      !!this.preview &&
      this.qtdSelecionados() > 0 &&
      !this.busy
    );
  }

  itensVisiveis(): VinculoCodigoFuncionarioPreviewRow[] {
    if (!this.preview) return [];
    if (this.filtroSituacao === 'todos') return this.preview.itens;
    return this.preview.itens.filter((i) => i.atualizavel);
  }

  itensAtualizaveisVisiveis(): VinculoCodigoFuncionarioPreviewRow[] {
    return this.itensVisiveis().filter((i) => i.atualizavel);
  }

  qtdSelecionados(): number {
    return this.selecionados.size;
  }

  estaSelecionado(funcionarioId: string): boolean {
    return this.selecionados.has(funcionarioId);
  }

  alternarSelecao(row: VinculoCodigoFuncionarioPreviewRow): void {
    if (!row.atualizavel || this.busy) return;
    if (this.selecionados.has(row.funcionarioId)) {
      this.selecionados.delete(row.funcionarioId);
    } else {
      this.selecionados.add(row.funcionarioId);
    }
    this.selecionados = new Set(this.selecionados);
  }

  todosAtualizaveisVisiveisSelecionados(): boolean {
    const elegiveis = this.itensAtualizaveisVisiveis();
    return (
      elegiveis.length > 0 &&
      elegiveis.every((i) => this.selecionados.has(i.funcionarioId))
    );
  }

  algunsAtualizaveisVisiveisSelecionados(): boolean {
    const elegiveis = this.itensAtualizaveisVisiveis();
    if (elegiveis.length === 0) return false;
    const qtd = elegiveis.filter((i) =>
      this.selecionados.has(i.funcionarioId),
    ).length;
    return qtd > 0 && qtd < elegiveis.length;
  }

  alternarMarcarTodosVisiveis(): void {
    if (this.busy) return;
    const elegiveis = this.itensAtualizaveisVisiveis();
    if (elegiveis.length === 0) return;

    if (this.todosAtualizaveisVisiveisSelecionados()) {
      for (const row of elegiveis) {
        this.selecionados.delete(row.funcionarioId);
      }
    } else {
      for (const row of elegiveis) {
        this.selecionados.add(row.funcionarioId);
      }
    }
    this.selecionados = new Set(this.selecionados);
  }

  rotuloSituacao(s: VinculoCodigoFuncionarioSituacao): string {
    const map: Record<VinculoCodigoFuncionarioSituacao, string> = {
      PREENCHER: 'Será preenchido',
      OK_JA_CORRETO: 'Já correto',
      CONFLITO_CODIGO_DIFERENTE: 'Conflito de código',
      MULTIPLOS_FUNCIONARIOS_MESMO_NOME: 'Homônimos no cadastro',
      MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO: 'Múltiplos cód. ERP',
      MULTIPLOS_NOMES_MESMO_COD_ERP: 'Múltiplos nomes no ERP',
    };
    return map[s] ?? s;
  }

  classeSituacao(s: VinculoCodigoFuncionarioSituacao): string {
    switch (s) {
      case 'PREENCHER':
        return 'situacao-preencher';
      case 'OK_JA_CORRETO':
        return 'situacao-ok';
      case 'CONFLITO_CODIGO_DIFERENTE':
        return 'situacao-conflito';
      default:
        return 'situacao-ambiguo';
    }
  }

  onUnidadeChange(): void {
    this.preview = null;
    this.ultimosAtualizados = null;
    this.error = '';
  }

  carregarPreview(): void {
    if (!this.podeAnalisar()) {
      if (!this.unidade) {
        this.error = 'Selecione a unidade.';
      }
      return;
    }

    this.carregandoPreview = true;
    this.error = '';
    this.preview = null;
    this.ultimosAtualizados = null;

    this.producaoConfig
      .previewVincularCodigoFuncionario(this.unidade as Unidade)
      .subscribe({
      next: (resp) => {
        this.preview = resp;
        this.selecionados = new Set(
          resp.itens.filter((i) => i.atualizavel).map((i) => i.funcionarioId),
        );
        this.carregandoPreview = false;
      },
      error: (e) => {
        this.carregandoPreview = false;
        const msg =
          e?.error?.message ??
          'Erro ao carregar prévia de vínculo de código ERP.';
        this.error = msg;
        this.errors.show(msg, 'Vincular código funcionário');
      },
    });
  }

  confirmar(): void {
    if (!this.podeConfirmarAtualizacao()) return;

    this.confirmando = true;
    this.error = '';

    this.producaoConfig
      .confirmarVincularCodigoFuncionario({
        unidade: this.unidade as Unidade,
        funcionarioIds: [...this.selecionados],
      })
      .subscribe({
      next: (resp) => {
        this.confirmando = false;
        this.ultimosAtualizados = resp.atualizados;
        this.importacaoConcluida.emit(resp.atualizados);
        this.carregarPreview();
      },
      error: (e) => {
        this.confirmando = false;
        const msg =
          e?.error?.message ?? 'Erro ao confirmar vínculo de código ERP.';
        this.error = msg;
        this.errors.show(msg, 'Vincular código funcionário');
      },
    });
  }

  private reset(): void {
    this.error = '';
    this.preview = null;
    this.ultimosAtualizados = null;
    this.filtroSituacao = 'atualizaveis';
    this.carregandoPreview = false;
    this.confirmando = false;
    this.selecionados = new Set();
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const u = this.auth.getCurrentUser()?.unidade?.trim();
    return u ? (u as Unidade) : null;
  }
}
