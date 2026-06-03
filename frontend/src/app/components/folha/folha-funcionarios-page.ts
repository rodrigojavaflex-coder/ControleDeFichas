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
import { formatarTelefoneBrExibicao } from './folha-telefone.util';

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

  private mensagemErroExclusaoFuncionario(e: {
    error?: { message?: string | string[] };
  }): string {
    const raw = e?.error?.message;
    if (Array.isArray(raw)) return raw.join('\n');
    return raw ?? 'Não foi possível excluir o funcionário.';
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
      error: (e: { error?: { message?: string | string[] } }) =>
        this.errors.show(
          this.mensagemErroExclusaoFuncionario(e),
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

  imprimirEventos(): void {
    this.gerarRelatorio('eventos', true);
  }

  imprimirFuncionarios(): void {
    this.gerarRelatorio('funcionarios', false);
  }

  imprimirAniversarios(): void {
    this.gerarRelatorio('aniversarios', false);
  }

  private gerarRelatorio(
    tipo: 'eventos' | 'funcionarios' | 'aniversarios',
    comEventosFixos: boolean,
  ): void {
    if (!this.podeLer() || this.imprimindo) return;
    this.imprimindo = true;
    const unidade = this.unidadeFiltro ? (this.unidadeFiltro as Unidade) : undefined;
    this.folha
      .listarFuncionariosTodos(unidade, this.nomeFiltro || undefined, comEventosFixos)
      .subscribe({
        next: (rows) => {
          this.imprimindo = false;
          const preparado = this.prepararRelatorio(tipo, rows);
          if (!preparado) return;
          this.abrirJanelaImpressao(preparado.titulo, preparado.html);
        },
        error: () => {
          this.imprimindo = false;
          this.errors.show('Erro ao preparar impressão da lista.', 'Folha');
        },
      });
  }

  private prepararRelatorio(
    tipo: 'eventos' | 'funcionarios' | 'aniversarios',
    rows: FuncionarioFolha[],
  ): { titulo: string; html: string } | null {
    if (rows.length === 0) {
      this.errors.show('Nenhum funcionário para imprimir com os filtros atuais.', 'Folha');
      return null;
    }

    switch (tipo) {
      case 'eventos':
        return {
          titulo: 'Relatório de Eventos Fixos',
          html: this.montarHtmlImpressaoEventos(rows),
        };
      case 'funcionarios':
        return {
          titulo: 'Relatório de Funcionários',
          html: this.montarHtmlImpressaoFuncionarios(rows),
        };
      case 'aniversarios': {
        const comNascimento = rows.filter((f) => this.extrairMesDiaNascimento(f.dataNascimento));
        if (comNascimento.length === 0) {
          this.errors.show(
            'Nenhum funcionário com data de nascimento cadastrada para os filtros atuais.',
            'Folha',
          );
          return null;
        }
        return {
          titulo: 'Relatório de Aniversários',
          html: this.montarHtmlImpressaoAniversarios(comNascimento),
        };
      }
    }
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
    return formatarTelefoneBrExibicao(raw);
  }

  formatarChavePix(f: FuncionarioFolha): string {
    const chave = f.chavePix?.trim();
    if (!chave) return '—';
    if (f.tipoPix) return `${f.tipoPix}: ${chave}`;
    return chave;
  }

  private abrirJanelaImpressao(tituloRelatorio: string, html: string): void {
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups para imprimir a lista.', 'Impressão');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.document.title = `${tituloRelatorio} ${this.getReportTimestamp()}`;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 200);
  }

  private montarHtmlImpressaoEventos(funcionarios: FuncionarioFolha[]): string {
    const subtituloExtra = ['Com eventos fixos'];
    const agrupado = this.agruparPorUnidade(funcionarios);
    const blocosUnidade = agrupado
      .map(([unidade, lista]) => this.blocoUnidadeImpressaoEventos(unidade, lista))
      .join('\n');
    return this.montarShellRelatorio('Relatório de Eventos Fixos', subtituloExtra, blocosUnidade);
  }

  private montarHtmlImpressaoFuncionarios(funcionarios: FuncionarioFolha[]): string {
    const agrupado = this.agruparPorUnidade(funcionarios);
    const blocosUnidade = agrupado
      .map(([unidade, lista], index) =>
        this.blocoUnidadeImpressaoFuncionarios(unidade, lista, index > 0),
      )
      .join('\n');
    return this.montarShellRelatorio('Relatório de Funcionários', [], blocosUnidade);
  }

  private montarHtmlImpressaoAniversarios(funcionarios: FuncionarioFolha[]): string {
    const agrupado = this.agruparAniversariosPorUnidadeEMes(funcionarios);
    const blocosUnidade = agrupado
      .map(([unidade, meses], index) =>
        this.blocoUnidadeImpressaoAniversarios(unidade, meses, index > 0),
      )
      .join('\n');
    return this.montarShellRelatorio('Relatório de Aniversários', [], blocosUnidade);
  }

  private montarShellRelatorio(
    reportTitle: string,
    subtituloExtra: string[],
    conteudo: string,
  ): string {
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

    const subtituloFiltros = this.subtituloFiltrosImpressao(subtituloExtra);

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
    .unit-section { margin-top: 24px; break-inside: auto; page-break-inside: auto; }
    .unit-section:first-of-type { margin-top: 0; }
    .unit-section-nova-pagina { break-before: page; page-break-before: always; margin-top: 0; }
    .unit-title { font-weight: 600; text-transform: uppercase; font-size: 12px; margin-bottom: 6px; color: #1e293b; break-after: avoid-page; page-break-after: avoid; }
    .funcionario-block { margin-top: 16px; break-inside: avoid-page; page-break-inside: avoid; }
    .funcionario-block:first-of-type { margin-top: 0; }
    .funcionario-nome { font-size: 15px; font-weight: 700; margin: 14px 0 6px; color: #1e293b; line-height: 1.3; }
    .dados-livres { margin-top: 2px; margin-left: 12px; }
    .dados-livres table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .dados-livres th, .dados-livres td { border: none; padding: 3px 10px 3px 0; text-align: left; vertical-align: top; background: transparent; }
    .dados-livres th { font-weight: 700; color: #1e293b; white-space: nowrap; }
    .dados-livres tbody td { color: #1e293b; }
    .col-telefone {
      white-space: nowrap;
      width: 1%;
      min-width: max-content;
      padding-right: 10px;
    }
    .eventos-livres { margin-top: 6px; margin-left: 24px; }
    .unit-total { margin-top: 12px; font-size: 11px; font-weight: 700; color: #334155; }
    .tipo-receita { color: #0f766e; font-weight: 600; }
    .tipo-despesa { color: #b91c1c; font-weight: 600; }
    .lista-funcionarios-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .lista-funcionarios-table th, .lista-funcionarios-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    .lista-funcionarios-table th { background: #f8fafc; font-weight: 700; color: #1e293b; }
    .lista-funcionarios-table tr:last-child td { border-bottom: none; }
    .mes-section { margin-top: 14px; break-inside: auto; page-break-inside: auto; }
    .mes-section:first-of-type { margin-top: 0; }
    .mes-title { font-weight: 600; font-size: 12px; margin: 10px 0 4px; color: #334155; break-after: avoid-page; page-break-after: avoid; }
    .aniversariante-lista { margin: 0; padding: 0 0 0 18px; font-size: 11px; line-height: 1.6; color: #1e293b; }
    .aniversariante-lista li { margin: 2px 0; }
    footer { text-align: right; font-size: 10px; color: #4a5568; margin-top: 32px; }
    @page {
      size: A4;
      margin: 12mm 15mm 28mm 15mm;
    }
    @media print {
      .print-actions { display: none; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
      }
      .report-header { break-after: avoid-page; page-break-after: avoid; }
      .lista-funcionarios-table thead { display: table-header-group; }
      footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 0;
        padding: 0 15mm 10mm;
        text-align: right;
        font-size: 10px;
        color: #4a5568;
        background: #fff;
      }
    }
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
  ${conteudo}
  <footer>${this.escapeHtml(geradoEmTexto)}</footer>
</body>
</html>`;
  }

  private subtituloFiltrosImpressao(extras: string[] = []): string {
    const partes: string[] = [];
    partes.push(
      this.unidadeFiltro
        ? `Unidade: ${this.unidadeFiltro}`
        : 'Unidades: Todas do escopo',
    );
    if (this.nomeFiltro.trim()) {
      partes.push(`Nome contém: «${this.nomeFiltro.trim()}»`);
    }
    partes.push(...extras);
    return `<div class="report-subtitle">${this.escapeHtml(partes.join(' · '))}</div>`;
  }

  private blocoUnidadeImpressaoEventos(unidade: Unidade, lista: FuncionarioFolha[]): string {
    const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const blocosFunc = ordenada.map((f) => this.blocoFuncionarioImpressao(f)).join('\n');
    const totalLabel =
      lista.length === 1 ? '1 funcionário' : `${lista.length} funcionários`;
    return `<section class="unit-section">
  <div class="unit-title">Unidade: ${this.escapeHtml(unidade)}</div>
  ${blocosFunc}
  <div class="unit-total">Total: ${this.escapeHtml(totalLabel)}</div>
</section>`;
  }

  private blocoUnidadeImpressaoFuncionarios(
    unidade: Unidade,
    lista: FuncionarioFolha[],
    novaPagina = false,
  ): string {
    const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const linhas = ordenada
      .map(
        (f) => `<tr>
          <td>${this.escapeHtml(f.nome)}</td>
          <td class="col-telefone">${this.escapeHtml(this.formatarTelefone(f.telefone))}</td>
          <td>${this.escapeHtml(f.cargo?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(f.setor?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(this.formatarDataDdMmYyyy(f.dataNascimento ?? null))}</td>
          <td>${this.escapeHtml(this.formatarDataDdMmYyyy(f.dataAdmissao ?? null))}</td>
        </tr>`,
      )
      .join('\n');
    const totalLabel =
      lista.length === 1 ? '1 funcionário' : `${lista.length} funcionários`;
    const classePagina = novaPagina ? ' unit-section-nova-pagina' : '';
    return `<section class="unit-section${classePagina}">
  <div class="unit-title">Unidade: ${this.escapeHtml(unidade)}</div>
  <table class="lista-funcionarios-table">
    <thead>
      <tr>
        <th>Nome</th>
        <th class="col-telefone">Telefone</th>
        <th>Cargo</th>
        <th>Setor</th>
        <th>Nascimento</th>
        <th>Admissão</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="unit-total">Total: ${this.escapeHtml(totalLabel)}</div>
</section>`;
  }

  private blocoUnidadeImpressaoAniversarios(
    unidade: Unidade,
    meses: Array<[number, FuncionarioFolha[]]>,
    novaPagina = false,
  ): string {
    const blocosMes = meses
      .map(([mes, lista]) => this.blocoMesImpressaoAniversarios(mes, lista))
      .join('\n');
    const total = meses.reduce((acc, [, lista]) => acc + lista.length, 0);
    const totalLabel = total === 1 ? '1 aniversariante' : `${total} aniversariantes`;
    const classePagina = novaPagina ? ' unit-section-nova-pagina' : '';
    return `<section class="unit-section${classePagina}">
  <div class="unit-title">Unidade: ${this.escapeHtml(unidade)}</div>
  ${blocosMes}
  <div class="unit-total">Total: ${this.escapeHtml(totalLabel)}</div>
</section>`;
  }

  private blocoMesImpressaoAniversarios(mes: number, lista: FuncionarioFolha[]): string {
    const itens = lista
      .map((f) => {
        const partes = this.extrairMesDiaNascimento(f.dataNascimento);
        const dataLabel = partes
          ? `${String(partes.dia).padStart(2, '0')}/${String(partes.mes).padStart(2, '0')}`
          : '—';
        return `<li>${this.escapeHtml(f.nome)} — ${this.escapeHtml(dataLabel)}</li>`;
      })
      .join('\n');
    return `<div class="mes-section">
  <div class="mes-title">${this.escapeHtml(this.nomeMesPt(mes))}</div>
  <ul class="aniversariante-lista">${itens}</ul>
</div>`;
  }

  private blocoFuncionarioImpressao(f: FuncionarioFolha): string {
    const dadosFuncionario = `<div class="dados-livres">
    <table>
      <thead>
        <tr>
          <th class="col-telefone">Telefone</th>
          <th>Admissão</th>
          <th>Cargo</th>
          <th>Setor</th>
          <th>Chave Pix</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-telefone">${this.escapeHtml(this.formatarTelefone(f.telefone))}</td>
          <td>${this.escapeHtml(this.formatarDataDdMmYyyy(f.dataAdmissao ?? null))}</td>
          <td>${this.escapeHtml(f.cargo?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(f.setor?.descricao?.trim() || '—')}</td>
          <td>${this.escapeHtml(this.formatarChavePix(f))}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

    const eventos =
      (f.eventosFixos?.length ?? 0) > 0
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

  private agruparAniversariosPorUnidadeEMes(
    funcionarios: FuncionarioFolha[],
  ): Array<[Unidade, Array<[number, FuncionarioFolha[]]>]> {
    const porUnidade = new Map<Unidade, Map<number, FuncionarioFolha[]>>();

    for (const f of funcionarios) {
      const partes = this.extrairMesDiaNascimento(f.dataNascimento);
      if (!partes) continue;

      const mesesUnidade = porUnidade.get(f.unidade) ?? new Map<number, FuncionarioFolha[]>();
      const listaMes = mesesUnidade.get(partes.mes) ?? [];
      listaMes.push(f);
      mesesUnidade.set(partes.mes, listaMes);
      porUnidade.set(f.unidade, mesesUnidade);
    }

    return Array.from(porUnidade.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([unidade, mesesMap]) => {
        const meses = Array.from(mesesMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([mes, lista]) => {
            const ordenada = [...lista].sort((a, b) => {
              const pa = this.extrairMesDiaNascimento(a.dataNascimento);
              const pb = this.extrairMesDiaNascimento(b.dataNascimento);
              const diaDiff = (pa?.dia ?? 0) - (pb?.dia ?? 0);
              if (diaDiff !== 0) return diaDiff;
              return a.nome.localeCompare(b.nome, 'pt-BR');
            });
            return [mes, ordenada] as [number, FuncionarioFolha[]];
          });
        return [unidade, meses] as [Unidade, Array<[number, FuncionarioFolha[]]>];
      });
  }

  private extrairMesDiaNascimento(
    raw?: string | null,
  ): { mes: number; dia: number } | null {
    if (raw == null || `${raw}` === '') return null;
    const s = `${raw}`;
    const ymd = s.includes('T') ? s.split('T')[0] : s.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return { mes, dia };
  }

  private nomeMesPt(mes: number): string {
    const nomes = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return nomes[mes - 1] ?? String(mes);
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
