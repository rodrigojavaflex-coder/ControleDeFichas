import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { VisitacaoPainelMedicoService } from '../../services/visitacao-painel-medico.service';
import {
  FindVisitacaoPainelMedicoDto,
  PainelMedicoRepresentante,
  VisitacaoPainelMedicoRepresentante,
} from '../../models/visitacao-painel-medico.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';

interface AppliedFilter {
  key: string;
  label: string;
  value: string;
}

interface PainelMedicoFilterSnapshot {
  nomeMedico: string;
  crmMedico: string;
  ufCrmMedico: string;
  nomeRepresentante: string;
  funcionarioId: string;
  unidade: string;
}

@Component({
  selector: 'app-visitacao-painel-medico-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visitacao-painel-medico-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    './visitacao-painel-medico-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class VisitacaoPainelMedicoPageComponent implements OnInit {
  private service = inject(VisitacaoPainelMedicoService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private errorModalService = inject(ErrorModalService);
  private configuracaoService = inject(ConfiguracaoService);

  Permission = Permission;

  configuracao: Configuracao | null = null;
  items: PainelMedicoRepresentante[] = [];
  representantesVinculados: VisitacaoPainelMedicoRepresentante[] = [];
  loading = false;
  loadingRepresentantes = false;
  imprimindo = false;
  error = '';

  currentPage = 1;
  pageSize = 50;
  totalItems = 0;
  totalPages = 0;

  nomeMedicoFilter = '';
  crmMedicoFilter = '';
  ufCrmMedicoFilter = '';
  nomeRepresentanteFilter = '';
  funcionarioIdFilter = '';
  unidadeFilter: Unidade | '' = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  filtersPanelOpen = false;
  private appliedFiltersSnapshot: PainelMedicoFilterSnapshot =
    this.createFilterSnapshot();

  ngOnInit(): void {
    if (!this.canRead()) {
      this.error = 'Você não possui permissão para visualizar o painel médico.';
      this.errorModalService.show(this.error, 'Acesso Negado');
      return;
    }

    this.pageContextService.setContext({
      title: 'Painel Médico',
      description:
        'Consulta médicos sincronizados do painel médicos × representantes.',
    });

    this.initializeUnidadeFilter();
    this.updateAppliedFiltersSnapshot();
    this.carregarConfiguracao();
    this.loadRepresentantes();
    this.loadItems();
  }

  private carregarConfiguracao(): void {
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => (this.configuracao = config),
      error: () => (this.configuracao = null),
    });
  }

  canRead(): boolean {
    return this.authService.hasPermission(
      Permission.VISITACAO_PAINEL_MEDICO_READ,
    );
  }

  get appliedFilters(): AppliedFilter[] {
    const filters: AppliedFilter[] = [];
    const s = this.appliedFiltersSnapshot;

    if (s.nomeMedico.trim()) {
      filters.push({ key: 'nomeMedico', label: 'Médico', value: s.nomeMedico.trim() });
    }
    if (s.crmMedico.trim()) {
      filters.push({ key: 'crmMedico', label: 'CRM', value: s.crmMedico.trim() });
    }
    if (s.ufCrmMedico.trim()) {
      filters.push({ key: 'ufCrmMedico', label: 'UF', value: s.ufCrmMedico.trim().toUpperCase() });
    }
    if (s.funcionarioId) {
      const rep = this.representantesVinculados.find((r) => r.id === s.funcionarioId);
      filters.push({
        key: 'funcionarioId',
        label: 'Representante',
        value: rep?.nome ?? s.funcionarioId,
      });
    } else if (s.nomeRepresentante.trim()) {
      filters.push({
        key: 'nomeRepresentante',
        label: 'Representante',
        value: s.nomeRepresentante.trim(),
      });
    }
    if (s.unidade) {
      filters.push({ key: 'unidade', label: 'Unidade', value: s.unidade });
    }

    return filters;
  }

  private buildFindDto(page: number, limit: number): FindVisitacaoPainelMedicoDto {
    const s = this.appliedFiltersSnapshot;
    const filters: FindVisitacaoPainelMedicoDto = { page, limit };

    if (s.nomeMedico.trim()) filters.nomeMedico = s.nomeMedico.trim();
    if (s.crmMedico.trim()) filters.crmMedico = s.crmMedico.trim();
    if (s.ufCrmMedico.trim()) filters.ufCrmMedico = s.ufCrmMedico.trim().toUpperCase();
    if (s.funcionarioId) {
      filters.funcionarioId = s.funcionarioId;
    } else if (s.nomeRepresentante.trim()) {
      filters.nomeRepresentante = s.nomeRepresentante.trim();
    }
    if (s.unidade) filters.unidade = s.unidade as Unidade;

    return filters;
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade?.trim()) {
      this.unidadeFilter = currentUser.unidade as Unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeDisabled = false;
      this.unidadeFilter = '';
    }
  }

  private createFilterSnapshot(): PainelMedicoFilterSnapshot {
    return {
      nomeMedico: this.nomeMedicoFilter || '',
      crmMedico: this.crmMedicoFilter || '',
      ufCrmMedico: this.ufCrmMedicoFilter || '',
      nomeRepresentante: this.nomeRepresentanteFilter || '',
      funcionarioId: this.funcionarioIdFilter || '',
      unidade: this.unidadeFilter || '',
    };
  }

  private updateAppliedFiltersSnapshot(): void {
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
  }

  loadRepresentantes(): void {
    this.loadingRepresentantes = true;
    const unidade = this.unidadeFilter || undefined;
    this.service.listarRepresentantes(unidade).subscribe({
      next: (rows) => {
        this.representantesVinculados = rows;
        this.loadingRepresentantes = false;
      },
      error: () => {
        this.loadingRepresentantes = false;
      },
    });
  }

  loadItems(): void {
    if (!this.canRead()) return;

    this.loading = true;
    this.error = '';

    this.service.findAll(this.buildFindDto(this.currentPage, this.pageSize)).subscribe({
      next: (response) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorModalService.show(
          'Erro ao carregar médicos do painel.',
          'Erro',
        );
      },
    });
  }

  imprimir(): void {
    if (!this.canRead() || this.imprimindo) return;

    this.imprimindo = true;
    this.fetchAllForPrint().subscribe({
      next: (rows) => {
        this.imprimindo = false;
        if (rows.length === 0) {
          this.errorModalService.show(
            'Nenhum médico para imprimir com os filtros atuais.',
            'Impressão',
          );
          return;
        }
        this.abrirJanelaImpressao(
          'Relatório — Painel Médico',
          this.montarHtmlImpressao(rows),
        );
      },
      error: () => {
        this.imprimindo = false;
        this.errorModalService.show(
          'Erro ao preparar impressão do painel médico.',
          'Impressão',
        );
      },
    });
  }

  private fetchAllForPrint(): Observable<PainelMedicoRepresentante[]> {
    const limit = 200;
    return this.service.findAll(this.buildFindDto(1, limit)).pipe(
      switchMap((first) => {
        const all = [...first.data];
        const totalPages = first.meta.totalPages;
        if (totalPages <= 1) return of(all);

        const requests = Array.from({ length: totalPages - 1 }, (_, index) =>
          this.service
            .findAll(this.buildFindDto(index + 2, limit))
            .pipe(map((response) => response.data)),
        );

        return forkJoin(requests).pipe(
          map((pages) => pages.reduce((acc, page) => acc.concat(page), all)),
        );
      }),
    );
  }

  private montarHtmlImpressao(items: PainelMedicoRepresentante[]): string {
    const agrupado = this.agruparPorUnidade(items);
    const blocosUnidade = agrupado
      .map(([unidade, lista], index) =>
        this.blocoUnidadeImpressaoPainelMedico(unidade, lista, index > 0),
      )
      .join('\n');
    return this.montarShellRelatorio(
      'Relatório — Painel Médico',
      [],
      blocosUnidade,
    );
  }

  private agruparPorUnidade(
    items: PainelMedicoRepresentante[],
  ): Array<[Unidade, PainelMedicoRepresentante[]]> {
    const map = new Map<Unidade, PainelMedicoRepresentante[]>();
    for (const item of items) {
      const atual = map.get(item.unidade) ?? [];
      atual.push(item);
      map.set(item.unidade, atual);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  private blocoUnidadeImpressaoPainelMedico(
    unidade: Unidade,
    lista: PainelMedicoRepresentante[],
    novaPagina = false,
  ): string {
    const ordenada = [...lista].sort((a, b) =>
      a.nomeMedico.localeCompare(b.nomeMedico, 'pt-BR'),
    );
    const linhas = ordenada
      .map(
        (item) => `<tr>
          <td>${this.escapeHtml(item.nomeMedico)}</td>
          <td>${this.escapeHtml(this.formatCrm(item))}</td>
          <td>${this.escapeHtml(item.nomeRepresentante ?? item.nomeRepresentanteErp ?? '—')}</td>
          <td>${this.escapeHtml(String(item.codigoRepresentante))}</td>
          <td>${this.escapeHtml(String(item.contratoRepresentante))}</td>
          <td>${this.escapeHtml(item.vinculadoFuncionario ? 'Vinculado' : 'Sem cadastro')}</td>
        </tr>`,
      )
      .join('\n');
    const totalLabel =
      lista.length === 1 ? '1 médico' : `${lista.length} médicos`;
    const classePagina = novaPagina ? ' unit-section-nova-pagina' : '';
    return `<section class="unit-section${classePagina}">
  <div class="unit-title">Unidade: ${this.escapeHtml(unidade)}</div>
  <table class="lista-funcionarios-table">
    <thead>
      <tr>
        <th>Médico</th>
        <th>CRM</th>
        <th>Representante</th>
        <th>Cód. rep.</th>
        <th>Filial painel</th>
        <th>Vínculo</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="unit-total">Total: ${this.escapeHtml(totalLabel)}</div>
</section>`;
  }

  private montarShellRelatorio(
    reportTitle: string,
    subtituloExtra: string[],
    conteudo: string,
  ): string {
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `${reportTitle} ${reportTimestamp}`;

    const currentUser = this.authService.getCurrentUser();
    const usuarioLabel =
      currentUser?.nome || currentUser?.email || 'Usuário não identificado';
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
    .unit-total { margin-top: 12px; font-size: 11px; font-weight: 700; color: #334155; }
    .lista-funcionarios-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .lista-funcionarios-table th, .lista-funcionarios-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    .lista-funcionarios-table th { background: #f8fafc; font-weight: 700; color: #1e293b; }
    .lista-funcionarios-table tr:last-child td { border-bottom: none; }
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
    const s = this.appliedFiltersSnapshot;
    const unidadeLabel = s.unidade || this.unidadeFilter;
    partes.push(
      unidadeLabel ? `Unidade: ${unidadeLabel}` : 'Unidades: Todas do escopo',
    );
    if (s.nomeMedico.trim()) {
      partes.push(`Médico contém: «${s.nomeMedico.trim()}»`);
    }
    if (s.crmMedico.trim()) {
      partes.push(`CRM contém: «${s.crmMedico.trim()}»`);
    }
    if (s.ufCrmMedico.trim()) {
      partes.push(`UF: ${s.ufCrmMedico.trim().toUpperCase()}`);
    }
    if (s.funcionarioId) {
      const rep = this.representantesVinculados.find(
        (r) => r.id === s.funcionarioId,
      );
      partes.push(`Representante: ${rep?.nome ?? s.funcionarioId}`);
    } else if (s.nomeRepresentante.trim()) {
      partes.push(`Representante contém: «${s.nomeRepresentante.trim()}»`);
    }
    partes.push(...extras);
    return `<div class="report-subtitle">${this.escapeHtml(partes.join(' · '))}</div>`;
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

  private abrirJanelaImpressao(tituloRelatorio: string, html: string): void {
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errorModalService.show('Permita pop-ups para imprimir a lista.', 'Impressão');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.document.title = `${tituloRelatorio} ${this.getReportTimestamp()}`;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 200);
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadItems();
  }

  toggleFiltersVisibility(): void {
    this.filtersPanelOpen = !this.filtersPanelOpen;
  }

  onFiltersToggleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleFiltersVisibility();
    }
  }

  onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.filters-toggle')) return;
    if (target.closest('.filter-chip button')) return;
    this.toggleFiltersVisibility();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.updateAppliedFiltersSnapshot();
    this.filtersPanelOpen = false;
    this.loadRepresentantes();
    this.loadItems();
  }

  clearFilters(): void {
    this.nomeMedicoFilter = '';
    this.crmMedicoFilter = '';
    this.ufCrmMedicoFilter = '';
    this.nomeRepresentanteFilter = '';
    this.funcionarioIdFilter = '';
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    this.currentPage = 1;
    this.filtersPanelOpen = false;
    this.updateAppliedFiltersSnapshot();
    this.loadRepresentantes();
    this.loadItems();
  }

  clearAppliedFilter(key: string): void {
    switch (key) {
      case 'nomeMedico':
        this.nomeMedicoFilter = '';
        break;
      case 'crmMedico':
        this.crmMedicoFilter = '';
        break;
      case 'ufCrmMedico':
        this.ufCrmMedicoFilter = '';
        break;
      case 'nomeRepresentante':
        this.nomeRepresentanteFilter = '';
        break;
      case 'funcionarioId':
        this.funcionarioIdFilter = '';
        break;
      case 'unidade':
        if (!this.unidadeDisabled) this.unidadeFilter = '';
        break;
    }
    this.currentPage = 1;
    this.updateAppliedFiltersSnapshot();
    this.loadRepresentantes();
    this.loadItems();
  }

  canRemoveFilter(key: string): boolean {
    if (key === 'unidade' && this.unidadeDisabled) return false;
    return true;
  }

  onFuncionarioFilterChange(): void {
    if (this.funcionarioIdFilter) {
      this.nomeRepresentanteFilter = '';
    }
  }

  formatCrm(item: PainelMedicoRepresentante): string {
    return `${item.crmMedico}/${item.ufCrmMedico}`;
  }

  labelRepresentanteOption(rep: VisitacaoPainelMedicoRepresentante): string {
    return `${rep.nome} (${rep.painelCodigoRepresentante})`;
  }
}
