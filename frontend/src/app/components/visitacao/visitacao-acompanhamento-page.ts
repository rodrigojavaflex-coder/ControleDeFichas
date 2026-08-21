import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { VisitacaoAcompanhamentoService } from '../../services/visitacao-acompanhamento.service';
import {
  FindVisitacaoAcompanhamentoDto,
  NaCarteiraFiltro,
  VisitacaoAcompanhamentoDetalhe,
  VisitacaoAcompanhamentoItem,
  VisitacaoAcompanhamentoOrdem,
  VisitacaoAcompanhamentoOrdenarPor,
  VisitacaoAcompanhamentoTotais,
  VisitacaoAcompanhamentoTotaisRepresentante,
} from '../../models/visitacao-acompanhamento.model';
import { VisitacaoPainelMedicoRepresentante } from '../../models/visitacao-painel-medico.model';
import { OrcamentoMedicoOpcaoFiltro } from '../../models/orcamento.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';
import { MedicoFilterPickerComponent } from '../medico-filter-picker/medico-filter-picker';

interface AppliedFilter {
  key: string;
  label: string;
  value: string;
}

interface AcompanhamentoFilterSnapshot {
  dataInicial: string;
  dataFinal: string;
  nomesMedico: string[];
  crmMedico: string;
  ufCrmMedico: string;
  funcionarioId: string;
  unidade: string;
  naCarteira: NaCarteiraFiltro;
}

type RelatorioForma = 'analitico' | 'sintetico';
type RelatorioMovimento = 'todos' | 'recebido' | 'rejeitado';

interface RelatorioImpressaoOpcoes {
  forma: RelatorioForma;
  movimento: RelatorioMovimento;
}

const TOTAIS_VAZIOS: VisitacaoAcompanhamentoTotais = {
  valorRecebido: 0,
  quantidadeRecebido: 0,
  valorRejeitado: 0,
  quantidadeRejeitado: 0,
  quantidadeMedicos: 0,
};

