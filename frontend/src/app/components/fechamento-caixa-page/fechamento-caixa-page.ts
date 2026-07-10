import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { FechamentoCaixaService } from '../../services/fechamento-caixa.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { VendaOrigem } from '../../models/venda.model';
import {
  CaixaBaixaDetalhe,
  CaixaErpPagamentoDetalhe,
  CaixaFechamentoStatus,
  CaixaFechamentoStatusExibicao,
  CaixaFormaTotalLinha,
  FechamentoCaixaDetalhado,
  FechamentoConsolidado,
  FechamentoFormaBloco,
  formaBlocoFechamento,
  ordenarFormasFechamentoCaixa,
  ordenarLinhasErpNoBloco,
  FORMAS_FECHAMENTO_CAIXA,
} from '../../models/fechamento-caixa.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-fechamento-caixa-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './fechamento-caixa-page.html',
  styleUrls: ['./fechamento-caixa-page.css'],
})
export class FechamentoCaixaPageComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly fechamentoCaixaService = inject(FechamentoCaixaService);
  private readonly pageContextService = inject(PageContextService);
  private readonly errorModalService = inject(ErrorModalService);
  private readonly configuracaoService = inject(ConfiguracaoService);

  unidades = Object.values(Unidade);
  unidade: Unidade | '' = '';
  data = '';
  unidadeBloqueada = false;
  configuracao: Configuracao | null = null;

  loading = false;
  saving = false;
  importandoErp = false;
  gerandoRelatorio = false;
  error = '';
  success = '';

  consolidado: FechamentoConsolidado | null = null;
  totalDespesas = 0;
  totalRetirada = 0;
  totalDespesasDisplay = '0,00';
  totalRetiradaDisplay = '0,00';

  showFecharCaixaModal = false;
  fecharCaixaModalMensagem = '';

  ngOnInit(): void {
    this.pageContextService.setContext({
      title: 'Fechamento de Caixa',
      description: 'Consolide ERP e baixas de terceiro por unidade e data.',
    });
    this.inicializarUnidade();
    this.data = this.resolverDataPadrao();
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => (this.configuracao = config),
      error: () => (this.configuracao = null),
    });
    this.onFiltroChange();
  }

  ngOnDestroy(): void {
    this.pageContextService.resetContext();
  }

  canBuscarErp(): boolean {
    return this.canFecharCaixa();
  }

  canFecharCaixa(): boolean {
    return this.authService.hasPermission(Permission.VENDA_FECHAR_CAIXA);
  }

  canReabrirCaixa(): boolean {
    return this.authService.hasPermission(Permission.VENDA_REABRIR_CAIXA);
  }

  onFiltroChange(): void {
    if (!this.unidade || !this.data) {
      this.consolidado = null;
      this.error = '';
      this.success = '';
      return;
    }
    this.carregarConsolidado();
  }

  irParaDiaAnterior(): void {
    this.alterarDataEmDias(-1);
  }

  irParaProximoDia(): void {
    this.alterarDataEmDias(1);
  }

  carregarConsolidado(): void {
    if (!this.unidade || !this.data) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.fechamentoCaixaService
      .obterConsolidado(this.unidade, this.data)
      .subscribe({
        next: (result) => {
          this.consolidado = result;
          this.totalDespesas = result.totalDespesas;
          this.totalRetirada = result.totalRetirada;
          this.syncMonetariosExibicao();
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err?.error?.message || 'Não foi possível carregar o fechamento.';
        },
      });
  }

  atualizarVendasErp(): void {
    if (!this.unidade || !this.data) {
      this.error = 'Informe unidade e data antes de buscar o ERP.';
      return;
    }

    if (!this.consolidado?.podeEditar) {
      return;
    }

    this.importandoErp = true;
    this.error = '';
    this.success = '';

    this.fechamentoCaixaService
      .importarCaixaErp({
        unidade: this.unidade,
        dataInicio: this.data,
        dataFim: this.data,
      })
      .subscribe({
        next: () => {
          this.importandoErp = false;
          this.success = 'Vendas do ERP atualizadas com sucesso.';
          this.carregarConsolidado();
        },
        error: (err) => {
          this.importandoErp = false;
          this.error =
            err?.error?.message ||
            'Não foi possível atualizar as vendas do ERP.';
        },
      });
  }

  salvarRascunho(): void {
    if (!this.unidade || !this.data || !this.consolidado?.podeEditar) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';

    this.fechamentoCaixaService
      .salvarRascunho({
        unidade: this.unidade,
        data: this.data,
        totalDespesas: this.totalDespesas,
        totalRetirada: this.totalRetirada,
      })
      .subscribe({
        next: (result) => {
          this.consolidado = result;
          this.totalDespesas = result.totalDespesas;
          this.totalRetirada = result.totalRetirada;
          this.syncMonetariosExibicao();
          this.saving = false;
          this.success = 'Salvo com sucesso.';
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message || 'Erro ao salvar.';
        },
      });
  }

  confirmarFechamento(): void {
    if (!this.unidade || !this.data || !this.consolidado?.podeConfirmar) {
      return;
    }

    this.fecharCaixaModalMensagem =
      `Deseja fechar o caixa de ${this.formatDateDisplay(this.data)} (${this.unidade})? Após o fechamento, despesas e retiradas não poderão ser alteradas até reabrir.`;
    this.showFecharCaixaModal = true;
  }

  onCancelarFecharCaixaModal(): void {
    this.showFecharCaixaModal = false;
  }

  onConfirmarFecharCaixaModal(): void {
    this.showFecharCaixaModal = false;

    if (!this.unidade || !this.data || !this.consolidado?.podeConfirmar) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';

    this.fechamentoCaixaService
      .salvarRascunho({
        unidade: this.unidade,
        data: this.data,
        totalDespesas: this.totalDespesas,
        totalRetirada: this.totalRetirada,
      })
      .subscribe({
        next: () => {
          this.fechamentoCaixaService
            .confirmarFechamento(this.unidade as Unidade, this.data)
            .subscribe({
              next: (result) => {
                this.consolidado = result;
                this.saving = false;
                this.success = 'Caixa fechado com sucesso.';
              },
              error: (err) => {
                this.saving = false;
                this.error =
                  err?.error?.message || 'Erro ao fechar caixa.';
              },
            });
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message || 'Erro ao salvar antes de fechar o caixa.';
        },
      });
  }

  reabrirFechamento(): void {
    if (
      !this.unidade ||
      !this.data ||
      !this.canReabrirCaixa() ||
      !this.consolidado?.podeReabrir
    ) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';

    this.fechamentoCaixaService
      .reabrirFechamento(this.unidade, this.data)
      .subscribe({
        next: (result) => {
          this.consolidado = result;
          this.saving = false;
          this.success = 'Fechamento reaberto.';
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message || 'Erro ao reabrir fechamento.';
          this.errorModalService.show(this.error, 'Reabrir fechamento');
        },
      });
  }

  getLinhaFormaOrigemLabel(forma: string, origem: string): string {
    return `${forma} ${this.getOrigemLabel(origem)}`;
  }

  getErpLinhas(bloco: FechamentoFormaBloco): CaixaFormaTotalLinha[] {
    if (bloco.erpLinhas?.length) {
      return bloco.erpLinhas;
    }
    if (bloco.erp) {
      return [
        {
          forma: bloco.forma,
          qtd: bloco.erp.qtd,
          liquido: bloco.erp.liquido,
        },
      ];
    }
    return [];
  }

  getLinhaErp(
    bloco: FechamentoFormaBloco,
    forma: string,
  ): CaixaFormaTotalLinha | null {
    return this.getErpLinhas(bloco).find((linha) => linha.forma === forma) ?? null;
  }

  getStatusLabel(status?: CaixaFechamentoStatusExibicao): string {
    if (status === 'FECHADO') {
      return 'Fechado';
    }
    if (status === 'BLOQUEADO') {
      return 'Bloqueado';
    }
    if (status === 'RASCUNHO') {
      return 'Aberto';
    }
    return '-';
  }

  getStatusRelatorioClass(status?: CaixaFechamentoStatusExibicao): string {
    if (status === 'FECHADO') {
      return 'status-confirmado';
    }
    if (status === 'BLOQUEADO') {
      return 'status-bloqueado';
    }
    if (status === 'RASCUNHO') {
      return 'status-aberto';
    }
    return '';
  }

  private montarStatusRelatorioHtml(
    consolidado: FechamentoConsolidado,
  ): string {
    const label = this.getStatusLabel(consolidado.statusExibicao);
    const classe = this.getStatusRelatorioClass(consolidado.statusExibicao);

    return `
      <div class="caixa-status-relatorio">
        <span class="status-badge-relatorio ${classe}">
          ${this.escapeHtml(label)}
        </span>
      </div>
    `;
  }

  isCaixaFechado(consolidado: FechamentoConsolidado | null): boolean {
    return consolidado?.statusExibicao === 'FECHADO';
  }

  imprimirCaixa(): void {
    if (!this.consolidado) {
      this.errorModalService.show(
        'Selecione unidade e data com fechamento carregado para gerar o relatório.',
        'Aviso',
      );
      return;
    }

    const conteudo = this.montarConteudoRelatorioCaixa(this.consolidado);
    this.abrirJanelaRelatorio('Caixa', conteudo, this.consolidado, 'resumido');
  }

  imprimirCaixaDetalhado(): void {
    if (!this.consolidado || !this.unidade || !this.data) {
      this.errorModalService.show(
        'Selecione unidade e data com fechamento carregado para gerar o relatório.',
        'Aviso',
      );
      return;
    }

    this.gerandoRelatorio = true;
    this.fechamentoCaixaService
      .obterCaixaDetalhado(this.unidade, this.data)
      .subscribe({
        next: (detalhado) => {
          this.gerandoRelatorio = false;
          const conteudo = this.montarConteudoRelatorioCaixaDetalhado(
            detalhado,
            this.consolidado!,
          );
          this.abrirJanelaRelatorio(
            'Caixa Detalhado',
            conteudo,
            this.consolidado!,
            'detalhado',
          );
        },
        error: (err) => {
          this.gerandoRelatorio = false;
          this.errorModalService.show(
            err?.error?.message ||
              'Não foi possível carregar os detalhes para o relatório.',
            'Caixa Detalhado',
          );
        },
      });
  }

  private montarConteudoRelatorioCaixa(consolidado: FechamentoConsolidado): string {
    const saldoFinal =
      this.isCaixaFechado(consolidado)
        ? consolidado.saldoFinalDinheiro
        : this.saldoFinalCalculado;

    const blocosHtml = this.formasOrdenadas
      .map((bloco) => this.montarCardRelatorioResumido(bloco, consolidado, saldoFinal))
      .join('');

    const rodapeFechamento = this.montarRodapeFechamentoRelatorio(consolidado);

    return `
      ${this.montarStatusRelatorioHtml(consolidado)}
      <div class="caixa-dia-titulo">
        Caixa dia ${this.formatDateDisplay(consolidado.data)} ${this.escapeHtml(consolidado.unidade)}
      </div>
      <div class="forma-blocos-stack">${blocosHtml}</div>
      ${rodapeFechamento}
    `;
  }

  private montarRodapeFechamentoRelatorio(
    consolidado: FechamentoConsolidado,
  ): string {
    if (!this.isCaixaFechado(consolidado) || !consolidado.confirmadoPorNome) {
      return '';
    }

    return `
      <p class="caixa-fechado-por">
        Fechado por: ${this.escapeHtml(consolidado.confirmadoPorNome)}
      </p>
    `;
  }

  private montarCardRelatorioResumido(
    bloco: FechamentoFormaBloco,
    consolidado: FechamentoConsolidado,
    saldoFinal: number | null,
  ): string {
    const linhas: string[] = [];

    if (bloco.forma === 'DINHEIRO') {
      linhas.push(
        this.renderLinhaValorRelatorio(
          'Saldo em caixa',
          this.formatCurrency(consolidado.saldoInicial),
        ),
      );

      const linhaDinheiro = this.getLinhaErp(bloco, 'DINHEIRO');
      if (linhaDinheiro) {
        linhas.push(
          this.renderLinhaValorRelatorio(
            'DINHEIRO',
            this.formatCurrency(linhaDinheiro.liquido),
          ),
        );
      }

      bloco.terceiroPorOrigem.forEach((item) => {
        linhas.push(
          this.renderLinhaValorRelatorio(
            this.getLinhaFormaOrigemLabel('DINHEIRO', item.origem),
            this.formatCurrency(item.liquido),
          ),
        );
      });

      const linhaConvenio = this.getLinhaErp(bloco, 'CONVENIO-DINHEIRO');
      if (linhaConvenio) {
        linhas.push(
          this.renderLinhaValorRelatorio(
            'CONVENIO-DINHEIRO',
            this.formatCurrency(linhaConvenio.liquido),
          ),
        );
      }

      linhas.push(
        this.renderLinhaValorRelatorio(
          'SAIDAS/DESPESAS',
          this.formatCurrency(this.totalDespesas),
        ),
        this.renderLinhaValorRelatorio(
          'FECHAMENTO',
          this.formatCurrency(this.totalRetirada),
        ),
        this.renderLinhaValorRelatorio(
          'TOTAL FECHAMENTO',
          this.formatCurrency(this.calcularTotalFechamento()),
          'destaque',
        ),
        this.renderLinhaValorRelatorio(
          'FICOU NO CAIXA',
          this.formatCurrency(saldoFinal),
        ),
        this.renderLinhaValorRelatorio(
          'TOTAL SAIDAS',
          this.formatCurrency(this.totalEntradasDinheiro),
          'destaque',
        ),
        this.renderLinhaSeparadorRelatorio(),
        this.renderLinhaValorRelatorio(
          'DIFERENÇA',
          this.formatCurrency(this.calcularDiferencaCaixa(saldoFinal)),
          'destaque',
        ),
      );
    } else {
      this.getErpLinhas(bloco).forEach((linha) => {
        linhas.push(
          this.renderLinhaValorRelatorio(
            linha.forma,
            this.formatCurrency(linha.liquido),
          ),
        );
      });

      bloco.terceiroPorOrigem.forEach((item) => {
        linhas.push(
          this.renderLinhaValorRelatorio(
            this.getLinhaFormaOrigemLabel(bloco.forma, item.origem),
            this.formatCurrency(item.liquido),
          ),
        );
      });

      linhas.push(
        this.renderLinhaValorRelatorio(
          `TOTAL ${this.getFormaTitulo(bloco.forma).toUpperCase()}`,
          this.formatCurrency(bloco.totalForma),
          'destaque',
        ),
      );
    }

    return `
      <article class="forma-bloco ${this.getFormaCardClass(bloco.forma)}">
        <div class="forma-bloco-header">
          <h2 class="forma-titulo">
            <span class="forma-icone" aria-hidden="true">
              <i class="fas ${this.getFormaIcon(bloco.forma)}"></i>
            </span>
            ${this.escapeHtml(this.getFormaTitulo(bloco.forma))}
          </h2>
        </div>
        <table class="forma-tabela">
          <tbody>${linhas.join('')}</tbody>
        </table>
      </article>
    `;
  }

  private calcularTotalFechamento(): number {
    return (
      Math.round((this.totalDespesas + this.totalRetirada) * 100) / 100
    );
  }

  private calcularDiferencaCaixa(saldoFinal: number | null): number {
    return (
      Math.round(
        (this.totalEntradasDinheiro -
          this.calcularTotalFechamento() -
          (saldoFinal ?? 0)) *
          100,
      ) / 100
    );
  }

  private renderLinhaSeparadorRelatorio(): string {
    return `
      <tr class="linha-separador">
        <td colspan="2">&nbsp;</td>
      </tr>
    `;
  }

  private montarConteudoRelatorioCaixaDetalhado(
    detalhado: FechamentoCaixaDetalhado,
    consolidado: FechamentoConsolidado,
  ): string {
    const blocosHtml = [...FORMAS_FECHAMENTO_CAIXA]
      .map((formaBloco) =>
        this.montarBlocoRelatorioDetalhado(
          formaBloco,
          detalhado,
          consolidado,
        ),
      )
      .join('');

    const formasOrdenadasResumo = ordenarFormasFechamentoCaixa(consolidado.formas);
    let totalDia = 0;

    const linhasResumo = formasOrdenadasResumo
      .map((bloco) => {
        const valorResumo = bloco.totalForma ?? 0;
        totalDia += valorResumo;
        const rotulo = `Total ${this.getFormaTitulo(bloco.forma)}`;

        return `
          <tr>
            <td>${this.escapeHtml(rotulo)}</td>
            <td class="valor">${this.formatCurrency(valorResumo)}</td>
          </tr>
        `;
      })
      .join('');

    const linhaTotalDia = `
      <tr class="total-final">
        <td>Total do dia</td>
        <td class="valor">${this.formatCurrency(Math.round(totalDia * 100) / 100)}</td>
      </tr>
    `;

    return `
      ${blocosHtml}
      <section class="detalhe-bloco resumo-total">
        <h2 class="detalhe-bloco-titulo">Resumo total</h2>
        <table class="detalhe-table resumo-table">
          <tbody>${linhasResumo}${linhaTotalDia}</tbody>
        </table>
      </section>
    `;
  }

  private montarBlocoRelatorioDetalhado(
    formaBloco: string,
    detalhado: FechamentoCaixaDetalhado,
    consolidado: FechamentoConsolidado,
  ): string {
    const blocoConsolidado = consolidado.formas.find(
      (item) => item.forma === formaBloco,
    );
    const secoes: string[] = [];

    const erpPorForma = this.agruparErpPorFormaNoBloco(
      detalhado.erpPagamentos,
      formaBloco,
    );
    for (const [formaErp, pagamentos] of erpPorForma) {
      secoes.push(
        this.montarSubsecaoDetalheRelatorio(
          formaErp,
          pagamentos,
          (pagamento) => `
            <tr>
              <td>${this.escapeHtml(this.formatReferenciaErpPagamento(pagamento))}</td>
              <td>${this.escapeHtml(pagamento.clienteNome || '-')}</td>
              <td class="valor">${this.formatCurrency(pagamento.valorLiquido)}</td>
            </tr>
          `,
          ['Requisição', 'Cliente', 'Valor'],
        ),
      );
    }

    const baixasPorOrigem = this.agruparBaixasPorOrigemNoBloco(
      detalhado.baixas,
      formaBloco,
    );
    for (const [origem, baixas] of baixasPorOrigem) {
      secoes.push(
        this.montarSubsecaoDetalheRelatorio(
          this.getLinhaFormaOrigemLabel(formaBloco, origem),
          baixas,
          (baixa) => `
            <tr>
              <td>${this.escapeHtml(baixa.protocolo)}</td>
              <td>${this.escapeHtml(baixa.clienteNome || '-')}</td>
              <td class="valor">${this.formatCurrency(baixa.valorBaixa)}</td>
            </tr>
          `,
          ['Protocolo', 'Cliente', 'Valor'],
        ),
      );
    }

    const totalBloco = blocoConsolidado?.totalForma ?? 0;
    const tituloBloco = this.getFormaTitulo(formaBloco);

    if (secoes.length === 0) {
      secoes.push(
        `<p class="secao-vazia">Nenhum registro encontrado para ${this.escapeHtml(this.getFormaTitulo(formaBloco))}.</p>`,
      );
    }

    const rodapeBloco = this.montarRodapeTotalQuebraRelatorio(
      formaBloco,
      totalBloco,
    );

    return `
      <section class="detalhe-bloco">
        <h2 class="detalhe-bloco-titulo">${this.escapeHtml(tituloBloco)}</h2>
        ${secoes.join('')}
        ${rodapeBloco}
      </section>
    `;
  }

  private montarRodapeTotalQuebraRelatorio(
    formaBloco: string,
    total: number,
  ): string {
    return `
      <table class="detalhe-table bloco-total-table">
        <tfoot>
          <tr class="subtotal">
            <td colspan="2">Total ${this.escapeHtml(this.getFormaTitulo(formaBloco))}</td>
            <td class="valor">${this.formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  private montarSubsecaoDetalheRelatorio<T extends { valorBaixa?: number; valorLiquido?: number }>(
    titulo: string,
    itens: T[],
    renderLinha: (item: T) => string,
    colunas: string[],
  ): string {
    const total = Math.round(
      itens.reduce(
        (acc, item) =>
          acc + Number(item.valorBaixa ?? item.valorLiquido ?? 0),
        0,
      ) * 100,
    ) / 100;

    const linhas =
      itens.length > 0
        ? itens.map(renderLinha).join('')
        : `<tr class="no-data-row"><td colspan="${colunas.length}">Nenhum registro.</td></tr>`;

    const cabecalho = colunas
      .map((coluna) =>
        coluna === 'Valor'
          ? `<th class="valor">${coluna}</th>`
          : `<th>${coluna}</th>`,
      )
      .join('');

    const idxTotal = colunas.findIndex((coluna) => coluna === 'Valor');
    const indiceTotal = idxTotal >= 0 ? idxTotal : colunas.length - 1;
    const colspanAntes = indiceTotal;
    const colspanDepois = colunas.length - indiceTotal - 1;
    const celulasDepois =
      colspanDepois > 0 ? `<td colspan="${colspanDepois}"></td>` : '';

    return `
      <section class="detalhe-subsecao">
        <h3>${this.escapeHtml(titulo)}</h3>
        <table class="detalhe-table">
          <thead><tr>${cabecalho}</tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr class="subtotal">
              <td colspan="${colspanAntes}">Total</td>
              <td class="valor">${this.formatCurrency(total)}</td>
              ${celulasDepois}
            </tr>
          </tfoot>
        </table>
      </section>
    `;
  }

  private agruparErpPorFormaNoBloco(
    pagamentos: CaixaErpPagamentoDetalhe[],
    formaBloco: string,
  ): Array<[string, CaixaErpPagamentoDetalhe[]]> {
    const mapa = new Map<string, CaixaErpPagamentoDetalhe[]>();

    pagamentos
      .filter(
        (pagamento) =>
          formaBlocoFechamento(pagamento.formaNormalizada) === formaBloco,
      )
      .forEach((pagamento) => {
        const forma = pagamento.formaNormalizada;
        const atual = mapa.get(forma) ?? [];
        atual.push(pagamento);
        mapa.set(forma, atual);
      });

    return [...mapa.entries()].sort(([a], [b]) =>
      ordenarLinhasErpNoBloco(a, b),
    );
  }

  private agruparBaixasPorOrigemNoBloco(
    baixas: CaixaBaixaDetalhe[],
    formaBloco: string,
  ): Array<[string, CaixaBaixaDetalhe[]]> {
    const mapa = new Map<string, CaixaBaixaDetalhe[]>();

    baixas
      .filter((baixa) => baixa.tipoDaBaixa === formaBloco)
      .forEach((baixa) => {
        const atual = mapa.get(baixa.origem) ?? [];
        atual.push(baixa);
        mapa.set(baixa.origem, atual);
      });

    return [...mapa.entries()].sort(([origemA], [origemB]) =>
      this.getOrigemLabel(origemA).localeCompare(
        this.getOrigemLabel(origemB),
        'pt-BR',
      ),
    );
  }

  private renderLinhaValorRelatorio(
    rotulo: string,
    valor: string,
    classeExtra = '',
  ): string {
    return `
      <tr class="${classeExtra}">
        <td>${this.escapeHtml(rotulo)}</td>
        <td class="valor">${valor}</td>
      </tr>
    `;
  }

  private abrirJanelaRelatorio(
    titulo: string,
    conteudoHtml: string,
    consolidado: FechamentoConsolidado,
    tipo: 'resumido' | 'detalhado' = 'resumido',
  ): void {
    const popup = window.open('', '_blank', 'width=1200,height=800');
    if (!popup) {
      this.errorModalService.show(
        'Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.',
        'Erro',
      );
      return;
    }

    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo do sistema" />` : '';
    const currentUser = this.authService.getCurrentUser();
    const usuarioLabel =
      currentUser?.nome || currentUser?.email || 'Usuário não identificado';
    const geradoEm = new Date().toLocaleString('pt-BR');

    const corpoResumido = `
      <div class="print-actions">
        <button onclick="window.print()">Imprimir PDF</button>
      </div>
      <div class="relatorio-caixa-conteudo">${conteudoHtml}</div>
    `;

    const corpoDetalhado = `
      <div class="print-actions">
        <button onclick="window.print()">Imprimir PDF</button>
      </div>
      <header class="report-header">
        <div class="logo-area">${logoHtml}</div>
        <div class="title-area">
          <h1>${this.escapeHtml(titulo)}</h1>
          <div class="subheader">
            Unidade: ${this.escapeHtml(consolidado.unidade)} | Data: ${this.formatDateDisplay(consolidado.data)} | Status: ${this.getStatusLabel(consolidado.statusExibicao)}
          </div>
        </div>
        <div class="header-spacer">&nbsp;</div>
      </header>
      ${conteudoHtml}
      <footer>Gerado em ${geradoEm} por ${this.escapeHtml(usuarioLabel)}</footer>
    `;

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${this.escapeHtml(titulo)}</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
          <style>${this.getEstilosRelatorio(tipo)}</style>
        </head>
        <body class="${tipo === 'resumido' ? 'relatorio-resumido' : 'relatorio-detalhado'}">
          ${tipo === 'resumido' ? corpoResumido : corpoDetalhado}
        </body>
      </html>
    `);
    popup.document.close();
  }

  private getEstilosRelatorio(tipo: 'resumido' | 'detalhado'): string {
    const base = `
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #334155; background: #fff; font-size: 12px; }
      h1 { margin: 0; font-size: 20px; color: #0f172a; }
      h2, h3 { margin: 0; color: #0f172a; }
      .print-actions { text-align: right; margin-bottom: 12px; }
      .print-actions button { padding: 8px 16px; border: none; background: #2563eb; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
      .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
      .logo-area, .header-spacer { flex: 0 0 200px; display: flex; align-items: center; }
      .header-spacer { visibility: hidden; }
      .logo-area img { max-height: 60px; width: auto; }
      .title-area { flex: 1; text-align: center; }
      .subheader { color: #64748b; font-size: 12px; margin-top: 4px; }
      footer { margin-top: 24px; text-align: right; color: #94a3b8; font-size: 11px; }
      @media print { .print-actions { display: none; } body { margin: 0 16px 40px; } }
    `;

    if (tipo === 'detalhado') {
      return `${base}
        h2.detalhe-bloco-titulo { font-size: 1rem; font-weight: 700; margin: 1.25rem 0 0.65rem; padding-bottom: 0.35rem; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; letter-spacing: 0.03em; }
        h3 { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 0.45rem; }
        .detalhe-bloco { margin-bottom: 1rem; page-break-inside: avoid; }
        .detalhe-bloco:first-of-type .detalhe-bloco-titulo { margin-top: 0; }
        .detalhe-subsecao { margin-top: 0.85rem; }
        .detalhe-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 0.35rem; }
        .detalhe-table th, .detalhe-table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
        .detalhe-table th { font-weight: 600; color: #334155; background: #f8fafc; }
        .detalhe-table td.valor, .detalhe-table th.valor { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .detalhe-table tfoot tr.subtotal td { font-weight: 600; background: #f8fafc; border-top: 1px dashed #cbd5e1; }
        .detalhe-table tr.total-final td { font-weight: 700; border-top: 1px solid #94a3b8; }
        .bloco-total-table { margin-top: 0.35rem; margin-bottom: 0; }
        .resumo-table { max-width: 480px; }
        .resumo-total { margin-top: 1.5rem; padding-top: 0.5rem; border-top: 2px solid #94a3b8; }
        .no-data-row td { text-align: center; color: #64748b; font-style: italic; }
        .secao-vazia { margin: 0.35rem 0 0.75rem; color: #64748b; font-style: italic; font-size: 0.85rem; }
      `;
    }

    return `${base}
      body.relatorio-resumido { margin: 6px; font-size: 10px; }
      .relatorio-caixa-conteudo { width: 35%; max-width: 35%; margin: 0 auto; }
      .caixa-status-relatorio { text-align: center; margin: 0 0 0.35rem; }
      .status-badge-relatorio { display: inline-flex; align-items: center; padding: 0.2rem 0.65rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border: 1px solid transparent; }
      .status-badge-relatorio.status-confirmado { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
      .status-badge-relatorio.status-aberto { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
      .status-badge-relatorio.status-bloqueado { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
      .caixa-dia-titulo { font-size: 0.85rem; font-weight: 700; color: #0f172a; margin: 0 0 0.5rem; padding: 0.15rem 0; border: none; background: transparent; text-transform: uppercase; letter-spacing: 0.01em; text-align: center; }
      .forma-blocos-stack { display: flex; flex-direction: column; gap: 0.9rem; align-items: stretch; }
      .forma-bloco { border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; overflow: hidden; page-break-inside: avoid; max-width: 100%; width: 100%; }
      .forma-bloco-header { display: flex; justify-content: flex-start; align-items: center; padding: 0.18rem 0.35rem; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
      .forma-titulo { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase; margin: 0; }
      .forma-icone { display: inline-flex; align-items: center; justify-content: center; width: 1.45rem; height: 1.45rem; border-radius: 6px; font-size: 0.78rem; flex-shrink: 0; }
      .forma-card-dinheiro .forma-icone { background: #ecfdf5; color: #047857; }
      .forma-card-cartao .forma-icone { background: #eff6ff; color: #1d4ed8; }
      .forma-card-deposito .forma-icone { background: #f5f3ff; color: #6d28d9; }
      .forma-tabela { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #d1d5db; }
      .forma-tabela td { padding: 0.12rem 0.4rem; font-size: 0.76rem; color: #1e293b; line-height: 1.4; vertical-align: middle; border: 1px solid #d1d5db; }
      .forma-tabela td:first-child { width: 62%; text-align: center; text-transform: uppercase; font-weight: 500; letter-spacing: 0.01em; }
      .forma-tabela td.valor { width: 38%; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; font-weight: 600; }
      .forma-tabela tr.destaque td { font-weight: 700; background: #f8fafc; color: #0f172a; }
      .forma-tabela tr.destaque td.valor { font-weight: 700; }
      .forma-tabela tr.linha-separador td { height: 0.45rem; padding: 0; background: #fff; border-left: 1px solid #d1d5db; border-right: 1px solid #d1d5db; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
      .caixa-fechado-por { margin: 0.75rem 0 0; padding: 0; font-size: 0.76rem; font-weight: 600; color: #334155; text-align: center; }
      @media print {
        body.relatorio-resumido { margin: 0; }
        .relatorio-caixa-conteudo { width: 35%; max-width: 35%; margin: 0 auto; }
      }
    `;
  }

  private formatReferenciaErpPagamento(
    pagamento: CaixaErpPagamentoDetalhe,
  ): string {
    if (pagamento.referenciaRequisicao?.trim()) {
      return pagamento.referenciaRequisicao.trim();
    }
    if (pagamento.numeroRequisicao != null) {
      return String(pagamento.numeroRequisicao);
    }
    if (pagamento.descricaoProduto?.trim()) {
      return pagamento.descricaoProduto.trim();
    }
    return '-';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getOrigemLabel(origem: string): string {
    switch (origem as VendaOrigem) {
      case VendaOrigem.GOIANIA:
        return 'Goiânia';
      case VendaOrigem.INHUMAS:
        return 'Inhumas';
      case VendaOrigem.UBERABA:
        return 'Uberaba';
      case VendaOrigem.NEROPOLIS:
        return 'Nerópolis';
      case VendaOrigem.RIBEIRAO_PRETO:
        return 'Ribeirão Preto';
      case VendaOrigem.OUTRO:
        return 'Outro';
      default:
        return origem;
    }
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }

  onMonetarioInput(value: string, campo: 'despesas' | 'retirada'): void {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const numerico = digits === '' ? 0 : parseInt(digits, 10) / 100;

    if (campo === 'despesas') {
      this.totalDespesas = numerico;
      this.totalDespesasDisplay = this.formatCurrencyInputDisplay(numerico);
      return;
    }

    this.totalRetirada = numerico;
    this.totalRetiradaDisplay = this.formatCurrencyInputDisplay(numerico);
  }

  onMonetarioBlur(campo: 'despesas' | 'retirada'): void {
    if (campo === 'despesas') {
      this.totalDespesasDisplay = this.formatCurrencyInputDisplay(this.totalDespesas);
      return;
    }
    this.totalRetiradaDisplay = this.formatCurrencyInputDisplay(this.totalRetirada);
  }

  onMonetarioFocus(campo: 'despesas' | 'retirada'): void {
    const display =
      campo === 'despesas' ? this.totalDespesasDisplay : this.totalRetiradaDisplay;
    if (display === '0,00') {
      if (campo === 'despesas') {
        this.totalDespesasDisplay = '';
      } else {
        this.totalRetiradaDisplay = '';
      }
    }
  }

  private syncMonetariosExibicao(): void {
    this.totalDespesasDisplay = this.formatCurrencyInputDisplay(this.totalDespesas);
    this.totalRetiradaDisplay = this.formatCurrencyInputDisplay(this.totalRetirada);
  }

  private formatCurrencyInputDisplay(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  }

  formatDateDisplay(value?: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  getFormaTitulo(forma: string): string {
    switch (forma) {
      case 'DINHEIRO':
        return 'Dinheiro';
      case 'CARTÃO/PIX':
        return 'Cartão';
      case 'DEPOSITO':
        return 'Depósito';
      default:
        return forma;
    }
  }

  getFormaIcon(forma: string): string {
    switch (forma) {
      case 'DINHEIRO':
        return 'fa-money-bill-wave';
      case 'CARTÃO/PIX':
        return 'fa-credit-card';
      case 'DEPOSITO':
        return 'fa-university';
      default:
        return 'fa-wallet';
    }
  }

  getFormaCardClass(forma: string): string {
    switch (forma) {
      case 'DINHEIRO':
        return 'forma-card-dinheiro';
      case 'CARTÃO/PIX':
        return 'forma-card-cartao';
      case 'DEPOSITO':
        return 'forma-card-deposito';
      default:
        return '';
    }
  }

  get formasOrdenadas(): FechamentoFormaBloco[] {
    if (!this.consolidado) {
      return [];
    }
    return ordenarFormasFechamentoCaixa(this.consolidado.formas);
  }

  get totalEntradasDinheiro(): number {
    if (!this.consolidado) return 0;
    const dinheiro =
      this.consolidado.formas.find((f) => f.forma === 'DINHEIRO')?.totalForma ??
      0;
    return (
      Math.round(
        (this.consolidado.saldoInicial + dinheiro) * 100,
      ) / 100
    );
  }

  get saldoFinalCalculado(): number {
    return (
      Math.round(
        (this.totalEntradasDinheiro - this.totalDespesas - this.totalRetirada) *
          100,
      ) / 100
    );
  }

  get diferencaCaixa(): number {
    const saldoFinal = this.isCaixaFechado(this.consolidado)
      ? this.consolidado!.saldoFinalDinheiro
      : this.saldoFinalCalculado;
    return this.calcularDiferencaCaixa(saldoFinal);
  }

  private inicializarUnidade(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade?.trim()) {
      this.unidade = currentUser.unidade as Unidade;
      this.unidadeBloqueada = true;
    }
  }

  private resolverDataPadrao(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private alterarDataEmDias(delta: number): void {
    if (!this.data) {
      return;
    }

    const [year, month, day] = this.data.split('-').map(Number);
    const proximaData = new Date(year, month - 1, day + delta);
    const y = proximaData.getFullYear();
    const m = String(proximaData.getMonth() + 1).padStart(2, '0');
    const d = String(proximaData.getDate()).padStart(2, '0');
    this.data = `${y}-${m}-${d}`;
    this.onFiltroChange();
  }

  private getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.hasLogo) {
      return null;
    }
    return `${environment.apiUrl}/configuracao/logo`;
  }
}
