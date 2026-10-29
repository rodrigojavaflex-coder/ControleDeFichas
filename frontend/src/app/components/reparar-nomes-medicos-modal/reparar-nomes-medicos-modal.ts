import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import {
  RepararNomesMedicosResponse,
  ReparoNomeMedicoItem,
} from '../../models/sincronizacao.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-reparar-nomes-medicos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reparar-nomes-medicos-modal.html',
  styleUrls: ['./reparar-nomes-medicos-modal.css'],
})
export class RepararNomesMedicosModalComponent {
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
  filtroTabela = '';
  result: RepararNomesMedicosResponse | null = null;
  /** chave tabela|id */
  selecionados = new Set<string>();
  pagina = 1;

  @Output() reparoConcluido = new EventEmitter<void>();

  abrir(): void {
    this.error = '';
    this.result = null;
    this.selecionados = new Set();
    this.pagina = 1;
    this.filtroMotivo = '';
    this.filtroTabela = '';

    const unidadeUsuario = this.obterUnidadeUsuarioLogado();
    this.unidadeBloqueada = !!unidadeUsuario;
    this.unidade = unidadeUsuario ?? '';

    this.visible = true;
  }

  fechar(): void {
    if (this.loading) return;
    this.visible = false;
  }

  get motivosDisponiveis(): string[] {
    const set = new Set<string>();
    for (const item of this.baseParaFiltros) {
      if (item.motivo?.trim()) set.add(item.motivo.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  get tabelasDisponiveis(): string[] {
    const set = new Set<string>();
    for (const item of this.baseParaFiltrosTabela) {
      if (item.tabela?.trim()) set.add(item.tabela.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  /** Motivos respeitam filtro de tabela (e vice-versa na lista final). */
  private get baseParaFiltros(): ReparoNomeMedicoItem[] {
    const lista = this.result?.paraCorrigir ?? [];
    if (!this.filtroTabela) return lista;
    return lista.filter((i) => i.tabela === this.filtroTabela);
  }

  private get baseParaFiltrosTabela(): ReparoNomeMedicoItem[] {
    const lista = this.result?.paraCorrigir ?? [];
    if (!this.filtroMotivo) return lista;
    return lista.filter((i) => i.motivo === this.filtroMotivo);
  }

  get listaFiltrada(): ReparoNomeMedicoItem[] {
    let lista = this.result?.paraCorrigir ?? [];
    if (this.filtroTabela) {
      lista = lista.filter((i) => i.tabela === this.filtroTabela);
    }
    if (this.filtroMotivo) {
      lista = lista.filter((i) => i.motivo === this.filtroMotivo);
    }
    return lista;
  }

  get temFiltroAtivo(): boolean {
    return !!this.filtroMotivo || !!this.filtroTabela;
  }

  get totalPaginas(): number {
    const n = this.listaFiltrada.length;
    return Math.max(1, Math.ceil(n / this.pageSize));
  }

  get paginaItens(): ReparoNomeMedicoItem[] {
    const lista = this.listaFiltrada;
    const inicio = (this.pagina - 1) * this.pageSize;
    return lista.slice(inicio, inicio + this.pageSize);
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

  chave(item: ReparoNomeMedicoItem): string {
    return `${item.tabela}|${item.id}`;
  }

  estaSelecionado(item: ReparoNomeMedicoItem): boolean {
    return this.selecionados.has(this.chave(item));
  }

  toggleItem(item: ReparoNomeMedicoItem, checked: boolean): void {
    const k = this.chave(item);
    if (checked) this.selecionados.add(k);
    else this.selecionados.delete(k);
  }

  onClickLinha(item: ReparoNomeMedicoItem): void {
    if (this.result?.aplicar) return;
    this.toggleItem(item, !this.estaSelecionado(item));
  }

  onCheckItem(item: ReparoNomeMedicoItem, event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    this.toggleItem(item, input.checked);
  }

  togglePagina(checked: boolean): void {
    for (const item of this.paginaItens) {
      this.toggleItem(item, checked);
    }
  }

  onCheckPagina(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    this.togglePagina(input.checked);
  }

  selecionarTodos(): void {
    for (const item of this.result?.paraCorrigir ?? []) {
      this.selecionados.add(this.chave(item));
    }
  }

  selecionarFiltrados(): void {
    for (const item of this.listaFiltrada) {
      this.selecionados.add(this.chave(item));
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

  executarDryRun(): void {
    this.executar(false);
  }

  executarApply(): void {
    if (!this.result || this.result.aCorrigir === 0) {
      this.error = 'Execute o dry-run antes e confirme que há itens a corrigir.';
      return;
    }
    if (this.selecionados.size === 0) {
      this.error = 'Marque ao menos um item para aplicar a correção.';
      return;
    }
    if (
      !confirm(
        `Aplicar correção em ${this.selecionados.size} registro(s) selecionado(s)?\n\nSobrescreve nomes no NEST pelo ERP (CRM+UF).`,
      )
    ) {
      return;
    }
    this.executar(true);
  }

  baixarRelatorioPendentes(): void {
    const rows = this.result?.pendentesRelatorio ?? [];
    if (!rows.length) {
      this.error = 'Não há pendentes para exportar neste dry-run.';
      return;
    }
    this.baixarCsv(
      rows,
      `pendentes-nomes-medicos-${this.sufixoArquivo()}.csv`,
    );
  }

  baixarRelatorioCorrigir(): void {
    const rows = this.temFiltroAtivo
      ? this.listaFiltrada
      : (this.result?.paraCorrigir ?? []);
    if (!rows.length) {
      this.error = 'Não há itens a corrigir para exportar.';
      return;
    }
    this.baixarCsv(
      rows,
      `a-corrigir-nomes-medicos-${this.sufixoArquivo()}.csv`,
    );
  }

  private baixarCsv(rows: ReparoNomeMedicoItem[], filename: string): void {
    const header = [
      'acao',
      'tabela',
      'unidade',
      'crm',
      'uf',
      'nome_nest',
      'nome_erp',
      'origem_erp',
      'motivo',
      'id',
    ];
    const lines = [header.join(';')];
    for (const r of rows) {
      lines.push(
        [
          r.acao,
          r.tabela,
          r.unidade ?? '',
          r.crm,
          r.uf,
          this.csvCell(r.nomeAtual),
          this.csvCell(r.nomeErp ?? ''),
          r.origemErp ?? '',
          this.csvCell(r.motivo),
          r.id,
        ].join(';'),
      );
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string): string {
    const v = value.replace(/"/g, '""');
    return `"${v}"`;
  }

  private sufixoArquivo(): string {
    const u = this.result?.unidadeFiltro || this.unidade || 'todas';
    const d = new Date().toISOString().slice(0, 10);
    return `${u}-${d}`;
  }

  private executar(aplicar: boolean): void {
    this.loading = true;
    this.error = '';

    const body: {
      aplicar: boolean;
      unidade?: string;
      itensSelecionados?: Array<{ tabela: string; id: string }>;
    } = {
      aplicar,
    };

    if (this.unidade) {
      body.unidade = this.unidade;
    }

    if (aplicar) {
      body.itensSelecionados = [...this.selecionados].map((k) => {
        const sep = k.indexOf('|');
        return {
          tabela: k.slice(0, sep),
          id: k.slice(sep + 1),
        };
      });
    } else {
      this.result = null;
      this.selecionados = new Set();
      this.pagina = 1;
      this.filtroMotivo = '';
      this.filtroTabela = '';
    }

    this.sincronizacaoService.repararNomesMedicos(body).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
        if (!aplicar) {
          this.selecionarTodos();
          this.pagina = 1;
          this.filtroMotivo = '';
          this.filtroTabela = '';
        }
        if (aplicar && res.corrigidos > 0) {
          this.reparoConcluido.emit();
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = extrairMensagemErroApi(
          err,
          'Erro ao reparar nomes de médicos.',
        );
        this.errorModalService.show(this.error, 'Erro');
      },
    });
  }

  private obterUnidadeUsuarioLogado(): Unidade | null {
    const currentUser = this.authService.getCurrentUser();
    const unidade = currentUser?.unidade?.trim();
    if (!unidade) return null;
    return Object.values(Unidade).includes(unidade as Unidade)
      ? (unidade as Unidade)
      : null;
  }
}
