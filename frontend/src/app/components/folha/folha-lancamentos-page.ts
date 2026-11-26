import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
import { FolhaFuncionarioFormComponent } from './folha-funcionario-form';
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
    FolhaFuncionarioFormComponent,
  ],
  templateUrl: './folha-lancamentos-page.html',
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
  /** Após Carregar: capas da competência + tipo (elegíveis e capas já existentes de inelegíveis — RN-011). */
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
  excluindoCapa = false;
  enviandoReciboWhatsapp = false;

  showExcluirCapaModal = false;
  excluirCapaModalMensagem = '';

  showCongelarCapaModal = false;
  showLiberarCapaModal = false;
  showEnviarReciboWhatsappModal = false;

  /** Capas marcadas para o arquivo de pagamento PagBank (RN-017). */
  capasSelecionadasArquivo = new Set<string>();
  gerandoArquivoPagamento = false;
  showArquivoPagamentoAvisosModal = false;
  arquivoPagamentoAvisosMensagem = '';
  arquivoPagamentoAvisosDetalhes: string[] = [];
  /** IDs válidos pendentes de confirmação após o modal de avisos. */
  capaIdsArquivoPendentes: string[] = [];

  /** Modal de filtros do relatório Folha por Evento. */
  showFiltroRelatorioEventoModal = false;
  /** verbaId → incluir no relatório (padrão: todos true ao abrir o modal). */
  relatorioEventoVerbaSelecionada: Record<string, boolean> = {};

  /** Hub de relatórios (Folha / Evento / Recibo / Prévia PagBank). */
  showModalRelatorios = false;
  /** Opções de impressão da Folha geral. */
  showModalOpcoesFolhaGeral = false;
  showModalOpcoesPreviaPagBank = false;
  folhaGeralFormato: 'analitico' | 'sintetico' = 'analitico';
  folhaGeralQuebraSetor = false;
  folhaGeralQuebraComissao = false;
  /** Somente no analítico: lista eventos (verbas) de cada funcionário. */
  folhaGeralVerEventos = false;
  /** Prévia PagBank: todos os funcionários ou só os com alerta. */
  previaPagBankModo: 'todos' | 'somenteAlertas' = 'todos';
  /** Prévia PagBank: ocultar coluna Líquido na seção de alertas. */
  previaPagBankOcultarLiquidoAlertas = false;

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
  unidadeApi(): Unidade | null {
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

  /** Tipo de folha escolhido (competência sempre definida pelo mês/ano da tela). Unidade é escolhida no modal do relatório. */
  relatoriosFolhaGeralFiltrosPreenchidos(): boolean {
    return !!this.tipoId?.trim();
  }

  /** Botão Relatórios: exige tipo de folha (unidade vem do filtro da tela). */
  desabilitarBotoesRelatoriosFolhaGeralTopo(): boolean {
    return !this.relatoriosFolhaGeralFiltrosPreenchidos();
  }

  /**
   * Escopo de unidade na API (RN-007): `usuario.unidade` ou, se vazio, `vendedor.unidade`.
   * Usuário sem vínculo pode consultar qualquer unidade.
   */
  private unidadeEscopoApiUsuario(): Unidade | null {
    const u = this.auth.getCurrentUser();
    const cadastro = u?.unidade?.trim();
    if (cadastro) return cadastro as Unidade;
    const vend = u?.vendedor?.unidade?.trim();
    if (vend) return vend as Unidade;
    return null;
  }

  /**
   * Unidades a consultar na API: filtro da tela de lançamento.
   * Unidade específica → só ela; “Todas” → todas que o usuário pode acessar.
   */
  unidadesEscopoRelatorio(): Unidade[] {
    const unTela = this.unidadeApi();
    if (unTela) return [unTela];
    const escopoApi = this.unidadeEscopoApiUsuario();
    if (escopoApi) return [escopoApi];
    return [...this.unidadesVisiveisParaSelect];
  }

  /** Rótulo de cabeçalho: unidade da tela ou “Todas as unidades”. */
  rotuloUnidadeRelatorioCabecalho(): string {
    const un = this.unidadeApi();
    if (un) return String(un);
    const unidades = this.unidadesEscopoRelatorio();
    if (unidades.length === 1) return String(unidades[0]);
    return 'Todas as unidades';
  }

  /** Tela em “Todas” e mais de uma unidade no escopo → quebra master (com quebra de página). */
  relatorioQuebraUnidadeMaster(): boolean {
    return this.unidadeApi() == null && this.unidadesEscopoRelatorio().length > 1;
  }

  private descricaoUnidadeParaRelatorio(row: FolhaCapaDetalheResponse): string {
    const u = row.capa.funcionario?.unidade;
    return u && String(u).trim() !== '' ? String(u) : 'Sem unidade';
  }

  /**
   * Carrega capas com detalhe das unidades informadas (ou do escopo atual).
   * Não engole 403/erro por unidade: se todas falharem, propaga; se parcial, junta as ok.
   */
  private carregarCapasComDetalheRelatorio(
    unidadesExplicitas?: Unidade[],
  ): Observable<FolhaCapaDetalheResponse[]> {
    const unidades =
      unidadesExplicitas && unidadesExplicitas.length > 0
        ? [...unidadesExplicitas]
        : this.unidadesEscopoRelatorio();
    if (!unidades.length || !this.tipoId?.trim()) {
      return of([]);
    }
    return forkJoin(
      unidades.map((unidade) =>
        this.folha
          .listarCapasComDetalhe({
            unidade,
            ano: this.ano,
            mes: this.mes,
            folhaTipoId: this.tipoId,
          })
          .pipe(
            map((rows) => ({ unidade, rows, ok: true as const })),
            catchError((err: { error?: { message?: string }; message?: string }) =>
              of({
                unidade,
                rows: [] as FolhaCapaDetalheResponse[],
                ok: false as const,
                erro:
                  err?.error?.message ||
                  err?.message ||
                  `Falha ao carregar ${unidade}`,
              }),
            ),
          ),
      ),
    ).pipe(
      map((resultados) => {
        const ok = resultados.filter((r) => r.ok);
        const falhas = resultados.filter((r) => !r.ok);
        if (ok.length === 0 && falhas.length > 0) {
          throw new Error(
            falhas
              .map((f) => `${f.unidade}: ${'erro' in f ? f.erro : 'erro'}`)
              .join(' · '),
          );
        }
        /** Garante unidade na capa para a quebra master (agrupamento / páginas). */
        return ok.flatMap((r) =>
          r.rows.map((row) => {
            const f = row.capa?.funcionario;
            if (f && (!f.unidade || String(f.unidade).trim() === '')) {
              return {
                ...row,
                capa: {
                  ...row.capa,
                  funcionario: { ...f, unidade: r.unidade },
                },
              };
            }
            return row;
          }),
        );
      }),
    );
  }

  pode(): {
    r: boolean;
    c: boolean;
    u: boolean;
    d: boolean;
  } {
    return {
      r: this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_READ),
      c: this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_CREATE),
      u: this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_UPDATE),
      d: this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_DELETE),
    };
  }

  /** Modal de cadastro do funcionário aberto a partir da grid (embed). */
  modalFuncionarioId: string | null = null;
  modalFuncionarioNome: string | null = null;

  /** Histórico de alterações por `folha_item` (alinha auditoria gravada como `folha_item` na API). */
  podeAuditarLinhaEvento(): boolean {
    return (
      this.auth.hasPermission(Permission.AUDIT_VIEW) ||
      this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_READ)
    );
  }

  /** Abrir cadastro do funcionário a partir da lista (exige `folha-funcionario:read`). */
  podeAbrirCadastroFuncionario(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_READ);
  }

  podeEditarCadastroFuncionario(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_UPDATE);
  }

  tituloModalCadastroFuncionario(): string {
    const nome = (this.modalFuncionarioNome ?? '').trim() || '—';
    return this.podeEditarCadastroFuncionario()
      ? `Editando Funcionário: ${nome}`
      : `Ver Funcionário: ${nome}`;
  }

  abrirModalCadastroFuncionario(row: FolhaCapaDetalheResponse, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.podeAbrirCadastroFuncionario()) return;
    const id = row.capa.funcionario?.id?.trim();
    if (!id) {
      this.errors.show('Funcionário da capa sem identificador.', 'Cadastro');
      return;
    }
    this.fecharTodosModaisItem();
    this.modalFuncionarioNome = this.nomeParaCapa(row);
    this.modalFuncionarioId = id;
  }

  fecharModalCadastroFuncionario(_ev?: { saved: boolean }): void {
    this.modalFuncionarioId = null;
    this.modalFuncionarioNome = null;
    this.recarregarListaCapasAposCadastroFuncionario();
  }

  /** Recarrega capas da competência (aberto = POST; fechado = GET) para refletir banco/conta/etc. */
  private recarregarListaCapasAposCadastroFuncionario(): void {
    const un = this.unidadeApi();
    if (!un || !this.tipoId?.trim() || !this.statusLote?.registrada) return;
    this.carregando = true;
    this.dispatchCargaCapaDepoisDoStatus(un);
  }

  textoBancoLista(row: FolhaCapaDetalheResponse): string {
    const v = String(row.capa.funcionario?.bancoNumero ?? '').trim();
    return v || '—';
  }

  textoContaLista(row: FolhaCapaDetalheResponse): string {
    const v = String(row.capa.funcionario?.contaBancaria ?? '').trim();
    return v || '—';
  }

  textoDigitoContaLista(row: FolhaCapaDetalheResponse): string {
    const v = String(row.capa.funcionario?.digitoConta ?? '').trim();
    return v || '—';
  }

  /** Competência com lote aberto e capa expandida não congelada (edição de eventos). */
  podeAlterarEventosNaCapaSelecionada(): boolean {
    if (!this.detalhe?.capa) return false;
    if (!this.capaElegivelCarregar(this.detalhe)) return false;
    if (this.detalhe.capa.congelada) return false;
    return this.podeEditarLoteNaCompetencia();
  }

  /** Capa entra no Carregar automático (ativo + RN-011); false = legada — só visualizar/excluir. */
  capaElegivelCarregar(row: FolhaCapaDetalheResponse | null | undefined): boolean {
    if (!row) return false;
    return row.elegivelCarregarCompetencia !== false;
  }

  podeExcluirCapa(): boolean {
    const podePerm = this.auth.hasPermission(
      Permission.FOLHA_LANCAMENTO_DELETE_CAPA,
    );
    return (
      podePerm &&
      this.podeEditarLoteNaCompetencia() &&
      !!this.detalhe &&
      !this.detalhe.capa.congelada &&
      !this.carregando &&
      !this.excluindoCapa
    );
  }

  podeCongelarCapa(): boolean {
    const podePerm = this.auth.hasPermission(
      Permission.FOLHA_LANCAMENTO_CONGELAR_CAPA,
    );
    return (
      podePerm &&
      this.podeEditarLoteNaCompetencia() &&
      !!this.detalhe &&
      this.capaElegivelCarregar(this.detalhe) &&
      !this.detalhe.capa.congelada &&
      !this.carregando &&
      !this.salvandoCongelacaoCapa
    );
  }

  podeLiberarCapa(): boolean {
    const podePerm = this.auth.hasPermission(
      Permission.FOLHA_LANCAMENTO_LIBERAR_CAPA,
    );
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

  abrirModalRelatorios(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    this.showModalRelatorios = true;
  }

  fecharModalRelatorios(): void {
    this.showModalRelatorios = false;
  }

  abrirOpcoesFolhaGeralDoHub(): void {
    this.fecharModalRelatorios();
    this.folhaGeralFormato = 'analitico';
    this.folhaGeralQuebraSetor = false;
    this.folhaGeralQuebraComissao = false;
    this.folhaGeralVerEventos = false;
    this.showModalOpcoesFolhaGeral = true;
  }

  fecharModalOpcoesFolhaGeral(): void {
    this.showModalOpcoesFolhaGeral = false;
  }

  confirmarGerarFolhaGeral(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const unidades = this.unidadesEscopoRelatorio();
    if (!unidades.length) {
      this.errors.show('Nenhuma unidade disponível para o relatório.', 'Relatório');
      return;
    }
    const opcoes = {
      formato: this.folhaGeralFormato,
      quebraSetor: this.folhaGeralQuebraSetor,
      quebraComissao: this.folhaGeralQuebraComissao,
      verEventos:
        this.folhaGeralFormato === 'analitico' && this.folhaGeralVerEventos,
      quebraUnidadeMaster: this.relatorioQuebraUnidadeMaster(),
    };
    const rotuloUnidade = this.rotuloUnidadeRelatorioCabecalho();
    this.fecharModalOpcoesFolhaGeral();
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (cfg) =>
        this.executarRelatorioFolhaGeral(cfg ?? null, opcoes, unidades, rotuloUnidade),
      error: () =>
        this.executarRelatorioFolhaGeral(null, opcoes, unidades, rotuloUnidade),
    });
  }

  abrirFolhaPorEventoDoHub(): void {
    this.fecharModalRelatorios();
    this.abrirModalFiltroRelatorioPorEvento();
  }

  abrirReciboGeralDoHub(): void {
    this.fecharModalRelatorios();
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const unidades = this.unidadesEscopoRelatorio();
    if (!unidades.length) {
      this.errors.show('Nenhuma unidade disponível para o relatório.', 'Relatório');
      return;
    }
    this.gerandoRelatorioFolhaGeral = true;
    this.executarReciboGeralCompetencia(
      unidades,
      this.rotuloUnidadeRelatorioCabecalho(),
      this.relatorioQuebraUnidadeMaster(),
    );
  }

  abrirPreviaPagBankDoHub(): void {
    this.fecharModalRelatorios();
    this.previaPagBankModo = 'todos';
    this.previaPagBankOcultarLiquidoAlertas = false;
    this.showModalOpcoesPreviaPagBank = true;
  }

  fecharModalOpcoesPreviaPagBank(): void {
    this.showModalOpcoesPreviaPagBank = false;
  }

  confirmarGerarPreviaPagBank(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    const unidades = this.unidadesEscopoRelatorio();
    if (!unidades.length) {
      this.errors.show('Nenhuma unidade disponível para o relatório.', 'Relatório');
      return;
    }
    const rotuloUnidade = this.rotuloUnidadeRelatorioCabecalho();
    const quebra = this.relatorioQuebraUnidadeMaster();
    const somenteAlertas = this.previaPagBankModo === 'somenteAlertas';
    const ocultarLiquidoAlertas = this.previaPagBankOcultarLiquidoAlertas;
    this.fecharModalOpcoesPreviaPagBank();
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (cfg) =>
        this.executarPreviaPagBank(cfg ?? null, {
          unidades,
          rotuloUnidade,
          quebraUnidadeMaster: quebra,
          somenteAlertas,
          ocultarLiquidoAlertas,
        }),
      error: () =>
        this.executarPreviaPagBank(null, {
          unidades,
          rotuloUnidade,
          quebraUnidadeMaster: quebra,
          somenteAlertas,
          ocultarLiquidoAlertas,
        }),
    });
  }

  abrirModalFiltroRelatorioPorEvento(): void {
    if (!this.pode().r || !this.relatoriosFolhaGeralFiltrosPreenchidos()) return;
    if (this.gerandoRelatorioFolhaGeral) return;
    if (!this.verbasAtivas.length) {
      this.errors.show(
        'Não há eventos cadastrados ativos para filtrar o relatório.',
        'Relatório',
      );
      return;
    }
    this.inicializarSelecoesRelatorioEvento();
    this.showFiltroRelatorioEventoModal = true;
  }

  fecharModalFiltroRelatorioPorEvento(): void {
    this.showFiltroRelatorioEventoModal = false;
  }

  private inicializarSelecoesRelatorioEvento(): void {
    const sel: Record<string, boolean> = {};
    for (const v of this.verbasOrdenadasParaRelatorioEvento()) {
      sel[v.id] = true;
    }
    this.relatorioEventoVerbaSelecionada = sel;
  }

  verbasOrdenadasParaRelatorioEvento(): FolhaVerba[] {
    return [...this.verbasAtivas].sort((a, b) => {
      const ordemTipo = (t: FolhaMovimentoTipo) =>
        t === FolhaMovimentoTipo.RECEITA ? 0 : 1;
      const diff = ordemTipo(a.tipoMovimento) - ordemTipo(b.tipoMovimento);
      if (diff !== 0) return diff;
      return a.descricao.localeCompare(b.descricao, 'pt-BR');
    });
  }

  verbasRelatorioEventoPorTipo(tipo: FolhaMovimentoTipo): FolhaVerba[] {
    return this.verbasOrdenadasParaRelatorioEvento().filter(
      (v) => v.tipoMovimento === tipo,
    );
  }

  marcarTodosEventosRelatorio(selecionar: boolean): void {
    this.marcarEventosRelatorioPorTipo(FolhaMovimentoTipo.RECEITA, selecionar);
    this.marcarEventosRelatorioPorTipo(FolhaMovimentoTipo.DESPESA, selecionar);
  }

  marcarEventosRelatorioPorTipo(
    tipo: FolhaMovimentoTipo,
    selecionar: boolean,
  ): void {
    const next = { ...this.relatorioEventoVerbaSelecionada };
    for (const v of this.verbasRelatorioEventoPorTipo(tipo)) {
      next[v.id] = selecionar;
    }
    this.relatorioEventoVerbaSelecionada = next;
  }

  secaoRelatorioEventoTotalmenteSelecionada(tipo: FolhaMovimentoTipo): boolean {
    const lista = this.verbasRelatorioEventoPorTipo(tipo);
    return lista.length > 0 && lista.every((v) => this.relatorioEventoVerbaSelecionada[v.id]);
  }

  secaoRelatorioEventoParcialmenteSelecionada(tipo: FolhaMovimentoTipo): boolean {
    const lista = this.verbasRelatorioEventoPorTipo(tipo);
    if (!lista.length) return false;
    const n = lista.filter((v) => this.relatorioEventoVerbaSelecionada[v.id]).length;
    return n > 0 && n < lista.length;
  }

  onSecaoRelatorioEventoChange(tipo: FolhaMovimentoTipo, checked: boolean): void {
    this.marcarEventosRelatorioPorTipo(tipo, checked);
  }

  contagemEventosSelecionadosRelatorio(): number {
    return this.verbasOrdenadasParaRelatorioEvento().filter(
      (v) => this.relatorioEventoVerbaSelecionada[v.id],
    ).length;
  }

  private obterVerbaIdsSelecionadasRelatorio(): Set<string> {
    return new Set(
      this.verbasOrdenadasParaRelatorioEvento()
        .filter((v) => this.relatorioEventoVerbaSelecionada[v.id])
        .map((v) => v.id),
    );
  }

  aplicarFiltroEGerarRelatorioPorEvento(): void {
    const ids = this.obterVerbaIdsSelecionadasRelatorio();
    if (ids.size === 0) {
      this.errors.show('Selecione ao menos um evento para o relatório.', 'Relatório');
      return;
    }
    if (this.gerandoRelatorioFolhaGeral) return;
    const unidades = this.unidadesEscopoRelatorio();
    if (!unidades.length) {
      this.errors.show('Nenhuma unidade disponível para o relatório.', 'Relatório');
      return;
    }
    const rotuloUnidade = this.rotuloUnidadeRelatorioCabecalho();
    const quebra = this.relatorioQuebraUnidadeMaster();
    this.fecharModalFiltroRelatorioPorEvento();
    this.gerandoRelatorioFolhaGeral = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (cfg) =>
        this.executarRelatorioFolhaPorEvento(cfg ?? null, ids, unidades, rotuloUnidade, quebra),
      error: () =>
        this.executarRelatorioFolhaPorEvento(null, ids, unidades, rotuloUnidade, quebra),
    });
  }

  private executarReciboGeralCompetencia(
    unidades: Unidade[],
    rotuloUnidade: string,
    quebraUnidadeMaster: boolean,
  ): void {
    this.carregarCapasComDetalheRelatorio(unidades).subscribe({
      next: (rows) => {
        const html = this.montarHtmlReciboGeralMultiplasPaginas(
          rotuloUnidade,
          rows,
          quebraUnidadeMaster,
        );
        this.abrirPopupRelatorioHtml(html, 'recibo-geral');
        this.gerandoRelatorioFolhaGeral = false;
      },
      error: (err: { message?: string }) => {
        this.errors.show(
          err?.message ||
            'Não foi possível carregar as folhas para o recibo geral. Tente novamente.',
          'Folha',
        );
        this.gerandoRelatorioFolhaGeral = false;
      },
    });
  }

  private executarRelatorioFolhaGeral(
    cfg: Configuracao | null,
    opcoes: {
      formato: 'analitico' | 'sintetico';
      quebraSetor: boolean;
      quebraComissao: boolean;
      verEventos?: boolean;
      quebraUnidadeMaster?: boolean;
    },
    unidades: Unidade[],
    rotuloUnidade: string,
  ): void {
    this.carregarCapasComDetalheRelatorio(unidades).subscribe({
      next: (rows) => {
        const tipoDesc =
          this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
        const html = this.montarHtmlRelatorioFolhaGeralDocumento(
          rows,
          cfg,
          rotuloUnidade,
          tipoDesc,
          opcoes,
          unidades,
        );
        this.abrirPopupRelatorioHtml(html, 'folha-geral');
        this.gerandoRelatorioFolhaGeral = false;
      },
      error: (err: { message?: string }) => {
        this.errors.show(
          err?.message ||
            'Não foi possível carregar as folhas para o relatório. Tente novamente.',
          'Folha',
        );
        this.gerandoRelatorioFolhaGeral = false;
      },
    });
  }

  private executarPreviaPagBank(
    cfg: Configuracao | null,
    opts: {
      unidades: Unidade[];
      rotuloUnidade: string;
      quebraUnidadeMaster: boolean;
      somenteAlertas: boolean;
      ocultarLiquidoAlertas: boolean;
    },
  ): void {
    this.carregarCapasComDetalheRelatorio(opts.unidades).subscribe({
      next: (rows) => {
        const tipoDesc =
          this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
        const html = this.montarHtmlPreviaPagBankDocumento(
          rows,
          cfg,
          opts.rotuloUnidade,
          tipoDesc,
          {
            somenteAlertas: opts.somenteAlertas,
            ocultarLiquidoAlertas: opts.ocultarLiquidoAlertas,
            quebraUnidadeMaster: opts.quebraUnidadeMaster,
          },
        );
        this.abrirPopupRelatorioHtml(html, 'previa-pagbank');
        this.gerandoRelatorioFolhaGeral = false;
      },
      error: (err: { message?: string }) => {
        this.errors.show(
          err?.message ||
            'Não foi possível carregar as folhas para a prévia PagBank. Tente novamente.',
          'Folha',
        );
        this.gerandoRelatorioFolhaGeral = false;
      },
    });
  }

  private executarRelatorioFolhaPorEvento(
    cfg: Configuracao | null,
    verbaIdsIncluir: ReadonlySet<string>,
    unidades: Unidade[],
    rotuloUnidade: string,
    quebraUnidadeMaster: boolean,
  ): void {
    this.carregarCapasComDetalheRelatorio(unidades).subscribe({
      next: (rows) => {
        const tipoDesc =
          this.tipos.find((t) => t.id === this.tipoId)?.descricao ?? '—';
        const html = this.montarHtmlRelatorioFolhaPorEventoDocumento(
          rows,
          cfg,
          rotuloUnidade,
          tipoDesc,
          verbaIdsIncluir,
          quebraUnidadeMaster,
        );
        this.abrirPopupRelatorioHtml(html, 'folha-por-evento');
        this.gerandoRelatorioFolhaGeral = false;
      },
      error: (err: { message?: string }) => {
        this.errors.show(
          err?.message ||
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

  private descricaoSetorParaRelatorio(row: FolhaCapaDetalheResponse): string {
    return (row.capa.funcionario?.setor?.descricao ?? '').trim() || 'Sem setor';
  }

  /**
   * Comissão = receitas com ehComissao; despesas abatem só em Não comissão.
   */
  private totaisComissaoDaCapa(row: FolhaCapaDetalheResponse): {
    comissao: number;
    naoComissaoReceitas: number;
    despesas: number;
    naoComissaoLiquido: number;
    receitas: number;
    liquido: number;
  } {
    const itens = row.capa.itens ?? [];
    let comissao = 0;
    let naoComissaoReceitas = 0;
    let despesas = 0;
    for (const it of itens) {
      const valor = FolhaLancamentosPage.parseDecimalFinanceiro(it.valor) || 0;
      if (it.folhaVerba?.tipoMovimento === FolhaMovimentoTipo.DESPESA) {
        despesas += valor;
      } else if (it.folhaVerba?.ehComissao === true) {
        comissao += valor;
      } else {
        naoComissaoReceitas += valor;
      }
    }
    if (itens.length === 0) {
      const r = FolhaLancamentosPage.parseDecimalFinanceiro(row.totalReceitas) || 0;
      const d = FolhaLancamentosPage.parseDecimalFinanceiro(row.totalDespesas) || 0;
      return {
        comissao: 0,
        naoComissaoReceitas: r,
        despesas: d,
        naoComissaoLiquido: r - d,
        receitas: r,
        liquido: r - d,
      };
    }
    return {
      comissao,
      naoComissaoReceitas,
      despesas,
      naoComissaoLiquido: naoComissaoReceitas - despesas,
      receitas: comissao + naoComissaoReceitas,
      liquido: comissao + naoComissaoReceitas - despesas,
    };
  }

  private filtrarItensFolhaGeral(
    itens: FolhaItem[] | undefined,
    filtro: 'comissao' | 'naoComissao' | 'todos',
  ): FolhaItem[] {
    const lista = [...(itens ?? [])].filter((it) => {
      const tipo = it.folhaVerba?.tipoMovimento;
      const ehCom = it.folhaVerba?.ehComissao === true;
      if (filtro === 'comissao') {
        return tipo === FolhaMovimentoTipo.RECEITA && ehCom;
      }
      if (filtro === 'naoComissao') {
        return (
          tipo === FolhaMovimentoTipo.DESPESA ||
          (tipo === FolhaMovimentoTipo.RECEITA && !ehCom)
        );
      }
      return true;
    });
    lista.sort((a, b) => {
      const ordemTipo = (t: FolhaMovimentoTipo | undefined) =>
        t === FolhaMovimentoTipo.RECEITA ? 0 : 1;
      const d =
        ordemTipo(a.folhaVerba?.tipoMovimento) -
        ordemTipo(b.folhaVerba?.tipoMovimento);
      if (d !== 0) return d;
      return (a.folhaVerba?.descricao ?? '').localeCompare(
        b.folhaVerba?.descricao ?? '',
        'pt-BR',
      );
    });
    return lista;
  }

  /** Tabela de eventos de uma capa (analítico + Ver eventos). */
  private htmlTabelaEventosFolhaGeral(
    itens: FolhaItem[],
    rotuloTotal: string,
    totalValor: number,
  ): string {
    if (!itens.length) {
      return `<p class="folha-geral-eventos-vazio">Nenhum evento neste bloco.</p>`;
    }
    const trs = itens
      .map((it) => {
        const tipo =
          it.folhaVerba?.tipoMovimento === FolhaMovimentoTipo.DESPESA
            ? 'Despesa'
            : 'Receita';
        return `<tr>
          <td>${this.escapeHtml(it.folhaVerba?.descricao ?? '—')}</td>
          <td>${this.escapeHtml(tipo)}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(it.valor))}</td>
        </tr>`;
      })
      .join('');
    return `<table class="tbl-rep tbl-rep-folha-geral-eventos"><thead><tr>
      <th>Evento</th><th>Tipo</th><th class="num">Valor</th>
    </tr></thead><tbody>${trs}</tbody>
    <tfoot><tr class="totais"><td colspan="2">${this.escapeHtml(rotuloTotal)}</td>
      <td class="num">${this.escapeHtml(this.moedaListaCapa(totalValor))}</td>
    </tr></tfoot></table>`;
  }

  private montarHtmlRelatorioFolhaGeralDocumento(
    rows: FolhaCapaDetalheResponse[],
    config: Configuracao | null,
    rotuloUnidade: string,
    tipoFolhaDescricao: string,
    opcoes: {
      formato: 'analitico' | 'sintetico';
      quebraSetor: boolean;
      quebraComissao: boolean;
      verEventos?: boolean;
      quebraUnidadeMaster?: boolean;
    },
    unidadesEscopo: Unidade[] = [],
  ): string {
    const comp = `${this.nomeMesPt(this.mes)} / ${this.ano}`;
    const quebras: string[] = [];
    if (opcoes.quebraUnidadeMaster) quebras.push('Unidade');
    if (opcoes.quebraSetor) quebras.push('Setor');
    if (opcoes.quebraComissao) quebras.push('Comissão');
    const subTitulo = [
      opcoes.formato === 'sintetico' ? 'Sintético' : 'Analítico',
      opcoes.verEventos ? 'Com eventos' : null,
      quebras.length ? `Quebra: ${quebras.join(' → ')}` : 'Sem quebra',
    ]
      .filter(Boolean)
      .join(' · ');
    type Linha = {
      nome: string;
      unidade: string;
      setor: string;
      comissao: number;
      naoComissaoReceitas: number;
      despesas: number;
      naoComissaoLiquido: number;
      receitas: number;
      liquido: number;
      itens: FolhaItem[];
    };

    const linhas: Linha[] = rows.map((r) => {
      const t = this.totaisComissaoDaCapa(r);
      return {
        nome: (r.capa.funcionario?.nome ?? '—').trim() || '—',
        unidade: this.descricaoUnidadeParaRelatorio(r),
        setor: this.descricaoSetorParaRelatorio(r),
        itens: r.capa.itens ?? [],
        ...t,
      };
    });

    const opcoesSemQuebraUnidade = { ...opcoes, quebraUnidadeMaster: false };
    const quebrasInternas = [
      opcoes.quebraSetor ? 'Setor' : null,
      opcoes.quebraComissao ? 'Comissão' : null,
    ].filter(Boolean) as string[];
    const subTituloPagina = [
      opcoes.formato === 'sintetico' ? 'Sintético' : 'Analítico',
      opcoes.verEventos ? 'Com eventos' : null,
      quebrasInternas.length
        ? `Quebra: ${quebrasInternas.join(' → ')}`
        : 'Sem quebra',
    ]
      .filter(Boolean)
      .join(' · ');

    if (opcoes.quebraUnidadeMaster && unidadesEscopo.length > 1) {
      const paginas = unidadesEscopo.map((u) => {
        const nomeUn = String(u);
        const linhasUn = linhas.filter((ln) => ln.unidade === nomeUn);
        const corpoUn =
          linhasUn.length === 0
            ? '<p class="vazio-relatorio-evento">Nenhuma folha nesta unidade para os filtros.</p>'
            : this.montarCorpoFolhaGeralComOpcoes(
                linhasUn,
                opcoesSemQuebraUnidade,
                [],
              );
        return {
          linhasCabecalhoCentral: [
            nomeUn,
            comp,
            tipoFolhaDescricao,
            subTituloPagina,
          ],
          corpo: corpoUn,
        };
      });
      return this.montarHtmlDocumentoPadraoFicha({
        documentTitle: 'relatorio-folha-geral',
        tituloPrincipal: 'RELATÓRIO DE FOLHA GERAL',
        linhasCabecalhoCentral: [],
        corpo: '',
        config,
        paginas,
      });
    }

    const corpo =
      linhas.length === 0
        ? '<p class="vazio-relatorio-evento">Nenhuma folha encontrada para os filtros.</p>'
        : this.montarCorpoFolhaGeralComOpcoes(linhas, opcoesSemQuebraUnidade, []);

    return this.montarHtmlDocumentoPadraoFicha({
      documentTitle: 'relatorio-folha-geral',
      tituloPrincipal: 'RELATÓRIO DE FOLHA GERAL',
      linhasCabecalhoCentral: [
        rotuloUnidade,
        comp,
        tipoFolhaDescricao,
        subTitulo,
      ],
      corpo,
      config,
    });
  }

  private montarCorpoFolhaGeralComOpcoes(
    linhas: Array<{
      nome: string;
      unidade: string;
      setor: string;
      comissao: number;
      naoComissaoReceitas: number;
      despesas: number;
      naoComissaoLiquido: number;
      receitas: number;
      liquido: number;
      itens: FolhaItem[];
    }>,
    opcoes: {
      formato: 'analitico' | 'sintetico';
      quebraSetor: boolean;
      quebraComissao: boolean;
      verEventos?: boolean;
      quebraUnidadeMaster?: boolean;
    },
    unidadesEscopo: Unidade[] = [],
  ): string {
    const analitico = opcoes.formato === 'analitico';
    const verEventos = analitico && opcoes.verEventos === true;
    const quebraUnidade = opcoes.quebraUnidadeMaster === true;

    const ordenarChavesUnidade = (keys: string[]): string[] =>
      [...keys].sort((a, b) => {
        if (a === 'Sem unidade') return 1;
        if (b === 'Sem unidade') return -1;
        return a.localeCompare(b, 'pt-BR');
      });

    const agruparPorUnidade = (): Map<string, typeof linhas> => {
      const map = new Map<string, typeof linhas>();
      for (const ln of linhas) {
        const key = quebraUnidade ? ln.unidade : 'Todos';
        const arr = map.get(key) ?? [];
        arr.push(ln);
        map.set(key, arr);
      }
      /** Com “Todas”, garante uma seção por unidade do escopo (mesmo sem folhas). */
      if (quebraUnidade && unidadesEscopo.length > 0) {
        for (const u of unidadesEscopo) {
          const k = String(u);
          if (!map.has(k)) map.set(k, []);
        }
      }
      const ordered = new Map<string, typeof linhas>();
      const keysPreferidas =
        quebraUnidade && unidadesEscopo.length > 0
          ? [
              ...unidadesEscopo.map((u) => String(u)),
              ...ordenarChavesUnidade(
                [...map.keys()].filter(
                  (k) => !unidadesEscopo.some((u) => String(u) === k),
                ),
              ),
            ]
          : ordenarChavesUnidade([...map.keys()]);
      for (const k of keysPreferidas) {
        if (map.has(k)) ordered.set(k, map.get(k)!);
      }
      return ordered;
    };

    const agruparPorSetor = (linhasEscopo: typeof linhas): Map<string, typeof linhas> => {
      const map = new Map<string, typeof linhas>();
      for (const ln of linhasEscopo) {
        const key = opcoes.quebraSetor ? ln.setor : 'Todos';
        const arr = map.get(key) ?? [];
        arr.push(ln);
        map.set(key, arr);
      }
      const ordered = new Map<string, typeof linhas>();
      const keys = [...map.keys()].sort((a, b) => {
        if (a === 'Sem setor') return 1;
        if (b === 'Sem setor') return -1;
        if (a === 'Todos') return -1;
        if (b === 'Todos') return 1;
        return a.localeCompare(b, 'pt-BR');
      });
      for (const k of keys) ordered.set(k, map.get(k)!);
      return ordered;
    };

    const soma = (arr: typeof linhas) =>
      arr.reduce(
        (acc, ln) => {
          acc.comissao += ln.comissao;
          acc.naoComissaoReceitas += ln.naoComissaoReceitas;
          acc.despesas += ln.despesas;
          acc.naoComissaoLiquido += ln.naoComissaoLiquido;
          acc.receitas += ln.receitas;
          acc.liquido += ln.liquido;
          acc.qtd += 1;
          return acc;
        },
        {
          comissao: 0,
          naoComissaoReceitas: 0,
          despesas: 0,
          naoComissaoLiquido: 0,
          receitas: 0,
          liquido: 0,
          qtd: 0,
        },
      );

    const tabelaPadrao = (
      arr: typeof linhas,
      rotuloTotal: string,
      incluirFuncionario: boolean,
    ): string => {
      const s = soma(arr);
      if (opcoes.quebraComissao) {
        const thead = `<thead><tr>
          ${incluirFuncionario ? '<th>Funcionário</th>' : '<th>Grupo</th>'}
          <th class="num">Comissão</th>
          <th class="num">Receitas (não comissão)</th>
          <th class="num">Despesas</th>
          <th class="num">Líquido (não comissão)</th>
          <th class="num">Líquido total</th>
        </tr></thead>`;
        let body = '';
        if (incluirFuncionario) {
          body = [...arr]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map(
              (ln) => `<tr>
              <td>${this.escapeHtml(ln.nome)}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.comissao))}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoReceitas))}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.despesas))}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoLiquido))}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.liquido))}</td>
            </tr>`,
            )
            .join('');
        } else {
          body = `<tr>
            <td>Comissão</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.comissao))}</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.comissao))}</td>
          </tr>
          <tr>
            <td>Não comissão</td>
            <td class="num">—</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoReceitas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.despesas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoLiquido))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoLiquido))}</td>
          </tr>`;
        }
        return `<table class="tbl-rep">${thead}<tbody>${body}</tbody>
          <tfoot><tr class="totais">
            <td>${this.escapeHtml(rotuloTotal)} (${s.qtd})</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.comissao))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoReceitas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.despesas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoLiquido))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(s.liquido))}</td>
          </tr></tfoot></table>`;
      }

      const thead = `<thead><tr>
        ${incluirFuncionario ? '<th>Funcionário</th>' : '<th></th>'}
        <th class="num">Receitas</th>
        <th class="num">Despesas</th>
        <th class="num">Líquido</th>
      </tr></thead>`;
      let body = '';
      if (incluirFuncionario) {
        body = [...arr]
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          .map(
            (ln) => `<tr>
            <td>${this.escapeHtml(ln.nome)}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.receitas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.despesas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.liquido))}</td>
          </tr>`,
          )
          .join('');
      } else {
        body = `<tr>
          <td>Total</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.receitas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.despesas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.liquido))}</td>
        </tr>`;
      }
      return `<table class="tbl-rep">${thead}<tbody>${body}</tbody>
        <tfoot><tr class="totais">
          <td>${this.escapeHtml(rotuloTotal)} (${s.qtd})</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.receitas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.despesas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.liquido))}</td>
        </tr></tfoot></table>`;
    };

    const partes: string[] = [];
    const porUnidade = agruparPorUnidade();
    const entradasUnidade = [...porUnidade.entries()];

    for (let idxUn = 0; idxUn < entradasUnidade.length; idxUn++) {
      const [unidadeNome, linhasUnidade] = entradasUnidade[idxUn];
      const ultimaUnidade = idxUn === entradasUnidade.length - 1;
      if (quebraUnidade) {
        const clsUltima = ultimaUnidade ? ' unidade-rep-block--last' : '';
        partes.push(`<div class="section unidade-rep-block${clsUltima}">
          <div class="secao-macro-titulo">${this.escapeHtml(unidadeNome)}</div>`);
      }

      if (quebraUnidade && linhasUnidade.length === 0) {
        partes.push(
          `<p class="vazio-relatorio-evento">Nenhuma folha nesta unidade para os filtros.</p>`,
        );
        if (quebraUnidade) {
          partes.push('</div>');
        }
        continue;
      }

      const porSetor = agruparPorSetor(linhasUnidade);
      const resumoSetores: Array<{
        nome: string;
        qtd: number;
        comissao: number;
        naoComissaoLiquido: number;
        receitas: number;
        despesas: number;
        liquido: number;
      }> = [];

      for (const [setorNome, arr] of porSetor) {
      const s = soma(arr);
      resumoSetores.push({
        nome: setorNome,
        qtd: s.qtd,
        comissao: s.comissao,
        naoComissaoLiquido: s.naoComissaoLiquido,
        receitas: s.receitas,
        despesas: s.despesas,
        liquido: s.liquido,
      });

      if (opcoes.quebraSetor) {
        partes.push(`<div class="section setor-rep-block">
          <div class="secao-macro-titulo">${this.escapeHtml(
            quebraUnidade ? `${unidadeNome} · ${setorNome}` : setorNome,
          )}</div>`);
      }

      if (opcoes.quebraComissao && analitico) {
        partes.push(`<div class="evento-det-titulo">Comissão</div>`);
        if (verEventos) {
          const soCom = [...arr]
            .filter((l) => l.comissao !== 0)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          if (soCom.length === 0) {
            partes.push(
              `<p class="folha-geral-eventos-vazio">Sem valores de comissão.</p>`,
            );
          } else {
            for (const ln of soCom) {
              partes.push(
                `<div class="folha-geral-func-bloco"><div class="folha-geral-func-nome">${this.escapeHtml(ln.nome)}</div>`,
              );
              partes.push(
                this.htmlTabelaEventosFolhaGeral(
                  this.filtrarItensFolhaGeral(ln.itens, 'comissao'),
                  'Total comissão',
                  ln.comissao,
                ),
              );
              partes.push('</div>');
            }
          }
          partes.push(
            `<p style="font-weight:700;margin:6px 0 12px">Total comissão: ${this.escapeHtml(this.moedaListaCapa(s.comissao))}</p>`,
          );
        } else {
          const soCom = [...arr]
            .filter((l) => l.comissao !== 0)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          const trCom =
            soCom.length === 0
              ? '<tr><td colspan="2" style="text-align:center;color:#666">Sem valores de comissão</td></tr>'
              : soCom
                  .map(
                    (ln) => `<tr>
              <td>${this.escapeHtml(ln.nome)}</td>
              <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.comissao))}</td>
            </tr>`,
                  )
                  .join('');
          partes.push(`<table class="tbl-rep"><thead><tr>
          <th>Funcionário</th><th class="num">Comissão</th>
        </tr></thead><tbody>${trCom}</tbody>
        <tfoot><tr class="totais"><td>Total comissão</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.comissao))}</td>
        </tr></tfoot></table>`);
        }

        partes.push(`<div class="evento-det-titulo">Não comissão</div>`);
        if (verEventos) {
          const ordenados = [...arr].sort((a, b) =>
            a.nome.localeCompare(b.nome, 'pt-BR'),
          );
          for (const ln of ordenados) {
            partes.push(
              `<div class="folha-geral-func-bloco"><div class="folha-geral-func-nome">${this.escapeHtml(ln.nome)}</div>`,
            );
            partes.push(
              this.htmlTabelaEventosFolhaGeral(
                this.filtrarItensFolhaGeral(ln.itens, 'naoComissao'),
                'Líquido não comissão',
                ln.naoComissaoLiquido,
              ),
            );
            partes.push(
              `<p class="folha-geral-func-totais">Receitas (não comissão): ${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoReceitas))}
              &nbsp;·&nbsp; Despesas: ${this.escapeHtml(this.moedaListaCapa(ln.despesas))}
              &nbsp;·&nbsp; Líquido: ${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoLiquido))}</p></div>`,
            );
          }
          partes.push(
            `<p style="font-weight:700;margin:6px 0 8px">Total não comissão: ${this.escapeHtml(this.moedaListaCapa(s.naoComissaoLiquido))}</p>`,
          );
        } else {
          const trNao = [...arr]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map(
              (ln) => `<tr>
            <td>${this.escapeHtml(ln.nome)}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoReceitas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.despesas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(ln.naoComissaoLiquido))}</td>
          </tr>`,
            )
            .join('');
          partes.push(`<table class="tbl-rep"><thead><tr>
          <th>Funcionário</th>
          <th class="num">Receitas (não comissão)</th>
          <th class="num">Despesas</th>
          <th class="num">Líquido</th>
        </tr></thead><tbody>${trNao}</tbody>
        <tfoot><tr class="totais"><td>Total não comissão</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoReceitas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.despesas))}</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(s.naoComissaoLiquido))}</td>
        </tr></tfoot></table>`);
        }
        partes.push(`<p style="font-weight:700;margin:8px 0 16px">Total do ${
          opcoes.quebraSetor ? 'setor' : 'grupo'
        }: ${this.escapeHtml(this.moedaListaCapa(s.liquido))}</p>`);
      } else if (verEventos) {
        const ordenados = [...arr].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR'),
        );
        for (const ln of ordenados) {
          partes.push(
            `<div class="folha-geral-func-bloco"><div class="folha-geral-func-nome">${this.escapeHtml(ln.nome)}</div>`,
          );
          partes.push(
            this.htmlTabelaEventosFolhaGeral(
              this.filtrarItensFolhaGeral(ln.itens, 'todos'),
              'Líquido',
              ln.liquido,
            ),
          );
          partes.push(
            `<p class="folha-geral-func-totais">Receitas: ${this.escapeHtml(this.moedaListaCapa(ln.receitas))}
            &nbsp;·&nbsp; Despesas: ${this.escapeHtml(this.moedaListaCapa(ln.despesas))}
            &nbsp;·&nbsp; Líquido: ${this.escapeHtml(this.moedaListaCapa(ln.liquido))}</p></div>`,
          );
        }
        partes.push(
          `<p style="font-weight:700;margin:8px 0 16px">${
            opcoes.quebraSetor ? 'Total do setor' : 'Totais'
          }: ${this.escapeHtml(this.moedaListaCapa(s.liquido))} (${s.qtd})</p>`,
        );
      } else {
        partes.push(
          tabelaPadrao(
            arr,
            opcoes.quebraSetor ? 'Total do setor' : 'Totais',
            analitico,
          ),
        );
      }

      if (opcoes.quebraSetor) {
        partes.push('</div>');
      }
    }

    if (opcoes.quebraSetor && resumoSetores.length > 1) {
      const usaCom = opcoes.quebraComissao;
      const trs = resumoSetores
        .map((r) =>
          usaCom
            ? `<tr>
            <td>${this.escapeHtml(r.nome)}</td>
            <td class="num">${this.escapeHtml(String(r.qtd))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.comissao))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.naoComissaoLiquido))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.liquido))}</td>
          </tr>`
            : `<tr>
            <td>${this.escapeHtml(r.nome)}</td>
            <td class="num">${this.escapeHtml(String(r.qtd))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.receitas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.despesas))}</td>
            <td class="num">${this.escapeHtml(this.moedaListaCapa(r.liquido))}</td>
          </tr>`,
        )
        .join('');
      const tot = resumoSetores.reduce(
        (a, r) => {
          a.qtd += r.qtd;
          a.comissao += r.comissao;
          a.naoComissaoLiquido += r.naoComissaoLiquido;
          a.receitas += r.receitas;
          a.despesas += r.despesas;
          a.liquido += r.liquido;
          return a;
        },
        {
          qtd: 0,
          comissao: 0,
          naoComissaoLiquido: 0,
          receitas: 0,
          despesas: 0,
          liquido: 0,
        },
      );
      partes.push(`<div class="section setor-resumo-final">
        <div class="secao-macro-titulo">${this.escapeHtml(
          quebraUnidade ? `Resumo por setor — ${unidadeNome}` : 'Resumo por setor',
        )}</div>
        <table class="tbl-rep"><thead><tr>
          <th>Setor</th><th class="num">Qtd</th>
          ${
            usaCom
              ? '<th class="num">Comissão</th><th class="num">Líq. não comissão</th><th class="num">Líquido</th>'
              : '<th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Líquido</th>'
          }
        </tr></thead><tbody>${trs}</tbody>
        <tfoot><tr class="totais">
          <td>Total geral</td>
          <td class="num">${this.escapeHtml(String(tot.qtd))}</td>
          ${
            usaCom
              ? `<td class="num">${this.escapeHtml(this.moedaListaCapa(tot.comissao))}</td>
                 <td class="num">${this.escapeHtml(this.moedaListaCapa(tot.naoComissaoLiquido))}</td>
                 <td class="num">${this.escapeHtml(this.moedaListaCapa(tot.liquido))}</td>`
              : `<td class="num">${this.escapeHtml(this.moedaListaCapa(tot.receitas))}</td>
                 <td class="num">${this.escapeHtml(this.moedaListaCapa(tot.despesas))}</td>
                 <td class="num">${this.escapeHtml(this.moedaListaCapa(tot.liquido))}</td>`
          }
        </tr></tfoot></table></div>`);
      }

      if (quebraUnidade) {
        const totUn = soma(linhasUnidade);
        partes.push(
          `<p style="font-weight:700;margin:8px 0 18px">Total da unidade ${this.escapeHtml(unidadeNome)}: ${this.escapeHtml(this.moedaListaCapa(totUn.liquido))} (${totUn.qtd})</p></div>`,
        );
      }
    }

    return partes.join('');
  }

  private avaliarCapaParaPagBank(row: FolhaCapaDetalheResponse): {
    ok: boolean;
    nome: string;
    liquido: number;
    problemas: string[];
  } {
    const f = row.capa.funcionario;
    const nome = f?.nome?.trim() || '—';
    const problemas: string[] = [];
    const banco = String(f?.bancoNumero ?? '').replace(/\D/g, '');
    const conta = String(f?.contaBancaria ?? '').replace(/\D/g, '');
    const digito = String(f?.digitoConta ?? '').replace(/\D/g, '');
    if (!banco || !conta || !digito) {
      problemas.push('sem dados bancários (banco, conta e dígito)');
    }
    const cpf = String(f?.cpf ?? '').replace(/\D/g, '');
    if (!cpf) problemas.push('sem CPF');
    const liquido = FolhaLancamentosPage.parseDecimalFinanceiro(row.liquido) || 0;
    if (!(liquido > 0)) problemas.push('líquido ≤ 0');
    return { ok: problemas.length === 0, nome, liquido, problemas };
  }

  private montarHtmlPreviaPagBankDocumento(
    rows: FolhaCapaDetalheResponse[],
    config: Configuracao | null,
    rotuloUnidade: string,
    tipoFolhaDescricao: string,
    opcoes: {
      somenteAlertas: boolean;
      ocultarLiquidoAlertas: boolean;
      quebraUnidadeMaster: boolean;
    },
  ): string {
    const comp = `${this.nomeMesPt(this.mes)} / ${this.ano}`;
    type LinhaPrev = {
      nome: string;
      unidade: string;
      liquido: number;
      ok: boolean;
      motivos: string;
    };
    const linhas: LinhaPrev[] = rows.map((row) => {
      const av = this.avaliarCapaParaPagBank(row);
      return {
        nome: av.nome,
        unidade: this.descricaoUnidadeParaRelatorio(row),
        liquido: av.liquido,
        ok: av.ok,
        motivos: av.problemas.join('; '),
      };
    });

    const montarBloco = (escopo: LinhaPrev[], tituloUnidade?: string): string => {
      const validos = escopo
        .filter((l) => l.ok)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const invalidos = escopo
        .filter((l) => !l.ok)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const totLiq = validos.reduce((s, v) => s + v.liquido, 0);
      const ocultarLiqAlertas = opcoes.ocultarLiquidoAlertas;
      const trOk = validos
        .map(
          (v) => `<tr>
        <td>${this.escapeHtml(v.nome)}</td>
        <td class="num">${this.escapeHtml(this.moedaListaCapa(v.liquido))}</td>
      </tr>`,
        )
        .join('');
      const trNo = invalidos
        .map((v) =>
          ocultarLiqAlertas
            ? `<tr>
        <td>${this.escapeHtml(v.nome)}</td>
        <td>${this.escapeHtml(v.motivos)}</td>
      </tr>`
            : `<tr>
        <td>${this.escapeHtml(v.nome)}</td>
        <td class="num">${this.escapeHtml(this.moedaListaCapa(v.liquido))}</td>
        <td>${this.escapeHtml(v.motivos)}</td>
      </tr>`,
        )
        .join('');
      const cab = tituloUnidade
        ? `<div class="secao-macro-titulo">${this.escapeHtml(tituloUnidade)}</div>`
        : '';
      const resumo = `<p><strong>Válidos:</strong> ${validos.length}
      &nbsp;|&nbsp; <strong>Inválidos:</strong> ${invalidos.length}
      &nbsp;|&nbsp; <strong>Soma líquidos válidos:</strong> ${this.escapeHtml(this.moedaListaCapa(totLiq))}</p>`;
      const secOk = opcoes.somenteAlertas
        ? ''
        : `<div class="section">
        <div class="evento-det-titulo">Entram no PagBank (${validos.length})</div>
        <table class="tbl-rep"><thead><tr>
          <th>Funcionário</th><th class="num">Líquido</th>
        </tr></thead>
        <tbody>${trOk || '<tr><td colspan="2" style="text-align:center;color:#666">Nenhum válido</td></tr>'}</tbody>
        <tfoot><tr class="totais"><td>Total</td>
          <td class="num">${this.escapeHtml(this.moedaListaCapa(totLiq))}</td>
        </tr></tfoot></table>
      </div>`;
      const theadAlertas = ocultarLiqAlertas
        ? '<th>Funcionário</th><th>Motivo</th>'
        : '<th>Funcionário</th><th class="num">Líquido</th><th>Motivo</th>';
      const colspanVazio = ocultarLiqAlertas ? '2' : '3';
      const secNo = `<div class="section">
        <div class="evento-det-titulo">${
          opcoes.somenteAlertas ? 'Alertas' : 'Não entram'
        } (${invalidos.length})</div>
        <table class="tbl-rep"><thead><tr>
          ${theadAlertas}
        </tr></thead>
        <tbody>${trNo || `<tr><td colspan="${colspanVazio}" style="text-align:center;color:#666">Nenhum alerta</td></tr>`}</tbody>
      </table>
      </div>`;
      return `${cab}${resumo}${secOk}${secNo}`;
    };

    const subModo = [
      opcoes.somenteAlertas ? 'Somente alertas' : 'Todos',
      opcoes.ocultarLiquidoAlertas ? 'Sem líquido nos alertas' : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const unidadesEscopo = this.unidadesEscopoRelatorio();
    if (opcoes.quebraUnidadeMaster && unidadesEscopo.length > 1) {
      const map = new Map<string, LinhaPrev[]>();
      for (const ln of linhas) {
        const arr = map.get(ln.unidade) ?? [];
        arr.push(ln);
        map.set(ln.unidade, arr);
      }
      const paginas = unidadesEscopo.map((u) => {
        const k = String(u);
        return {
          linhasCabecalhoCentral: [k, comp, tipoFolhaDescricao, subModo],
          corpo: montarBloco(map.get(k) ?? [], undefined),
        };
      });
      return this.montarHtmlDocumentoPadraoFicha({
        documentTitle: 'previa-pagbank',
        tituloPrincipal: 'PRÉVIA PAGBANK',
        linhasCabecalhoCentral: [],
        corpo: '',
        config,
        paginas,
      });
    }

    return this.montarHtmlDocumentoPadraoFicha({
      documentTitle: 'previa-pagbank',
      tituloPrincipal: 'PRÉVIA PAGBANK',
      linhasCabecalhoCentral: [rotuloUnidade, comp, tipoFolhaDescricao, subModo],
      corpo:
        montarBloco(linhas) ||
        '<p class="vazio-relatorio-evento">Nenhuma folha encontrada para os filtros.</p>',
      config,
    });
  }

  private rotuloTipoMovimentoRelatorioEvento(tipo: FolhaMovimentoTipo): string {
    return tipo === FolhaMovimentoTipo.RECEITA ? 'Receita' : 'Despesa';
  }

  private montarCorpoFolhaPorEventoDeRows(
    rows: FolhaCapaDetalheResponse[],
    verbaIdsIncluir: ReadonlySet<string>,
    prefixoTitulo?: string,
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
        if (!vid || !verbaIdsIncluir.has(vid)) continue;
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
      const rotuloTipo = this.rotuloTipoMovimentoRelatorioEvento(b.tipo);
      return `<div class="evento-det-block">
        <div class="evento-det-titulo">${this.escapeHtml(b.descricao)} (${this.escapeHtml(rotuloTipo)})</div>
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
      if (!blocos.length) return '';
      const titulo = prefixoTitulo
        ? `${prefixoTitulo} · ${tituloMacro}`
        : tituloMacro;
      return `<div class="section">
          <div class="secao-macro-titulo">${this.escapeHtml(titulo)}</div>
          ${blocos.map((b) => htmlBlocoVerba(b)).join('')}
        </div>`;
    };

    const partesCorpo = [
      montarSecaoTipo('RECEITAS', receitas),
      montarSecaoTipo('DESPESAS', despesas),
    ].filter((p) => p.length > 0);
    return partesCorpo.join('');
  }

  private montarHtmlRelatorioFolhaPorEventoDocumento(
    rows: FolhaCapaDetalheResponse[],
    config: Configuracao | null,
    rotuloUnidade: string,
    tipoFolhaDescricao: string,
    verbaIdsIncluir: ReadonlySet<string>,
    quebraUnidadeMaster: boolean,
  ): string {
    const comp = `${this.nomeMesPt(this.mes)} / ${this.ano}`;
    const unidadesEscopo = this.unidadesEscopoRelatorio();

    if (quebraUnidadeMaster && unidadesEscopo.length > 1) {
      const map = new Map<string, FolhaCapaDetalheResponse[]>();
      for (const r of rows) {
        const key = this.descricaoUnidadeParaRelatorio(r);
        const arr = map.get(key) ?? [];
        arr.push(r);
        map.set(key, arr);
      }
      const paginas = unidadesEscopo.map((u) => {
        const k = String(u);
        const rowsUn = map.get(k) ?? [];
        const corpoUn =
          rowsUn.length === 0
            ? '<p class="vazio-relatorio-evento">Nenhuma folha nesta unidade para os filtros.</p>'
            : this.montarCorpoFolhaPorEventoDeRows(rowsUn, verbaIdsIncluir) ||
              '<p class="vazio-relatorio-evento">Nenhum lançamento para os eventos e filtros selecionados.</p>';
        return {
          linhasCabecalhoCentral: [k, comp, tipoFolhaDescricao],
          corpo: corpoUn,
        };
      });
      return this.montarHtmlDocumentoPadraoFicha({
        documentTitle: 'folha-geral-por-evento',
        tituloPrincipal: 'FOLHA GERAL POR EVENTO',
        linhasCabecalhoCentral: [],
        corpo: '',
        config,
        paginas,
      });
    }

    const corpo =
      this.montarCorpoFolhaPorEventoDeRows(rows, verbaIdsIncluir) ||
      '<p class="vazio-relatorio-evento">Nenhum lançamento para os eventos e filtros selecionados.</p>';

    return this.montarHtmlDocumentoPadraoFicha({
      documentTitle: 'folha-geral-por-evento',
      tituloPrincipal: 'FOLHA GERAL POR EVENTO',
      linhasCabecalhoCentral: [rotuloUnidade, comp, tipoFolhaDescricao],
      corpo,
      config,
    });
  }

  /**
   * Cabeçalho tipo ficha técnica (logo + título central) e rodapé com data/usuário.
   * Com `paginas`, cada item é uma folha completa (logo + cabeçalho + corpo + rodapé) e quebra de página.
   */
  private montarHtmlDocumentoPadraoFicha(opts: {
    documentTitle: string;
    tituloPrincipal: string;
    linhasCabecalhoCentral: string[];
    corpo: string;
    config: Configuracao | null;
    paginas?: Array<{ linhasCabecalhoCentral: string[]; corpo: string }>;
  }): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const geradoEm = new Date().toLocaleString('pt-BR');
    let logoHtml = '';
    if (opts.config?.hasLogo) {
      logoHtml = `<img src="${environment.apiUrl}/configuracao/logo" alt="Logo" style="max-height: 80px; max-width: 120px; display: block;" />`;
    }

    const montarHeader = (linhas: string[]): string => {
      const headerRow = linhas
        .map((t) => `<div>${this.escapeHtml(t)}</div>`)
        .join('');
      return `<div class="header">
    <div class="logo-box">${logoHtml}</div>
    <div class="header-content">
      <h1 class="header-title">${this.escapeHtml(opts.tituloPrincipal)}</h1>
      <div class="header-row">${headerRow}</div>
    </div>
  </div>`;
    };

    const rodape = `<div class="footer-print">
    Documento gerado em ${geradoEm} &nbsp; Impresso por: ${this.escapeHtml(userName)}
  </div>`;

    const multi = !!(opts.paginas && opts.paginas.length > 0);
    /** Rodapé único e fixo na impressão — não entra no fluxo (não pula de página). */
    const corpoHtml = multi
      ? opts.paginas!
          .map((p, i) => {
            const last = i === opts.paginas!.length - 1;
            const cls = last
              ? 'relatorio-pagina relatorio-pagina--last'
              : 'relatorio-pagina';
            return `<div class="${cls}">
  ${montarHeader(p.linhasCabecalhoCentral)}
  ${p.corpo}
</div>`;
          })
          .join('') + rodape
      : `${montarHeader(opts.linhasCabecalhoCentral)}
  ${opts.corpo}
  ${rodape}`;

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
    .secao-macro-titulo { font-weight: 700; font-size: 12px; margin: 14px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }
    .vazio-secao, .vazio-relatorio-evento { color: #666; margin: 0; }
    .tbl-rep { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tbl-rep th, .tbl-rep td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
    .tbl-rep th { background: #f5f5f5; font-weight: bold; text-align: left; }
    .tbl-rep th.num, .tbl-rep td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tbl-rep .totais td { font-weight: bold; background: #fff8e6; }
    .tbl-rep tfoot .totais td { border-top: 2px solid #999; }
    .evento-det-block { margin-bottom: 14px; page-break-inside: avoid; }
    .setor-rep-block { margin-bottom: 16px; page-break-inside: avoid; }
    .setor-resumo-final { margin-top: 20px; page-break-inside: avoid; }
    .relatorio-pagina {
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
    }
    .relatorio-pagina.relatorio-pagina--last {
      page-break-after: auto;
      break-after: auto;
    }
    .tbl-rep-folha-setor { table-layout: fixed; width: 100%; }
    .tbl-rep-folha-setor col.col-funcionario { width: 42%; }
    .tbl-rep-folha-setor col.col-num { width: 19.33%; }
    .tbl-rep-folha-setor .col-funcionario { word-wrap: break-word; overflow-wrap: anywhere; }
    .tbl-rep-resumo-setor col.col-funcionario { width: 42%; }
    .tbl-rep-resumo-setor col.col-num { width: 14.5%; }
    .evento-det-titulo { font-weight: 700; font-size: 12px; margin: 10px 0 6px; color: #1e293b; }
    .folha-geral-func-bloco { margin: 0 0 12px; page-break-inside: avoid; }
    .folha-geral-func-nome { font-weight: 700; font-size: 11.5px; margin: 0 0 4px; color: #0f172a; }
    .folha-geral-func-totais { margin: 4px 0 0; font-size: 10.5px; color: #334155; }
    .folha-geral-eventos-vazio { margin: 4px 0 8px; font-size: 11px; color: #64748b; font-style: italic; }
    .tbl-rep-folha-geral-eventos { margin-bottom: 2px; }
    .evento-det-block table { margin-top: 4px; }
    .footer-print { font-size: 9px; color: #444; margin-top: 20px; }
    @media print {
      @page { margin: 15mm 10mm 18mm 10mm; }
      .footer-print {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100vw;
        font-size: 9px !important;
        color: #444 !important;
        z-index: 1000;
        margin-top: 0 !important;
      }
    }
  </style>
</head>
<body${multi ? ' class="relatorio-multipagina"' : ''}>
  ${corpoHtml}
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
          .recibo-geral-unidade-rotulo {
            text-align: center;
            font-size: 11px;
            color: #64748b;
            margin: 0 0 6px;
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
          .sec-tabela-mini .cell-desc { text-align: left; font-weight: 500; width: 48%; }
          .sec-tabela-mini .cell-ref {
            text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap;
            font-weight: 600; width: 28%; font-size: 10px; color: var(--r-text);
          }
          .sec-tabela-mini .cell-val { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 700; min-width: 100px; width: 24%; }
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

    const linhasReciboSecao = <
      U extends {
        valor: unknown;
        quantidade?: string;
        folhaVerba: { descricao: string };
      },
    >(
      itens: U[],
      msgVazio: string,
    ): string => {
      if (!itens.length) {
        return `<tr class="stripe-a"><td colspan="3" class="sem-itens-msg">${this.escapeHtml(
          msgVazio,
        )}</td></tr>`;
      }
      return itens
        .map((it, idx) => {
          const stripe = idx % 2 === 0 ? 'stripe-a' : 'stripe-b';
          const valorEsc = this.escapeHtml(this.moedaListaCapa(it.valor));
          const refEsc = this.escapeHtml(
            FolhaLancamentosPage.rotuloReferenciaRecibo(it.quantidade),
          );
          return `<tr class="${stripe}"><td class="cell-desc">${this.escapeHtml(
            it.folhaVerba.descricao,
          )}</td><td class="cell-ref">${refEsc}</td><td class="cell-val">${valorEsc}</td></tr>`;
        })
        .join('');
    };

    const bodyReceitas = linhasReciboSecao(
      itensReceitas,
      'Nenhuma receita nesta folha.',
    );
    const bodyDespesas = linhasReciboSecao(
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
                  <td class="cell-ref"></td>
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
                  <td class="cell-ref"></td>
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
    rotuloUnidade: string,
    rows: FolhaCapaDetalheResponse[],
    quebraUnidadeMaster: boolean,
  ): string {
    const user = this.auth.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const footer = `<div class="footer-print">
          Documento gerado em ${new Date().toLocaleString('pt-BR')} · Impresso por: ${this.escapeHtml(userName)}
        </div>`;
    const sorted = [...rows].sort((a, b) => {
      if (quebraUnidadeMaster) {
        const du = this.descricaoUnidadeParaRelatorio(a).localeCompare(
          this.descricaoUnidadeParaRelatorio(b),
          'pt-BR',
        );
        if (du !== 0) return du;
      }
      return this.nomeParaCapa(a).localeCompare(this.nomeParaCapa(b), 'pt-BR');
    });
    const slugUn = rotuloUnidade
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
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
            <p class="doc-nome-func">${this.escapeHtml(rotuloUnidade)} · ${this.escapeHtml(tipoDesc)}</p>
          </header>
          <p class="recibo-geral-vazio-msg">Não há folhas nesta competência para os filtros selecionados.</p>
          ${footer}
        </div>`
        : sorted
            .map(
              (d, i, arr) => {
                const unCapa = this.descricaoUnidadeParaRelatorio(d);
                const rotuloPagina = quebraUnidadeMaster
                  ? `${unCapa} · ${tipoDesc}`
                  : `${rotuloUnidade} · ${tipoDesc}`;
                return `<div class="recibo-geral-pagina"${
                i === arr.length - 1 ? ' data-last="1"' : ''
              }>
          <div class="recibo-geral-wrap">
            <p class="recibo-geral-unidade-rotulo">${this.escapeHtml(rotuloPagina)}</p>
            ${this.montarCorpoHtmlReciboPagamento(d)}
          </div>
          ${footer}
        </div>`;
              },
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
    this.limparSelecaoArquivoPagamento();
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
              'Nenhuma folha (capa) nesta competência. Elegíveis: ativo, admissão até o mês/ano vigente; se demitido, competência até o mês da demissão inclusive (RN-011).',
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
    this.limparSelecaoArquivoPagamento();
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

  /** Iniciais para o avatar do modal (1ª letra do 1º e do último nome). */
  iniciaisNomeFuncionario(row: FolhaCapaDetalheResponse): string {
    const partes = this.nomeParaCapa(row)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].slice(0, 2).toLocaleUpperCase('pt-BR');
    const a = partes[0][0] ?? '';
    const b = partes[partes.length - 1][0] ?? '';
    return `${a}${b}`.toLocaleUpperCase('pt-BR');
  }

  /**
   * Valores monetários na grade principal; evita `CurrencyPipe` (entradas string/omitidas pela API ficam vazias).
   */
  moedaListaCapa(valor: unknown): string {
    const n = FolhaLancamentosPage.parseDecimalFinanceiro(valor);
    return Number.isNaN(n) ? '—' : this.formatoMoedaCapaLista.format(n);
  }

  /** Quantidade de capas/funcionários na lista carregada. */
  quantidadeFuncionariosLista(): number {
    return this.capasNaCompetencia.length;
  }

  totalReceitasLista(): number {
    return this.capasNaCompetencia.reduce(
      (acc, row) => acc + (FolhaLancamentosPage.parseDecimalFinanceiro(row.totalReceitas) || 0),
      0,
    );
  }

  totalDespesasLista(): number {
    return this.capasNaCompetencia.reduce(
      (acc, row) => acc + (FolhaLancamentosPage.parseDecimalFinanceiro(row.totalDespesas) || 0),
      0,
    );
  }

  totalLiquidoLista(): number {
    return this.capasNaCompetencia.reduce(
      (acc, row) => acc + (FolhaLancamentosPage.parseDecimalFinanceiro(row.liquido) || 0),
      0,
    );
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
    return `${this.nomeParaCapa(row)}. Líquido ${this.moedaListaCapa(row.liquido)}. Abrir folha`;
  }

  /** Clique na linha abre o modal da folha (checkbox permanece só para seleção do arquivo). */
  abrirModalFolhaCapa(row: FolhaCapaDetalheResponse, event?: Event): void {
    event?.preventDefault();
    this.fecharTodosModaisItem();
    this.detalhe = row;
  }

  fecharModalFolhaCapa(): void {
    this.fecharTodosModaisItem();
    this.detalhe = null;
  }

  indiceCapaModalAtual(): number {
    if (!this.detalhe) return -1;
    return this.capasNaCompetencia.findIndex(
      (c) => c.capa.id === this.detalhe!.capa.id,
    );
  }

  podeIrParaCapaAnterior(): boolean {
    return this.indiceCapaModalAtual() > 0;
  }

  podeIrParaProximaCapa(): boolean {
    const i = this.indiceCapaModalAtual();
    return i >= 0 && i < this.capasNaCompetencia.length - 1;
  }

  irParaCapaAnterior(): void {
    const i = this.indiceCapaModalAtual();
    if (i <= 0) return;
    this.abrirModalFolhaCapa(this.capasNaCompetencia[i - 1]);
  }

  irParaProximaCapa(): void {
    const i = this.indiceCapaModalAtual();
    if (i < 0 || i >= this.capasNaCompetencia.length - 1) return;
    this.abrirModalFolhaCapa(this.capasNaCompetencia[i + 1]);
  }

  private static quantidadeFormatadaInicial(q: unknown): string {
    const n = Number.parseFloat(String(q ?? '1').replace(',', '.'));
    const x = Number.isFinite(n) ? n : 1;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(x);
  }

  /** Rótulo da referência no recibo (impressão / recibo geral). */
  private static rotuloReferenciaRecibo(q: unknown): string {
    return `REFERÊNCIA(${FolhaLancamentosPage.quantidadeFormatadaInicial(q)})`;
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
    return this.capaSelecionadaNoArquivo(row.capa.id);
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

  private removerCapaDaLista(capaId: string): void {
    this.capasNaCompetencia = this.capasNaCompetencia.filter(
      (c) => c.capa.id !== capaId,
    );
    if (this.detalhe?.capa.id === capaId) {
      this.detalhe = null;
    }
  }

  solicitarExcluirCapa(): void {
    if (!this.podeExcluirCapa() || !this.detalhe) return;
    const nome = this.nomeFuncionario(this.detalhe.capa.funcionario);
    this.excluirCapaModalMensagem =
      `Excluir a folha de ${nome} nesta competência? Todos os eventos lançados serão removidos. Esta ação não pode ser desfeita.`;
    this.showExcluirCapaModal = true;
  }

  fecharExcluirCapaModal(): void {
    this.showExcluirCapaModal = false;
  }

  confirmarExcluirCapaModal(): void {
    this.fecharExcluirCapaModal();
    const un = this.unidadeApi();
    const capaId = this.detalhe?.capa.id;
    if (!capaId || !un || !this.podeExcluirCapa()) return;
    this.excluindoCapa = true;
    this.folha.deleteCapa(capaId, un).subscribe({
      next: () => {
        this.removerCapaDaLista(capaId);
        this.excluindoCapa = false;
        this.errors.show('Folha excluída com sucesso.', 'Folha');
      },
      error: (e) => {
        this.excluindoCapa = false;
        this.errors.show(e?.error?.message ?? 'Erro ao excluir a folha.', 'Folha');
      },
    });
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
    return this.auth.hasPermission(Permission.FOLHA_LANCAMENTO_ENVIAR_RECIBO_WHATSAPP);
  }

  private temPermissaoEnviarReciboWhatsapp(): boolean {
    return this.temPermissaoEnviarReciboWhatsappIndividual();
  }

  private telefoneFuncionarioAtualValido(): boolean {
    const telefone = this.detalhe?.capa?.funcionario?.telefone?.trim();
    return !!telefone;
  }

  podeGerarArquivoPagamento(): boolean {
    return this.auth.hasPermission(
      Permission.FOLHA_LANCAMENTO_GERAR_ARQUIVO_PAGAMENTO,
    );
  }

  desabilitarBotaoArquivoPagamento(): boolean {
    if (this.gerandoArquivoPagamento) return true;
    if (!this.podeGerarArquivoPagamento()) return true;
    if (!this.statusLote?.registrada || !this.statusLote.fechado) return true;
    if (!this.unidadeApi()) return true;
    return this.capasSelecionadasArquivo.size === 0;
  }

  capaSelecionadaNoArquivo(capaId: string): boolean {
    return this.capasSelecionadasArquivo.has(capaId);
  }

  todasCapasSelecionadasNoArquivo(): boolean {
    if (this.capasNaCompetencia.length === 0) return false;
    return this.capasNaCompetencia.every((r) =>
      this.capasSelecionadasArquivo.has(r.capa.id),
    );
  }

  alternarSelecaoCapaArquivo(capaId: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const next = new Set(this.capasSelecionadasArquivo);
    if (next.has(capaId)) next.delete(capaId);
    else next.add(capaId);
    this.capasSelecionadasArquivo = next;
  }

  alternarSelecaoTodasCapasArquivo(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.todasCapasSelecionadasNoArquivo()) {
      this.capasSelecionadasArquivo = new Set();
      return;
    }
    this.capasSelecionadasArquivo = new Set(
      this.capasNaCompetencia.map((r) => r.capa.id),
    );
  }

  limparSelecaoArquivoPagamento(): void {
    this.capasSelecionadasArquivo = new Set();
  }

  solicitarGerarArquivoPagamento(): void {
    if (this.desabilitarBotaoArquivoPagamento()) return;
    const selecionadas = this.capasNaCompetencia.filter((r) =>
      this.capasSelecionadasArquivo.has(r.capa.id),
    );
    if (selecionadas.length === 0) {
      this.errors.show('Selecione ao menos um funcionário.', 'Arquivo de pagamento');
      return;
    }

    const avisos: string[] = [];
    const validas: FolhaCapaDetalheResponse[] = [];
    for (const row of selecionadas) {
      const f = row.capa.funcionario;
      const nome = f?.nome?.trim() || '—';
      const problemas: string[] = [];
      const banco = String(f?.bancoNumero ?? '').replace(/\D/g, '');
      const conta = String(f?.contaBancaria ?? '').replace(/\D/g, '');
      const digito = String(f?.digitoConta ?? '').replace(/\D/g, '');
      if (!banco || !conta || !digito) {
        problemas.push('sem dados bancários (banco, conta e dígito)');
      }
      const cpf = String(f?.cpf ?? '').replace(/\D/g, '');
      if (!cpf) problemas.push('sem CPF');
      if (!(Number(row.liquido) > 0)) {
        problemas.push('líquido ≤ 0');
      }
      if (problemas.length > 0) {
        avisos.push(`${nome}: ${problemas.join('; ')}`);
      } else {
        validas.push(row);
      }
    }

    if (avisos.length > 0) {
      this.arquivoPagamentoAvisosDetalhes = avisos;
      this.capaIdsArquivoPendentes = validas.map((r) => r.capa.id);
      if (validas.length === 0) {
        this.arquivoPagamentoAvisosMensagem =
          'Nenhum dos selecionados pode entrar no arquivo. Corrija o cadastro ou o líquido e tente novamente.';
      } else {
        this.arquivoPagamentoAvisosMensagem = `${avisos.length} funcionário(s) serão omitidos. Deseja gerar o arquivo apenas com os ${validas.length} válido(s)?`;
      }
      this.showArquivoPagamentoAvisosModal = true;
      return;
    }

    this.executarGeracaoArquivoPagamento(validas.map((r) => r.capa.id));
  }

  confirmarArquivoPagamentoAvisosModal(): void {
    const ids = [...this.capaIdsArquivoPendentes];
    this.fecharArquivoPagamentoAvisosModal();
    if (ids.length === 0) return;
    this.executarGeracaoArquivoPagamento(ids);
  }

  fecharArquivoPagamentoAvisosModal(): void {
    this.showArquivoPagamentoAvisosModal = false;
    this.arquivoPagamentoAvisosMensagem = '';
    this.arquivoPagamentoAvisosDetalhes = [];
    this.capaIdsArquivoPendentes = [];
  }

  private executarGeracaoArquivoPagamento(capaIds: string[]): void {
    const un = this.unidadeApi();
    if (!un || capaIds.length === 0) return;
    this.gerandoArquivoPagamento = true;
    this.folha.gerarArquivoPagamento({ unidade: un, capaIds }).subscribe({
      next: (blob) => {
        this.gerandoArquivoPagamento = false;
        const mesPad = String(this.mes).padStart(2, '0');
        const fileName = `folha-pagamento-${un}-${this.ano}-${mesPad}.xlsx`;
        this.baixarBlob(blob, fileName);
        this.errors.show(
          `Arquivo gerado com ${capaIds.length} funcionário(s).`,
          'Arquivo de pagamento',
        );
      },
      error: async (e: unknown) => {
        this.gerandoArquivoPagamento = false;
        const msg = await this.mensagemErroBlobOuJson(e);
        this.errors.show(msg, 'Arquivo de pagamento');
      },
    });
  }

  private baixarBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async mensagemErroBlobOuJson(e: unknown): Promise<string> {
    const err = e as {
      error?: Blob | { message?: string | string[]; avisos?: string[] };
      message?: string;
    };
    if (err?.error instanceof Blob) {
      try {
        const text = await err.error.text();
        const parsed = JSON.parse(text) as {
          message?: string | string[];
          avisos?: string[];
        };
        const base = Array.isArray(parsed.message)
          ? parsed.message.join(' ')
          : parsed.message || 'Erro ao gerar o arquivo.';
        if (parsed.avisos?.length) {
          return `${base}\n${parsed.avisos.join('\n')}`;
        }
        return base;
      } catch {
        return 'Erro ao gerar o arquivo de pagamento.';
      }
    }
    const msg = (err?.error as { message?: string | string[] } | undefined)
      ?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string') return msg;
    return err?.message || 'Erro ao gerar o arquivo de pagamento.';
  }
}
