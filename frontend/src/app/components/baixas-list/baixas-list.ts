import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaixasService } from '../../services/baixas.service';
import { AuthService } from '../../services/auth.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Baixa, BaixaPaginatedResponse, FindBaixasDto, TipoDaBaixa } from '../../models/baixa.model';
import { Unidade, Permission } from '../../models/usuario.model';
import { VendaOrigem } from '../../models/venda.model';
import { VendaService } from '../../services/vendas.service';
import { Venda } from '../../models/venda.model';
import { firstValueFrom } from 'rxjs';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';
import { PageContextService } from '../../services/page-context.service';
import { LancarBaixaModalComponent } from '../lancar-baixa-modal/lancar-baixa-modal';
import { ErrorModalService } from '../../services/error-modal.service';

interface AppliedFilter {
  key: string;
  label: string;
  value: string;
}

interface BaixasFilterSnapshot {
  protocolo: string;
  cliente: string;
  dataInicial: string;
  dataFinal: string;
  unidade: string;
  origem: string;
  valorMin: string;
  valorMax: string;
}

@Component({
  selector: 'app-baixas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, LancarBaixaModalComponent],
  templateUrl: './baixas-list.html',
  styleUrls: ['./baixas-list.css']
})
export class BaixasListComponent implements OnInit, OnDestroy {
  private baixasService = inject(BaixasService);
  private authService = inject(AuthService);
  private vendaService = inject(VendaService);
  private configuracaoService = inject(ConfiguracaoService);
  private pageContextService = inject(PageContextService);
  private errorModalService = inject(ErrorModalService);

  Permission = Permission;
  TipoDaBaixa = TipoDaBaixa;
  unidades = Object.values(Unidade);
  origens = Object.values(VendaOrigem);

  items: Baixa[] = [];
  loading = false;
  error = '';

  // Paginação
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  pageSize = 50;

  // Filtros
  dataInicialFilter = '';
  dataFinalFilter = '';
  unidadeFilter: Unidade | '' = '';
  unidadeDisabled = false;
  protocoloFilter = '';
  clienteFilter = '';
  valorMinFilter = '';
  valorMaxFilter = '';
  origemFilter: VendaOrigem | '' = '';
  private vendaCache = new Map<string, Venda>();
  configuracao: Configuracao | null = null;
  filtersPanelOpen = false;
  private appliedFiltersSnapshot: BaixasFilterSnapshot = this.createFilterSnapshot();
  selectedBaixa: Baixa | null = null;
  showBaixaModal = false;
  selectedVendaForBaixa: Venda | null = null;
  loadingVendaSelecionada = false;

  ngOnInit(): void {
    if (!this.canViewBaixas()) {
      this.error = 'Você não possui permissão para visualizar as baixas.';
      return;
    }

    this.initializeDateFilters();
    this.initializeUnidadeFilter();
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
    this.loadConfiguracao();
    this.pageContextService.setContext({
      title: 'Baixas',
      description: 'Consulte e filtre todas as baixas registradas.'
    });
    this.loadBaixas();
  }

  ngOnDestroy(): void {
    this.pageContextService.resetContext();
  }

  canViewBaixas(): boolean {
    return this.authService.hasPermission(Permission.VENDA_BAIXAR);
  }

  private initializeDateFilters(): void {
    if (this.dataInicialFilter && this.dataFinalFilter) {
      return;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    this.dataInicialFilter = formatDate(yesterday);
    this.dataFinalFilter = formatDate(now);
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade) {
      this.unidadeFilter = currentUser.unidade;
      this.unidadeDisabled = true;
    }
  }

  private loadConfiguracao(): void {
    this.configuracaoService.getConfiguracao().subscribe({
      next: config => (this.configuracao = config),
      error: () => (this.configuracao = null)
    });
  }

  private createFilterSnapshot(): BaixasFilterSnapshot {
    return {
      protocolo: this.protocoloFilter || '',
      cliente: this.clienteFilter || '',
      dataInicial: this.dataInicialFilter || '',
      dataFinal: this.dataFinalFilter || '',
      unidade: this.unidadeFilter?.toString() || '',
      origem: this.origemFilter?.toString() || '',
      valorMin: this.valorMinFilter || '',
      valorMax: this.valorMaxFilter || ''
    };
  }

  private updateAppliedFiltersSnapshot(): void {
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
  }

