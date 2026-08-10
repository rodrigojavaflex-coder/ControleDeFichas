import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoAcompanhamentoService } from '../../services/producao-acompanhamento.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  AcompanhamentoDetalheResponse,
  AcompanhamentoEtapaResumo,
  AcompanhamentoLinhaFila,
  AcompanhamentoResumoResponse,
} from '../../models/producao-acompanhamento.model';
import { rotuloClientePaciente } from './utils/producao-cliente-paciente.util';
import { ProducaoEtapasRefreshService } from '../../services/producao-etapas-refresh.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FiltroReqFormula,
  linhaAtendeFiltroReqFormula,
  MENSAGEM_FORMATO_FILTRO_REQ_FORMULA,
  parseFiltroReqFormula,
  rotuloFiltroReqFormula,
} from './utils/producao-req-formula-filtro.util';

@Component({
  selector: 'app-producao-acompanhamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-acompanhamento-page.html',
  styleUrls: [
    './producao-acompanhamento-page.css',
    './producao-filtros-collapsible.css',
    './producao-etapa-cards.css',
  ],
})
export class ProducaoAcompanhamentoPage implements OnInit, OnDestroy {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private acompanhamentoService = inject(ProducaoAcompanhamentoService);
  private producaoEtapasRefresh = inject(ProducaoEtapasRefreshService);
  private configuracaoService = inject(ConfiguracaoService);
  private destroyRef = inject(DestroyRef);

  private configRelatorio: Configuracao | null = null;

  unidades: Unidade[] = Object.values(Unidade);
  selectedUnidades = new Set<Unidade>();
  unidadeDisabled = false;

