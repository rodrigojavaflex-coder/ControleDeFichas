import { Component, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-producao-acompanhamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-acompanhamento-page.html',
  styleUrls: ['./producao-acompanhamento-page.css'],
})
export class ProducaoAcompanhamentoPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private acompanhamentoService = inject(ProducaoAcompanhamentoService);

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
  /** Preenchido ao buscar req-fórmula; restringe linhas no modal. */
  reqFormulaFiltroAtivo: {
    requisicao: number;
    formula: string;
    filial?: number;
  } | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Acompanhamento',
      description:
        'Fila operacional: etapas em andamento conforme dados importados do PCP.',
    });
    this.initializeUnidadeFilter();
    void this.atualizar();
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
    return linhas.filter(
      (lin) =>
        lin.requisicao === f.requisicao &&
        this.normalizarFormula(lin.formula) ===
          this.normalizarFormula(f.formula) &&
        (f.filial == null || lin.filial === f.filial),
    );
  }

  get totalRequisicoesModal(): number {
    if (this.reqFormulaFiltroAtivo) {
      return this.linhasDetalheModal.length;
    }
    return this.etapaSelecionada?.totalRequisicoesFormulas ?? 0;
  }

  selecionarEtapa(
    etapa: AcompanhamentoEtapaResumo,
    filtroReq?: { requisicao: number; formula: string; filial?: number },
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
    const parsed = this.parseFiltroReqFormula(this.filtroReqFormula);
    if (!parsed) {
      this.errors.show(
        'Informe req-fórmula no formato 96605-0 ou 2-96605-0 (filial opcional).',
        'Acompanhamento',
      );
      return;
    }
    this.buscandoReqFormula = true;
    this.acompanhamentoService
      .localizar({
        unidades: Array.from(this.selectedUnidades),
        requisicao: parsed.requisicao,
        formula: parsed.formula,
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
              'Requisição-fórmula não encontrada na fila em andamento.',
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
