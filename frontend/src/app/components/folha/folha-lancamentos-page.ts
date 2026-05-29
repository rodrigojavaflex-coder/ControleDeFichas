import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FolhaService } from '../../services/folha.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import {
  FolhaCapaDetalheResponse,
  FolhaItem,
  FolhaMovimentoTipo,
  FolhaTipo,
  FolhaVerba,
  FuncionarioFolha,
  FolhaFechamentoStatus,
} from '../../models/folha.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { nomeMesPt } from './folha-meses';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-folha-lancamentos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HistoricoAuditoriaComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './folha-lancamentos-page.html',
  styleUrls: ['./folha-pages.shared.css'],
})
export class FolhaLancamentosPage implements OnInit {
  private folha = inject(FolhaService);
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private configuracaoService = inject(ConfiguracaoService);

  Permission = Permission;
  Unidade = Unidade;
  FolhaMovimentoTipo = FolhaMovimentoTipo;
  nomeMesPt = nomeMesPt;

  private readonly formatoMoedaCapaLista = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /** '' = nenhuma unidade escolhida (ex.: opção "Todas" para quem pode filtrar); lançamento exige uma unidade específica. */
  unidadeFiltro: Unidade | '' = '';
  ano = new Date().getFullYear();
  mes = new Date().getMonth() + 1;
  tipos: FolhaTipo[] = [];
  tipoId = '';
  verbasAtivas: FolhaVerba[] = [];
  detalhe: FolhaCapaDetalheResponse | null = null;
  /** Após Carregar: uma entrada por funcionário elegível na competência + tipo (RN-011). */
  capasNaCompetencia: FolhaCapaDetalheResponse[] = [];
  statusLote: FolhaFechamentoStatus | null = null;
  carregando = false;
  /** Enquanto busca capas para impressão dos relatórios gerais (Folha / Folha por evento). */
  gerandoRelatorioFolhaGeral = false;

  /** Modal de inclusão: uma instância; `tipo` define a lista de eventos e o POST. */
  modalInclusaoAberto = false;
  modalInclusaoTipo: FolhaMovimentoTipo | null = null;
  modalInclusaoVerbaId = '';
  modalInclusaoValorTexto = '';
  modalInclusaoQuantidadeTexto = '1';

  /** Modal de edição ref/valor (sem edição inline no card). */
  modalEdicaoAberto = false;
  /** Item em edição (id estável até salvar/fechar). */
  itemModalEdicaoId: string | null = null;
  edicaoValorTexto = '';
  edicaoQuantidadeTexto = '1';
  /** Payload exibido no cabeçalho do modal (evento já vinculado ao item). */
  edicaoTituloEvento = '';

  /** Tipo do item em edição (para pill Receita / Despesa no modal). */
  modalEdicaoMovimentoTipo: FolhaMovimentoTipo | null = null;

  salvandoModalLancamento = false;
  salvandoCongelacaoCapa = false;
  enviandoReciboWhatsapp = false;

  showCongelarCapaModal = false;
  showLiberarCapaModal = false;
  showEnviarReciboWhatsappModal = false;

  showRemoverItemModal = false;
  itemIdParaRemover: string | null = null;
  removerItemModalMensagem = '';

  folhaItemAuditoriaEntidadeId: string | null = null;

  readonly folhaItemCampoAuditLabels: Record<string, string> = {
    valor: 'Valor',
    quantidade: 'Referência (qtd)',
    folhaCapaId: 'Folha (capa)',
    folhaVerbaId: 'Evento',
  };

  get referenciaCompetencia(): string {
    return `${this.nomeMesPt(this.mes)} / ${this.ano}`;
  }