  loadBaixas(page: number = this.currentPage): void {
    if (!this.canViewBaixas()) {
      return;
    }

    if (this.dataInicialFilter && this.dataFinalFilter && this.dataInicialFilter > this.dataFinalFilter) {
      this.error = 'A data inicial não pode ser maior que a data final.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.currentPage = page;

    const filters: FindBaixasDto = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.dataInicialFilter) {
      filters.dataInicial = this.dataInicialFilter;
    }
    if (this.dataFinalFilter) {
      filters.dataFinal = this.dataFinalFilter;
    }
    this.baixasService.getBaixas(filters).subscribe({
      next: (response: BaixaPaginatedResponse) => {
        this.enrichBaixasWithVendas(response.data)
          .then(enriched => {
            const filteredData = this.applyLocalFilters(enriched);
            this.items = filteredData;
            this.totalItems = filteredData.length;
            this.totalPages = response.meta.totalPages || 1;
            this.loading = false;
            // manter seleção se ainda existir
            if (this.selectedBaixa) {
              const stillExists = this.items.find(item => item.id === this.selectedBaixa!.id) || null;
              this.selectedBaixa = stillExists;
              this.selectedVendaForBaixa = stillExists ? this.resolveVendaFromBaixa(stillExists) : null;
            }
          })
          .catch(() => {
            this.error = 'Erro ao carregar dados das vendas associadas.';
            this.loading = false;
          });
      },
      error: () => {
        this.error = 'Erro ao carregar baixas. Tente novamente.';
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadBaixas();
  }

  clearFilters(): void {
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    this.protocoloFilter = '';
    this.clienteFilter = '';
    this.origemFilter = '';
    this.valorMinFilter = '';
    this.valorMaxFilter = '';
    this.initializeDateFilters();
    this.filtersPanelOpen = false;
    this.updateAppliedFiltersSnapshot();
    this.loadBaixas(1);
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

  get appliedFilters(): AppliedFilter[] {
    const filters: AppliedFilter[] = [];
    const snapshot = this.appliedFiltersSnapshot;
    if (snapshot.protocolo.trim()) {
      filters.push({ key: 'protocolo', label: 'Protocolo', value: snapshot.protocolo.trim() });
    }
    if (snapshot.cliente.trim()) {
      filters.push({ key: 'cliente', label: 'Cliente', value: snapshot.cliente.trim() });
    }
    if (snapshot.dataInicial || snapshot.dataFinal) {
      const inicio = this.formatDateDisplay(snapshot.dataInicial);
      const fim = this.formatDateDisplay(snapshot.dataFinal);
      let value = '';
      if (inicio && fim) value = `${inicio} a ${fim}`;
      else if (inicio) value = `A partir de ${inicio}`;
      else if (fim) value = `Até ${fim}`;
      filters.push({ key: 'periodo', label: 'Período', value });
    }
    if (snapshot.unidade) {
      filters.push({ key: 'unidade', label: 'Unidade', value: snapshot.unidade });
    }
    if (snapshot.origem) {
      filters.push({ key: 'origem', label: 'Comprado em', value: this.getOrigemLabel(snapshot.origem as VendaOrigem) });
    }
    if (snapshot.valorMin || snapshot.valorMax) {
      let value = '';
      if (snapshot.valorMin && snapshot.valorMax) value = `${snapshot.valorMin} a ${snapshot.valorMax}`;
      else if (snapshot.valorMin) value = `>= ${snapshot.valorMin}`;
      else if (snapshot.valorMax) value = `<= ${snapshot.valorMax}`;
      filters.push({ key: 'valor', label: 'Valor da baixa', value });
    }
    return filters.filter(filter => filter.value);
  }

  clearAppliedFilter(key: string): void {
    switch (key) {
      case 'protocolo':
        this.protocoloFilter = '';
        break;
      case 'cliente':
        this.clienteFilter = '';
        break;
      case 'periodo':
        this.dataInicialFilter = '';
        this.dataFinalFilter = '';
        break;
      case 'unidade':
        if (!this.unidadeDisabled) {
          this.unidadeFilter = '';
        }
        break;
      case 'origem':
        this.origemFilter = '';
        break;
      case 'valor':
        this.valorMinFilter = '';
        this.valorMaxFilter = '';
        break;
      default:
        return;
    }
    this.updateAppliedFiltersSnapshot();
    this.applyFilters();
  }

  applyFilters(): void {
    this.filtersPanelOpen = false;
    this.updateAppliedFiltersSnapshot();
    this.loadBaixas(1);
  }

  isBaixaSelected(baixa: Baixa): boolean {
    return this.selectedBaixa?.id === baixa.id;
  }

  toggleSelectBaixa(baixa: Baixa): void {
    if (this.selectedBaixa?.id === baixa.id) {
      this.selectedBaixa = null;
      this.selectedVendaForBaixa = null;
      return;
    }

    this.selectedBaixa = baixa;
    this.selectedVendaForBaixa = this.resolveVendaFromBaixa(baixa);
  }

  abrirModalBaixaSelecionada(): void {
    if (!this.selectedBaixa) {
      this.errorModalService.show('Selecione uma baixa para abrir o modal.', 'Atenção');
      return;
    }

    if (this.loadingVendaSelecionada) {
      return;
    }

    const venda = this.resolveVendaFromBaixa(this.selectedBaixa);
    if (!venda) {
      if (this.selectedBaixa.idvenda) {
        this.loadingVendaSelecionada = true;
        this.vendaService.getVendaById(this.selectedBaixa.idvenda).subscribe({
          next: vendaCompleta => {
            this.vendaCache.set(vendaCompleta.id, vendaCompleta);
            this.loadingVendaSelecionada = false;
            this.selectedVendaForBaixa = vendaCompleta;
            this.showBaixaModal = true;
          },
          error: () => {
            this.loadingVendaSelecionada = false;
            this.errorModalService.show('Não foi possível carregar os dados da venda selecionada.', 'Erro');
          }
        });
        return;
      }

      this.errorModalService.show('Não foi possível identificar a venda vinculada a esta baixa.', 'Atenção');
      return;
    }

    this.selectedVendaForBaixa = venda;
    this.showBaixaModal = true;
  }

  closeBaixaModal(): void {
    this.showBaixaModal = false;
    this.selectedVendaForBaixa = null;
  }

  onBaixaModalClosed(): void {
    this.showBaixaModal = false;
    this.selectedVendaForBaixa = null;
    this.loadBaixas(this.currentPage);
  }

  private getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.logoRelatorio) {
      return null;
    }

    const backendUrl = environment.apiUrl.replace(/\/api$/, '');
    return this.configuracao.logoRelatorio.startsWith('/uploads')
      ? backendUrl + this.configuracao.logoRelatorio
      : this.configuracao.logoRelatorio;
  }

  imprimirRelatorio(): void {
    if (this.items.length === 0) {
      this.error = 'Nenhuma baixa disponível para imprimir.';
      setTimeout(() => (this.error = ''), 3000);
      return;
    }

    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.error = 'Não foi possível abrir o relatório. Verifique bloqueadores de pop-up.';
      return;
    }

    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo do sistema" />` : '';

    const agrupadosPorTipo = this.items.reduce<Record<string, number>>((acc, baixa) => {
      const tipo = baixa.tipoDaBaixa || 'Não informado';
      acc[tipo] = (acc[tipo] || 0) + (baixa.valorBaixa || 0);
      return acc;
    }, {});

    const totalGeral = this.items.reduce((total, baixa) => total + (baixa.valorBaixa || 0), 0);

    const baixasPorOrigem = new Map<string, Baixa[]>();
    this.items.forEach(baixa => {
      const origemLabel = this.getOrigemLabel(baixa.venda?.origem);
      if (!baixasPorOrigem.has(origemLabel)) {
        baixasPorOrigem.set(origemLabel, []);
      }
      baixasPorOrigem.get(origemLabel)!.push(baixa);
    });

    const origensOrdenadas = Array.from(baixasPorOrigem.keys()).sort((a, b) => {
      if (a === '-' && b !== '-') return 1;
      if (b === '-' && a !== '-') return -1;
      return a.localeCompare(b);
    });

    const secoesPorOrigem = origensOrdenadas
      .map(origem => {
        const origemLabel = origem === '-' ? 'Não informado' : origem;
        const baixasDaOrigem = baixasPorOrigem.get(origem) || [];
        const linhas = baixasDaOrigem
          .map(
            baixa => `
              <tr>
                <td>${baixa.dataBaixa ? new Date(baixa.dataBaixa).toLocaleDateString('pt-BR') : '-'}</td>
                <td>${baixa.venda?.protocolo || '-'}</td>
                <td>${baixa.venda?.cliente || '-'}</td>
                <td>${baixa.venda?.unidade || '-'}</td>
                <td>${origemLabel}</td>
                <td>${baixa.tipoDaBaixa || '-'}</td>
                <td>${this.formatCurrency(baixa.valorBaixa)}</td>
                <td>${baixa.observacao || '-'}</td>
              </tr>`
          )
          .join('');
        const totalOrigem = baixasDaOrigem.reduce((sum, baixa) => sum + (baixa.valorBaixa || 0), 0);
        const totaisPorTipoNaOrigem = baixasDaOrigem.reduce<Record<string, number>>((acc, baixa) => {
          const tipo = baixa.tipoDaBaixa || 'Não informado';
          acc[tipo] = (acc[tipo] || 0) + (baixa.valorBaixa || 0);
          return acc;
        }, {});
        const linhasTotaisPorTipoNaOrigem = Object.entries(totaisPorTipoNaOrigem)
          .map(
            ([tipo, total]) => `
              <tr>
                <td>${tipo}</td>
                <td>${this.formatCurrency(total)}</td>
              </tr>
            `
          )
          .join('');

        return `
          <section class="origin-section">
            <h2 class="origin-title">Comprado em: ${origemLabel}</h2>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Protocolo</th>
                    <th>Cliente</th>
                    <th>Unidade</th>
                    <th>Comprado em</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  ${linhas}
                </tbody>
              </table>
            </div>
            <div class="origin-summary">
              <span>Total ${origemLabel}:</span> ${this.formatCurrency(totalOrigem)}
            </div>
            <div class="origin-type-summary">
              <div class="origin-type-summary-title">Resumo por tipo (${origemLabel})</div>
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${linhasTotaisPorTipoNaOrigem}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total ${origemLabel}</strong></td>
                    <td><strong>${this.formatCurrency(totalOrigem)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        `;
      })
      .join('');

    const linhasTotais = Object.entries(agrupadosPorTipo)
      .map(
        ([tipo, total]) => `
        <tr>
          <td>${tipo}</td>
          <td>${this.formatCurrency(total)}</td>
        </tr>
      `
      )
      .join('');

    const reportTimestamp = this.getReportTimestamp();
    const reportTitle = 'Fechamento';

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1f2937; background: #fff; font-size: 12px; }
            h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; color: #0f172a; }
            .print-actions { text-align: right; margin-bottom: 12px; }
            .print-actions button { padding: 8px 16px; border: none; background: #2563eb; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
            .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
            .logo-area,
            .header-spacer { flex: 0 0 200px; display: flex; justify-content: flex-start; align-items: center; }
            .header-spacer { visibility: hidden; }
            .logo-area img { max-height: 60px; width: auto; display: block; }
            .title-area { flex: 1; text-align: center; }
            .subheader { color: #64748b; font-size: 12px; margin-top: 4px; }
            .origin-section { margin-top: 24px; page-break-inside: avoid; }
            .origin-title { font-weight: 600; text-transform: uppercase; font-size: 12px; margin-bottom: 8px; color: #1e293b; }
            .table-wrapper { border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
            tr:last-child td { border-bottom: none; }
            th { background-color: #f8fafc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #475569; }
            .origin-summary { text-align: right; font-weight: 600; margin-top: 8px; color: #0f172a; }
            .origin-type-summary { margin-top: 12px; }
            .origin-type-summary-title { font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 4px; text-transform: uppercase; }
            .origin-type-summary table { width: auto; border-collapse: collapse; font-size: 11px; }
            .origin-type-summary th,
            .origin-type-summary td { border: 1px solid #e2e8f0; padding: 4px 10px; text-align: left; }
            .origin-type-summary th { background-color: #f8fafc; color: #475569; }
            .totals { margin-top: 32px; }
            .totals h2 { font-size: 14px; margin-bottom: 8px; color: #0f172a; }
            .totals table { width: auto; border-collapse: collapse; font-size: 12px; }
            .totals th, .totals td { border: 1px solid #e2e8f0; padding: 6px 12px; text-align: left; }
            footer { margin-top: 32px; text-align: right; color: #94a3b8; font-size: 11px; }
            @media print { .print-actions { display: none; } body { margin: 0 20px 60px; } footer { position: fixed; bottom: 12px; left: 20px; right: 20px; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button onclick="window.print()">Imprimir</button>
          </div>
          <header class="report-header">
            <div class="logo-area">${logoHtml}</div>
            <div class="title-area">
              <h1>${reportTitle}</h1>
              <div class="subheader">
                Período: ${this.formatReportDate(this.dataInicialFilter)} até ${this.formatReportDate(
                  this.dataFinalFilter
                )} |
                Unidade: ${this.unidadeFilter || 'Todas'}
              </div>
            </div>
            <div class="header-spacer">&nbsp;</div>
          </header>
          ${secoesPorOrigem}
          <div class="totals">
            <h2>Totais por tipo de baixa</h2>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${linhasTotais}
                <tr>
                  <td><strong>Total Geral</strong></td>
                  <td><strong>${this.formatCurrency(totalGeral)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer>
            Relatório gerado em ${new Date().toLocaleString('pt-BR')}
          </footer>
        </body>
      </html>
    `);
    popup.document.close();
    popup.document.title = `${reportTitle} ${reportTimestamp}`;
    popup.focus();
  }
  onValorBlur(type: 'min' | 'max'): void {
    const value = type === 'min' ? this.valorMinFilter : this.valorMaxFilter;
    const parsed = this.parseValorFilter(value);
    if (parsed !== null) {
      const formatted = parsed.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      if (type === 'min') {
        this.valorMinFilter = formatted;
      } else {
        this.valorMaxFilter = formatted;
      }
    } else if (!value) {
      if (type === 'min') {
        this.valorMinFilter = '';
      } else {
        this.valorMaxFilter = '';
      }
    }
  }

  private applyLocalFilters(items: Baixa[]): Baixa[] {
    let filtered = [...items];

    const unidadeFiltroNormalizada = this.normalizeUnidade(this.unidadeFilter);
    if (unidadeFiltroNormalizada) {
      filtered = filtered.filter(
        baixa => this.normalizeUnidade(baixa.venda?.unidade) === unidadeFiltroNormalizada
      );
    }

    if (this.origemFilter) {
      filtered = filtered.filter(baixa => baixa.venda?.origem === this.origemFilter);
    }

    if (this.protocoloFilter.trim()) {
      const protocolo = this.protocoloFilter.trim().toLowerCase();
      filtered = filtered.filter(baixa => baixa.venda?.protocolo?.toLowerCase().includes(protocolo));
    }

    if (this.clienteFilter.trim()) {
      const cliente = this.clienteFilter.trim().toLowerCase();
      filtered = filtered.filter(baixa => baixa.venda?.cliente?.toLowerCase().includes(cliente));
    }

    const valorMin = this.parseValorFilter(this.valorMinFilter);
    const valorMax = this.parseValorFilter(this.valorMaxFilter);

    if (valorMin !== null) {
      filtered = filtered.filter(baixa => (baixa.valorBaixa || 0) >= valorMin);
    }
    if (valorMax !== null) {
      filtered = filtered.filter(baixa => (baixa.valorBaixa || 0) <= valorMax);
    }

    return filtered;
  }

  private resolveVendaFromBaixa(baixa: Baixa): Venda | null {
    if (baixa.idvenda) {
      const cachedVenda = this.vendaCache.get(baixa.idvenda);
      if (cachedVenda) {
        return cachedVenda;
      }
    }
    return baixa.venda || null;
  }

  private parseValorFilter(value: string | number): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const valueAsString = typeof value === 'number' ? value.toString() : value.trim();

    if (!valueAsString) {
      return null;
    }

    const normalized = valueAsString.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  private normalizeUnidade(value: string | Unidade | null | undefined): string {
    if (!value) {
      return '';
    }
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  getOrigemLabel(origem: VendaOrigem | undefined | null): string {
    switch (origem) {
      case VendaOrigem.GOIANIA:
        return 'Goiânia';
      case VendaOrigem.UBERABA:
        return 'Uberaba';
      case VendaOrigem.NEROPOLIS:
        return 'Nerópolis';
      case VendaOrigem.OUTRO:
        return 'Outro';
      default:
        return '-';
    }
  }

  private formatDateDisplay(value?: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private async enrichBaixasWithVendas(baixas: Baixa[]): Promise<Baixa[]> {
    const requests: Record<string, Promise<Venda>> = {};

    baixas.forEach(baixa => {
      const vendaId = baixa.idvenda;
      if (!vendaId) {
        return;
      }

      const hasDetailedVenda =
        !!baixa.venda &&
        typeof baixa.venda.valorCliente === 'number' &&
        typeof baixa.venda.status === 'string';

      if (hasDetailedVenda && !this.vendaCache.has(vendaId)) {
        this.vendaCache.set(vendaId, baixa.venda as Venda);
      }

      if (!this.vendaCache.has(vendaId)) {
        requests[vendaId] = firstValueFrom(this.vendaService.getVendaById(vendaId));
      }
    });

    const requestEntries = Object.entries(requests);
    if (requestEntries.length > 0) {
      const response = await Promise.all(
        requestEntries.map(([id, promise]) => promise.then(data => [id, data] as const))
      );
      response.forEach(([id, venda]) => this.vendaCache.set(id, venda));
    }

    return baixas.map(baixa => {
      if (baixa.idvenda) {
        const venda = this.vendaCache.get(baixa.idvenda);
        if (venda) {
          return {
            ...baixa,
            venda
          };
        }
      }
      return baixa;
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    this.loadBaixas(page);
  }

  formatCurrency(value: number | undefined | null): string {
    if (!value && value !== 0) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;
  }

  private formatReportDate(date: string | null | undefined): string {
    if (!date) {
      return '-';
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return date;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
}
