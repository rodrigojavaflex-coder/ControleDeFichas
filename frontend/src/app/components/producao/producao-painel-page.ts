import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface ProducaoPainelCardEtapa {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  total: number;
  atrasadas: number;
}

@Component({
  selector: 'app-producao-painel-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-painel-page.html',
  styleUrls: ['./producao-painel-page.css'],
})
export class ProducaoPainelPage implements OnInit, OnDestroy {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private painelService = inject(ProducaoPainelService);
  private producaoEtapasRefresh = inject(ProducaoEtapasRefreshService);
  private destroyRef = inject(DestroyRef);

  unidades: Unidade[] = Object.values(Unidade);
  selectedUnidades = new Set<Unidade>();
  unidadeDisabled = false;

  carregando = false;
  carregandoHistorico = false;
  dados: ProducaoPainelResponse | null = null;
  codEtapaFiltro: string | null = null;
  filtroReqFormula = '';
  reqFormulaFiltroAtivo: {
    requisicao: number;
    formula: string;
    filial?: number;
  } | null = null;

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
    return this.carregando || this.carregandoHistorico;
  }

  get tituloProcessamento(): string {
    if (this.carregandoHistorico) {
      return 'Carregando histórico';
    }
    return 'Buscando requisições';
  }

  get subtituloProcessamento(): string {
    if (this.carregandoHistorico) {
      return 'Consultando etapas da requisição…';
    }
    return 'Carregando painel de produção em andamento…';
  }

  get unidadeFixa(): Unidade | null {
    if (!this.unidadeDisabled || this.selectedUnidades.size === 0) {
      return null;
    }
    return this.selectedUnidades.values().next().value ?? null;
  }

  get cardsEtapa(): ProducaoPainelCardEtapa[] {
    const linhas = this.dados?.linhas ?? [];
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
          atrasadas: lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0 ? 1 : 0,
        });
      } else {
        atual.total += 1;
        if (lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0) {
          atual.atrasadas += 1;
        }
      }
    }
    return [...mapa.values()].sort(
      (a, b) =>
        a.posicaoEtapa - b.posicaoEtapa ||
        a.etapa.localeCompare(b.etapa, 'pt-BR'),
    );
  }

  get linhasVisiveis(): ProducaoPainelLinha[] {
    let linhas = this.dados?.linhas ?? [];
    if (this.reqFormulaFiltroAtivo) {
      const f = this.reqFormulaFiltroAtivo;
      linhas = linhas.filter(
        (l) =>
          l.requisicao === f.requisicao &&
          this.normalizarFormula(l.formula) === this.normalizarFormula(f.formula) &&
          (f.filial == null || l.filial === f.filial),
      );
    } else if (this.codEtapaFiltro) {
      linhas = linhas.filter((l) => l.codEtapaAtual === this.codEtapaFiltro);
    }
    return linhas;
  }

  get labelEtapaFiltro(): string {
    const card = this.cardsEtapa.find((c) => c.codEtapa === this.codEtapaFiltro);
    if (!card) {
      return this.codEtapaFiltro ?? '';
    }
    return `${card.etapa} (${card.codEtapa})`;
  }

  get resumoGeral(): { total: number; atrasadas: number } {
    const linhas = this.dados?.linhas ?? [];
    let atrasadas = 0;
    for (const lin of linhas) {
      if (lin.minutosParaRetirada != null && lin.minutosParaRetirada < 0) {
        atrasadas += 1;
      }
    }
    return { total: linhas.length, atrasadas };
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_PAINEL_READ);
  }

  atualizar(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    this.carregando = true;
    this.fecharHistorico();
    this.painelService
      .consultar({ unidades: Array.from(this.selectedUnidades) })
      .subscribe({
        next: (data) => {
          this.dados = data;
          if (
            this.codEtapaFiltro &&
            !data.linhas.some((l) => l.codEtapaAtual === this.codEtapaFiltro)
          ) {
            this.codEtapaFiltro = null;
          }
          if (this.reqFormulaFiltroAtivo) {
            const f = this.reqFormulaFiltroAtivo;
            const aindaExiste = data.linhas.some(
              (l) =>
                l.requisicao === f.requisicao &&
                this.normalizarFormula(l.formula) ===
                  this.normalizarFormula(f.formula) &&
                (f.filial == null || l.filial === f.filial),
            );
            if (!aindaExiste) {
              this.limparFiltroReqFormula(false);
            }
          }
          this.carregando = false;
        },
        error: (e) => {
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar painel.',
            'Painel de retirada',
          );
          this.dados = null;
          this.carregando = false;
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
      this.dados = null;
      this.codEtapaFiltro = null;
    } else {
      this.unidades.forEach((u) => this.selectedUnidades.add(u));
      this.atualizar();
    }
  }

  limparUnidades(): void {
    this.selectedUnidades.clear();
    this.dados = null;
    this.codEtapaFiltro = null;
    this.limparFiltroReqFormula();
    this.fecharHistorico();
  }

  buscarRequisicaoFormula(): void {
    if (!this.podeLer() || this.selectedUnidades.size === 0) {
      return;
    }
    const parsed = this.parseFiltroReqFormula(this.filtroReqFormula);
    if (!parsed) {
      this.errors.show(
        'Informe req-fórmula no formato 96605-0 ou 2-96605-0 (filial opcional).',
        'Painel de retirada',
      );
      return;
    }
    const linhas = this.dados?.linhas ?? [];
    const encontradas = linhas.filter(
      (l) =>
        l.requisicao === parsed.requisicao &&
        this.normalizarFormula(l.formula) ===
          this.normalizarFormula(parsed.formula) &&
        (parsed.filial == null || l.filial === parsed.filial),
    );
    if (!encontradas.length) {
      this.errors.show(
        'Requisição-fórmula não encontrada no painel das unidades selecionadas.',
        'Painel de retirada',
      );
      return;
    }
    this.reqFormulaFiltroAtivo = parsed;
    this.codEtapaFiltro = encontradas[0].codEtapaAtual;
    if (encontradas.length === 1) {
      this.abrirHistorico(encontradas[0]);
    }
  }

  limparFiltroReqFormula(limparInput = true): void {
    this.reqFormulaFiltroAtivo = null;
    if (limparInput) {
      this.filtroReqFormula = '';
    }
  }

  limparFiltrosVisuais(): void {
    this.codEtapaFiltro = null;
    this.limparFiltroReqFormula();
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

  selecionarCardEtapa(codEtapa: string): void {
    this.limparFiltroReqFormula(false);
    if (this.codEtapaFiltro === codEtapa) {
      this.codEtapaFiltro = null;
      return;
    }
    this.codEtapaFiltro = codEtapa;
  }

  selecionarCardTotal(): void {
    this.limparFiltroReqFormula(false);
    this.codEtapaFiltro = null;
  }

  limparFiltroEtapa(): void {
    this.codEtapaFiltro = null;
  }

  private normalizarFormula(formula: string): string {
    const t = String(formula ?? '').trim();
    if (!t) {
      return '';
    }
    if (/^\d+$/.test(t)) {
      return String(Number(t));
    }
    return t;
  }

  private parseFiltroReqFormula(
    raw: string,
  ): { requisicao: number; formula: string; filial?: number } | null {
    const text = raw.trim();
    if (!text) {
      return null;
    }
    const erp = /^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*$/.exec(text);
    if (erp) {
      return {
        filial: Number(erp[1]),
        requisicao: Number(erp[2]),
        formula: String(Number(erp[3])),
      };
    }
    const withFilial =
      /^(\d+)\s*-\s*(\d+)\s*(?:\(\s*filial\s*(\d+)\s*\))?\s*$/i.exec(text);
    if (withFilial) {
      const requisicao = Number(withFilial[1]);
      const formula = String(Number(withFilial[2]));
      const filial = withFilial[3] ? Number(withFilial[3]) : undefined;
      return { requisicao, formula, filial };
    }
    return null;
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
        },
        error: (e) => {
          this.modalHistoricoAberto = false;
          this.linhaHistorico = null;
          this.carregandoHistorico = false;
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
      this.dados = null;
      this.codEtapaFiltro = null;
      this.limparFiltroReqFormula();
      this.fecharHistorico();
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
