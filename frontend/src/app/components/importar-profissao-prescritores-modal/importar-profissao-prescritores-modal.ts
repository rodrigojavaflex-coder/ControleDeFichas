import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import {
  ImportarProfissaoPrescritoresResponse,
  ImportProfissaoItem,
} from '../../models/sincronizacao.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-importar-profissao-prescritores-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './importar-profissao-prescritores-modal.html',
  styleUrls: ['./importar-profissao-prescritores-modal.css'],
})
export class ImportarProfissaoPrescritoresModalComponent {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly authService = inject(AuthService);

  readonly pageSize = 100;
  unidades = Object.values(Unidade);

  visible = false;
  loading = false;
  error = '';
  unidade: Unidade | '' = '';
  unidadeBloqueada = false;
  filtroMotivo = '';
  result: ImportarProfissaoPrescritoresResponse | null = null;
  selecionados = new Set<string>();
  pagina = 1;

  @Output() importacaoConcluida = new EventEmitter<void>();

  abrir(): void {
    this.error = '';
    this.result = null;
    this.selecionados = new Set();
    this.pagina = 1;
    this.filtroMotivo = '';
    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? '';
    this.visible = true;
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const currentUser = this.authService.getCurrentUser();
    const u = currentUser?.unidade?.trim();
    if (!u) return null;
    return Object.values(Unidade).includes(u as Unidade) ? (u as Unidade) : null;
  }

  fechar(): void {
    if (this.loading) return;
    this.visible = false;
  }

  chave(item: ImportProfissaoItem): string {
    return `${item.acao}|${item.crm}|${item.uf}|${item.pfcrm}|${item.id ?? ''}`;
  }

  get motivosDisponiveis(): string[] {
    const set = new Set<string>();
    for (const item of this.result?.paraAplicar ?? []) {
      if (item.motivo?.trim()) set.add(item.motivo.trim());
    }
    // Prefixo "N)" define a ordem correta de execução
    return [...set].sort((a, b) => {
      const na = Number(/^(\d+)\)/.exec(a)?.[1] ?? 99);
      const nb = Number(/^(\d+)\)/.exec(b)?.[1] ?? 99);
      if (na !== nb) return na - nb;
      return a.localeCompare(b, 'pt-BR');
    });
  }

  get listaFiltrada(): ImportProfissaoItem[] {
    const lista = this.result?.paraAplicar ?? [];
    if (!this.filtroMotivo) return lista;
    return lista.filter((i) => i.motivo === this.filtroMotivo);
  }

  get temFiltroAtivo(): boolean {
    return !!this.filtroMotivo;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.listaFiltrada.length / this.pageSize));
  }

  get paginaItens(): ImportProfissaoItem[] {
    const i = (this.pagina - 1) * this.pageSize;
    return this.listaFiltrada.slice(i, i + this.pageSize);
  }

  get qtdSelecionados(): number {
    return this.selecionados.size;
  }

  get qtdFiltrados(): number {
    return this.listaFiltrada.length;
  }

  get paginaTodaSelecionada(): boolean {
    const itens = this.paginaItens;
    return (
      itens.length > 0 && itens.every((i) => this.selecionados.has(this.chave(i)))
    );
  }

  onFiltroChange(): void {
    this.pagina = 1;
  }

  toggleItem(item: ImportProfissaoItem, checked: boolean): void {
    const k = this.chave(item);
    if (checked) this.selecionados.add(k);
    else this.selecionados.delete(k);
  }

  estaSelecionado(item: ImportProfissaoItem): boolean {
    return this.selecionados.has(this.chave(item));
  }

  onClickLinha(item: ImportProfissaoItem): void {
    if (this.result?.aplicar) return;
    this.toggleItem(item, !this.estaSelecionado(item));
  }

  onCheckItem(item: ImportProfissaoItem, event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    this.toggleItem(item, input.checked);
  }

  onCheckPagina(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    for (const item of this.paginaItens) {
      this.toggleItem(item, input.checked);
    }
  }

  selecionarTodos(): void {
    for (const i of this.result?.paraAplicar ?? []) {
      this.selecionados.add(this.chave(i));
    }
  }

  selecionarFiltrados(): void {
    for (const i of this.listaFiltrada) {
      this.selecionados.add(this.chave(i));
    }
  }

  limparSelecao(): void {
    this.selecionados.clear();
  }

  paginaAnterior(): void {
    if (this.pagina > 1) this.pagina -= 1;
  }

  paginaProxima(): void {
    if (this.pagina < this.totalPaginas) this.pagina += 1;
  }

  dryRun(): void {
    this.executar(false);
  }

  aplicar(): void {
    if (!this.result?.aAplicar) {
      this.error = 'Execute o dry-run antes.';
      return;
    }
    if (!this.selecionados.size) {
      this.error = 'Marque ao menos um item.';
      return;
    }
    if (
      !confirm(
        `Aplicar PFCRM em ${this.selecionados.size} registro(s) selecionado(s)?`,
      )
    ) {
      return;
    }
    this.executar(true);
  }

  private executar(aplicar: boolean): void {
    this.loading = true;
    this.error = '';
    const body: {
      aplicar: boolean;
      unidade?: string;
      itensSelecionados?: Array<{
        acao: string;
        id?: string;
        crm: string;
        uf: string;
        pfcrm: string;
      }>;
    } = { aplicar };
    if (this.unidade) body.unidade = this.unidade;
    if (aplicar) {
      body.itensSelecionados = [...this.selecionados].map((k) => {
        const [acao, crm, uf, pfcrm, id] = k.split('|');
        return {
          acao,
          crm,
          uf,
          pfcrm,
          ...(id ? { id } : {}),
        };
      });
    }
    this.sincronizacaoService.importarProfissaoPrescritores(body).subscribe({
      next: (res) => {
        this.loading = false;
        this.result = res;
        this.pagina = 1;
        this.filtroMotivo = '';
        if (!aplicar) {
          this.selecionados = new Set(
            (res.paraAplicar ?? []).map((i) => this.chave(i)),
          );
        } else {
          this.selecionados = new Set();
          this.importacaoConcluida.emit();
          if (res.aplicados > 0 && !res.erros?.length) {
            this.error = '';
          }
        }
        if (res.erros?.length) {
          this.error = res.erros.slice(0, 5).join(' · ');
        } else if (!aplicar && res.totalAnalisado === 0) {
          this.error =
            'Dry-run sem dados do ERP. Verifique sync ativa e agent da unidade.';
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = extrairMensagemErroApi(err);
        this.error = msg;
        this.errorModalService.show(msg);
      },
    });
  }
}
