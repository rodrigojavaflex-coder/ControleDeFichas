import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FolhaService } from '../../services/folha.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { environment } from '../../../environments/environment';
import {
  FuncionarioFolha,
  FuncionarioPaginated,
  FolhaFuncionarioEventoFixo,
  FolhaMovimentoTipo,
} from '../../models/folha.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { Configuracao } from '../../models/configuracao.model';

@Component({
  selector: 'app-folha-funcionarios-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './folha-funcionarios-page.html',
  styleUrls: ['./folha-pages.shared.css'],
})
export class FolhaFuncionariosPage implements OnInit {
  private folha = inject(FolhaService);
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private configuracaoService = inject(ConfiguracaoService);

  configuracao: Configuracao | null = null;

  Permission = Permission;
  Unidade = Unidade;

  unidadesDisponiveis: Unidade[] = Object.values(Unidade);
  /** Vazio = todas as unidades (escopo RN-007) quando o filtro não está bloqueado. */
  unidadeFiltro: Unidade | '' = '';
  unidadeFiltroDisabled = false;
  nomeFiltro = '';
  mostrarEventosFixosImpressao = false;
  dados: FuncionarioPaginated | null = null;
  pagina = 1;
  pageSize = 10;
  carregando = false;
  imprimindo = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Lista de funcionários',
      description:
        'Funcionários cadastrados por unidade. Com acesso a várias unidades, deixe o filtro em «Todas» para ver todos.',
    });
    this.initializeUnidadeFiltro();
    this.aplicarUnidadeDaQueryString();
    this.carregarConfiguracao();
    this.carregarLista();
  }

  private carregarConfiguracao(): void {
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => (this.configuracao = config),
      error: () => (this.configuracao = null),
    });
  }

  private initializeUnidadeFiltro(): void {
    const u = this.auth.getCurrentUser();
    if (u?.unidade && String(u.unidade).trim() !== '') {
      this.unidadeFiltro = u.unidade as Unidade;
      this.unidadeFiltroDisabled = true;
    } else {
      this.unidadeFiltro = '';
      this.unidadeFiltroDisabled = false;
    }
  }

  private aplicarUnidadeDaQueryString(): void {
    if (this.unidadeFiltroDisabled) return;
    const q = this.route.snapshot.queryParamMap.get('unidade')?.trim();
    if (q && this.unidadesDisponiveis.includes(q as Unidade)) {
      this.unidadeFiltro = q as Unidade;
    }
  }

  private sincronizarQueryFiltroUnidade(): void {
    if (this.unidadeFiltroDisabled) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { unidade: this.unidadeFiltro || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private queryParamsRetornoLista(): { unidade?: string } {
    if (this.unidadeFiltroDisabled || !this.unidadeFiltro) return {};
    return { unidade: this.unidadeFiltro };
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_READ);
  }

  podeCriar(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_CREATE);
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_UPDATE);
  }

  podeExcluir(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_DELETE);
  }

  mostrarColunaAcoes(): boolean {
    return this.podeEditar() || this.podeExcluir();
  }

  irNovo(): void {
    void this.router.navigate(['/folha/funcionarios/new'], {
      queryParams: this.queryParamsRetornoLista(),
    });
  }

  irEditar(f: FuncionarioFolha): void {
    void this.router.navigate(['/folha/funcionarios/edit', f.id], {
      queryParams: this.queryParamsRetornoLista(),
    });
  }

  excluir(f: FuncionarioFolha): void {
    if (!this.podeExcluir()) return;
    if (
      !confirm(
        `Excluir o funcionário "${f.nome}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    this.folha.excluirFuncionario(f.id).subscribe({
      next: () => this.carregarLista(),
      error: (e: { error?: { message?: string } }) =>
        this.errors.show(
          e?.error?.message ?? 'Não foi possível excluir o funcionário.',
          'Folha',
        ),
    });
  }

  limparFiltros(): void {
    this.nomeFiltro = '';
    this.pagina = 1;
    if (!this.unidadeFiltroDisabled) {
      this.unidadeFiltro = '';
    }
    this.sincronizarQueryFiltroUnidade();
    this.carregarLista();
  }

  onMudarUnidadeFiltro(): void {
    this.pagina = 1;
    this.sincronizarQueryFiltroUnidade();
    this.carregarLista();
  }

  carregarLista(): void {
    if (!this.podeLer()) return;
    this.carregando = true;
    const unidade = this.unidadeFiltro ? (this.unidadeFiltro as Unidade) : undefined;
    this.folha
      .listarFuncionarios(
        unidade,
        this.pagina,
        this.pageSize,
        this.nomeFiltro || undefined,
      )
      .subscribe({
        next: (r) => {
          this.dados = r;
          this.carregando = false;
        },
        error: () => {
          this.carregando = false;
          this.errors.show('Erro ao carregar funcionários.', 'Folha');
        },
      });
  }

  imprimirLista(): void {
    if (!this.podeLer() || this.imprimindo) return;
    this.imprimindo = true;
    const unidade = this.unidadeFiltro ? (this.unidadeFiltro as Unidade) : undefined;
    this.folha
      .listarFuncionariosTodos(
        unidade,
        this.nomeFiltro || undefined,
        this.mostrarEventosFixosImpressao,
      )
      .subscribe({
        next: (rows) => {
          this.imprimindo = false;
          if (rows.length === 0) {
            this.errors.show('Nenhum funcionário para imprimir com os filtros atuais.', 'Folha');
            return;
          }
          this.abrirJanelaImpressao(rows);
        },
        error: () => {
          this.imprimindo = false;
          this.errors.show('Erro ao preparar impressão da lista.', 'Folha');
        },
      });
  }

  formatarDataDdMmYyyy(raw?: string | null): string {
    if (raw == null || `${raw}` === '') return '—';
    const s = `${raw}`;
    const ymd = s.includes('T') ? s.split('T')[0] : s.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return '—';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  formatarTelefone(raw?: string | null): string {
    const t = raw?.trim();
    return t || '—';
  }

  formatarChavePix(f: FuncionarioFolha): string {
    const chave = f.chavePix?.trim();
    if (!chave) return '—';
    if (f.tipoPix) return `${f.tipoPix}: ${chave}`;
    return chave;
  }

  private abrirJanelaImpressao(funcionarios: FuncionarioFolha[]): void {
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups para imprimir a lista.', 'Impressão');
      return;
    }
    win.document.write(this.montarHtmlImpressao(funcionarios));
    win.document.close();
    win.document.title = `Relatório de Funcionários ${this.getReportTimestamp()}`;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 200);
  }

  private montarHtmlImpressao(funcionarios: FuncionarioFolha[]): string {
    const reportTitle = 'Relatório de Funcionários';
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `${reportTitle} ${reportTimestamp}`;

    const currentUser = this.auth.getCurrentUser();
    const usuarioLabel = currentUser?.nome || currentUser?.email || 'Usuário não identificado';
    const dataGeracao = new Date();
    const dataFormatada = dataGeracao.toLocaleDateString('pt-BR');
    const horaFormatada = dataGeracao.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const geradoEmTexto = `Gerado em ${dataFormatada}, ${horaFormatada} por ${usuarioLabel}`;

    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo do sistema" />`
      : '';

    const subtituloFiltros = this.subtituloFiltrosImpressao();
    const agrupado = this.agruparPorUnidade(funcionarios);
    const blocosUnidade = agrupado
      .map(([unidade, lista]) => this.blocoUnidadeImpressao(unidade, lista))
      .join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(reportDocumentTitle)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1a202c; font-size: 12px; background: #fff; margin-bottom: 80px; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
    .report-subtitle { margin-top: 6px; font-size: 11px; color: #475569; font-weight: 500; }
    .print-actions { text-align: right; margin-bottom: 12px; }
    .print-actions button { background: #2b6cb0; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .logo-area, .header-spacer { flex: 0 0 220px; display: flex; align-items: center; justify-content: flex-start; }
    .header-spacer { visibility: hidden; }
    .logo-area img { max-height: 60px; width: auto; display: block; }
    .title-area { flex: 1 1 auto; text-align: center; }
    .unit-section { margin-top: 24px; page-break-inside: avoid; }
    .unit-section:first-of-type { margin-top: 0; }
    .unit-title { font-weight: 600; text-transform: uppercase; font-size: 12px; margin-bottom: 6px; color: #1e293b; }
    .funcionario-block { margin-top: 16px; page-break-inside: avoid; }
    .funcionario-block:first-of-type { margin-top: 0; }
    .funcionario-nome { font-size: 15px; font-weight: 700; margin: 14px 0 6px; color: #1e293b; line-height: 1.3; }
    .dados-livres { margin-top: 2px; margin-left: 12px; }
    .dados-livres table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .dados-livres th, .dados-livres td { border: none; padding: 3px 10px 3px 0; text-align: left; vertical-align: top; background: transparent; }
    .dados-livres th { font-weight: 700; color: #1e293b; white-space: nowrap; }
    .dados-livres tbody td { color: #1e293b; }
    .eventos-livres { margin-top: 6px; margin-left: 24px; }
    .unit-total { margin-top: 12px; font-size: 11px; font-weight: 700; color: #334155; }
    .tipo-receita { color: #0f766e; font-weight: 600; }
    .tipo-despesa { color: #b91c1c; font-weight: 600; }
    footer { position: fixed; bottom: 12px; left: 20px; right: 20px; text-align: right; font-size: 10px; color: #4a5568; }
    @media print { .print-actions { display: none; } body { margin: 0 20px 80px; } }
  </style>
</head>
<body>
  <div class="print-actions">
    <button type="button" onclick="window.print()">Imprimir PDF</button>
  </div>
  <header class="report-header">
    <div class="logo-area">${logoHtml}</div>
    <div class="title-area">
      <h1>${this.escapeHtml(reportTitle)}</h1>
      ${subtituloFiltros}
    </div>
    <div class="header-spacer">&nbsp;</div>
  </header>
  ${blocosUnidade}
  <footer>${this.escapeHtml(geradoEmTexto)}</footer>
</body>
</html>`;
  }

  private subtituloFiltrosImpressao(): string {
    const partes: string[] = [];
    partes.push(
      this.unidadeFiltro
        ? `Unidade: ${this.unidadeFiltro}`
        : 'Unidades: Todas do escopo',
    );
    if (this.nomeFiltro.trim()) {
      partes.push(`Nome contém: «${this.nomeFiltro.trim()}»`);
    }
    if (this.mostrarEventosFixosImpressao) {
      partes.push('Com eventos fixos');
    }
    return `<div class="report-subtitle">${this.escapeHtml(partes.join(' · '))}</div>`;
  }

  private blocoUnidadeImpressao(unidade: Unidade, lista: FuncionarioFolha[]): string {
    const blocosFunc = lista.map((f) => this.blocoFuncionarioImpressao(f)).join('\n');
    const totalLabel =
      lista.length === 1 ? '1 funcionário' : `${lista.length} funcionários`;
    return `<section class="unit-section">
  <div class="unit-title">Unidade: ${this.escapeHtml(unidade)}</div>
  ${blocosFunc}
  <div class="unit-total">Total: ${this.escapeHtml(totalLabel)}</div>
</section>`;
  }

  private blocoFuncionarioImpressao(f: FuncionarioFolha): string {
    const dadosFuncionario = `<div class="dados-livres">
    <table>
      <thead>
        <tr>
          <th>Telefone</th>
          <th>Admissão</th>
          <th>Cargo</th>
          <th>Setor</th>
          <th>Chave Pix</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${this.escapeHtml(this.formatarTelefone(f.telefone))}</td>
          <td>${this.escapeHtml(this.formatarDataDdMmYyyy(f.dataAdmissao ?? null))}</td>
          <td>${this.escapeHtml(f.cargo?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(f.setor?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(this.formatarChavePix(f))}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

    const eventos =
      this.mostrarEventosFixosImpressao && (f.eventosFixos?.length ?? 0) > 0
        ? this.tabelaEventosFixosImpressao(f.eventosFixos ?? [])
        : '';

    return `<div class="funcionario-block">
  <div class="funcionario-nome">${this.escapeHtml(f.nome)}</div>
  ${dadosFuncionario}
  ${eventos}
</div>`;
  }

  private tabelaEventosFixosImpressao(eventos: FolhaFuncionarioEventoFixo[]): string {
    const linhas = eventos
      .map((ev) => {
        const desc = ev.folhaVerba?.descricao?.trim() || 'Evento';
        const tipo = this.labelTipoMovimento(ev.folhaVerba?.tipoMovimento);
        const tipoClasse =
          ev.folhaVerba?.tipoMovimento === FolhaMovimentoTipo.RECEITA
            ? 'tipo-receita'
            : ev.folhaVerba?.tipoMovimento === FolhaMovimentoTipo.DESPESA
              ? 'tipo-despesa'
              : '';
        return `<tr>
          <td>${this.escapeHtml(desc)}</td>
          <td class="${tipoClasse}">${this.escapeHtml(tipo)}</td>
          <td>${this.escapeHtml(this.formatarQuantidade(ev.quantidade))}</td>
          <td>${this.escapeHtml(this.formatarMoeda(ev.valor))}</td>
        </tr>`;
      })
      .join('\n');

    return `<div class="dados-livres eventos-livres">
    <table>
      <thead>
        <tr>
          <th>Evento fixo</th>
          <th>Tipo</th>
          <th>Referência</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`;
  }

  private labelTipoMovimento(tipo?: FolhaMovimentoTipo | null): string {
    if (tipo === FolhaMovimentoTipo.RECEITA) return 'Receita';
    if (tipo === FolhaMovimentoTipo.DESPESA) return 'Despesa';
    return '—';
  }

  private getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.hasLogo) return null;
    return `${environment.apiUrl}/configuracao/logo`;
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}`;
  }

  private agruparPorUnidade(
    funcionarios: FuncionarioFolha[],
  ): Array<[Unidade, FuncionarioFolha[]]> {
    const map = new Map<Unidade, FuncionarioFolha[]>();
    for (const f of funcionarios) {
      const u = f.unidade;
      const atual = map.get(u) ?? [];
      atual.push(f);
      map.set(u, atual);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }

  private formatarMoeda(valor: unknown): string {
    const num = Number(String(valor ?? '0').replace(',', '.'));
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  }

  private formatarQuantidade(valor: unknown): string {
    const num = Number(String(valor ?? '1').replace(',', '.'));
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(Number.isFinite(num) ? num : 1);
  }

  private escapeHtml(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
