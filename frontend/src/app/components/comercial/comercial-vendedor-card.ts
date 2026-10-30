import { Component, DestroyRef, Input, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialAcompanhamentoService } from '../../services/comercial-acompanhamento.service';
import {
  ComercialAcompanhamentoDetalhe,
  ComercialAcompanhamentoItem,
  ComercialAcompanhamentoMovimentoProduto,
} from '../../models/comercial-acompanhamento.model';
import { Unidade } from '../../models/usuario.model';
import { nomeMesPt } from '../folha/folha-meses';

type ComercialDetalheSecao =
  | 'requisicoes'
  | 'setor'
  | 'terceiros'
  | 'marcaPropriaSetor'
  | 'marcaPropriaOutros'
  | 'orcamentos';
type ComercialCardBloco = 'resultados' | 'metas' | 'analise';
type ComercialProjecaoBase = 'requisicao' | 'marcaPropria';

const DETALHE_SECOES_PADRAO: Record<ComercialDetalheSecao, boolean> = {
  requisicoes: false,
  setor: false,
  terceiros: false,
  marcaPropriaSetor: false,
  marcaPropriaOutros: false,
  orcamentos: false,
};

/** Home: só Análise aberta; Resultados e Metas fechados. */
const CARD_BLOCO_DEFAULT: Record<ComercialCardBloco, boolean> = {
  resultados: false,
  metas: false,
  analise: true,
};

