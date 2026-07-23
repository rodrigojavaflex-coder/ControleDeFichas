import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoProdutividadeService } from '../../services/producao-produtividade.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ProdutividadeAnaliticoLinha,
  ProdutividadeConsultaResponse,
  ProdutividadeFuncionarioRow,
  ProdutividadeFuncionarioSemCadastro,
  ProdutividadeFuncionarioSemEtapaVinculada,
  ProdutividadeTipoRelatorio,
  PRODUTIVIDADE_TIPOS_RELATORIO,
} from '../../models/producao-produtividade.model';
import { PRODUCAO_COD_ETAPA_GESTAO } from '../../models/producao-config.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';
import { environment } from '../../../environments/environment';

interface ProdutividadeColunaEtapa {
  codEtapa: string;
  etapa: string;
}

@Component({
  selector: 'app-producao-produtividade-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-produtividade-page.html',
  styleUrls: ['./producao-produtividade-page.css'],
})
export class ProducaoProdutividadePage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private produtividadeService = inject(ProducaoProdutividadeService);
  private configuracaoService = inject(ConfiguracaoService);

  Unidade = Unidade;
  unidades = Object.values(Unidade);
  MESES_PT = MESES_PT;
  nomeMesPt = nomeMesPt;
  anosOpcoes: number[] = [];

  selectedUnidades = new Set<Unidade>();
  unidadeDisabled = false;
  mes = new Date().getMonth() + 1;
  ano = new Date().getFullYear();
  dataInicio = '';
  dataFim = '';

  carregando = false;
  resultado: ProdutividadeConsultaResponse | null = null;
  colunasEtapas: ProdutividadeColunaEtapa[] = [];
  funcionarioExpandidoId: string | null = null;
  modalAvisosAberto = false;
  modalRelatorioAberto = false;
  tipoRelatorioSelecionado: ProdutividadeTipoRelatorio = 'resumida';
  gerandoRelatorio = false;
  tiposRelatorio = PRODUTIVIDADE_TIPOS_RELATORIO;
  private configRelatorio: Configuracao | null = null;

  private moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Produtividade',
      description:
        'Contabiliza etapas concluídas no período conforme remuneração configurada e etapas de cada funcionário.',
    });
    void this.inicializarPagina();
  }

  private async inicializarPagina(): Promise<void> {
    try {
      await this.auth.refreshCurrentUserProfile();
    } catch {
      // Mantém usuário em cache se o profile não estiver disponível.
    }
    this.initializeUnidadeFilter();
    this.inicializarAnosOpcoes();
    this.definirPeriodoMesAtual();
    this.carregarConfigRelatorio();
    this.atualizarConsultaPorFiltros();
  }

  private carregarConfigRelatorio(): void {
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => {
        this.configRelatorio = config;
      },
      error: () => {
        this.configRelatorio = null;
      },
    });
  }

  onCompetenciaChange(): void {
    this.aplicarCompetenciaSelecionada();
    this.atualizarConsultaPorFiltros();
  }

  navegarMesAnterior(): void {
    this.navegarMes(-1);
  }

  navegarMesProximo(): void {
    this.navegarMes(1);
  }

  abrirModalAvisos(): void {
    if (!this.podeVerAlertas() || !this.temAvisos()) return;
    this.modalAvisosAberto = true;
  }

  fecharModalAvisos(): void {
    this.modalAvisosAberto = false;
  }

  abrirModalRelatorio(): void {
    if (!this.resultado) return;
    this.tipoRelatorioSelecionado = 'resumida';
    this.modalRelatorioAberto = true;
  }

  fecharModalRelatorio(): void {
    if (this.gerandoRelatorio) return;
    this.modalRelatorioAberto = false;
  }

  gerarRelatorio(): void {
    if (!this.resultado || this.gerandoRelatorio) return;

    if (this.tipoRelatorioSelecionado === 'analitico') {
      this.gerandoRelatorio = true;
      this.produtividadeService
        .consultarAnalitico({
          unidades: Array.from(this.selectedUnidades),
          dataInicio: this.dataInicio,
          dataFim: this.dataFim,
        })
        .subscribe({
          next: (analitico) => {
            this.gerandoRelatorio = false;
            this.fecharModalRelatorio();
            this.imprimirRelatorioAnalitico(analitico.linhas);
          },
          error: (e) => {
            this.gerandoRelatorio = false;
            this.errors.show(
              e?.error?.message ?? 'Erro ao gerar relatório analítico.',
              'Produção',
            );
          },
        });
      return;
    }

    this.fecharModalRelatorio();
    if (this.tipoRelatorioSelecionado === 'sintetico') {
      this.imprimirRelatorioSintetico();
    } else {
      this.imprimirRelatorioResumida();
    }
  }

  primeiroNome(nome: string): string {
    const t = nome?.trim();
    if (!t) return '—';
    return t.split(/\s+/)[0] ?? t;
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_PRODUTIVIDADE_READ);
  }

  podeVerAlertas(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_PRODUTIVIDADE_READ_ALERTAS);
  }

  podeSelecionarMultiplasUnidades(): boolean {
    return !this.unidadeDisabled;
  }

  podeConsultar(): boolean {
    return this.filtrosValidosParaConsulta() && !this.carregando;
  }

  private filtrosValidosParaConsulta(): boolean {
    return (
      this.podeLer() &&
      this.selectedUnidades.size > 0 &&
      this.mes >= 1 &&
      this.mes <= 12 &&
      this.ano > 0 &&
      !!this.dataInicio &&
      !!this.dataFim
    );
  }

  toggleUnidade(unidade: Unidade, checked: boolean): void {
    if (this.unidadeDisabled) return;
    if (checked) {
      this.selectedUnidades.add(unidade);
    } else {
      this.selectedUnidades.delete(unidade);
    }
    this.atualizarConsultaPorFiltros();
  }

  toggleTodasUnidades(): void {
    if (this.unidadeDisabled) return;
    const todasSelecionadas =
      this.selectedUnidades.size === this.unidades.length;
    if (todasSelecionadas) {
      this.selectedUnidades.clear();
    } else {
      this.unidades.forEach((u) => this.selectedUnidades.add(u));
    }
    this.atualizarConsultaPorFiltros();
  }

  limparUnidades(): void {
    if (this.unidadeDisabled) return;
    this.selectedUnidades.clear();
    this.atualizarConsultaPorFiltros();
  }

  onUnidadesContainerClick(event: MouseEvent): void {
    if (this.unidadeDisabled) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest('.unidade-item') ||
      target.closest('.filter-section-actions') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }
    this.toggleTodasUnidades();
  }

  consultar(): void {
    if (!this.filtrosValidosParaConsulta()) return;
    this.carregando = true;
    this.resultado = null;
    this.colunasEtapas = [];
    this.funcionarioExpandidoId = null;
    this.modalAvisosAberto = false;
    this.produtividadeService
      .consultar({
        unidades: Array.from(this.selectedUnidades),
        dataInicio: this.dataInicio,
        dataFim: this.dataFim,
      })
      .subscribe({
        next: (res) => {
          this.resultado = res;
          this.colunasEtapas = this.montarColunasEtapas(res);
          this.carregando = false;
        },
        error: (e) => {
          this.carregando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao consultar produtividade.',
            'Produção',
          );
        },
      });
  }

  alternarExpansao(f: ProdutividadeFuncionarioRow): void {
    const chave = this.chaveFuncionario(f);
    this.funcionarioExpandidoId =
      this.funcionarioExpandidoId === chave ? null : chave;
  }

  aoClicarLinhaGrid(f: ProdutividadeFuncionarioRow): void {
    this.alternarExpansao(f);
  }

  quantidadeCelula(
    f: ProdutividadeFuncionarioRow,
    codEtapa: string,
  ): number | null {
    const etapa = f.etapas.find((e) => e.codEtapa === codEtapa);
    if (!etapa || etapa.quantidade <= 0) return null;
    return etapa.quantidade;
  }

  totalColunaEtapa(codEtapa: string): number {
    if (!this.resultado) return 0;
    return this.resultado.funcionarios.reduce((acc, f) => {
      const qtd = this.quantidadeCelula(f, codEtapa);
      return acc + (qtd ?? 0);
    }, 0);
  }

  totalGeralValor(): number {
    return this.resultado?.resumo.totalValor ?? 0;
  }

  colspanGridDetalhe(): number {
    return this.colunasEtapas.length + 2;
  }

  estaExpandido(f: ProdutividadeFuncionarioRow): boolean {
    return this.funcionarioExpandidoId === this.chaveFuncionario(f);
  }

  exibirUnidadeNoCard(): boolean {
    return (this.resultado?.unidades.length ?? 0) > 1;
  }

  chaveFuncionario(f: ProdutividadeFuncionarioRow): string {
    return f.funcionarioId;
  }

  formatarUnidadesFuncionario(f: ProdutividadeFuncionarioRow): string {
    return [...f.unidades]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ');
  }

  formatarCodigosErp(f: ProdutividadeFuncionarioRow): string {
    if (f.codigosFuncionarioErp?.length) {
      return f.codigosFuncionarioErp.join(' / ');
    }
    return String(f.codigoFuncionarioErp);
  }

  formatarUnidadesAviso(item: {
    unidades: ProdutividadeFuncionarioSemCadastro['unidades'];
  }): string {
    return item.unidades
      .map((u) => `${u.unidade} (${u.linhas})`)
      .join(', ');
  }

  formatarEtapasSemVinculo(
    item: ProdutividadeFuncionarioSemEtapaVinculada,
  ): string {
    return item.etapas
      .map((e) => `${e.etapa} (${e.linhas})`)
      .join(', ');
  }

  formatarAmostrasRequisicao(
    item: ProdutividadeFuncionarioSemCadastro,
  ): string {
    return (item.amostrasRequisicoes ?? []).join(', ');
  }

  temAvisosSemCadastro(): boolean {
    return (this.resultado?.avisos?.funcionariosSemCadastro?.length ?? 0) > 0;
  }

  temAvisosSemEtapaVinculada(): boolean {
    return (
      (this.resultado?.avisos?.funcionariosSemEtapaVinculada?.length ?? 0) > 0
    );
  }

  temAvisos(): boolean {
    if (!this.podeVerAlertas()) return false;
    return this.temAvisosSemCadastro() || this.temAvisosSemEtapaVinculada();
  }

  totalLinhasAvisos(): number {
    if (!this.podeVerAlertas() || !this.resultado?.avisos) return 0;
    return (
      (this.resultado.avisos.totalLinhasSemCadastro ?? 0) +
      (this.resultado.avisos.totalLinhasSemEtapaVinculada ?? 0)
    );
  }

  get unidadeFixa(): Unidade | null {
    if (!this.unidadeDisabled || this.selectedUnidades.size === 0) {
      return null;
    }
    return this.selectedUnidades.values().next().value ?? null;
  }

  formatarMoeda(valor: number): string {
    return this.moedaFmt.format(Number.isFinite(valor) ? valor : 0);
  }

  formatarPeriodo(): string {
    if (!this.resultado) return '—';
    const [y, m] = this.resultado.dataInicio.split('-');
    if (!y || !m) {
      return `${this.formatarData(this.resultado.dataInicio)} a ${this.formatarData(this.resultado.dataFim)}`;
    }
    return `${this.nomeMesPt(Number(m))} / ${y}`;
  }

  formatarUnidadesResumo(): string {
    if (!this.resultado?.unidades.length) return '—';
    return [...this.resultado.unidades]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ');
  }

  formatarData(iso: string): string {
    if (!iso) return '—';
    const d = iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
  }

  private initializeUnidadeFilter(): void {
    const permitidas = this.resolverUnidadesPermitidasUsuario();
    if (permitidas) {
      this.unidades = permitidas;
      if (permitidas.length === 1) {
        this.selectedUnidades = new Set(permitidas);
        this.unidadeDisabled = true;
      } else {
        this.selectedUnidades = new Set(permitidas);
        this.unidadeDisabled = false;
      }
      return;
    }

    this.unidades = Object.values(Unidade);
    this.selectedUnidades = new Set();
    this.unidadeDisabled = false;
  }

  /** Escopo de produtividade conforme cadastro (`unidadesProdutividade`). */
  private resolverUnidadesPermitidasUsuario(): Unidade[] | null {
    const u = this.auth.getCurrentUser();
    if (!u?.unidade || String(u.unidade).trim() === '') {
      return null;
    }
    const extras = (u.unidadesProdutividade ?? []).filter(Boolean) as Unidade[];
    if (!extras.length) {
      return [u.unidade as Unidade];
    }
    return [...new Set(extras)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private inicializarAnosOpcoes(): void {
    const atual = new Date().getFullYear();
    const min = atual - 5;
    const max = atual + 1;
    this.anosOpcoes = [];
    for (let y = max; y >= min; y--) {
      this.anosOpcoes.push(y);
    }
  }

  private definirPeriodoMesAtual(): void {
    const today = new Date();
    this.ano = today.getFullYear();
    this.mes = today.getMonth() + 1;
    this.aplicarCompetenciaSelecionada();
  }

  private aplicarCompetenciaSelecionada(): void {
    const pad = (n: number) => String(n).padStart(2, '0');
    this.dataInicio = `${this.ano}-${pad(this.mes)}-01`;
    const ultimoDia = new Date(this.ano, this.mes, 0).getDate();
    this.dataFim = `${this.ano}-${pad(this.mes)}-${pad(ultimoDia)}`;
  }

  private navegarMes(delta: number): void {
    let novoMes = this.mes + delta;
    let novoAno = this.ano;

    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }

    this.mes = novoMes;
    this.ano = novoAno;
    this.garantirAnoNasOpcoes(novoAno);
    this.aplicarCompetenciaSelecionada();
    this.atualizarConsultaPorFiltros();
  }

  private atualizarConsultaPorFiltros(): void {
    if (!this.podeLer()) return;

    if (this.selectedUnidades.size === 0) {
      this.resultado = null;
      this.colunasEtapas = [];
      this.funcionarioExpandidoId = null;
      this.modalAvisosAberto = false;
      return;
    }

    this.aplicarCompetenciaSelecionada();

    if (this.filtrosValidosParaConsulta()) {
      this.consultar();
    }
  }

  private garantirAnoNasOpcoes(ano: number): void {
    if (!this.anosOpcoes.includes(ano)) {
      this.anosOpcoes = [...this.anosOpcoes, ano].sort((a, b) => b - a);
    }
  }

  private montarColunasEtapas(
    res: ProdutividadeConsultaResponse,
  ): ProdutividadeColunaEtapa[] {
    const map = new Map<string, string>();
    for (const funcionario of res.funcionarios) {
      for (const etapa of funcionario.etapas) {
        if (!map.has(etapa.codEtapa)) {
          map.set(etapa.codEtapa, etapa.etapa);
        }
      }
    }
    const colunas = [...map.entries()]
      .map(([codEtapa, etapa]) => ({ codEtapa, etapa }))
      .sort((a, b) => a.etapa.localeCompare(b.etapa, 'pt-BR'));

    const idxGestao = colunas.findIndex(
      (c) => c.codEtapa === PRODUCAO_COD_ETAPA_GESTAO,
    );
    if (idxGestao >= 0) {
      const [gestao] = colunas.splice(idxGestao, 1);
      colunas.push(gestao);
    }

    return colunas;
  }

  private renderRodapeTabelaResumida(
    colunas: ProdutividadeColunaEtapa[],
  ): string {
    if (!this.resultado || colunas.length === 0) return '';
    const celulas = colunas
      .map((c) => {
        const total = this.totalColunaEtapa(c.codEtapa);
        return `<td class="col-num"><strong>${total}</strong></td>`;
      })
      .join('');
    return `<tfoot>
      <tr class="grid-total-row">
        <td class="col-funcionario"><strong>Total</strong></td>
        ${celulas}
        <td class="col-num col-total"><strong>${this.escapeHtml(this.formatarMoeda(this.totalGeralValor()))}</strong></td>
      </tr>
    </tfoot>`;
  }

  private imprimirRelatorioResumida(): void {
    if (!this.resultado) return;
    const res = this.resultado;
    const colunas = this.colunasEtapas;
    const cabecalhoEtapas = colunas
      .map(
        (c) =>
          `<th class="col-etapa">${this.escapeHtml(this.abreviarEtapa(c.etapa))}</th>`,
      )
      .join('');
    const linhas = res.funcionarios
      .map((f) => {
        const celulas = colunas
          .map((c) => {
            const qtd = this.quantidadeCelula(f, c.codEtapa);
            return `<td class="col-num">${qtd ?? ''}</td>`;
          })
          .join('');
        return `<tr>
          <td class="col-funcionario">${this.escapeHtml(this.primeiroNome(f.nome))}</td>
          ${celulas}
          <td class="col-num col-total"><strong>${this.escapeHtml(this.formatarMoeda(f.totalValor))}</strong></td>
        </tr>`;
      })
      .join('');

    const html = `
      ${this.renderResumoRelatorio(res)}
      <div class="table-wrapper">
        <table class="table-grid">
          <thead>
            <tr>
              <th class="col-funcionario">Funcionário</th>
              ${cabecalhoEtapas}
              <th class="col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linhas || '<tr><td colspan="' + (colunas.length + 2) + '">Nenhum dado.</td></tr>'}
          </tbody>
          ${this.renderRodapeTabelaResumida(colunas)}
        </table>
      </div>`;

    this.abrirRelatorioImpressao({
      tituloDocumento: 'Produtividade — Tabela Resumida',
      tituloPrincipal: 'Produtividade — Tabela Resumida',
      corpo: html,
      paisagem: true,
    });
  }

  private imprimirRelatorioSintetico(): void {
    if (!this.resultado) return;
    const res = this.resultado;
    const exibirUnidade = res.unidades.length > 1;

    const cards = res.funcionarios
      .map((f) => {
        const linhasEtapas = f.etapas
          .map(
            (e) => `<tr>
              <td>${this.escapeHtml(e.etapa)}</td>
              <td class="col-num">${e.quantidade}</td>
              <td class="col-num">${this.escapeHtml(this.formatarMoeda(e.valorUnitario))}</td>
              <td class="col-num">${this.escapeHtml(this.formatarMoeda(e.valorTotal))}</td>
            </tr>`,
          )
          .join('');
        const contexto = [
          exibirUnidade
            ? `<span>Unidade: ${this.escapeHtml(this.formatarUnidadesFuncionario(f))}</span>`
            : '',
          `<span>Setor: ${this.escapeHtml(f.setor || '—')}</span>`,
          `<span>Cargo: ${this.escapeHtml(f.cargo || '—')}</span>`,
          `<span>ERP: ${this.escapeHtml(this.formatarCodigosErp(f))}</span>`,
        ]
          .filter(Boolean)
          .join(' · ');

        return `<article class="func-card">
          <div class="func-card-header">
            <p class="func-identidade"><strong>${this.escapeHtml(f.nome)}</strong></p>
            <p class="func-contexto">${contexto}</p>
            <p class="func-resumo-total">Total: ${this.escapeHtml(this.formatarMoeda(f.totalValor))} · ${f.totalQuantidade} etapa(s)</p>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th class="col-num">Qtd.</th>
                  <th class="col-num">Valor unit.</th>
                  <th class="col-num">Valor total</th>
                </tr>
              </thead>
              <tbody>${linhasEtapas}</tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td class="col-num"><strong>${f.totalQuantidade}</strong></td>
                  <td class="col-num"></td>
                  <td class="col-num"><strong>${this.escapeHtml(this.formatarMoeda(f.totalValor))}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>`;
      })
      .join('');

    const html = `
      ${this.renderResumoRelatorio(res)}
      <div class="func-cards">${cards || '<p>Nenhum dado.</p>'}</div>`;

    this.abrirRelatorioImpressao({
      tituloDocumento: 'Produtividade — Sintético',
      tituloPrincipal: 'Produtividade — Sintético',
      corpo: html,
    });
  }

  private imprimirRelatorioAnalitico(linhas: ProdutividadeAnaliticoLinha[]): void {
    if (!this.resultado) return;
    const res = this.resultado;
    const exibirUnidade = res.unidades.length > 1;
    const corpo = this.renderCorpoRelatorioAnalitico(linhas, exibirUnidade);

    this.abrirRelatorioImpressao({
      tituloDocumento: 'Produtividade — Analítico',
      tituloPrincipal: 'Produtividade — Analítico',
      corpo,
      paisagem: true,
    });
  }

  private renderCorpoRelatorioAnalitico(
    linhas: ProdutividadeAnaliticoLinha[],
    exibirUnidade: boolean,
  ): string {
    if (!this.resultado) return '<p>Nenhum dado.</p>';
    const resumo = this.renderResumoRelatorio(this.resultado);

    if (linhas.length === 0) {
      return `${resumo}<p class="vazio-relatorio">Nenhum dado.</p>`;
    }

    const gruposFuncionario = new Map<
      string,
      { nome: string; etapas: Map<string, { etapa: string; linhas: ProdutividadeAnaliticoLinha[] }> }
    >();

    for (const linha of linhas) {
      let grupoFunc = gruposFuncionario.get(linha.funcionarioId);
      if (!grupoFunc) {
        grupoFunc = { nome: linha.funcionario, etapas: new Map() };
        gruposFuncionario.set(linha.funcionarioId, grupoFunc);
      }

      let grupoEtapa = grupoFunc.etapas.get(linha.codEtapa);
      if (!grupoEtapa) {
        grupoEtapa = { etapa: linha.etapa, linhas: [] };
        grupoFunc.etapas.set(linha.codEtapa, grupoEtapa);
      }
      grupoEtapa.linhas.push(linha);
    }

    const blocos = [...gruposFuncionario.values()]
      .map((funcionario) => {
        const blocosEtapa = [...funcionario.etapas.values()]
          .map((grupoEtapa) => {
            const linhasTabela = grupoEtapa.linhas
              .map(
                (l) => `<tr>
                  ${exibirUnidade ? `<td>${this.escapeHtml(l.unidade)}</td>` : ''}
                  <td class="col-num">${l.requisicao}</td>
                  <td>${this.escapeHtml(l.formula)}</td>
                  <td class="col-num">${this.escapeHtml(this.formatarData(l.data))}</td>
                </tr>`,
              )
              .join('');

            const totalEtapa = grupoEtapa.linhas.length;
            const colspanTotal = exibirUnidade ? 4 : 3;

            return `<section class="analitico-grupo-etapa">
              <h3 class="grupo-subtitulo">${this.escapeHtml(grupoEtapa.etapa)}</h3>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      ${exibirUnidade ? '<th>Unidade</th>' : ''}
                      <th class="col-num">Requisição</th>
                      <th>Fórmula</th>
                      <th class="col-num">Data</th>
                    </tr>
                  </thead>
                  <tbody>${linhasTabela}</tbody>
                  <tfoot>
                    <tr class="analitico-total-etapa">
                      <td colspan="${colspanTotal}">
                        <strong>${this.escapeHtml(funcionario.nome)} Quantidade total de ${this.escapeHtml(grupoEtapa.etapa)}: ${totalEtapa}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>`;
          })
          .join('');

        return `<section class="analitico-grupo-funcionario">
          <h2 class="grupo-titulo">${this.escapeHtml(funcionario.nome)}</h2>
          ${blocosEtapa}
        </section>`;
      })
      .join('');

    return `${resumo}<div class="analitico-grupos">${blocos}</div>`;
  }

  private linhasCabecalhoRelatorio(): string[] {
    if (!this.resultado) return [];
    const unidades = [...this.resultado.unidades]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ');
    return [
      `Unidade(s): ${unidades}`,
      `Período: ${this.formatarData(this.resultado.dataInicio)} a ${this.formatarData(this.resultado.dataFim)}`,
    ];
  }

  private renderResumoRelatorio(res: ProdutividadeConsultaResponse): string {
    return `<div class="resumo-linha">
      Funcionários: <strong>${res.resumo.totalFuncionarios}</strong> ·
      Etapas contabilizadas: <strong>${res.resumo.totalQuantidade}</strong> ·
      Valor total: <strong>${this.escapeHtml(this.formatarMoeda(res.resumo.totalValor))}</strong>
    </div>`;
  }

  private abreviarEtapa(etapa: string): string {
    const t = etapa?.trim();
    if (!t) return '—';
    if (t.length <= 14) return t;
    return `${t.slice(0, 13)}…`;
  }

  private abrirRelatorioImpressao(opts: {
    tituloDocumento: string;
    tituloPrincipal: string;
    corpo: string;
    paisagem?: boolean;
  }): void {
    const popup = window.open('', '_blank', 'width=1120,height=800');
    if (!popup) {
      this.errors.show(
        'Não foi possível abrir o relatório. Verifique bloqueadores de pop-up.',
        'Produção',
      );
      return;
    }

    popup.document.write(this.montarHtmlDocumentoRelatorio(opts));
    popup.document.close();
  }

  private montarHtmlDocumentoRelatorio(opts: {
    tituloDocumento: string;
    tituloPrincipal: string;
    corpo: string;
    paisagem?: boolean;
  }): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const emitidoEm = new Date().toLocaleString('pt-BR');
    const logoHtml = this.configRelatorio?.hasLogo
      ? `<img src="${environment.apiUrl}/configuracao/logo" alt="Logo" style="max-height: 80px; max-width: 120px; display: block;" />`
      : '';
    const headerRow = this.linhasCabecalhoRelatorio()
      .map((t) => `<div>${this.escapeHtml(t)}</div>`)
      .join('');
    const pageRule = opts.paisagem
      ? '@page { size: landscape; margin: 12mm 10mm 42px 10mm; }'
      : '@page { margin: 12mm 10mm 42px 10mm; }';

    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(opts.tituloDocumento)}</title>
    <style>
      ${pageRule}
      body { font-family: Arial, sans-serif; margin: 15px; line-height: 1.35; font-size: 11px; color: #111; background: #fff; }
      .print-actions { text-align: right; margin-bottom: 12px; }
      .print-actions button { padding: 8px 16px; border: none; background: #2563eb; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
      .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
      .logo-box { flex: 0 0 auto; margin-right: 20px; }
      .header-content { flex: 1 1 auto; text-align: center; }
      .header-title { margin: 0; font-size: 1.35em; font-weight: bold; color: #0f172a; }
      .header-row { display: flex; gap: 20px; margin-top: 8px; font-size: 0.95em; justify-content: center; flex-wrap: wrap; }
      .header-row div { font-weight: bold; color: #334155; }
      .resumo-linha { margin: 0 0 14px; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; }
      .table-wrapper { border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 5px 7px; text-align: left; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      th { background: #f8fafc; text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; color: #475569; white-space: nowrap; }
      .col-num { text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .col-funcionario { min-width: 5.5rem; white-space: nowrap; }
      .col-etapa { max-width: 6rem; white-space: normal; word-break: break-word; font-size: 9px; }
      .col-total { min-width: 5rem; }
      table tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #94a3b8; }
      .grid-total-row td { font-weight: 700; }
      .analitico-total-etapa td { text-align: right; color: #334155; font-size: 10px; }
      .func-cards { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
      .func-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; break-inside: avoid; background: #fff; }
      .func-card-header { padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
      .func-identidade { margin: 0; font-size: 12px; color: #0f172a; }
      .func-contexto { margin: 4px 0 0; font-size: 10px; color: #64748b; line-height: 1.4; }
      .func-resumo-total { margin: 4px 0 0; font-size: 10px; color: #334155; font-weight: 600; }
      .analitico-grupos { margin-top: 8px; }
      .analitico-grupo-funcionario {
        margin-bottom: 18px;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }
      .analitico-grupo-funcionario + .analitico-grupo-funcionario {
        page-break-before: always;
        break-before: page;
        margin-top: 0;
        padding-top: 4px;
      }
      .grupo-titulo {
        margin: 0 0 10px;
        padding: 6px 8px;
        background: #f0f0f0;
        border-left: 4px solid #2563eb;
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .analitico-grupo-etapa {
        margin: 0 0 12px 0;
        page-break-inside: avoid;
        break-inside: avoid-page;
      }
      .analitico-grupo-etapa + .analitico-grupo-etapa {
        page-break-before: always;
        break-before: page;
        padding-top: 4px;
      }
      .grupo-subtitulo {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        color: #334155;
      }
      .vazio-relatorio { color: #64748b; margin: 12px 0 0; }
      .footer-print {
        margin-top: 24px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
        font-size: 9px;
        color: #64748b;
        text-align: center;
      }
      @media print {
        .print-actions { display: none; }
        .func-card, .analitico-grupo-etapa { break-inside: avoid; page-break-inside: avoid; }
        .analitico-grupo-funcionario + .analitico-grupo-funcionario,
        .analitico-grupo-etapa + .analitico-grupo-etapa { page-break-before: always; break-before: page; }
        .footer-print {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100vw;
          margin-top: 0;
          padding: 6px 10mm;
          border-top: 1px solid #ccc;
          background: #fff;
          z-index: 1000;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-actions">
      <button type="button" onclick="window.print()">Imprimir</button>
    </div>
    <div class="header">
      <div class="logo-box">${logoHtml}</div>
      <div class="header-content">
        <h1 class="header-title">${this.escapeHtml(opts.tituloPrincipal)}</h1>
        <div class="header-row">${headerRow}</div>
      </div>
    </div>
    ${opts.corpo}
    <div class="footer-print">
      Documento gerado em ${emitidoEm} &nbsp;·&nbsp; Impresso por: ${this.escapeHtml(userName)}
    </div>
  </body>
</html>`;
  }

  private escapeHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