  carregando = false;
  carregandoDetalhe = false;
  resumo: AcompanhamentoResumoResponse | null = null;
  etapaSelecionada: AcompanhamentoEtapaResumo | null = null;
  detalhe: AcompanhamentoDetalheResponse | null = null;
  modalDetalheAberto = false;
  filtroReqFormula = '';
  codEtapaFiltro: string | null = null;
  buscandoReqFormula = false;
  filtrosContainerAberto = true;
  /** Preenchido ao buscar req-fórmula; restringe linhas no modal. */
  reqFormulaFiltroAtivo: FiltroReqFormula | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Acompanhamento',
      description:
        'Fila operacional: etapas em andamento conforme dados importados do PCP.',
    });
    this.initializeUnidadeFilter();
    this.carregarConfigRelatorio();
    void this.atualizar();

    this.producaoEtapasRefresh.iniciarMonitoramentoSincronizacao();
    this.producaoEtapasRefresh.onEtapasAtualizadas$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (
          this.podeLer() &&
          this.selectedUnidades.size > 0 &&
          !this.carregando &&
          !this.buscandoReqFormula
        ) {
          this.atualizar();
        }
      });
  }

  ngOnDestroy(): void {
    this.producaoEtapasRefresh.pararMonitoramentoSincronizacao();
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_ACOMPANHAMENTO_READ);
  }

  /** Cards com requisições na fila (reforço no front; API já filtra). */
  get etapasVisiveis(): AcompanhamentoEtapaResumo[] {
    let list = (this.resumo?.etapas ?? []).filter(
      (e) => e.totalRequisicoesFormulas > 0,
    );
    if (this.codEtapaFiltro) {
      list = list.filter((e) => e.codEtapa === this.codEtapaFiltro);
    }
    return list;
  }

  atualizar(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    this.carregando = true;
    this.fecharDetalhe();
    this.limparFiltroReqFormula(false);
    this.acompanhamentoService
      .resumo({ unidades: Array.from(this.selectedUnidades) })
      .subscribe({
        next: (data) => {
          this.resumo = data;
          this.carregando = false;
        },
        error: (e) => {
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar resumo da fila.',
            'Acompanhamento',
          );
          this.resumo = null;
          this.carregando = false;
        },
      });
  }

  get linhasDetalheModal(): AcompanhamentoLinhaFila[] {
    const linhas = this.detalhe?.linhas ?? [];
    const f = this.reqFormulaFiltroAtivo;
    if (!f) {
      return linhas;
    }
    return linhas.filter((lin) => linhaAtendeFiltroReqFormula(lin, f));
  }

  get totalRequisicoesModal(): number {
    if (this.reqFormulaFiltroAtivo) {
      return this.linhasDetalheModal.length;
    }
    return this.etapaSelecionada?.totalRequisicoesFormulas ?? 0;
  }

  selecionarEtapa(
    etapa: AcompanhamentoEtapaResumo,
    filtroReq?: FiltroReqFormula,
  ): void {
    if (this.selectedUnidades.size === 0 || etapa.totalRequisicoesFormulas <= 0) {
      return;
    }
    this.reqFormulaFiltroAtivo = filtroReq ?? null;
    this.etapaSelecionada = etapa;
    this.modalDetalheAberto = true;
    this.carregandoDetalhe = true;
    this.detalhe = null;
    this.acompanhamentoService
      .detalhe({
        unidades: Array.from(this.selectedUnidades),
        codEtapa: etapa.codEtapa,
      })
      .subscribe({
        next: (data) => {
          this.detalhe = data;
          this.carregandoDetalhe = false;
        },
        error: (e) => {
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar detalhe da etapa.',
            'Acompanhamento',
          );
          this.carregandoDetalhe = false;
        },
      });
  }

  fecharDetalhe(): void {
    this.modalDetalheAberto = false;
    this.etapaSelecionada = null;
    this.detalhe = null;
    this.carregandoDetalhe = false;
    this.reqFormulaFiltroAtivo = null;
  }

  toggleUnidade(unidade: Unidade, checked: boolean): void {
    if (checked) {
      this.selectedUnidades.add(unidade);
    } else {
      this.selectedUnidades.delete(unidade);
    }
    this.agendarAtualizarAposFiltro();
  }

  toggleTodasUnidades(): void {
    const all =
      this.unidades.length > 0 &&
      this.selectedUnidades.size === this.unidades.length;
    if (all) {
      this.selectedUnidades.clear();
    } else {
      this.unidades.forEach((u) => this.selectedUnidades.add(u));
    }
    this.agendarAtualizarAposFiltro();
  }

  limparUnidades(): void {
    this.selectedUnidades.clear();
    this.resumo = null;
    this.fecharDetalhe();
    this.limparFiltroReqFormula(false);
  }

  buscarRequisicaoFormula(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    const parsed = parseFiltroReqFormula(this.filtroReqFormula);
    if (!parsed) {
      this.errors.show(
        MENSAGEM_FORMATO_FILTRO_REQ_FORMULA,
        'Acompanhamento',
      );
      return;
    }
    this.buscandoReqFormula = true;
    this.acompanhamentoService
      .localizar({
        unidades: Array.from(this.selectedUnidades),
        requisicao: parsed.requisicao,
        formula: parsed.formula ?? undefined,
        filial: parsed.filial,
      })
      .subscribe({
        next: (loc) => {
          this.buscandoReqFormula = false;
          this.codEtapaFiltro = loc.codEtapa;
          const etapa =
            this.resumo?.etapas.find((e) => e.codEtapa === loc.codEtapa) ??
            ({
              codEtapa: loc.codEtapa,
              etapa: loc.etapa,
              posicaoEtapa: loc.posicaoEtapa,
              totalRequisicoesFormulas: 1,
              tempoMedioMinutos: null,
            } satisfies AcompanhamentoEtapaResumo);
          this.selecionarEtapa(etapa, parsed);
        },
        error: (e) => {
          this.buscandoReqFormula = false;
          this.codEtapaFiltro = null;
          this.errors.show(
            e?.error?.message ??
              (parsed.formula == null
                ? 'Requisição não encontrada na fila em andamento.'
                : 'Requisição-fórmula não encontrada na fila em andamento.'),
            'Acompanhamento',
          );
        },
      });
  }

  limparFiltroReqFormula(limparInput = true): void {
    this.codEtapaFiltro = null;
    this.reqFormulaFiltroAtivo = null;
    if (limparInput) {
      this.filtroReqFormula = '';
    }
  }

  rotuloFiltroReqFormula(filtro: FiltroReqFormula): string {
    return rotuloFiltroReqFormula(filtro);
  }

  contadorFiltrosAtivos(): number {
    let n = 0;
    if (this.selectedUnidades.size > 0 && this.selectedUnidades.size < this.unidades.length) {
      n += 1;
    }
    if (this.reqFormulaFiltroAtivo) {
      n += 1;
    }
    if (this.codEtapaFiltro) {
      n += 1;
    }
    if (this.filtroReqFormula.trim()) {
      n += 1;
    }
    return n;
  }

  toggleFiltrosContainer(): void {
    this.filtrosContainerAberto = !this.filtrosContainerAberto;
  }

  descricaoUltimaAtualizacao(): string | null {
    const iso = this.resumo?.consultadoEm;
    if (!iso) {
      return null;
    }
    return `Última atualização: ${this.formatarDataHoraConsulta(iso)}`;
  }

  formatarDataHoraConsulta(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  onCardKeydown(event: KeyboardEvent, acao: () => void): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    acao();
  }

  private agendarAtualizarAposFiltro(): void {
    if (this.selectedUnidades.size > 0) {
      this.atualizar();
    } else {
      this.resumo = null;
      this.fecharDetalhe();
    }
  }

  onUnidadesContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('button') ||
      target.closest('label.unidade-item')
    ) {
      return;
    }
    this.toggleTodasUnidades();
  }

  get unidadeFixa(): Unidade | null {
    if (!this.unidadeDisabled || this.selectedUnidades.size === 0) {
      return null;
    }
    return this.selectedUnidades.values().next().value ?? null;
  }

  formatarMinutos(min: number | null | undefined): string {
    if (min == null || Number.isNaN(min)) {
      return '—';
    }
    const total = Math.max(0, Math.round(min));
    if (total < 60) {
      return `${total} min`;
    }
    if (total < 24 * 60) {
      const h = Math.floor(total / 60);
      const m = total % 60;
      return m > 0 ? `${h} h ${m} min` : `${h} h`;
    }
    const dias = Math.floor(total / (24 * 60));
    const resto = total % (24 * 60);
    const h = Math.floor(resto / 60);
    const m = resto % 60;
    const partes: string[] = [`${dias} d`];
    if (h > 0) {
      partes.push(`${h} h`);
    }
    if (m > 0) {
      partes.push(`${m} min`);
    }
    return partes.join(' ');
  }

  tempoMaisDe24Horas(min: number | null | undefined): boolean {
    if (min == null || Number.isNaN(min)) {
      return false;
    }
    return min > 24 * 60;
  }

  rotuloClientePaciente(
    cliente: string | null | undefined,
    paciente: string | null | undefined,
  ): string | null {
    return rotuloClientePaciente(cliente, paciente);
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) {
      return d;
    }
    return `${day}/${m}/${y}`;
  }

  labelRequisicaoFormula(
    requisicao: number,
    formula: string,
    filial: number,
  ): string {
    return `${requisicao}-${formula} (filial ${filial})`;
  }

  imprimirDetalheEtapa(): void {
    if (!this.etapaSelecionada || this.carregandoDetalhe) {
      return;
    }
    const linhas = this.linhasDetalheModal;
    if (!linhas.length) {
      this.errors.show('Nenhuma requisição na fila para imprimir.', 'Acompanhamento');
      return;
    }

    const etapa = this.etapaSelecionada;
    const consultadoEm = this.detalhe?.consultadoEm ?? this.resumo?.consultadoEm;

    const rowsHtml = linhas
      .map((lin) => {
        const entrada = [
          this.formatarData(lin.dataEntrada),
          lin.horaEntrada ? lin.horaEntrada.slice(0, 8) : '',
        ]
          .filter((p) => p && p !== '—')
          .join(' ');
        const clientePaciente =
          this.rotuloClientePaciente(lin.cliente, lin.paciente) ?? '—';
        const atrasada = this.tempoMaisDe24Horas(lin.tempoDecorridoMinutos);
        return `<tr${atrasada ? ' class="linha-atrasada"' : ''}>
          <td>${this.escapeHtml(this.labelRequisicaoFormula(lin.requisicao, lin.formula, lin.filial))}</td>
          <td>${this.escapeHtml(lin.unidade)}</td>
          <td>${this.escapeHtml(lin.funcionario ?? '—')}</td>
          <td>${this.escapeHtml(entrada || '—')}</td>
          <td class="col-num">${this.escapeHtml(this.formatarMinutos(lin.tempoDecorridoMinutos))}</td>
          <td>${this.escapeHtml(clientePaciente)}</td>
        </tr>`;
      })
      .join('');

    const metaParts: string[] = [];
    if (this.reqFormulaFiltroAtivo) {
      metaParts.push(
        `Filtro: ${this.escapeHtml(this.rotuloFiltroReqFormula(this.reqFormulaFiltroAtivo))}`,
      );
    }
    if (consultadoEm) {
      metaParts.push(
        `Dados consultados em: ${this.escapeHtml(this.formatarDataHoraConsulta(consultadoEm))}`,
      );
    }
    const metaHtml = metaParts.length
      ? `<div class="resumo-linha">${metaParts.join(' · ')}</div>`
      : '';

    const corpo = `${metaHtml}
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Req-fórmula</th>
          <th>Unidade</th>
          <th>Funcionário</th>
          <th>Entrada</th>
          <th class="col-num">Tempo</th>
          <th>Cliente / Paciente</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;

    const tituloDocumento = `Acompanhamento — ${etapa.etapa}`;
    const html = this.montarHtmlDocumentoRelatorio({
      tituloDocumento,
      tituloPrincipal: etapa.etapa,
      linhasCabecalho: this.linhasCabecalhoRelatorioDetalheEtapa(etapa, linhas.length),
      corpo,
    });

    this.abrirDocumentoImpressao(html, tituloDocumento);
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

  private linhasCabecalhoRelatorioDetalheEtapa(
    etapa: AcompanhamentoEtapaResumo,
    totalLinhas: number,
  ): string[] {
    const unidades = [...this.selectedUnidades]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ');
    return [
      `Etapa: ${etapa.codEtapa} · Posição ${etapa.posicaoEtapa}`,
      `Unidade(s): ${unidades || '—'}`,
      `${totalLinhas} requisição(ões) na fila`,
    ];
  }

  private montarHtmlDocumentoRelatorio(opts: {
    tituloDocumento: string;
    tituloPrincipal: string;
    linhasCabecalho: string[];
    corpo: string;
  }): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const emitidoEm = new Date().toLocaleString('pt-BR');
    const logoHtml = this.configRelatorio?.hasLogo
      ? `<img src="${environment.apiUrl}/configuracao/logo" alt="Logo" style="max-height: 80px; max-width: 120px; display: block;" />`
      : '';
    const headerRow = opts.linhasCabecalho
      .map((t) => `<div>${this.escapeHtml(t)}</div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(opts.tituloDocumento)}</title>
    <style>
      @page { margin: 12mm 10mm 42px 10mm; }
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
      th { background: #f8fafc; text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; color: #475569; }
      .col-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      tr.linha-atrasada td { background: #fef2f2; }
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

  /** Pop-up sem noopener (senão o Chrome retorna null); fallback iframe se bloqueado. */
  private abrirDocumentoImpressao(html: string, titulo: string): void {
    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (popup) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.document.title = titulo;
      popup.focus();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', titulo);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      this.errors.show(
        'Não foi possível abrir a impressão. Verifique bloqueadores de pop-up.',
        'Acompanhamento',
      );
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const imprimir = (): void => {
      if (iframe.dataset['printed'] === '1') return;
      iframe.dataset['printed'] = '1';
      win.focus();
      win.print();
      window.setTimeout(() => iframe.remove(), 1500);
    };

    win.addEventListener('load', imprimir, { once: true });
    if (doc.readyState === 'complete') {
      imprimir();
    } else {
      window.setTimeout(imprimir, 800);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private initializeUnidadeFilter(): void {
    const permitidas = this.resolverUnidadesPermitidasUsuario();
    if (permitidas) {
      this.unidades = permitidas;
      this.selectedUnidades = new Set(permitidas);
      this.unidadeDisabled = permitidas.length === 1;
      return;
    }
    this.unidades = Object.values(Unidade);
    this.selectedUnidades = new Set();
    this.unidadeDisabled = false;
  }

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
}