  /**
   * Igual `FolhaFechamentoPage.initializeUnidadeFilter` / lista de Vendas: com `usuario.unidade`
   * preenchida, o filtro fica fixo nela; caso contrário inicia vazio (usuário escolhe ou "Todas").
   */
  private initializeUnidadeFilter(): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.unidade && currentUser.unidade.trim() !== '') {
      this.unidadeFiltro = currentUser.unidade as Unidade;
    } else {
      this.unidadeFiltro = '';
    }
  }

  get unidadesVisiveisParaSelect(): Unidade[] {
    return Object.values(Unidade);
  }

  get campoUnidadeDesabilitado(): boolean {
    const u = this.auth.getCurrentUser();
    return !!(u?.unidade && u.unidade.trim() !== '');
  }

  /** Unidade enviada à API; ausente quando o filtro está em "Todas" (não lança neste estado). */
  private unidadeApi(): Unidade | null {
    return this.unidadeFiltro === '' ? null : this.unidadeFiltro;
  }

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Lançamento de folha',
      description:
        'Com competência aberta, a lista atualiza ao mudar unidade, tipo ou competência; use Carregar quando o lote não estiver pronto ou para repetir após erro. Clique no funcionário para expandir eventos.',
    });
    this.initializeUnidadeFilter();
    this.folha.listarTipos().subscribe({
      next: (t) => {
        this.tipos = t.filter((x) => x.ativo);
        if (!this.tipoId && this.tipos.length) this.tipoId = this.tipos[0].id;
        this.quandoMudaCompetencia();
      },
      error: () => this.errors.show('Erro ao carregar tipos.', 'Folha'),
    });
    this.folha.listarVerbas().subscribe({
      next: (v) => (this.verbasAtivas = v.filter((x) => x.ativo)),
      error: () => {},
    });
  }

  mesAnterior(): void {
    if (this.carregando) return;
    if (this.mes <= 1) {
      this.mes = 12;
      this.ano = Number(this.ano) - 1;
    } else {
      this.mes--;
    }
    this.quandoMudaCompetencia();
  }

  proximoMes(): void {
    if (this.carregando) return;
    if (this.mes >= 12) {
      this.mes = 1;
      this.ano = Number(this.ano) + 1;
    } else {
      this.mes++;
    }
    this.quandoMudaCompetencia();
  }

  precisaEscolherUnidadeParaLancar(): boolean {
    return !this.campoUnidadeDesabilitado && this.unidadeFiltro === '';
  }

  /** Competência com abertura registrada e lote fechado (RN-015: envio/visualização de recibo). */
  loteFechadoParaCompetencia(): boolean {
    const s = this.statusLote;
    return !!(s?.registrada && s.fechado);
  }

  /**
   * Carregar habilitado com filtros mínimos e abertura registrada.
   * Lote aberto: exige permissão de criação (RN-006, pode criar capas).
   * Lote fechado: exige leitura (lista capas existentes para recibo/WhatsApp).
   */
  podeCarregarTopo(): boolean {
    if (this.carregando) return false;
    if (this.precisaEscolherUnidadeParaLancar()) return false;
    if (!this.tipoId?.trim()) return false;
    const s = this.statusLote;
    if (!s?.registrada) return false;
    if (s.fechado) return this.pode().r;
    return this.pode().c;
  }

  /** Unidade específica e tipo de folha escolhidos (competência sempre definida pelo mês/ano da tela). */
  relatoriosFolhaGeralFiltrosPreenchidos(): boolean {
    return (
      !this.precisaEscolherUnidadeParaLancar() && !!this.tipoId?.trim()
    );
  }

  /** Botões sempre visíveis com leitura: desabilita sem unidade específica ou tipo de folha. */
  desabilitarBotoesRelatoriosFolhaGeralTopo(): boolean {
    return !this.relatoriosFolhaGeralFiltrosPreenchidos();
  }

  pode(): {
    r: boolean;
    c: boolean;
    u: boolean;
    d: boolean;
  } {
    const admin = this.auth.hasPermission(Permission.ADMIN_FULL);
    return {
      r: admin || this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_READ),
      c: admin || this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_CREATE),
      u: admin || this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_UPDATE),
      d: admin || this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_DELETE),
    };
  }

  /** Histórico de alterações por `folha_item` (alinha auditoria gravada como `folha_item` na API). */
  podeAuditarLinhaEvento(): boolean {
    const admin = this.auth.hasPermission(Permission.ADMIN_FULL);
    return (
      admin ||
      this.auth.hasPermission(Permission.AUDIT_VIEW) ||
      this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_READ)
    );
  }

  /** Competência com lote aberto e capa expandida não congelada (edição de eventos). */
  podeAlterarEventosNaCapaSelecionada(): boolean {
    if (!this.detalhe?.capa) return false;
    if (this.detalhe.capa.congelada) return false;
    return this.podeEditarLoteNaCompetencia();
  }

  podeCongelarCapa(): boolean {
    const podePerm =
      this.auth.hasPermission(Permission.ADMIN_FULL) ||
      this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_CONGELAR_CAPA);
    return (
      podePerm &&
      this.podeEditarLoteNaCompetencia() &&
      !!this.detalhe &&
      !this.detalhe.capa.congelada &&
      !this.carregando &&
      !this.salvandoCongelacaoCapa
    );
  }

  podeLiberarCapa(): boolean {
    const podePerm =
      this.auth.hasPermission(Permission.ADMIN_FULL) ||
      this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_LIBERAR_CAPA);
    return (
      podePerm &&
      this.podeEditarLoteNaCompetencia() &&
      !!this.detalhe &&
      !!this.detalhe.capa.congelada &&
      !this.carregando &&
      !this.salvandoCongelacaoCapa
    );
  }

  /** Abre o recibo da capa selecionada para impressão ou PDF. */
  podeImprimirRelatorioCapa(): boolean {
    return (
      this.pode().r &&
      !!this.detalhe &&
      !this.carregando &&
      (this.podeEditarLoteNaCompetencia() || this.loteFechadoParaCompetencia())
    );
  }

  podeEnviarReciboWhatsapp(): boolean {
    return (
      this.temPermissaoEnviarReciboWhatsapp() &&
      !!this.detalhe &&
      !!this.statusLote?.fechado &&
      !!this.telefoneFuncionarioAtualValido() &&
      !this.carregando &&
      !this.enviandoReciboWhatsapp
    );
  }

  motivoDesabilitadoEnviarReciboWhatsapp(): string {
    if (this.podeEnviarReciboWhatsapp()) return 'Enviar recibo por WhatsApp';
    if (!this.temPermissaoEnviarReciboWhatsapp()) {
      return 'Sem permissão para enviar recibo por WhatsApp no lançamento.';
    }
    if (!this.statusLote?.fechado) {
      return 'Disponível após fechar o lote em Controle das competências.';
    }
    if (!this.telefoneFuncionarioAtualValido()) {
      return 'Cadastre o telefone do funcionário.';
    }
    if (this.enviandoReciboWhatsapp) {
      return 'Enviando recibo por WhatsApp...';
    }
    return 'Selecione uma capa para enviar o recibo.';
  }

  imprimirRelatorioCapaFolha(): void {
    const d = this.detalhe;
    if (!d || !this.podeImprimirRelatorioCapa()) return;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (c) => this.abrirJanelaImpressaoRelatorioCapa(d, c ?? null),
      error: () => this.abrirJanelaImpressaoRelatorioCapa(d, null),
    });
  }

  private abrirJanelaImpressaoRelatorioCapa(
    d: FolhaCapaDetalheResponse,
    cfg: Configuracao | null,
  ): void {
    const html = this.montarHtmlRelatorioCapaEstiloFichaTecnica(d, cfg);
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups no navegador para gerar o recibo.', 'Folha');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 150);
  }

  imprimirRelatorioFolhaGeralConsolidado(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const un = this.unidadeApi();
    if (!un) return;
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (cfg) => this.executarRelatorioFolhaGeral(un, cfg ?? null),
      error: () => this.executarRelatorioFolhaGeral(un, null),
    });
  }

  imprimirRelatorioFolhaPorEvento(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const un = this.unidadeApi();
    if (!un) return;
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (cfg) => this.executarRelatorioFolhaPorEvento(un, cfg ?? null),
      error: () => this.executarRelatorioFolhaPorEvento(un, null),
    });
  }

  imprimirReciboGeralTodasCapas(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const un = this.unidadeApi();
    if (!un) return;
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: () => this.executarReciboGeralCompetencia(un),
      error: () => this.executarReciboGeralCompetencia(un),
    });
  }

  private executarReciboGeralCompetencia(un: Unidade): void {
    this.folha
      .listarCapasComDetalhe({
        unidade: un,
        ano: this.ano,
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          const html = this.montarHtmlReciboGeralMultiplasPaginas(un, rows);
          this.abrirPopupRelatorioHtml(html, 'recibo-geral');
          this.gerandoRelatorioFolhaGeral = false;
        },
        error: () => {
          this.errors.show(
            'Não foi possível carregar as folhas para o recibo geral. Tente novamente.',
            'Folha',
          );
          this.gerandoRelatorioFolhaGeral = false;
        },
      });
  }

  private executarRelatorioFolhaGeral(un: Unidade, cfg: Configuracao | null): void {
    this.folha
      .listarCapasComDetalhe({
        unidade: un,
        ano: this.ano,
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          const tipoDesc =
            this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
          const html = this.montarHtmlRelatorioFolhaGeralDocumento(rows, cfg, un, tipoDesc);
          this.abrirPopupRelatorioHtml(html, 'folha-geral');
          this.gerandoRelatorioFolhaGeral = false;
        },
        error: () => {
          this.errors.show(
            'Não foi possível carregar as folhas para o relatório. Tente novamente.',
            'Folha',
          );
          this.gerandoRelatorioFolhaGeral = false;
        },
      });
  }

  private executarRelatorioFolhaPorEvento(un: Unidade, cfg: Configuracao | null): void {
    this.folha
      .listarCapasComDetalhe({
        unidade: un,
        ano: this.ano,
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          const tipoDesc =
            this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
          const html = this.montarHtmlRelatorioFolhaPorEventoDocumento(rows, cfg, un, tipoDesc);
          this.abrirPopupRelatorioHtml(html, 'folha-por-evento');
          this.gerandoRelatorioFolhaGeral = false;
        },
        error: () => {
          this.errors.show(
            'Não foi possível carregar as folhas para o relatório. Tente novamente.',
            'Folha',
          );
          this.gerandoRelatorioFolhaGeral = false;
        },
      });
  }

  private abrirPopupRelatorioHtml(html: string, slugDoc: string): void {
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups no navegador para gerar o relatório.', 'Folha');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.document.title = slugDoc;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 150);
  }

  private montarHtmlRelatorioFolhaGeralDocumento(
    rows: FolhaCapaDetalheResponse[],
    config: Configuracao | null,
    unidade: Unidade,
    tipoFolhaDescricao: string,
  ): string {
    const comp = `${this.nomeMesPt(this.mes)} / ${this.ano}`;
    let totR = 0;
    let totD = 0;
    let totL = 0;
    const linhas = rows
      .map((r) => {
        totR += Number(r.totalReceitas) || 0;
        totD += Number(r.totalDespesas) || 0;
        totL += Number(r.liquido) || 0;
        const nome = (r.capa.funcionario?.nome ?? '—').trim() || '—';
        return `<tr>
          <td>${this.escapeHtml(nome)}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(r.totalReceitas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(r.totalDespesas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(r.liquido))}</td>
        </tr>`;
      })
      .join('');
    const corpoTabela =
      rows.length === 0
        ? `<tbody><tr><td colspan="4" style="text-align:center;color:#666">Nenhuma folha encontrada para os filtros.</td></tr></tbody>`
        : `<thead><tr>
            <th>Funcionário</th>
            <th class="num">Receitas</th>
            <th class="num">Despesas</th>
            <th class="num">Líquido</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr class="totais">
            <td>Totais</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(totR))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(totD))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(totL))}</td>
          </tr></tfoot>`;

    const linCab: string[] = [String(unidade), comp, tipoFolhaDescricao];

    const corpo = `<table class="tbl-rep" aria-label="Folhas por funcionário">${corpoTabela}</table>`;

    return this.montarHtmlDocumentoPadraoFicha({
      documentTitle: 'relatorio-folha-geral',
      tituloPrincipal: 'RELATÓRIO DE FOLHA GERAL',
      linhasCabecalhoCentral: linCab,
      corpo,
      config,
    });
  }

  private montarHtmlRelatorioFolhaPorEventoDocumento(
    rows: FolhaCapaDetalheResponse[],
    config: Configuracao | null,
    unidade: Unidade,
    tipoFolhaDescricao: string,
  ): string {
    type LinhaFunc = {
      funcionarioNome: string;
      valorNum: number;
    };
    type BlocoPorVerba = {
      verbaId: string;
      descricao: string;
      tipo: FolhaMovimentoTipo;
      linhas: LinhaFunc[];
    };

    const map = new Map<string, BlocoPorVerba>();

    for (const d of rows) {
      const nome =
        ((d.capa.funcionario?.nome ?? '') as string).trim() || '—';
      for (const it of d.capa.itens ?? []) {
        const vid = it.folhaVerba?.id;
        if (!vid) continue;
        let bloco = map.get(vid);
        if (!bloco) {
          bloco = {
            verbaId: vid,
            descricao: it.folhaVerba.descricao,
            tipo: it.folhaVerba.tipoMovimento,
            linhas: [],
          };
          map.set(vid, bloco);
        }
        const valor = FolhaLancamentosPage.parseDecimalFinanceiro(it.valor);
        const valorNum = Number.isNaN(valor) ? 0 : valor;

        bloco.linhas.push({
          funcionarioNome: nome,
          valorNum,
        });
      }
    }

    const receitas = [...map.values()].filter(
      (b) => b.tipo === FolhaMovimentoTipo.RECEITA,
    );
    const despesas = [...map.values()].filter(
      (b) => b.tipo === FolhaMovimentoTipo.DESPESA,
    );
    const ordenarBloc = (a: BlocoPorVerba, b: BlocoPorVerba) =>
      a.descricao.localeCompare(b.descricao, 'pt-BR');
    receitas.sort(ordenarBloc);
    despesas.sort(ordenarBloc);

    const htmlBlocoVerba = (b: BlocoPorVerba): string => {
      const linOrd = [...b.linhas].sort((a, c) =>
        a.funcionarioNome.localeCompare(c.funcionarioNome, 'pt-BR'),
      );
      let sumV = 0;
      const trs = linOrd
        .map((ln) => {
          sumV += ln.valorNum;
          return `<tr>
            <td>${this.escapeHtml(ln.funcionarioNome)}</td>
            <td class="num">1</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.valorNum))}</td>
          </tr>`;
        })
        .join('');
      const qtdOcorrencias = linOrd.length;
      const qTotalFmt = String(qtdOcorrencias);
      return `<div class="evento-det-block">
        <div class="evento-det-titulo">${this.escapeHtml(b.descricao)}</div>
        <table class="tbl-rep tbl-rep-evento-det" aria-label="${this.escapeHtml(b.descricao)}">
          <thead><tr>
            <th>Funcionário</th>
            <th class="num">Quantidade</th>
            <th class="num">Valor</th>
          </tr></thead>
          <tbody>${trs}</tbody>
          <tfoot><tr class="totais">
            <td>${this.escapeHtml('Total')}</td>
            <td class="num">${this.escapeHtml(qTotalFmt)}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(sumV))}</td>
          </tr></tfoot>
        </table>
      </div>`;
    };

    const montarSecaoTipo = (
      tituloMacro: string,
      blocos: BlocoPorVerba[],
    ): string => {
      if (!blocos.length) {
        return `<div class="section"><div class="section-title">${tituloMacro}</div>
          <p class="vazio-secao">Nenhum lançamento nesta competência.</p></div>`;
      }
      return `<div class="section">
          <div class="section-title">${tituloMacro}</div>
          ${blocos.map((b) => htmlBlocoVerba(b)).join('')}
        </div>`;
    };

    const comp = `${this.nomeMesPt(this.mes)} / ${this.ano}`;
    const linCabEvt: string[] = [String(unidade), comp, tipoFolhaDescricao];

    const corpo = `${montarSecaoTipo('RECEITAS', receitas)}
      ${montarSecaoTipo('DESPESAS', despesas)}`;

    return this.montarHtmlDocumentoPadraoFicha({
      documentTitle: 'folha-geral-por-evento',
      tituloPrincipal: 'FOLHA GERAL POR EVENTO',
      linhasCabecalhoCentral: linCabEvt,
      corpo,
      config,
    });
  }

  /**
   * Cabeçalho tipo ficha técnica (logo + título central) e rodapé com data/usuário; sem assinatura de farmacêutico.
   */
  private montarHtmlDocumentoPadraoFicha(opts: {
    documentTitle: string;
    tituloPrincipal: string;
    linhasCabecalhoCentral: string[];
    corpo: string;
    config: Configuracao | null;
  }): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    let logoHtml = '';
    if (opts.config?.hasLogo) {
      logoHtml = `<img src="${environment.apiUrl}/configuracao/logo" alt="Logo" style="max-height: 80px; max-width: 120px; display: block;" />`;
    }
    const headerRow = opts.linhasCabecalhoCentral
      .map((t) => `<div>${this.escapeHtml(t)}</div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${this.escapeHtml(opts.documentTitle)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 15px; line-height: 1.35; font-size: 11px; color: #111; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
    .logo-box { flex: 0 0 auto; margin-right: 20px; }
    .header-content { flex: 1 1 auto; text-align: center; }
    .header-title { margin: 0; font-size: 1.5em; font-weight: bold; }
    .header-row { display: flex; gap: 20px; margin-top: 8px; font-size: 1em; justify-content: center; flex-wrap: wrap; }
    .header-row div { font-weight: bold; }
    .section { margin-bottom: 18px; }
    .section-title { background: #f0f0f0; padding: 6px; font-weight: bold; border-left: 4px solid #007bff; margin-bottom: 8px; font-size: 12px; }
    .vazio-secao { color: #666; margin: 0; }
    .tbl-rep { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tbl-rep th, .tbl-rep td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
    .tbl-rep th { background: #f5f5f5; font-weight: bold; text-align: left; }
    .tbl-rep th.num, .tbl-rep td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tbl-rep .totais td { font-weight: bold; background: #fff8e6; }
    .tbl-rep tfoot .totais td { border-top: 2px solid #999; }
    .evento-det-block { margin-bottom: 14px; page-break-inside: avoid; }
    .evento-det-titulo { font-weight: 700; font-size: 12px; margin: 10px 0 6px; color: #1e293b; }
    .evento-det-block table { margin-top: 4px; }
    @media print {
      @page { margin: 15mm 10mm 40px 10mm; }
      .footer-print {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100vw;
        font-size: 9px !important;
        color: #444 !important;
        z-index: 1000;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-box">${logoHtml}</div>
    <div class="header-content">
      <h1 class="header-title">${this.escapeHtml(opts.tituloPrincipal)}</h1>
      <div class="header-row">${headerRow}</div>
    </div>
  </div>
  ${opts.corpo}
  <div class="footer-print">
    Documento gerado em ${new Date().toLocaleString('pt-BR')} &nbsp; Impresso por: ${this.escapeHtml(userName)}
  </div>
</body>
</html>`;
  }

  private estilosReciboPagamento(variant: 'unico' | 'geral'): string {
    const geralLayout =
      variant === 'geral'
        ? `
          body.recibo-geral-bundle { margin: 0; background: #fff; color: var(--r-text); }
          .recibo-geral-pagina {
            padding: 14px 16px 28px;
            min-height: 100vh;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            page-break-after: always;
            break-after: page;
          }
          .recibo-geral-pagina:last-of-type,
          .recibo-geral-pagina[data-last="1"] {
            page-break-after: auto;
            break-after: auto;
          }
          .recibo-geral-wrap {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
          }
          .recibo-geral-vazio-msg {
            margin: 32px auto 0;
            max-width: 520px;
            text-align: center;
            color: #64748b;
            font-size: 13px;
            line-height: 1.45;
          }
        `
        : '';

    const printRules =
      variant === 'unico'
        ? `
          @media print {
            @page { margin: 12mm 10mm 42px;}
            body { margin: 6px;}
            .footer-print {
              position: fixed;
              bottom: 0;
              left: 0;
              width: 100vw;
              font-size: 9px!important;
              color: #475569!important;
              z-index: 1000;
            }
          }
        `
        : `
          @media print {
            @page { margin: 12mm 10mm 16mm;}
            body.recibo-geral-bundle { margin: 0; padding: 0; }
            .recibo-geral-pagina .footer-print {
              position: static;
              margin-top: auto;
              padding-top: 16px;
            }
          }
        `;

    return `
          :root {
            --r-text:#212529;
            --r-banner-rec:#3d5530;
            --r-banner-desc:#c41e3a;
            --r-liq-box:#ff9800;
            --r-liq-box-border:#e65100;
            --r-stripe-b:#f3f4f6;
          }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 14px 16px 48px; line-height: 1.35; font-size: 11px; color: var(--r-text); background: #fff; }
          .doc-cabecalho-recibo { text-align: center; margin-bottom: 14px; }
          .doc-title-main { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111; line-height: 1.25; }
          .doc-ref-mensal { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #111; }
          .doc-nome-func { margin: 0; font-size: 13px; font-weight: 600; color: #111; }
          .recibo-blocos { max-width: 540px; margin: 14px auto 0; }
          .bloco-sec-recibo { margin-bottom: 14px; border: 1px solid #cfd4dc; border-radius: 4px; overflow: hidden;}
          .sec-banner {
            text-align: center; padding: 9px 12px; font-size: 12px; font-weight: 800;
            letter-spacing: 0.14em; text-transform: uppercase; color: #fff;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .sec-banner-rec { background: var(--r-banner-rec); }
          .sec-banner-desc { background: var(--r-banner-desc); }
          .sec-tabela-mini { width: 100%; border-collapse: collapse; font-size: 11px; }
          .sec-tabela-mini td { padding: 8px 14px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; overflow-wrap:anywhere;}
          .sec-tabela-mini .cell-desc { text-align: left; font-weight: 500; width: 65%; }
          .sec-tabela-mini .cell-val { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 700; min-width: 120px; }
          .stripe-a td { background: #fff; }
          .stripe-b td { background: var(--r-stripe-b); }
          .sem-itens-msg { color: #64748b; font-style: italic; text-align: center; }
          .row-total-mini td {
            font-weight: 800;
            background: #e5e7eb !important;
            border-bottom: none !important;
            border-top: 2px solid #9ca3af;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .linha-liquido-destaque {
            display: flex; align-items: center; justify-content: space-between; gap: 16px;
            flex-wrap: wrap; padding: 16px 14px; margin-top: 6px;
            border: 2px solid #1f2937; background: #fafafa;
          }
          .lbl-liq { font-size: 17px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; color: #111;}
          .caixa-valor-liq {
            background: var(--r-liq-box); color: #111; font-size: 21px; font-weight: 900;
            padding: 12px 20px; border: 3px solid var(--r-liq-box-border); border-radius: 4px;
            font-variant-numeric: tabular-nums;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .footer-print { font-size: 10px; color: #495057; margin-top: 20px; text-align: center;}
          ${geralLayout}
          ${printRules}
        `;
  }

  private montarCorpoHtmlReciboPagamento(d: FolhaCapaDetalheResponse): string {
    const capa = d.capa;
    const f = capa.funcionario;
    const refMensalTitulo = `${this.nomeMesPt(capa.mes)}/${capa.ano}`;

    const ordenarPorDescricao = <
      U extends {
        folhaVerba: { descricao: string };
      },
    >(xs: U[]): U[] =>
      [...xs].sort((a, b) =>
        a.folhaVerba.descricao.localeCompare(b.folhaVerba.descricao, 'pt-BR'),
      );

    const itensReceitas = ordenarPorDescricao(
      (capa.itens ?? []).filter(
        (it) =>
          it.folhaVerba.tipoMovimento === FolhaMovimentoTipo.RECEITA,
      ),
    );
    const itensDespesas = ordenarPorDescricao(
      (capa.itens ?? []).filter(
        (it) =>
          it.folhaVerba.tipoMovimento === FolhaMovimentoTipo.DESPESA,
      ),
    );

    const linhasDuasColunasSecao = <
      U extends {
        valor: unknown;
        folhaVerba: { descricao: string };
      },
    >(
      itens: U[],
      msgVazio: string,
    ): string => {
      if (!itens.length) {
        return `<tr class="stripe-a"><td colspan="2" class="sem-itens-msg">${this.escapeHtml(
          msgVazio,
        )}</td></tr>`;
      }
      return itens
        .map((it, idx) => {
          const stripe = idx % 2 === 0 ? 'stripe-a' : 'stripe-b';
          const valorEsc = this.escapeHtml(this.moedaListaCapa(it.valor));
          return `<tr class="${stripe}"><td class="cell-desc">${this.escapeHtml(
            it.folhaVerba.descricao,
          )}</td><td class="cell-val">${valorEsc}</td></tr>`;
        })
        .join('');
    };

    const bodyReceitas = linhasDuasColunasSecao(
      itensReceitas,
      'Nenhuma receita nesta folha.',
    );
    const bodyDespesas = linhasDuasColunasSecao(
      itensDespesas,
      'Nenhum desconto nesta folha.',
    );

    const moedaLiquido = this.escapeHtml(this.moedaListaCapa(d.liquido));
    const moedaTotRec = this.escapeHtml(this.moedaListaCapa(d.totalReceitas));
    const moedaTotDesc = this.escapeHtml(this.moedaListaCapa(d.totalDespesas));

    return `<header class="doc-cabecalho-recibo">
          <h1 class="doc-title-main">Recibo de Pagamento</h1>
          <p class="doc-ref-mensal">Folha mensal referente a ${this.escapeHtml(refMensalTitulo)}</p>
          <p class="doc-nome-func">${this.escapeHtml((f.nome || '').trim() || '—')}</p>
        </header>

        <div class="recibo-blocos" role="presentation">
          <section class="bloco-sec-recibo" aria-label="Receitas">
            <header class="sec-banner sec-banner-rec">Receitas</header>
            <table class="sec-tabela-mini">
              <tbody>
                ${bodyReceitas}
                <tr class="row-total-mini">
                  <td class="cell-desc">${this.escapeHtml('TOTAL')}</td>
                  <td class="cell-val">${moedaTotRec}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section class="bloco-sec-recibo" aria-label="Descontos">
            <header class="sec-banner sec-banner-desc">Descontos</header>
            <table class="sec-tabela-mini">
              <tbody>
                ${bodyDespesas}
                <tr class="row-total-mini">
                  <td class="cell-desc">${this.escapeHtml('TOTAL DOS DESCONTOS')}</td>
                  <td class="cell-val">${moedaTotDesc}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <div class="linha-liquido-destaque" aria-label="Total líquido">
            <span class="lbl-liq">${this.escapeHtml('TOTAL LÍQUIDO')}</span>
            <span class="caixa-valor-liq">${moedaLiquido}</span>
          </div>
        </div>`;
  }

  private montarHtmlReciboGeralMultiplasPaginas(
    un: Unidade,
    rows: FolhaCapaDetalheResponse[],
  ): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const footer = `<div class="footer-print">
          Documento gerado em ${new Date().toLocaleString('pt-BR')} · Impresso por: ${this.escapeHtml(userName)}
        </div>`;
    const sorted = [...rows].sort((a, b) =>
      this.nomeParaCapa(a).localeCompare(this.nomeParaCapa(b), 'pt-BR'),
    );
    const slugUn = String(un)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
    const nomeRelatorio = `recibo-geral-${slugUn || 'unidade'}-${this.ano}-${String(this.mes).padStart(2, '0')}`;
    const tipoDesc =
      this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
    const refComp = `${this.nomeMesPt(this.mes)}/${this.ano}`;

    const paginas =
      sorted.length === 0
        ? `<div class="recibo-geral-pagina recibo-geral-vazio" data-last="1">
          <header class="doc-cabecalho-recibo">
            <h1 class="doc-title-main">Recibo de Pagamento — Geral</h1>
            <p class="doc-ref-mensal">Folha mensal referente a ${this.escapeHtml(refComp)}</p>
            <p class="doc-nome-func">${this.escapeHtml(String(un))} · ${this.escapeHtml(tipoDesc)}</p>
          </header>
          <p class="recibo-geral-vazio-msg">Não há folhas nesta competência para os filtros selecionados.</p>
          ${footer}
        </div>`
        : sorted
            .map(
              (d, i, arr) => `<div class="recibo-geral-pagina"${
                i === arr.length - 1 ? ' data-last="1"' : ''
              }>
          <div class="recibo-geral-wrap">
            ${this.montarCorpoHtmlReciboPagamento(d)}
          </div>
          ${footer}
        </div>`,
            )
            .join('');

    return `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8"/>
        <title>${nomeRelatorio}</title>
        <style>
          ${this.estilosReciboPagamento('geral')}
        </style>
      </head>
      <body class="recibo-geral-bundle">
        ${paginas}
      </body>
      </html>`;
  }

  private montarHtmlRelatorioCapaEstiloFichaTecnica(
    d: FolhaCapaDetalheResponse,
    _config: Configuracao | null,
  ): string {
    const capa = d.capa;
    const f = capa.funcionario;
    const slugNome = (f.nome || 'funcionario')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const nomeRelatorio = `relatorio-folha-${slugNome || 'funcionario'}-${capa.ano}-${String(capa.mes).padStart(2, '0')}`;

    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';

    return `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8"/>
        <title>${nomeRelatorio}</title>
        <style>
          ${this.estilosReciboPagamento('unico')}
        </style>
      </head>
      <body>
        ${this.montarCorpoHtmlReciboPagamento(d)}

        <div class="footer-print">
          Documento gerado em ${new Date().toLocaleString('pt-BR')} · Impresso por: ${this.escapeHtml(userName)}
        </div>
      </body>
      </html>`;
  }

  private escapeHtml(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Coluna de ações por linha: Editar / Auditoria / Remover (sem “Incluir” — esse fluxo está no modal em cada quadro).
   */
  mostrarColunaAcoesLinha(): boolean {
    if (this.loteFechadoParaCompetencia()) {
      return this.podeAuditarLinhaEvento();
    }
    return (
      this.podeAuditarLinhaEvento() || this.podeBotaoEditarItem() || this.podeRemoverItem()
    );
  }

  podeIncluirEventoPorModal(): boolean {
    return this.podeAlterarEventosNaCapaSelecionada() && this.pode().c;
  }

  podeBotaoEditarItem(): boolean {
    return this.podeAlterarEventosNaCapaSelecionada() && this.pode().u;
  }

  podeRemoverItem(): boolean {
    return this.podeAlterarEventosNaCapaSelecionada() && this.pode().d;
  }

  verbasListaPorMovimento(tipo: FolhaMovimentoTipo): FolhaVerba[] {
    return this.verbasAtivas.filter((v) => v.tipoMovimento === tipo);
  }

  itensCapaPorMovimento(tipo: FolhaMovimentoTipo): FolhaItem[] {
    const itens = this.detalhe?.capa.itens ?? [];
    return itens.filter((i) => i.folhaVerba.tipoMovimento === tipo);
  }

  /** Descrição da verba escolhida no modal de inclusão (após selecionar no `<select>`). */
  get descricaoVerbaSelecionadaModalInclusao(): string {
    const id = this.modalInclusaoVerbaId?.trim();
    const tipo = this.modalInclusaoTipo;
    if (!id || !tipo) return '';
    const vb = this.verbasListaPorMovimento(tipo).find((v) => v.id === id);
    return vb?.descricao?.trim() ?? '';
  }

  private limparModalInclusao(): void {
    this.modalInclusaoTipo = null;
    this.modalInclusaoVerbaId = '';
    this.modalInclusaoValorTexto = '';
    this.modalInclusaoQuantidadeTexto = '1';
  }

  abrirModalInclusao(tipo: FolhaMovimentoTipo): void {
    if (!this.podeIncluirEventoPorModal() || !this.detalhe) return;
    this.fecharModalEdicaoSomenteEstado();
    this.modalInclusaoTipo = tipo;
    this.modalInclusaoAberto = true;
    this.modalInclusaoVerbaId = '';
    this.modalInclusaoValorTexto = '';
    this.modalInclusaoQuantidadeTexto = '1';
  }

  fecharModalInclusao(): void {
    this.modalInclusaoAberto = false;
    this.limparModalInclusao();
  }

  abrirModalEdicaoItem(it: FolhaItem): void {
    if (!this.podeBotaoEditarItem() || !this.detalhe) return;
    this.fecharModalInclusaoSomenteEstado();
    this.modalEdicaoAberto = true;
    this.itemModalEdicaoId = it.id;
    this.modalEdicaoMovimentoTipo = it.folhaVerba.tipoMovimento;
    this.edicaoTituloEvento = it.folhaVerba.descricao;
    this.edicaoValorTexto = this.moedaListaCapa(it.valor);
    this.edicaoQuantidadeTexto = FolhaLancamentosPage.quantidadeFormatadaInicial(it.quantidade);
  }

  fecharModalEdicao(): void {
    this.modalEdicaoAberto = false;
    this.itemModalEdicaoId = null;
    this.modalEdicaoMovimentoTipo = null;
    this.edicaoTituloEvento = '';
    this.edicaoValorTexto = '';
    this.edicaoQuantidadeTexto = '1';
  }

  private fecharModalInclusaoSomenteEstado(): void {
    if (!this.modalInclusaoAberto) return;
    this.modalInclusaoAberto = false;
    this.limparModalInclusao();
  }

  private fecharModalEdicaoSomenteEstado(): void {
    if (!this.modalEdicaoAberto) return;
    this.fecharModalEdicao();
  }

  private fecharTodosModaisItem(): void {
    this.fecharModalInclusaoSomenteEstado();
    this.fecharModalEdicaoSomenteEstado();
    if (this.showRemoverItemModal) {
      this.fecharRemoverItemModal();
    }
  }

  formatarCampoValorModalInclusaoBlur(): void {
    this.formatarCampoValorTextoBlur(
      (v) => (this.modalInclusaoValorTexto = v),
      () => this.modalInclusaoValorTexto,
    );
  }

  formatarCampoValorModalEdicaoBlur(): void {
    this.formatarCampoValorTextoBlur((v) => (this.edicaoValorTexto = v), () => this.edicaoValorTexto);
  }

  confirmarModalInclusao(): void {
    if (!this.pode().c || !this.detalhe || !this.modalInclusaoTipo || !this.modalInclusaoAberto) return;
    if (!this.modalInclusaoVerbaId) {
      this.errors.show('Escolha um evento para incluir.', 'Item');
      return;
    }
    const v = FolhaLancamentosPage.valorDigitadoParaNumero(this.modalInclusaoValorTexto.trim());
    if (Number.isNaN(v)) {
      this.errors.show('Informe um valor numérico válido (ex.: R$ 100,00).', 'Item');
      return;
    }
    const qRaw = this.modalInclusaoQuantidadeTexto.trim() || '1';
    const q = FolhaLancamentosPage.valorDigitadoParaNumero(qRaw);
    if (Number.isNaN(q) || q < 0.0001) {
      this.errors.show('Informe uma referência/quantidade válida (> 0).', 'Item');
      return;
    }
    const un = this.unidadeApi();
    if (!un) return;
    this.salvandoModalLancamento = true;
    this.folha
      .postItem(this.detalhe.capa.id, un, {
        folhaVerbaId: this.modalInclusaoVerbaId,
        valor: v,
        quantidade: q,
      })
      .subscribe({
        next: (d) => {
          this.sincronizaDetalheCompletoAPosAlteracao(d);
          this.modalInclusaoAberto = false;
          this.limparModalInclusao();
          this.salvandoModalLancamento = false;
        },
        error: (e) => {
          this.salvandoModalLancamento = false;
          this.errors.show(e?.error?.message ?? 'Erro ao lançar item.', 'Item');
        },
      });
  }

  salvarModalEdicao(): void {
    if (!this.pode().u || !this.detalhe || !this.modalEdicaoAberto || !this.itemModalEdicaoId) return;
    const valorStr = this.edicaoValorTexto;
    const qtdStr = this.edicaoQuantidadeTexto;

    const v = FolhaLancamentosPage.valorDigitadoParaNumero(valorStr.trim());
    const q = FolhaLancamentosPage.valorDigitadoParaNumero(qtdStr.trim() || '1');
    if (Number.isNaN(v) || Number.isNaN(q) || q < 0.0001) {
      this.errors.show('Informe valor e quantidade válidos (quantidade > 0).', 'Item');
      return;
    }

    const un = this.unidadeApi();
    if (!un) return;
    const itemId = this.itemModalEdicaoId;
    this.salvandoModalLancamento = true;
    this.folha
      .patchItem(this.detalhe.capa.id, itemId, un, { valor: v, quantidade: q })
      .subscribe({
        next: (d) => {
          this.sincronizaDetalheCompletoAPosAlteracao(d);
          this.fecharModalEdicao();
          this.salvandoModalLancamento = false;
        },
        error: (e) => {
          this.salvandoModalLancamento = false;
          this.errors.show(e?.error?.message ?? 'Erro ao salvar lançamento.', 'Item');
        },
      });
  }

  quantidadeSomenteLeitura(it: Pick<FolhaItem, 'quantidade'>): string {
    return FolhaLancamentosPage.quantidadeFormatadaInicial(it.quantidade);
  }

  abrirAuditoriaFolhaItem(itemId: string): void {
    this.folhaItemAuditoriaEntidadeId = itemId;
  }

  fecharAuditoriaFolhaItem(): void {
    this.folhaItemAuditoriaEntidadeId = null;
  }

  /** Abertura registrada na API e lote não fechado. */
  podeEditarLoteNaCompetencia(): boolean {
    const s = this.statusLote;
    if (!s) return false;
    return !!(s.registrada && !s.fechado);
  }

  atualizarStatusInicial(): void {
    if (!this.tipoId) return;
    const un = this.unidadeApi();
    if (!un) {
      this.statusLote = null;
      this.carregando = false;
      return;
    }
    this.carregando = false;
    this.atualizaStatus();
  }

  atualizaStatus(): void {
    const un = this.unidadeApi();
    if (!this.tipoId || !un) return;
    this.folha.statusFechamento(un, this.ano, this.mes, this.tipoId).subscribe({
      next: (s) => {
        this.statusLote = s;
        this.tentativaCarregarCapasAoMudarFiltroOuCompetencia(un, s);
      },
    });
  }

  quandoMudaCompetencia(): void {
    this.fecharTodosModaisItem();
    this.detalhe = null;
    this.capasNaCompetencia = [];
    this.statusLote = null;
    this.atualizarStatusInicial();
  }

  carregarCapasNaCompetencia(): void {
    if (!this.podeCarregarTopo()) return;
    const un = this.unidadeApi();
    if (!un) {
      this.errors.show('Escolha uma unidade específica para lançar (não use "Todas").', 'Validação');
      return;
    }
    if (!this.tipoId) {
      this.errors.show('Selecione o tipo de folha.', 'Validação');
      return;
    }
    this.carregando = true;
    this.folha.statusFechamento(un, this.ano, this.mes, this.tipoId).subscribe({
      next: (s) => {
        this.statusLote = s;
        this.dispatchCargaCapaDepoisDoStatus(un);
      },
      error: (e) => {
        this.carregando = false;
        this.errors.show(e?.error?.message ?? 'Erro ao consultar competência.', 'Controle');
      },
    });
  }

  /**
   * Com filtros válidos, carrega lista de capas automaticamente após consultar o status:
   * lote aberto → POST carregar-competencia; lote fechado → GET com detalhe (somente leitura).
   */
  private tentativaCarregarCapasAoMudarFiltroOuCompetencia(un: Unidade, s: FolhaFechamentoStatus): void {
    if (this.carregando) return;
    if (this.precisaEscolherUnidadeParaLancar()) return;
    if (!this.tipoId?.trim()) return;
    if (!s.registrada) return;

    if (s.fechado) {
      if (!this.pode().r) return;
      this.carregando = true;
      this.executarListarCapasCompetenciaFechada(un);
      return;
    }

    if (!this.pode().c) return;
    this.carregando = true;
    this.executarPostCarregarCompetencia(un);
  }

  private executarPostCarregarCompetencia(un: Unidade): void {
    this.folha
      .postCarregarCompetencia({
        unidade: un,
        ano: this.ano,
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          this.finalizarCargaCapas(rows, {
            vazioAberta:
              'Nenhum funcionário elegível nesta competência (ativo; admissão até o mês/ano vigente; se demitido, competência antes do mês da demissão — RN-011).',
          });
        },
        error: (e) => {
          this.carregando = false;
          this.errors.show(e?.error?.message ?? 'Erro ao carregar folhas.', 'Folha');
        },
      });
  }

  /** Lote fechado: apenas lista capas já existentes (sem criar novas). */
  private executarListarCapasCompetenciaFechada(un: Unidade): void {
    this.folha
      .listarCapasComDetalhe({
        unidade: un,
        ano: this.ano,
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          this.finalizarCargaCapas(rows, {
            vazioFechada: 'Nenhuma folha (capa) encontrada nesta competência fechada.',
          });
        },
        error: (e) => {
          this.carregando = false;
          this.errors.show(e?.error?.message ?? 'Erro ao carregar folhas.', 'Folha');
        },
      });
  }

  private finalizarCargaCapas(
    rows: FolhaCapaDetalheResponse[],
    msgs: { vazioAberta?: string; vazioFechada?: string },
  ): void {
    this.capasNaCompetencia = rows;
    this.fecharTodosModaisItem();
    this.detalhe = null;
    this.carregando = false;
    if (rows.length === 0) {
      const msg = this.loteFechadoParaCompetencia()
        ? msgs.vazioFechada
        : msgs.vazioAberta;
      if (msg) this.errors.show(msg, 'Folha');
    }
  }

  /** Roda depois que `statusLote` foi atualizado no fluxo manual (botão Carregar). */
  private dispatchCargaCapaDepoisDoStatus(un: Unidade): void {
    if (!this.statusLote) {
      this.carregando = false;
      return;
    }
    if (!this.statusLote.registrada) {
      this.carregando = false;
      this.errors.show(
        'Abertura não registrada nesta competência. Registre em Folha › Controle das competências.',
        'Controle',
      );
      return;
    }
    if (this.statusLote.fechado) {
      this.executarListarCapasCompetenciaFechada(un);
      return;
    }
    this.executarPostCarregarCompetencia(un);
  }

  nomeParaCapa(row: FolhaCapaDetalheResponse): string {
    return this.nomeFuncionario(row.capa.funcionario);
  }

  /**
   * Valores monetários na grade principal; evita `CurrencyPipe` (entradas string/omitidas pela API ficam vazias).
   */
  moedaListaCapa(valor: unknown): string {
    const n = FolhaLancamentosPage.parseDecimalFinanceiro(valor);
    return Number.isNaN(n) ? '—' : this.formatoMoedaCapaLista.format(n);
  }

  private static parseDecimalFinanceiro(valor: unknown): number {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : Number.NaN;
    const normalizado = String(valor).trim().replace(/\s/g, '').replace(',', '.');
    const n = Number.parseFloat(normalizado);
    return Number.isFinite(n) ? n : Number.NaN;
  }

  /** Aceita `1500`, `1500.5`, `1500,5`, `1.500,00`, `R$ 1.500,00` digitados na célula. */
  private static valorDigitadoParaNumero(valorStr: string): number {
    let t = valorStr.trim().replace(/\s/g, '').replace(/r\$/gi, '');
    if (t.includes(',') && /\.\d{3}/.test(t)) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else if (t.includes(',') && t.includes('.')) {
      const lastComma = t.lastIndexOf(',');
      const lastDot = t.lastIndexOf('.');
      t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    } else if (t.includes(',')) {
      t = t.replace(',', '.');
    }
    return Number.parseFloat(t);
  }

  ariaLabelListaCapa(row: FolhaCapaDetalheResponse): string {
    return `${this.nomeParaCapa(row)}. Líquido ${this.moedaListaCapa(row.liquido)}`;
  }

  /** Alterna a capa em edição no próprio card; segundo clique na mesma linha recolhe. */
  selecionarCapaParaEdicao(row: FolhaCapaDetalheResponse): void {
    if (this.detalhe?.capa.id === row.capa.id) {
      this.detalhe = null;
      this.fecharTodosModaisItem();
      return;
    }
    this.fecharTodosModaisItem();
    this.detalhe = row;
  }

  private static quantidadeFormatadaInicial(q: unknown): string {
    const n = Number.parseFloat(String(q ?? '1').replace(',', '.'));
    const x = Number.isFinite(n) ? n : 1;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(x);
  }

  private formatarCampoValorTextoBlur(set: (s: string) => void, get: () => string): void {
    const t = get().trim();
    if (t === '') return;
    const v = FolhaLancamentosPage.valorDigitadoParaNumero(get());
    if (!Number.isNaN(v)) {
      set(this.moedaListaCapa(v));
    }
  }

  capaEhSelecionadaNaGrade(row: FolhaCapaDetalheResponse): boolean {
    return this.detalhe?.capa.id === row.capa.id;
  }

  private atualizarOuInserirCapaNaLista(d: FolhaCapaDetalheResponse): void {
    const i = this.capasNaCompetencia.findIndex((c) => c.capa.id === d.capa.id);
    if (i >= 0) {
      const next = [...this.capasNaCompetencia];
      next[i] = d;
      this.capasNaCompetencia = next;
      return;
    }
    const next = [...this.capasNaCompetencia, d].sort((a, b) =>
      this.nomeParaCapa(a).localeCompare(this.nomeParaCapa(b), 'pt-BR'),
    );
    this.capasNaCompetencia = next;
  }

  sincronizaDetalheCompletoAPosAlteracao(d: FolhaCapaDetalheResponse): void {
    this.detalhe = d;
    this.atualizarOuInserirCapaNaLista(d);
  }

  solicitarRemoverItem(itemId: string): void {
    if (!this.podeRemoverItem()) return;
    if (!this.detalhe?.capa.itens?.length) return;
    const it = this.detalhe.capa.itens.find((i) => i.id === itemId);
    if (!it) return;
    this.itemIdParaRemover = itemId;
    const ev = it.folhaVerba?.descricao?.trim();
    this.removerItemModalMensagem = ev
      ? `Remover o lançamento "${ev}"? Esta ação não pode ser desfeita automaticamente.`
      : 'Remover este lançamento? Esta ação não pode ser desfeita automaticamente.';
    this.showRemoverItemModal = true;
  }

  fecharRemoverItemModal(): void {
    this.showRemoverItemModal = false;
    this.itemIdParaRemover = null;
    this.removerItemModalMensagem = '';
  }

  confirmarRemoverItemModal(): void {
    const id = this.itemIdParaRemover;
    const capaId = this.detalhe?.capa.id;
    this.fecharRemoverItemModal();
    if (!id || !capaId || !this.podeRemoverItem()) return;
    const un = this.unidadeApi();
    if (!un) return;
    this.folha.deleteItem(capaId, id, un).subscribe({
      next: (d) => this.sincronizaDetalheCompletoAPosAlteracao(d),
      error: (e) => this.errors.show(e?.error?.message ?? 'Erro.', 'Item'),
    });
  }

  nomeFuncionario(f?: FuncionarioFolha): string {
    return f?.nome ?? '—';
  }

  solicitarCongelarCapa(): void {
    if (!this.podeCongelarCapa() || !this.detalhe) return;
    this.showCongelarCapaModal = true;
  }

  fecharCongelarCapaModal(): void {
    this.showCongelarCapaModal = false;
  }

  confirmarCongelarCapaModal(): void {
    this.fecharCongelarCapaModal();
    const un = this.unidadeApi();
    if (!this.detalhe || !un) return;
    this.salvandoCongelacaoCapa = true;
    this.folha.postCongelarCapa(this.detalhe.capa.id, un).subscribe({
      next: (d) => {
        this.sincronizaDetalheCompletoAPosAlteracao(d);
        this.salvandoCongelacaoCapa = false;
      },
      error: (e) => {
        this.salvandoCongelacaoCapa = false;
        this.errors.show(e?.error?.message ?? 'Erro ao congelar a folha.', 'Folha');
      },
    });
  }

  solicitarLiberarCapa(): void {
    if (!this.podeLiberarCapa() || !this.detalhe) return;
    this.showLiberarCapaModal = true;
  }

  solicitarEnviarReciboWhatsapp(): void {
    if (!this.podeEnviarReciboWhatsapp() || !this.detalhe) return;
    this.showEnviarReciboWhatsappModal = true;
  }

  fecharLiberarCapaModal(): void {
    this.showLiberarCapaModal = false;
  }

  confirmarLiberarCapaModal(): void {
    this.fecharLiberarCapaModal();
    const un = this.unidadeApi();
    if (!this.detalhe || !un) return;
    this.salvandoCongelacaoCapa = true;
    this.folha.postLiberarCapa(this.detalhe.capa.id, un).subscribe({
      next: (d) => {
        this.sincronizaDetalheCompletoAPosAlteracao(d);
        this.salvandoCongelacaoCapa = false;
      },
      error: (e) => {
        this.salvandoCongelacaoCapa = false;
        this.errors.show(e?.error?.message ?? 'Erro ao liberar a folha.', 'Folha');
      },
    });
  }

  fecharEnviarReciboWhatsappModal(): void {
    this.showEnviarReciboWhatsappModal = false;
  }

  confirmarEnviarReciboWhatsappModal(): void {
    this.fecharEnviarReciboWhatsappModal();
    const un = this.unidadeApi();
    if (!this.detalhe || !un || !this.podeEnviarReciboWhatsapp()) return;
    this.enviandoReciboWhatsapp = true;
    this.folha.enviarReciboWhatsapp(this.detalhe.capa.id, un).subscribe({
      next: () => {
        this.enviandoReciboWhatsapp = false;
        this.errors.show('Recibo enviado por WhatsApp com sucesso.', 'Folha');
      },
      error: (e) => {
        this.enviandoReciboWhatsapp = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao enviar recibo por WhatsApp.',
          'WhatsApp',
        );
      },
    });
  }

  temPermissaoEnviarReciboWhatsappIndividual(): boolean {
    if (this.auth.hasPermission(Permission.ADMIN_FULL)) return true;
    return this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_ENVIAR_RECIBO_WHATSAPP);
  }

  private temPermissaoEnviarReciboWhatsapp(): boolean {
    return this.temPermissaoEnviarReciboWhatsappIndividual();
  }

  private telefoneFuncionarioAtualValido(): boolean {
    const telefone = this.detalhe?.capa?.funcionario?.telefone?.trim();
    return !!telefone;
  }
}
