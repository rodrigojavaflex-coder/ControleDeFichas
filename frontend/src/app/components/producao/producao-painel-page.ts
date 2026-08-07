import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoPainelService } from '../../services/producao-painel.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ProducaoPainelHistoricoEtapa,
  ProducaoPainelHistoricoResponse,
  ProducaoPainelLinha,
  ProducaoPainelResponse,
} from '../../models/producao-painel.model';
import { estiloFundoPainel } from './utils/producao-painel-cor.util';
import { rotuloClientePaciente } from './utils/producao-cliente-paciente.util';
import { ProducaoEtapasRefreshService } from '../../services/producao-etapas-refresh.service';
import {
  FiltroReqFormula,
  linhaAtendeFiltroReqFormula,
  MENSAGEM_FORMATO_FILTRO_REQ_FORMULA,
  parseFiltroReqFormula,
  rotuloFiltroReqFormula,
} from './utils/producao-req-formula-filtro.util';

export interface ProducaoPainelCardEtapa {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  total: number;
  atrasadas: number;
  dentroPrazo: number;
}

@Component({
  selector: 'app-producao-painel-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-painel-page.html',
  styleUrls: [
    './producao-painel-page.css',
    './producao-filtros-collapsible.css',
    './producao-etapa-cards.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProducaoPainelPage implements OnInit, OnDestroy {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private painelService = inject(ProducaoPainelService);
  private producaoEtapasRefresh = inject(ProducaoEtapasRefreshService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  unidades: Unidade[] = Object.values(Unidade);
  selectedUnidades = new Set<Unidade>();
  unidadeDisabled = false;

  carregando = false;
  carregandoHistorico = false;
  readonly dados = signal<ProducaoPainelResponse | null>(null);
  readonly codEtapaFiltro = signal<string | null>(null);
  readonly reqFormulaFiltroAtivo = signal<FiltroReqFormula | null>(null);

  readonly cardsEtapa = computed((): ProducaoPainelCardEtapa[] => {
    const linhas = this.dados()?.linhas ?? [];
    const mapa = new Map<string, ProducaoPainelCardEtapa>();
    for (const lin of linhas) {
      const key = lin.codEtapaAtual;
      const atual = mapa.get(key);
      if (!atual) {
        mapa.set(key, {
          codEtapa: lin.codEtapaAtual,
          etapa: lin.etapaAtual,
          posicaoEtapa: lin.posicaoEtapaAtual,
          total: 1,
          atrasadas:
            lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0 ? 1 : 0,
          dentroPrazo: 0,
        });
      } else {
        atual.total += 1;
        if (lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0) {
          atual.atrasadas += 1;
        }
      }
    }
    return [...mapa.values()]
      .map((c) => ({
        ...c,
        dentroPrazo: c.total - c.atrasadas,
      }))
      .sort(
        (a, b) =>
          a.posicaoEtapa - b.posicaoEtapa ||
          a.etapa.localeCompare(b.etapa, 'pt-BR'),
      );
  });

  readonly linhasVisiveis = computed((): ProducaoPainelLinha[] => {
    let linhas = this.dados()?.linhas ?? [];
    const reqF = this.reqFormulaFiltroAtivo();
    const codF = this.codEtapaFiltro();
    if (reqF) {
      linhas = linhas.filter((l) => linhaAtendeFiltroReqFormula(l, reqF));
    } else if (codF) {
      linhas = linhas.filter((l) => l.codEtapaAtual === codF);
    }
    return linhas;
  });

  readonly labelEtapaFiltro = computed((): string => {
    const cod = this.codEtapaFiltro();
    const card = this.cardsEtapa().find((c) => c.codEtapa === cod);
    if (!card) {
      return cod ?? '';
    }
    return `${card.etapa} (${card.codEtapa})`;
  });

  readonly resumoGeral = computed(
    (): { total: number; atrasadas: number; dentroPrazo: number } => {
      const linhas = this.dados()?.linhas ?? [];
      let atrasadas = 0;
      for (const lin of linhas) {
        if (lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0) {
          atrasadas += 1;
        }
      }
      const total = linhas.length;
      return { total, atrasadas, dentroPrazo: total - atrasadas };
    },
  );

  readonly descricaoUltimaAtualizacao = computed((): string | null => {
    const iso = this.dados()?.consultadoEm;
    if (!iso) {
      return null;
    }
    return `Última atualização: ${this.formatarDataHoraConsulta(iso)}`;
  });

  filtroReqFormula = '';

  filtrosContainerAberto = true;

  modalHistoricoAberto = false;
  historico: ProducaoPainelHistoricoResponse | null = null;
  linhaHistorico: ProducaoPainelLinha | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Painel de retirada',
      description:
        'Requisições em produção com prazo de entrega (retirada). Semáforo por tempo corrido até a data/hora de retirada.',
    });
    this.initializeUnidadeFilter();
    void this.atualizar();

    this.producaoEtapasRefresh.iniciarMonitoramentoSincronizacao();
    this.producaoEtapasRefresh.onEtapasAtualizadas$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.podeLer() && this.selectedUnidades.size > 0 && !this.carregando) {
          this.atualizar();
        }
      });
  }

  ngOnDestroy(): void {
    this.producaoEtapasRefresh.pararMonitoramentoSincronizacao();
  }

  get processamentoAtivo(): boolean {
    return this.carregando;
  }

  get tituloProcessamento(): string {
    return 'Buscando requisições';
  }

  get subtituloProcessamento(): string {
    return 'Carregando painel de produção em andamento…';
  }

  get unidadeFixa(): Unidade | null {
    if (!this.unidadeDisabled || this.selectedUnidades.size === 0) {
      return null;
    }
    return this.selectedUnidades.values().next().value ?? null;
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_PAINEL_READ);
  }

  rotuloFiltroReqFormula(filtro: FiltroReqFormula): string {
    return rotuloFiltroReqFormula(filtro);
  }

  contadorFiltrosAtivos(): number {
    let n = 0;
    if (this.selectedUnidades.size > 0 && this.selectedUnidades.size < this.unidades.length) {
      n += 1;
    }
    if (this.reqFormulaFiltroAtivo()) {
      n += 1;
    }
    if (this.codEtapaFiltro()) {
      n += 1;
    }
    if (this.filtroReqFormula.trim()) {
      n += 1;
    }
    return n;
  }

  rotuloDentroPrazoCard(quantidade: number): string {
    return quantidade === 0 ? 'nenhuma no prazo' : `${quantidade} dentro do prazo`;
  }

  toggleFiltrosContainer(): void {
    this.filtrosContainerAberto = !this.filtrosContainerAberto;
    this.cdr.markForCheck();
  }

  atualizar(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    this.carregando = true;
    this.cdr.markForCheck();
    this.fecharHistorico();
    this.painelService
      .consultar({ unidades: Array.from(this.selectedUnidades) })
      .subscribe({
        next: (data) => {
          this.dados.set(data);
          const codF = this.codEtapaFiltro();
          if (
            codF &&
            !data.linhas.some((l) => l.codEtapaAtual === codF)
          ) {
            this.codEtapaFiltro.set(null);
          }
          const reqF = this.reqFormulaFiltroAtivo();
          if (reqF) {
            const aindaExiste = data.linhas.some((l) =>
              linhaAtendeFiltroReqFormula(l, reqF),
            );
            if (!aindaExiste) {
              this.limparFiltroReqFormula(false);
            }
          }
          this.carregando = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar painel.',
            'Painel de retirada',
          );
          this.dados.set(null);
          this.carregando = false;
          this.cdr.markForCheck();
        },
      });
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
      this.dados.set(null);
      this.codEtapaFiltro.set(null);
      this.cdr.markForCheck();
    } else {
      this.unidades.forEach((u) => this.selectedUnidades.add(u));
      this.atualizar();
    }
  }

  limparUnidades(): void {
    this.selectedUnidades.clear();
    this.dados.set(null);
    this.codEtapaFiltro.set(null);
    this.limparFiltroReqFormula();
    this.fecharHistorico();
    this.cdr.markForCheck();
  }

  buscarRequisicaoFormula(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    const parsed = parseFiltroReqFormula(this.filtroReqFormula);
    if (!parsed) {
      this.errors.show(
        MENSAGEM_FORMATO_FILTRO_REQ_FORMULA,
        'Painel de retirada',
      );
      return;
    }
    const linhas = this.dados()?.linhas ?? [];
    const encontradas = linhas.filter((l) =>
      linhaAtendeFiltroReqFormula(l, parsed),
    );
    if (!encontradas.length) {
      this.errors.show(
        parsed.formula == null
          ? 'Requisição não encontrada no painel das unidades selecionadas.'
          : 'Requisição-fórmula não encontrada no painel das unidades selecionadas.',
        'Painel de retirada',
      );
      return;
    }
    this.reqFormulaFiltroAtivo.set(parsed);
    if (parsed.formula != null && encontradas.length === 1) {
      this.codEtapaFiltro.set(encontradas[0].codEtapaAtual);
    } else {
      this.codEtapaFiltro.set(null);
    }
    this.cdr.markForCheck();
    if (parsed.formula != null && encontradas.length === 1) {
      this.abrirHistorico(encontradas[0]);
    }
  }

  limparFiltroReqFormula(limparInput = true): void {
    this.reqFormulaFiltroAtivo.set(null);
    if (limparInput) {
      this.filtroReqFormula = '';
    }
    this.cdr.markForCheck();
  }

  limparFiltrosVisuais(): void {
    this.codEtapaFiltro.set(null);
    this.limparFiltroReqFormula();
    this.cdr.markForCheck();
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

  onCardKeydown(event: KeyboardEvent, acao: () => void): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    acao();
  }

  selecionarCardEtapa(codEtapa: string): void {
    this.limparFiltroReqFormula(false);
    if (this.codEtapaFiltro() === codEtapa) {
      this.codEtapaFiltro.set(null);
      this.cdr.markForCheck();
      return;
    }
    this.codEtapaFiltro.set(codEtapa);
    this.cdr.markForCheck();
  }

  selecionarCardTotal(): void {
    this.limparFiltroReqFormula(false);
    this.codEtapaFiltro.set(null);
    this.cdr.markForCheck();
  }

  limparFiltroEtapa(): void {
    this.codEtapaFiltro.set(null);
    this.cdr.markForCheck();
  }

  estiloCorLinha(cor: string): Record<string, string> | null {
    return estiloFundoPainel(cor);
  }

  classeCorLinha(cor: string): string {
    const c = (cor ?? '').toUpperCase();
    if (c === 'AMARELO') return 'producao-painel-linha--amarelo';
    if (c === 'LARANJA') return 'producao-painel-linha--laranja';
    if (c === 'VERMELHO') return 'producao-painel-linha--vermelho';
    if (c.startsWith('#')) return '';
    return '';
  }

  rotuloClientePaciente(
    cliente: string | null | undefined,
    paciente: string | null | undefined,
  ): string | null {
    return rotuloClientePaciente(cliente, paciente);
  }

  labelTempoRetirada(lin: ProducaoPainelLinha): string {
    const m = lin.minutosParaRetirada;
    if (m == null) {
      return 'Sem data de retirada';
    }
    const abs = Math.abs(Math.round(m));
    const texto = this.formatarMinutos(abs);
    if (m < 0) {
      return `Atrasado ${texto}`;
    }
    return `Faltam ${texto}`;
  }

  labelStatus(lin: ProducaoPainelLinha): string {
    const rotulo = lin.rotuloAlerta?.trim();
    if (rotulo) {
      return rotulo;
    }
    if (lin.minutosParaRetirada == null) {
      return 'Sem data de retirada';
    }
    return 'No prazo';
  }

  formatarMinutos(min: number): string {
    if (min < 60) {
      return `${min} min`;
    }
    if (min < 24 * 60) {
      const h = Math.floor(min / 60);
      const mi = min % 60;
      return mi > 0 ? `${h} h ${mi} min` : `${h} h`;
    }
    const dias = Math.floor(min / (24 * 60));
    const resto = min % (24 * 60);
    const h = Math.floor(resto / 60);
    const mi = resto % 60;
    const partes: string[] = [`${dias} d`];
    if (h > 0) partes.push(`${h} h`);
    if (mi > 0) partes.push(`${mi} min`);
    return partes.join(' ');
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
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

  labelReqFormula(lin: ProducaoPainelLinha): string {
    return `${lin.requisicao}-${lin.formula}`;
  }

  formatarHoraRetirada(hora: string | null | undefined): string {
    const h = hora?.trim();
    if (!h) {
      return '';
    }
    const parts = h.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return h;
  }

  chaveLinha(lin: ProducaoPainelLinha): string {
    return `${lin.unidade}|${lin.filial}|${lin.requisicao}|${lin.formula}`;
  }

  abrirHistorico(lin: ProducaoPainelLinha): void {
    if (this.carregandoHistorico) {
      return;
    }
    this.linhaHistorico = lin;
    this.carregandoHistorico = true;
    this.historico = null;
    this.modalHistoricoAberto = true;
    this.cdr.markForCheck();
    this.painelService
      .historico({
        unidade: lin.unidade,
        filial: lin.filial,
        requisicao: lin.requisicao,
        formula: lin.formula,
      })
      .subscribe({
        next: (data) => {
          this.historico = data;
          this.carregandoHistorico = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.modalHistoricoAberto = false;
          this.linhaHistorico = null;
          this.carregandoHistorico = false;
          this.cdr.markForCheck();
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar histórico da requisição.',
            'Painel de retirada',
          );
        },
      });
  }

  fecharHistorico(): void {
    this.modalHistoricoAberto = false;
    this.historico = null;
    this.linhaHistorico = null;
    this.carregandoHistorico = false;
    this.cdr.markForCheck();
  }

  labelEntradaSaida(data: string | null, hora: string | null): string {
    if (!data) {
      return '—';
    }
    const d = this.formatarData(data);
    return hora ? `${d} ${hora}` : d;
  }

  labelTempoEtapa(min: number | null): string {
    if (min == null) {
      return '—';
    }
    return this.formatarMinutos(min);
  }

  etapaEmDestaque(e: ProducaoPainelHistoricoEtapa): boolean {
    return e.emAndamentoFila;
  }

  private agendarAtualizarAposFiltro(): void {
    if (this.selectedUnidades.size > 0) {
      this.atualizar();
    } else {
      this.dados.set(null);
      this.codEtapaFiltro.set(null);
      this.limparFiltroReqFormula();
      this.fecharHistorico();
      this.cdr.markForCheck();
    }
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