@Component({
  selector: 'app-visitacao-acompanhamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent, MedicoFilterPickerComponent],
  templateUrl: './visitacao-acompanhamento-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    './visitacao-painel-medico-page.css',
    './visitacao-acompanhamento-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class VisitacaoAcompanhamentoPageComponent implements OnInit {
  private service = inject(VisitacaoAcompanhamentoService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private errorModalService = inject(ErrorModalService);
  private configuracaoService = inject(ConfiguracaoService);

  readonly medicoOrdenacaoOpcoes = [
    { value: 'total' as const, label: 'Mais movimentos' },
    { value: 'aprovados' as const, label: 'Mais recebidos' },
    { value: 'rejeitados' as const, label: 'Mais rejeitados' },
    { value: 'alfabetica' as const, label: 'Ordem alfabética' },
  ];

  configuracao: Configuracao | null = null;
  items: VisitacaoAcompanhamentoItem[] = [];
  totais: VisitacaoAcompanhamentoTotais = { ...TOTAIS_VAZIOS };
  totaisPorRepresentante: VisitacaoAcompanhamentoTotaisRepresentante[] = [];
  representantesVinculados: VisitacaoPainelMedicoRepresentante[] = [];
  opcoesMedico: OrcamentoMedicoOpcaoFiltro[] = [];
  selectedMedicos = new Set<string>();
  loading = false;
  loadingRepresentantes = false;
  loadingOpcoesMedico = false;
  imprimindo = false;
  error = '';

  currentPage = 1;
  pageSize = 50;
  totalItems = 0;
  totalPages = 0;

  dataInicialFilter = '';
  dataFinalFilter = '';
  crmMedicoFilter = '';
  ufCrmMedicoFilter = '';
  funcionarioIdFilter = '';
  unidadeFilter: Unidade | '' = '';
  naCarteiraFilter: NaCarteiraFiltro = 'todos';
  sortField: VisitacaoAcompanhamentoOrdenarPor = 'valorRecebido';
  sortDirection: VisitacaoAcompanhamentoOrdem = 'desc';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  filtersPanelOpen = false;
  private appliedFiltersSnapshot: AcompanhamentoFilterSnapshot =
    this.createFilterSnapshot();

  detalheAberto = false;
  carregandoDetalhe = false;
  detalhe: VisitacaoAcompanhamentoDetalhe | null = null;
  medicoDetalhe: VisitacaoAcompanhamentoItem | null = null;

  showPrintModal = false;
  printForma: RelatorioForma = 'analitico';
  printMovimento: RelatorioMovimento = 'todos';

  ngOnInit(): void {
    if (!this.canRead()) {
      this.error = 'Você não possui permissão para visualizar o acompanhamento.';
      this.errorModalService.show(this.error, 'Acesso Negado');
      return;
    }

    this.pageContextService.setContext({
      title: 'Acompanhamento Visitação',
      description:
        'Recebidos e rejeitados da carteira (painel), inclusive quando o movimento ocorre em outra unidade.',
    });

    this.initializeDateFilters();
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
      Permission.VISITACAO_ACOMPANHAMENTO_READ,
    );
  }

  get cardsResumo(): VisitacaoAcompanhamentoTotaisRepresentante[] {
    if (!this.totaisPorRepresentante.length) {
      return [];
    }
    return [
      {
        nomeRepresentante: 'Total',
        valorRecebido: this.totais.valorRecebido,
        quantidadeRecebido: this.totais.quantidadeRecebido,
        valorRejeitado: this.totais.valorRejeitado,
        quantidadeRejeitado: this.totais.quantidadeRejeitado,
        quantidadeMedicos: this.totais.quantidadeMedicos,
      },
      ...this.totaisPorRepresentante,
    ];
  }

  get processamentoAtivo(): boolean {
    return this.loading || this.imprimindo;
  }

  get tituloProcessamento(): string {
    return this.imprimindo ? 'Preparando impressão' : 'Buscando acompanhamento';
  }

  get subtituloProcessamento(): string {
    return this.imprimindo
      ? 'Aguarde enquanto montamos o relatório com os filtros atuais.'
      : '';
  }

  get appliedFilters(): AppliedFilter[] {
    const filters: AppliedFilter[] = [];
    const s = this.appliedFiltersSnapshot;

    if (s.dataInicial || s.dataFinal) {
      const from = s.dataInicial ? this.formatarData(s.dataInicial) : '';
      const to = s.dataFinal ? this.formatarData(s.dataFinal) : '';
      filters.push({
        key: 'periodo',
        label: 'Período',
        value: from && to ? `${from} a ${to}` : from || to,
      });
    }
    if (s.nomesMedico.length) {
      filters.push({
        key: 'nomesMedico',
        label: 'Médicos',
        value:
          s.nomesMedico.length <= 2
            ? s.nomesMedico.join(', ')
            : `${s.nomesMedico.length} selecionado(s)`,
      });
    }
    if (s.crmMedico.trim()) {
      filters.push({ key: 'crmMedico', label: 'CRM', value: s.crmMedico.trim() });
    }
    if (s.ufCrmMedico.trim()) {
      filters.push({
        key: 'ufCrmMedico',
        label: 'UF',
        value: s.ufCrmMedico.trim().toUpperCase(),
      });
    }
    if (s.funcionarioId) {
      const rep = this.representantesVinculados.find((r) => r.id === s.funcionarioId);
      filters.push({
        key: 'funcionarioId',
        label: 'Representante',
        value: rep?.nome ?? s.funcionarioId,
      });
    }
    if (s.naCarteira !== 'todos') {
      filters.push({
        key: 'naCarteira',
        label: 'No Painel',
        value: s.naCarteira === 'sim' ? 'Sim' : 'Não',
      });
    }
    if (s.unidade && !this.unidadeDisabled) {
      filters.push({ key: 'unidade', label: 'Unidade', value: s.unidade });
    }

    return filters;
  }

  private buildFindDto(page: number, limit: number): FindVisitacaoAcompanhamentoDto {
    const s = this.appliedFiltersSnapshot;
    const filters: FindVisitacaoAcompanhamentoDto = {
      page,
      limit,
      dataInicial: s.dataInicial,
      dataFinal: s.dataFinal,
    };

    if (s.nomesMedico.length) filters.nomesMedico = [...s.nomesMedico];
    if (s.crmMedico.trim()) filters.crmMedico = s.crmMedico.trim();
    if (s.ufCrmMedico.trim()) filters.ufCrmMedico = s.ufCrmMedico.trim().toUpperCase();
    if (s.funcionarioId) filters.funcionarioId = s.funcionarioId;
    if (s.naCarteira !== 'todos') filters.naCarteira = s.naCarteira;
    if (s.unidade) filters.unidade = s.unidade as Unidade;
    filters.ordenarPor = this.sortField;
    filters.ordem = this.sortDirection;

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

  /** Mês corrente: dia 1 até o último dia do mês (data local). */
  private initializeDateFilters(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.dataInicialFilter = `${year}-${pad(month + 1)}-01`;
    this.dataFinalFilter = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  }

  private createFilterSnapshot(): AcompanhamentoFilterSnapshot {
    return {
      dataInicial: this.dataInicialFilter || '',
      dataFinal: this.dataFinalFilter || '',
      nomesMedico: Array.from(this.selectedMedicos),
      crmMedico: this.crmMedicoFilter || '',
      ufCrmMedico: this.ufCrmMedicoFilter || '',
      funcionarioId: this.funcionarioIdFilter || '',
      unidade: this.unidadeFilter || '',
      naCarteira: this.naCarteiraFilter,
    };
  }

  private updateAppliedFiltersSnapshot(): void {
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
  }

  onDateRangeChange(range: DateRangeValue): void {
    this.dataInicialFilter = range.start;
    this.dataFinalFilter = range.end;
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
    if (!this.canRead() || this.loading) return;
    const s = this.appliedFiltersSnapshot;
    if (!s.dataInicial || !s.dataFinal) {
      this.initializeDateFilters();
      this.updateAppliedFiltersSnapshot();
    }

    this.loading = true;
    this.error = '';
    this.filtersPanelOpen = false;

    this.service.findAll(this.buildFindDto(this.currentPage, this.pageSize)).subscribe({
      next: (response) => {
        this.items = response.data;
        this.totais = response.totais ?? { ...TOTAIS_VAZIOS };
        this.totaisPorRepresentante = response.totaisPorRepresentante ?? [];
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.totaisPorRepresentante = [];
        this.totais = { ...TOTAIS_VAZIOS };
        this.errorModalService.show(
          'Erro ao carregar o acompanhamento da visitação.',
          'Erro',
        );
      },
    });
  }

  abrirDetalhe(item: VisitacaoAcompanhamentoItem): void {
    if (!this.canRead() || this.carregandoDetalhe || this.processamentoAtivo) return;
    const s = this.appliedFiltersSnapshot;
    this.medicoDetalhe = item;
    this.detalhe = null;
    this.detalheAberto = true;
    this.carregandoDetalhe = true;

    this.service
      .detalhe({
        unidade: item.unidade,
        crmMedico: item.crmMedico,
        ufCrmMedico: item.ufCrmMedico,
        dataInicial: s.dataInicial,
        dataFinal: s.dataFinal,
        nomeMedico: item.nomeMedico,
      })
      .subscribe({
        next: (data) => {
          this.detalhe = data;
          this.carregandoDetalhe = false;
        },
        error: () => {
          this.carregandoDetalhe = false;
          this.errorModalService.show(
            'Erro ao carregar o detalhe do movimento.',
            'Erro',
          );
        },
      });
  }

  fecharDetalhe(): void {
    this.detalheAberto = false;
    this.detalhe = null;
    this.medicoDetalhe = null;
    this.carregandoDetalhe = false;
  }

  get totalDetalheRecebido(): number {
    return (
      this.detalhe?.recebidos.reduce((acc, rec) => acc + (rec.valorPago || 0), 0) ?? 0
    );
  }

  get totalDetalheRejeitado(): number {
    return (
      this.detalhe?.rejeitados.reduce((acc, rej) => acc + (rej.precoVenda || 0), 0) ?? 0
    );
  }

  onRowKey(event: KeyboardEvent, item: VisitacaoAcompanhamentoItem): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.abrirDetalhe(item);
    }
  }

  imprimir(): void {
    this.openPrintModal();
  }

  openPrintModal(): void {
    if (!this.canRead() || this.processamentoAtivo) return;
    if (this.totalItems === 0) {
      this.errorModalService.show(
        'Nenhum médico para imprimir com os filtros atuais.',
        'Impressão',
      );
      return;
    }
    this.printForma = 'analitico';
    this.printMovimento = 'todos';
    this.showPrintModal = true;
  }

  closePrintModal(): void {
    if (this.imprimindo) return;
    this.showPrintModal = false;
  }

  confirmGerarRelatorio(): void {
    if (!this.canRead() || this.processamentoAtivo) return;

    const opcoes: RelatorioImpressaoOpcoes = {
      forma: this.printForma,
      movimento: this.printMovimento,
    };
    this.showPrintModal = false;
    this.imprimindo = true;

    this.fetchAllForPrint().subscribe({
      next: (listagem) => {
        this.imprimindo = false;
        const itens = this.filtrarItensMovimento(listagem.rows, opcoes.movimento);
        if (itens.length === 0) {
          this.errorModalService.show(
            'Nenhum médico para imprimir com as opções escolhidas.',
            'Impressão',
          );
          return;
        }
        this.abrirJanelaImpressao(
          'Acompanhamento Visitação',
          this.montarHtmlImpressao(itens, opcoes),
        );
      },
      error: () => {
        this.imprimindo = false;
        this.errorModalService.show(
          'Erro ao preparar impressão do acompanhamento.',
          'Impressão',
        );
      },
    });
  }

  imprimirDetalheAtual(): void {
    if (!this.canRead() || !this.detalhe || !this.medicoDetalhe) return;
    this.abrirJanelaImpressao(
      'Detalhe do acompanhamento',
      this.montarHtmlImpressaoDetalheMedico(this.medicoDetalhe, this.detalhe),
    );
  }

  private fetchAllForPrint(): Observable<{
    rows: VisitacaoAcompanhamentoItem[];
    totais: VisitacaoAcompanhamentoTotais;
    totaisPorRepresentante: VisitacaoAcompanhamentoTotaisRepresentante[];
  }> {
    const dto = this.buildFindDto(1, this.pageSize);
    dto.todos = true;
    return this.service.findAll(dto).pipe(
      map((response) => ({
        rows: response.data,
        totais: response.totais,
        totaisPorRepresentante: response.totaisPorRepresentante ?? [],
      })),
    );
  }

  private montarHtmlImpressao(
    items: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    const agrupado = this.agruparPorRepresentanteEUnidade(items);
    const corpo =
      opcoes.forma === 'sintetico'
        ? this.montarCorpoSintetico(agrupado, items, opcoes)
        : this.montarCorpoAnalitico(agrupado, items, opcoes);

    return this.montarShellRelatorio(
      'Acompanhamento Visitação',
      [
        `${this.rotuloFormaRelatorio(opcoes.forma)} · ${this.rotuloMovimentoRelatorio(opcoes.movimento)}`,
      ],
      corpo,
    );
  }

  private montarCorpoAnalitico(
    agrupado: Array<{
      representante: string;
      unidades: Array<[Unidade, VisitacaoAcompanhamentoItem[]]>;
    }>,
    items: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    const blocos = agrupado
      .map((grupo, indexRep) => {
        const itensRep = grupo.unidades.flatMap(([, lista]) => lista);
        const blocosUnidade = grupo.unidades
          .map(([unidade, lista], indexUnidade) =>
            this.blocoUnidadeImpressao(
              unidade,
              lista,
              grupo.representante,
              opcoes,
              indexRep > 0 && indexUnidade === 0,
            ),
          )
          .join('\n');
        return `<section class="rep-section">
  <div class="rep-title">Representante: ${this.escapeHtml(grupo.representante)}</div>
  ${blocosUnidade}
  ${this.tabelaTotaisAnalitico(
    `Total ${grupo.representante} · ${this.formatarQtdMedicos(itensRep.length)}`,
    itensRep,
    opcoes,
  )}
</section>`;
      })
      .join('\n');

    const totalGeral = this.tabelaTotaisAnalitico(
      `Total geral · ${this.formatarQtdMedicos(items.length)}`,
      items,
      opcoes,
    );

    return `${blocos}${totalGeral}`;
  }

  private montarCorpoSintetico(
    agrupado: Array<{
      representante: string;
      unidades: Array<[Unidade, VisitacaoAcompanhamentoItem[]]>;
    }>,
    items: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    const cabecalho = this.cabecalhoSintetico(opcoes);
    const blocos = agrupado
      .map((grupo) => {
        const itensRep = grupo.unidades.flatMap(([, lista]) => lista);
        const linhas = grupo.unidades
          .map(([unidade, lista]) => {
            const foraCarteira = lista.some((i) => i.movimentoForaCarteira);
            const rotuloUnidade =
              foraCarteira && grupo.representante !== 'Sem representante'
                ? `${unidade} (outra unidade)`
                : unidade;
            return `<tr>
          <td>${this.escapeHtml(rotuloUnidade)}</td>
          <td class="num">${lista.length}</td>
          ${this.celulasValoresTotais(lista, opcoes)}
        </tr>`;
          })
          .join('\n');
        return `<section class="rep-section">
  <div class="rep-title">Representante: ${this.escapeHtml(grupo.representante)}</div>
  <table class="lista-funcionarios-table">
    <thead>${cabecalho}</thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${itensRep.length}</td>
        ${this.celulasValoresTotais(itensRep, opcoes)}
      </tr>
    </tfoot>
  </table>
</section>`;
      })
      .join('\n');

    return `${blocos}
<section class="rep-section">
  <table class="lista-funcionarios-table">
    <thead>${cabecalho}</thead>
    <tbody>
      <tr>
        <td>Total geral</td>
        <td class="num">${items.length}</td>
        ${this.celulasValoresTotais(items, opcoes)}
      </tr>
    </tbody>
  </table>
</section>`;
  }

  private agruparPorRepresentanteEUnidade(
    items: VisitacaoAcompanhamentoItem[],
  ): Array<{
    representante: string;
    unidades: Array<[Unidade, VisitacaoAcompanhamentoItem[]]>;
  }> {
    const porRep = new Map<string, VisitacaoAcompanhamentoItem[]>();
    for (const item of items) {
      const chave = item.nomeRepresentante?.trim() || 'Sem representante';
      const atual = porRep.get(chave) ?? [];
      atual.push(item);
      porRep.set(chave, atual);
    }

    return Array.from(porRep.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([representante, lista]) => ({
        representante,
        unidades: this.agruparPorUnidade(lista),
      }));
  }

  private agruparPorUnidade(
    items: VisitacaoAcompanhamentoItem[],
  ): Array<[Unidade, VisitacaoAcompanhamentoItem[]]> {
    const grouped = new Map<Unidade, VisitacaoAcompanhamentoItem[]>();
    for (const item of items) {
      const atual = grouped.get(item.unidade) ?? [];
      atual.push(item);
      grouped.set(item.unidade, atual);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  private blocoUnidadeImpressao(
    unidade: Unidade,
    lista: VisitacaoAcompanhamentoItem[],
    representante: string,
    opcoes: RelatorioImpressaoOpcoes,
    novaPagina = false,
  ): string {
    const ordenada = [...lista].sort((a, b) => this.compararParaImpressao(a, b));
    const linhas = ordenada
      .map(
        (item) => `<tr>
          <td>${this.escapeHtml(item.nomeMedico)}</td>
          <td>${this.escapeHtml(this.formatCrm(item))}</td>
          <td>${this.escapeHtml(item.naCarteira ? 'Sim' : 'Não')}</td>
          <td>${item.movimentoForaCarteira ? 'Sim' : 'Não'}</td>
          ${this.celulasValoresItem(item, opcoes)}
        </tr>`,
      )
      .join('\n');

    const classePagina = novaPagina ? ' unit-section-nova-pagina' : '';
    const foraCarteira = lista.some((i) => i.movimentoForaCarteira);
    const tituloUnidade =
      foraCarteira && representante !== 'Sem representante'
        ? `Unidade: ${unidade} (recebido/rejeitado em outra unidade)`
        : `Unidade: ${unidade}`;
    return `<section class="unit-section${classePagina}">
  <div class="unit-title">${this.escapeHtml(tituloUnidade)}</div>
  <table class="lista-funcionarios-table tabela-analitico">
    ${this.colgroupAnalitico(opcoes)}
    <thead>${this.cabecalhoAnalitico(opcoes)}</thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      ${this.linhaTotaisAnalitico(this.formatarQtdMedicos(lista.length), lista, opcoes)}
    </tfoot>
  </table>
</section>`;
  }

  private tabelaTotaisAnalitico(
    rotulo: string,
    lista: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    return `<table class="lista-funcionarios-table tabela-analitico tabela-total-analitico">
    ${this.colgroupAnalitico(opcoes)}
    <tbody>
      ${this.linhaTotaisAnalitico(rotulo, lista, opcoes)}
    </tbody>
  </table>`;
  }

  private colgroupAnalitico(opcoes: RelatorioImpressaoOpcoes): string {
    return `<colgroup>
        <col class="col-medico" />
        <col class="col-crm" />
        <col class="col-painel" />
        <col class="col-outra" />
        ${this.incluirRecebido(opcoes) ? '<col class="col-valor" />' : ''}
        ${this.incluirRejeitado(opcoes) ? '<col class="col-valor" />' : ''}
      </colgroup>`;
  }

  private cabecalhoAnalitico(opcoes: RelatorioImpressaoOpcoes): string {
    return `<tr>
        <th>Médico</th>
        <th>CRM</th>
        <th>No Painel</th>
        <th>Outra unidade</th>
        ${this.incluirRecebido(opcoes) ? '<th class="num">Recebido</th>' : ''}
        ${this.incluirRejeitado(opcoes) ? '<th class="num">Rejeitado</th>' : ''}
      </tr>`;
  }

  private cabecalhoSintetico(opcoes: RelatorioImpressaoOpcoes): string {
    return `<tr>
        <th>Unidade</th>
        <th class="num">Médicos</th>
        ${this.incluirRecebido(opcoes) ? '<th class="num">Recebido</th>' : ''}
        ${this.incluirRejeitado(opcoes) ? '<th class="num">Rejeitado</th>' : ''}
      </tr>`;
  }

  private linhaTotaisAnalitico(
    rotulo: string,
    lista: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    return `<tr>
        <td colspan="4">${this.escapeHtml(rotulo)}</td>
        ${this.celulasValoresTotais(lista, opcoes)}
      </tr>`;
  }

  private celulasValoresItem(
    item: VisitacaoAcompanhamentoItem,
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    const rec = this.incluirRecebido(opcoes)
      ? `<td class="num">${this.escapeHtml(this.formatarMoeda(item.valorRecebido))}</td>`
      : '';
    const rej = this.incluirRejeitado(opcoes)
      ? `<td class="num">${this.escapeHtml(this.formatarMoeda(item.valorRejeitado))}</td>`
      : '';
    return `${rec}${rej}`;
  }

  private celulasValoresTotais(
    lista: VisitacaoAcompanhamentoItem[],
    opcoes: RelatorioImpressaoOpcoes,
  ): string {
    const rec = this.incluirRecebido(opcoes)
      ? `<td class="num">${this.escapeHtml(this.formatarMoeda(this.somarValor(lista, 'valorRecebido')))}</td>`
      : '';
    const rej = this.incluirRejeitado(opcoes)
      ? `<td class="num">${this.escapeHtml(this.formatarMoeda(this.somarValor(lista, 'valorRejeitado')))}</td>`
      : '';
    return `${rec}${rej}`;
  }

  private somarValor(
    lista: VisitacaoAcompanhamentoItem[],
    campo: 'valorRecebido' | 'valorRejeitado',
  ): number {
    return lista.reduce((acc, item) => acc + (item[campo] || 0), 0);
  }

  private filtrarItensMovimento(
    items: VisitacaoAcompanhamentoItem[],
    movimento: RelatorioMovimento,
  ): VisitacaoAcompanhamentoItem[] {
    if (movimento === 'recebido') {
      return items.filter((item) => (item.valorRecebido || 0) > 0);
    }
    if (movimento === 'rejeitado') {
      return items.filter((item) => (item.valorRejeitado || 0) > 0);
    }
    return items;
  }

  private incluirRecebido(opcoes: RelatorioImpressaoOpcoes): boolean {
    return opcoes.movimento !== 'rejeitado';
  }

  private incluirRejeitado(opcoes: RelatorioImpressaoOpcoes): boolean {
    return opcoes.movimento !== 'recebido';
  }

  private formatarQtdMedicos(quantidade: number): string {
    return `${quantidade} ${quantidade === 1 ? 'médico' : 'médicos'}`;
  }

  private rotuloFormaRelatorio(forma: RelatorioForma): string {
    return forma === 'sintetico' ? 'Sintético' : 'Analítico';
  }

  private rotuloMovimentoRelatorio(movimento: RelatorioMovimento): string {
    if (movimento === 'recebido') return 'Recebidos';
    if (movimento === 'rejeitado') return 'Rejeitados';
    return 'Recebidos e rejeitados';
  }

  private montarHtmlImpressaoDetalheMedico(
    item: VisitacaoAcompanhamentoItem,
    detalhe: VisitacaoAcompanhamentoDetalhe,
  ): string {
    const totalRecebido = detalhe.recebidos.reduce((acc, r) => acc + (r.valorPago || 0), 0);
    const totalRejeitado = detalhe.rejeitados.reduce((acc, r) => acc + (r.precoVenda || 0), 0);
    const linhasRec = detalhe.recebidos.length
      ? detalhe.recebidos
          .map(
            (r) => `<tr>
          <td>${this.escapeHtml(this.formatarData(r.dataPagamento))}</td>
          <td>${r.numeroCupom}</td>
          <td>${r.numeroRequisicao}</td>
          <td>${r.numeroOrcamento ?? '—'}</td>
          <td class="num">${this.escapeHtml(this.formatarMoeda(r.valorPago))}</td>
        </tr>`,
          )
          .join('\n')
      : '<tr><td colspan="5">Nenhum recebimento no período</td></tr>';
    const linhasRej = detalhe.rejeitados.length
      ? detalhe.rejeitados
          .map(
            (r) => `<tr>
          <td>${this.escapeHtml(this.formatarData(r.dataOrcamento))}</td>
          <td>${this.escapeHtml(r.nrOrcamento)}</td>
          <td>${this.escapeHtml(r.nomeCliente || '—')}</td>
          <td>${this.escapeHtml(r.motivoRejeicao || 'Sem motivo')}</td>
          <td class="num">${this.escapeHtml(this.formatarMoeda(r.precoVenda))}</td>
        </tr>`,
          )
          .join('\n')
      : '<tr><td colspan="5">Nenhum orçamento rejeitado no período</td></tr>';

    const corpo = `<section class="unit-section">
  <div class="unit-title">${this.escapeHtml(item.nomeMedico)} · ${this.escapeHtml(this.formatCrm(item))} · ${this.escapeHtml(item.unidade)}</div>
  <h3 class="detalhe-print-subtitle">Recebidos no caixa</h3>
  <table class="lista-funcionarios-table">
    <thead>
      <tr><th>Data</th><th>Cupom</th><th>Requisição</th><th>Orçamento</th><th class="num">Valor pago</th></tr>
    </thead>
    <tbody>${linhasRec}</tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>Total recebido</strong></td>
        <td class="num"><strong>${this.escapeHtml(this.formatarMoeda(totalRecebido))}</strong></td>
      </tr>
    </tfoot>
  </table>
  <h3 class="detalhe-print-subtitle">Orçamentos rejeitados</h3>
  <table class="lista-funcionarios-table">
    <thead>
      <tr><th>Data</th><th>Orçamento</th><th>Cliente</th><th>Motivo</th><th class="num">Valor</th></tr>
    </thead>
    <tbody>${linhasRej}</tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>Total rejeitado</strong></td>
        <td class="num"><strong>${this.escapeHtml(this.formatarMoeda(totalRejeitado))}</strong></td>
      </tr>
    </tfoot>
  </table>
</section>`;

    const extraUnidade = item.movimentoForaCarteira
      ? item.unidadeCarteira
        ? ` · movimento em outra unidade (carteira ${item.unidadeCarteira})`
        : ' · movimento em outra unidade'
      : '';
    return this.montarShellRelatorio(
      'Detalhe do acompanhamento',
      [
        `${item.nomeMedico} · ${this.formatCrm(item)} · ${item.unidade}${extraUnidade}`,
        `Recebido: ${this.formatarMoeda(totalRecebido)} · Rejeitado: ${this.formatarMoeda(totalRejeitado)}`,
      ],
      corpo,
    );
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
    .rep-section { margin-top: 28px; }
    .rep-section:first-of-type { margin-top: 0; }
    .rep-title { font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 8px; color: #0f172a; break-after: avoid-page; page-break-after: avoid; }
    .rep-section .unit-section:first-of-type { margin-top: 0; }
    .unit-section:first-of-type { margin-top: 0; }
    .unit-section-nova-pagina { break-before: page; page-break-before: always; margin-top: 0; }
    .unit-title { font-weight: 600; text-transform: uppercase; font-size: 12px; margin-bottom: 6px; color: #1e293b; break-after: avoid-page; page-break-after: avoid; }
    .lista-funcionarios-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .lista-funcionarios-table.tabela-analitico { table-layout: fixed; }
    .lista-funcionarios-table col.col-medico { width: 32%; }
    .lista-funcionarios-table col.col-crm { width: 14%; }
    .lista-funcionarios-table col.col-painel { width: 10%; }
    .lista-funcionarios-table col.col-outra { width: 12%; }
    .lista-funcionarios-table col.col-valor { width: 16%; }
    .lista-funcionarios-table th, .lista-funcionarios-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    .lista-funcionarios-table th { background: #f8fafc; font-weight: 700; color: #1e293b; }
    .lista-funcionarios-table td.num, .lista-funcionarios-table th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .lista-funcionarios-table tfoot td { border-top: 1px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
    .lista-funcionarios-table tr:last-child td { border-bottom: none; }
    .tabela-total-analitico { margin-top: 8px; }
    .tabela-total-analitico td { border-top: 1px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
    .detalhe-print-subtitle { font-size: 12px; margin: 14px 0 6px; color: #334155; break-after: avoid-page; page-break-after: avoid; }
    footer { text-align: right; font-size: 10px; color: #4a5568; margin-top: 32px; }
    @page { size: A4; margin: 12mm 15mm 28mm 15mm; }
    @media print {
      .print-actions { display: none; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .report-header { break-after: avoid-page; page-break-after: avoid; }
      .lista-funcionarios-table thead { display: table-header-group; }
      footer {
        position: fixed; bottom: 0; left: 0; right: 0; margin: 0;
        padding: 0 15mm 10mm; text-align: right; font-size: 10px; color: #4a5568; background: #fff;
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
    if (s.dataInicial || s.dataFinal) {
      partes.push(
        `Período: ${this.formatarData(s.dataInicial)} a ${this.formatarData(s.dataFinal)}`,
      );
    }
    if (s.nomesMedico.length) {
      partes.push(
        s.nomesMedico.length <= 2
          ? `Médicos: ${s.nomesMedico.join(', ')}`
          : `Médicos: ${s.nomesMedico.length} selecionado(s)`,
      );
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
    }
    if (s.naCarteira !== 'todos') {
      partes.push(`No Painel: ${s.naCarteira === 'sim' ? 'Sim' : 'Não'}`);
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
    if (this.processamentoAtivo || page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadItems();
  }

  onSort(field: VisitacaoAcompanhamentoOrdenarPor): void {
    if (this.processamentoAtivo) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection =
        field === 'valorRecebido' || field === 'valorRejeitado' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.loadItems();
  }

  private compararParaImpressao(
    a: VisitacaoAcompanhamentoItem,
    b: VisitacaoAcompanhamentoItem,
  ): number {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const valorA = this.valorOrdenacao(a, this.sortField);
    const valorB = this.valorOrdenacao(b, this.sortField);
    if (typeof valorA === 'number' && typeof valorB === 'number') {
      return (valorA - valorB) * dir;
    }
    return (
      String(valorA).localeCompare(String(valorB), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    );
  }

  private valorOrdenacao(
    item: VisitacaoAcompanhamentoItem,
    campo: VisitacaoAcompanhamentoOrdenarPor,
  ): string | number {
    switch (campo) {
      case 'unidade':
        return item.unidade;
      case 'nomeMedico':
        return item.nomeMedico;
      case 'crmMedico':
        return item.crmMedico;
      case 'nomeRepresentante':
        return item.nomeRepresentante ?? '';
      case 'naCarteira':
        return item.naCarteira ? 1 : 0;
      case 'valorRecebido':
        return item.valorRecebido;
      case 'valorRejeitado':
        return item.valorRejeitado;
    }
  }

  toggleFiltersVisibility(): void {
    if (this.processamentoAtivo) return;
    this.filtersPanelOpen = !this.filtersPanelOpen;
    if (this.filtersPanelOpen) {
      this.loadOpcoesMedico();
    }
  }

  onMedicosSelected(medicos: Set<string>): void {
    this.selectedMedicos = medicos;
  }

  loadOpcoesMedico(): void {
    if (!this.dataInicialFilter || !this.dataFinalFilter) {
      this.initializeDateFilters();
    }
    this.loadingOpcoesMedico = true;
    const dto: FindVisitacaoAcompanhamentoDto = {
      dataInicial: this.dataInicialFilter,
      dataFinal: this.dataFinalFilter,
    };
    if (this.unidadeFilter) dto.unidade = this.unidadeFilter as Unidade;
    if (this.crmMedicoFilter.trim()) dto.crmMedico = this.crmMedicoFilter.trim();
    if (this.ufCrmMedicoFilter.trim()) {
      dto.ufCrmMedico = this.ufCrmMedicoFilter.trim().toUpperCase();
    }
    if (this.funcionarioIdFilter) dto.funcionarioId = this.funcionarioIdFilter;
    if (this.naCarteiraFilter !== 'todos') dto.naCarteira = this.naCarteiraFilter;

    this.service.opcoesFiltro(dto).subscribe({
      next: (opcoes) => {
        this.opcoesMedico = opcoes.medicos;
        this.loadingOpcoesMedico = false;
      },
      error: () => {
        this.loadingOpcoesMedico = false;
      },
    });
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
    if (this.processamentoAtivo) return;
    if (!this.dataInicialFilter || !this.dataFinalFilter) {
      this.initializeDateFilters();
    }
    this.currentPage = 1;
    this.updateAppliedFiltersSnapshot();
    this.filtersPanelOpen = false;
    this.loadRepresentantes();
    this.loadItems();
  }

  clearFilters(): void {
    if (this.processamentoAtivo) return;
    this.selectedMedicos = new Set();
    this.crmMedicoFilter = '';
    this.ufCrmMedicoFilter = '';
    this.funcionarioIdFilter = '';
    this.naCarteiraFilter = 'todos';
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    this.initializeDateFilters();
    this.sortField = 'valorRecebido';
    this.sortDirection = 'desc';
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
    if (this.processamentoAtivo) return;
    switch (key) {
      case 'periodo':
        this.dataInicialFilter = '';
        this.dataFinalFilter = '';
        this.initializeDateFilters();
        break;
      case 'nomesMedico':
        this.selectedMedicos = new Set();
        break;
      case 'crmMedico':
        this.crmMedicoFilter = '';
        break;
      case 'ufCrmMedico':
        this.ufCrmMedicoFilter = '';
        break;
      case 'funcionarioId':
        this.funcionarioIdFilter = '';
        break;
      case 'naCarteira':
        this.naCarteiraFilter = 'todos';
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
    if (key === 'periodo') return false;
    return true;
  }

  formatCrm(item: { crmMedico: string; ufCrmMedico: string }): string {
    return `${item.crmMedico}/${item.ufCrmMedico}`;
  }

  labelRepresentanteOption(rep: VisitacaoPainelMedicoRepresentante): string {
    return `${rep.nome} (${rep.painelCodigoRepresentante})`;
  }

  formatarData(data: string | null | undefined): string {
    if (!data) return '—';
    const s = data.includes('T') ? data.split('T')[0] : data.slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }

  formatarMoeda(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '—';
    return Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }
}