@Component({
  selector: 'app-comercial-vendedor-card',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './comercial-vendedor-card.html',
  styleUrls: ['./comercial-acompanhamento-page.css', './comercial-vendedor-card.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ComercialVendedorCardComponent {
  private service = inject(ComercialAcompanhamentoService);
  private errors = inject(ErrorModalService);
  private destroyRef = inject(DestroyRef);
  private detalheReq$ = new Subject<void>();

  @Input({ required: true }) item!: ComercialAcompanhamentoItem;
  @Input() podeVerComissao = false;
  @Input() mostrarAcompanhamento = false;
  /** Exibe “Último caixa fechado” no cabeçalho do card (home). */
  @Input() mostrarUltimoCaixa = false;
  /** Card TOTAL da unidade (anel limiar 80%, sem comissão/ranking). */
  @Input() isTotal = false;
  /** Fonte do modal Detalhes: próprio vendedor ou total da unidade. */
  @Input() modoDetalhe: 'meu' | 'unidade' = 'meu';
  @Input() competencia = '';
  /** Competência no formato YYYY-MM (limites do filtro de dia). */
  @Input() anoMes = '';
  @Input() unidade = '';

  infoManipuladosAberto = false;
  infoProjecaoAberto = false;
  infoProjecaoBase: ComercialProjecaoBase | null = null;
  infoCorAnelAberto = false;
  infoCorAnelPercentual: number | null = null;
  infoCorAnelTitulo = '';
  infoCorAnelBasePrimeiraFaixa: number | null = null;

  detalheAberto = false;
  carregandoDetalhe = false;
  detalhe: ComercialAcompanhamentoDetalhe | null = null;
  detalheDataInicialInput = '';
  detalheDataFinalInput = '';
  detalheDataInicial = '';
  detalheDataFinal = '';
  detalheSecoesAbertas: Record<ComercialDetalheSecao, boolean> = {
    ...DETALHE_SECOES_PADRAO,
  };

  private cardBlocosAbertos: Partial<Record<ComercialCardBloco, boolean>> = {};

  cardBlocoAberto(bloco: ComercialCardBloco): boolean {
    if (Object.prototype.hasOwnProperty.call(this.cardBlocosAbertos, bloco)) {
      return this.cardBlocosAbertos[bloco] === true;
    }
    // Modal da unidade (total): todas as seções abertas.
    if (this.isTotal) {
      return true;
    }
    return CARD_BLOCO_DEFAULT[bloco];
  }

  toggleCardBloco(bloco: ComercialCardBloco): void {
    this.cardBlocosAbertos = {
      ...this.cardBlocosAbertos,
      [bloco]: !this.cardBlocoAberto(bloco),
    };
  }

  get titulo(): string {
    if (this.isTotal) {
      const unidade = (this.unidade || '').trim();
      if (unidade) return unidade;
      return String(this.item.nomeVendedor || '')
        .replace(/^TOTAL\s+/i, '')
        .trim();
    }
    return this.rotuloVendedor(this.item);
  }

  get dataUltimoCaixaFormatada(): string {
    return this.formatarData(this.item.dataUltimoCaixaFechado);
  }

  temAnaliseDoDia(): boolean {
    if (this.isTotal) {
      return false;
    }
    return (
      this.item.mesAberto === true &&
      (this.item.valorRecebidoHojeRequisicao != null ||
        this.item.valorRecebidoHojeMarcaPropria != null)
    );
  }

  destacarFaltaHoje(valor: number | null | undefined): boolean {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0;
  }

  temAnaliseDesempenho(): boolean {
    return (
      this.temMetaCadastrada(this.item.valorMetaRequisicao) ||
      this.temMetaCadastrada(this.item.valorMetaMarcaPropria)
    );
  }

  temMetaCadastrada(valor: number | null | undefined): boolean {
    return valor != null && valor > 0;
  }

  numeroLugar(posicao: number | null | undefined): number {
    const n = Number(posicao);
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.trunc(n);
  }

  rotuloLugar(posicao: number | null | undefined): string {
    const n = this.numeroLugar(posicao);
    if (n < 1) return '';
    return `${n}º Lugar`;
  }

  classeRankingBadge(posicao: number | null | undefined): string {
    const n = Number(posicao);
    if (!Number.isFinite(n) || n < 1) return '';
    if (n === 1) return 'is-ouro';
    if (n === 2) return 'is-prata';
    if (n === 3) return 'is-bronze';
    return 'is-demais';
  }

  formatarPercentualTopo(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return `${Number(valor).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
    })}%`;
  }

  valorTotalRecebido(): number {
    return (
      Number(this.item.valorRecebidoRequisicao || 0) +
      Number(this.item.valorRecebidoMarcaPropria || 0)
    );
  }

  get competenciaDataInicial(): string {
    const { ano, mes } = this.resolverAnoMesCompetencia();
    const mm = String(mes).padStart(2, '0');
    return `${ano}-${mm}-01`;
  }

  get competenciaDataFinal(): string {
    const { ano, mes } = this.resolverAnoMesCompetencia();
    const ultimo = new Date(ano, mes, 0).getDate();
    const mm = String(mes).padStart(2, '0');
    return `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`;
  }

  get temFiltroDiaDetalhe(): boolean {
    return !!(this.detalheDataInicial || this.detalheDataFinal);
  }

  get rotuloPeriodoDetalhe(): string {
    if (!this.temFiltroDiaDetalhe) {
      return this.competencia || this.rotuloCompetenciaDeAnoMes();
    }
    const ini = this.detalheDataInicial || this.competenciaDataInicial;
    const fim = this.detalheDataFinal || this.competenciaDataFinal;
    if (ini === fim) {
      return this.formatarData(ini);
    }
    return `${this.formatarData(ini)} a ${this.formatarData(fim)}`;
  }

  get valorTotalRecebidoDetalhe(): number {
    if (!this.detalhe || !this.temFiltroDiaDetalhe) {
      return this.valorTotalRecebido();
    }
    return (
      this.totalDetalheManipulados +
      this.totalDetalheSetor +
      this.totalDetalheTerceiros +
      this.totalDetalheMarcaPropriaSetores +
      this.totalDetalheMarcaPropriaOutros
    );
  }

  private resolverAnoMesCompetencia(): { ano: number; mes: number } {
    const parts = (this.anoMes || '').split('-').map((n) => Number(n));
    if (
      parts.length >= 2 &&
      Number.isFinite(parts[0]) &&
      Number.isFinite(parts[1]) &&
      parts[1] >= 1 &&
      parts[1] <= 12
    ) {
      return { ano: parts[0], mes: parts[1] };
    }
    const agora = new Date();
    return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  }

  private rotuloCompetenciaDeAnoMes(): string {
    const { ano, mes } = this.resolverAnoMesCompetencia();
    return `${nomeMesPt(mes)} ${ano}`;
  }

  rotuloVendedor(item: ComercialAcompanhamentoItem): string {
    if (item.codigoVendedorErp == null) {
      return item.nomeVendedor;
    }
    return `${item.nomeVendedor} (${item.codigoVendedorErp})`;
  }

  rotuloQtdManipulados(
    reqs: number | null | undefined,
    formulas: number | null | undefined,
  ): string {
    return `${Number(reqs || 0)} Reqs / ${Number(formulas || 0)} Fórmulas`;
  }

  rotuloQtdSetorManipulado(qtd: number | null | undefined): string {
    return `${Number(qtd || 0)} item(ns)`;
  }

  rotuloQtdTerceiros(qtd: number | null | undefined): string {
    return `${Number(qtd || 0)} venda(s)`;
  }

  rotuloManipuladoSetor(): string {
    const setores = this.rotuloSetores(this.item.codigosSetorRevendaManipulados);
    return setores === '—' ? 'setor' : `setor ${setores}`;
  }

  rotuloMarcaPropriaSetor(): string {
    const setores = this.rotuloSetores(this.item.codigosSetorMarcaPropria);
    return setores === '—' ? 'setor 0' : `setor ${setores}`;
  }

  rotuloTituloSetor(): string {
    const setores = this.rotuloSetores(this.item.codigosSetorRevendaManipulados);
    return setores === '—'
      ? 'Manipulado (Setor)'
      : `Manipulado (Setor ${setores})`;
  }

  rotuloTituloMarcaPropriaSetor(): string {
    return `Marca própria (${this.rotuloMarcaPropriaSetor()})`;
  }

  rotuloSetores(codigos: number[] | null | undefined): string {
    const lista = (codigos ?? []).filter((n) => Number(n) > 0);
    return lista.length ? lista.join(', ') : '—';
  }

  larguraBarraMeta(valor: number | null | undefined): number {
    if (valor == null || !Number.isFinite(valor) || valor <= 0) return 0;
    return Math.min(100, valor);
  }

  arcoMetaRing(valor: number | null | undefined): string {
    const circunferencia = 2 * Math.PI * 15.5;
    const pct = this.larguraBarraMeta(valor) / 100;
    const preenchido = circunferencia * pct;
    return `${preenchido.toFixed(2)} ${(circunferencia - preenchido).toFixed(2)}`;
  }

  limiarVermelhoAnelMeta(basePrimeiraFaixa?: number | null): number {
    if (this.isTotal) return 80;
    const base = Number(basePrimeiraFaixa);
    if (!Number.isFinite(base)) return 80;
    return Math.max(80, base);
  }

  classeCorAnelMeta(
    valor: number | null | undefined,
    basePrimeiraFaixa?: number | null,
  ): string {
    const pct = Number(valor);
    if (!Number.isFinite(pct)) return 'is-vermelho';
    if (pct >= 100) return 'is-verde';
    if (pct < this.limiarVermelhoAnelMeta(basePrimeiraFaixa)) return 'is-vermelho';
    return 'is-azul';
  }

  get mostrarComissaoEfetiva(): boolean {
    return this.podeVerComissao && !this.isTotal;
  }

  valorTotalProjetado(): number {
    return (
      Number(this.item.valorProjetadoRequisicao || 0) +
      Number(this.item.valorProjetadoMarcaPropria || 0)
    );
  }

  valorMetaTotalGeral(): number | null {
    const temReq = this.temMetaCadastrada(this.item.valorMetaRequisicao);
    const temMp = this.temMetaCadastrada(this.item.valorMetaMarcaPropria);
    if (!temReq && !temMp) return null;
    return (
      (temReq ? Number(this.item.valorMetaRequisicao) : 0) +
      (temMp ? Number(this.item.valorMetaMarcaPropria) : 0)
    );
  }

  metaTotalGeralParcial(): boolean {
    const temReq = this.temMetaCadastrada(this.item.valorMetaRequisicao);
    const temMp = this.temMetaCadastrada(this.item.valorMetaMarcaPropria);
    return (temReq && !temMp) || (!temReq && temMp);
  }

  percentualSobreMetaTotal(
    valor: number | null | undefined,
    meta: number | null | undefined,
  ): number | null {
    if (!this.temMetaCadastrada(meta)) return null;
    return (Number(valor || 0) / Number(meta)) * 100;
  }

  rotuloCorAnelMeta(
    valor: number | null | undefined,
    basePrimeiraFaixa?: number | null,
  ): string {
    switch (this.classeCorAnelMeta(valor, basePrimeiraFaixa)) {
      case 'is-vermelho':
        return 'Vermelho';
      case 'is-azul':
        return 'Azul';
      default:
        return 'Verde';
    }
  }

  motivoCorAnelMeta(
    valor: number | null | undefined,
    basePrimeiraFaixa?: number | null,
  ): string {
    const pct = Number(valor);
    const limiar = this.limiarVermelhoAnelMeta(basePrimeiraFaixa);
    if (!Number.isFinite(pct) || pct < limiar) {
      return `Abaixo da base da 1ª faixa (${this.formatarPercentualMeta(limiar)}).`;
    }
    if (pct < 100) {
      return `Entre ${this.formatarPercentualMeta(limiar)} e 99,9% da meta.`;
    }
    return '100% ou mais da meta.';
  }

  basePrimeiraFaixa(baseTipo: ComercialProjecaoBase | null): number | null {
    if (baseTipo === 'marcaPropria') {
      return this.item.percentualMetaPrimeiraFaixaMarcaPropria ?? null;
    }
    return this.item.percentualMetaPrimeiraFaixaRequisicao ?? null;
  }

  formatarMoeda(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  formatarPercentualMeta(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return `${Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  formatarPercentualFaixa(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return `${Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}%`;
  }

  formatarDiasUteis(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  formatarData(data: string | null | undefined): string {
    if (!data) return '—';
    const s = data.includes('T') ? data.split('T')[0] : data.slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }

  abrirInfoManipulados(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.infoManipuladosAberto = true;
  }

  fecharInfoManipulados(): void {
    this.infoManipuladosAberto = false;
  }

  abrirInfoProjecao(event: Event, base: ComercialProjecaoBase): void {
    event.preventDefault();
    event.stopPropagation();
    this.infoProjecaoBase = base;
    this.infoProjecaoAberto = true;
  }

  fecharInfoProjecao(): void {
    this.infoProjecaoAberto = false;
    this.infoProjecaoBase = null;
  }

  rotuloBaseProjecao(base: ComercialProjecaoBase | null): string {
    return base === 'marcaPropria' ? 'Marca própria' : 'Manipulados';
  }

  valorRealizadoProjecao(base: ComercialProjecaoBase): number {
    return base === 'marcaPropria'
      ? Number(this.item.valorRecebidoMarcaPropria || 0)
      : Number(this.item.valorRecebidoRequisicao || 0);
  }

  valorProjetadoInfo(base: ComercialProjecaoBase): number | null | undefined {
    return base === 'marcaPropria'
      ? this.item.valorProjetadoMarcaPropria
      : this.item.valorProjetadoRequisicao;
  }

  valorMetaProjecao(base: ComercialProjecaoBase): number | null | undefined {
    return base === 'marcaPropria'
      ? this.item.valorMetaMarcaPropria
      : this.item.valorMetaRequisicao;
  }

  percentualProjecaoInfo(base: ComercialProjecaoBase): number | null | undefined {
    return base === 'marcaPropria'
      ? this.item.percentualProjecaoMarcaPropria
      : this.item.percentualProjecaoRequisicao;
  }

  valorMedioDiaProjecao(base: ComercialProjecaoBase): number | null {
    const realizados = Number(this.item.diasRealizados ?? 0);
    if (realizados <= 0) return null;
    return this.valorRealizadoProjecao(base) / realizados;
  }

  diasRestantesProjecao(): number | null {
    const mes = this.item.diasUteisMes;
    const realizados = this.item.diasRealizados;
    if (mes == null || realizados == null) return null;
    return Math.max(0, Number(mes) - Number(realizados));
  }

  abrirInfoCorAnel(
    event: Event,
    percentual: number | null | undefined,
    titulo: string,
    baseTipo: ComercialProjecaoBase | null,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.infoCorAnelPercentual =
      percentual == null || !Number.isFinite(Number(percentual))
        ? null
        : Number(percentual);
    this.infoCorAnelTitulo = titulo;
    this.infoCorAnelBasePrimeiraFaixa = baseTipo
      ? this.basePrimeiraFaixa(baseTipo)
      : null;
    this.infoCorAnelAberto = true;
  }

  fecharInfoCorAnel(): void {
    this.infoCorAnelAberto = false;
    this.infoCorAnelPercentual = null;
    this.infoCorAnelTitulo = '';
    this.infoCorAnelBasePrimeiraFaixa = null;
  }

  abrirDetalhe(): void {
    this.resetFiltroDiaDetalhe();
    this.carregarDetalhe();
  }

  private carregarDetalhe(): void {
    this.detalheAberto = true;
    this.carregandoDetalhe = true;
    this.detalhe = null;
    this.detalheSecoesAbertas = { ...DETALHE_SECOES_PADRAO };
    this.detalheReq$.next();
    const filtroDia = {
      dataInicial: this.detalheDataInicial || undefined,
      dataFinal: this.detalheDataFinal || undefined,
    };
    const req$ =
      this.modoDetalhe === 'unidade' && this.unidade
        ? this.service.unidadeDetalhe(this.unidade as Unidade, filtroDia)
        : this.service.meuDetalhe(filtroDia);
    req$
      .pipe(takeUntil(this.detalheReq$), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.detalhe = res;
          this.carregandoDetalhe = false;
        },
        error: (e: { error?: { message?: string } }) => {
          this.carregandoDetalhe = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar o detalhe.',
            this.isTotal ? 'Unidade' : 'Meu desempenho',
          );
        },
      });
  }

  aplicarFiltroDiaDetalhe(): void {
    if (!this.validarFiltroDiaDetalhe()) {
      return;
    }
    this.detalheDataInicial = this.detalheDataInicialInput.trim();
    this.detalheDataFinal = this.detalheDataFinalInput.trim();
    this.carregarDetalhe();
  }

  limparFiltroDiaDetalhe(): void {
    this.resetFiltroDiaDetalhe();
    this.carregarDetalhe();
  }

  private resetFiltroDiaDetalhe(): void {
    this.detalheDataInicialInput = '';
    this.detalheDataFinalInput = '';
    this.detalheDataInicial = '';
    this.detalheDataFinal = '';
  }

  private validarFiltroDiaDetalhe(): boolean {
    const ini = this.detalheDataInicialInput.trim();
    const fim = this.detalheDataFinalInput.trim();
    if (!ini && !fim) {
      return true;
    }
    const min = this.competenciaDataInicial;
    const max = this.competenciaDataFinal;
    if (ini && (ini < min || ini > max)) {
      this.errors.show(
        `Data inicial deve estar em ${this.formatarData(min)} a ${this.formatarData(max)}.`,
        'Validação',
      );
      return false;
    }
    if (fim && (fim < min || fim > max)) {
      this.errors.show(
        `Data final deve estar em ${this.formatarData(min)} a ${this.formatarData(max)}.`,
        'Validação',
      );
      return false;
    }
    const iniEfetiva = ini || min;
    const fimEfetiva = fim || max;
    if (iniEfetiva > fimEfetiva) {
      this.errors.show(
        'Data inicial não pode ser posterior à data final.',
        'Validação',
      );
      return false;
    }
    return true;
  }

  fecharDetalhe(): void {
    this.detalheReq$.next();
    this.detalheAberto = false;
    this.carregandoDetalhe = false;
    this.detalhe = null;
    this.resetFiltroDiaDetalhe();
    this.detalheSecoesAbertas = { ...DETALHE_SECOES_PADRAO };
  }

  toggleDetalheSecao(secao: ComercialDetalheSecao): void {
    this.detalheSecoesAbertas = {
      ...this.detalheSecoesAbertas,
      [secao]: !this.detalheSecoesAbertas[secao],
    };
  }

  resumoQtdRequisicoesDetalhe(): string {
    if (this.temFiltroDiaDetalhe && this.detalhe) {
      const n = this.detalhe.manipulados.length;
      return `${n} Req${n === 1 ? '' : 's'}`;
    }
    return this.rotuloQtdManipulados(
      this.item.quantidadeRecebidoRequisicao,
      this.item.quantidadeFormulasRequisicao,
    );
  }

  resumoValorRequisicoesDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheManipulados;
    return Number(this.item.valorRequisicaoPura || 0);
  }

  resumoQtdSetorDetalhe(): string {
    if (this.temFiltroDiaDetalhe && this.detalhe) {
      return this.rotuloQtdSetorManipulado(this.detalhe.setor.length);
    }
    return this.rotuloQtdSetorManipulado(this.item.quantidadeRevendaManipulados);
  }

  resumoValorSetorDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheSetor;
    return Number(this.item.valorRevendaManipulados || 0);
  }

  resumoQtdTerceirosDetalhe(): string {
    if (this.temFiltroDiaDetalhe && this.detalhe) {
      return this.rotuloQtdTerceiros(this.detalhe.terceiros.length);
    }
    return this.rotuloQtdTerceiros(this.item.quantidadeTerceirosManipulados);
  }

  resumoValorTerceirosDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheTerceiros;
    return Number(this.item.valorTerceirosManipulados || 0);
  }

  resumoQtdMarcaSetorDetalhe(): string {
    if (this.temFiltroDiaDetalhe) {
      return this.rotuloQtdSetorManipulado(this.detalheMarcaPropriaSetores.length);
    }
    return this.rotuloQtdSetorManipulado(
      this.item.quantidadeRecebidoMarcaPropriaSetores,
    );
  }

  resumoValorMarcaSetorDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheMarcaPropriaSetores;
    return Number(this.item.valorRecebidoMarcaPropriaSetores || 0);
  }

  resumoQtdMarcaOutrosDetalhe(): string {
    if (this.temFiltroDiaDetalhe) {
      return this.rotuloQtdSetorManipulado(this.detalheMarcaPropriaOutros.length);
    }
    return this.rotuloQtdSetorManipulado(
      this.item.quantidadeRecebidoMarcaPropriaOutros,
    );
  }

  resumoValorMarcaOutrosDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheMarcaPropriaOutros;
    return Number(this.item.valorRecebidoMarcaPropriaOutros || 0);
  }

  resumoQtdRejeitadoDetalhe(): string {
    if (this.temFiltroDiaDetalhe && this.detalhe) {
      return `${this.detalhe.rejeitados.length} orçamento(s)`;
    }
    return `${this.item.quantidadeRejeitado ?? 0} orçamento(s)`;
  }

  resumoValorRejeitadoDetalhe(): number {
    if (this.temFiltroDiaDetalhe) return this.totalDetalheRejeitado;
    return Number(this.item.valorRejeitado || 0);
  }

  get totalDetalheManipulados(): number {
    return (this.detalhe?.manipulados ?? []).reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  get detalheMarcaPropriaSetores(): ComercialAcompanhamentoMovimentoProduto[] {
    const setores = this.setoresMarcaPropriaConfigurados();
    if (setores.size === 0) return [];
    return (this.detalhe?.marcaPropria ?? []).filter(
      (row) =>
        row.codigoSetor != null && setores.has(Number(row.codigoSetor)),
    );
  }

  get detalheMarcaPropriaOutros(): ComercialAcompanhamentoMovimentoProduto[] {
    const setores = this.setoresMarcaPropriaConfigurados();
    if (setores.size === 0) return this.detalhe?.marcaPropria ?? [];
    return (this.detalhe?.marcaPropria ?? []).filter(
      (row) =>
        row.codigoSetor == null || !setores.has(Number(row.codigoSetor)),
    );
  }

  get totalDetalheMarcaPropriaSetores(): number {
    return this.detalheMarcaPropriaSetores.reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  get totalDetalheMarcaPropriaOutros(): number {
    return this.detalheMarcaPropriaOutros.reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  private setoresMarcaPropriaConfigurados(): Set<number> {
    return new Set(
      (this.item.codigosSetorMarcaPropria ?? [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0),
    );
  }

  get totalDetalheRejeitado(): number {
    return (this.detalhe?.rejeitados ?? []).reduce(
      (acc, row) => acc + Number(row.precoVenda || 0),
      0,
    );
  }

  get totalDetalheTerceiros(): number {
    return (this.detalhe?.terceiros ?? []).reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  get totalDetalheSetor(): number {
    return (this.detalhe?.setor ?? []).reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }
}
