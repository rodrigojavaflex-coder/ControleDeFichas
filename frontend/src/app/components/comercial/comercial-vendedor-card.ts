import { Component, DestroyRef, Input, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
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

const CARD_BLOCO_DEFAULT: Record<ComercialCardBloco, boolean> = {
  resultados: true,
  metas: true,
  analise: true,
};

@Component({
  selector: 'app-comercial-vendedor-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  @Input() competencia = '';
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
  detalheSecoesAbertas: Record<ComercialDetalheSecao, boolean> = {
    ...DETALHE_SECOES_PADRAO,
  };

  private cardBlocosAbertos: Partial<Record<ComercialCardBloco, boolean>> = {};

  cardBlocoAberto(bloco: ComercialCardBloco): boolean {
    return this.cardBlocosAbertos[bloco] ?? CARD_BLOCO_DEFAULT[bloco];
  }

  toggleCardBloco(bloco: ComercialCardBloco): void {
    this.cardBlocosAbertos = {
      ...this.cardBlocosAbertos,
      [bloco]: !this.cardBlocoAberto(bloco),
    };
  }

  get titulo(): string {
    return this.rotuloVendedor(this.item);
  }

  temAnaliseDoDia(): boolean {
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
    baseTipo: ComercialProjecaoBase,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.infoCorAnelPercentual =
      percentual == null || !Number.isFinite(Number(percentual))
        ? null
        : Number(percentual);
    this.infoCorAnelTitulo = titulo;
    this.infoCorAnelBasePrimeiraFaixa = this.basePrimeiraFaixa(baseTipo);
    this.infoCorAnelAberto = true;
  }

  fecharInfoCorAnel(): void {
    this.infoCorAnelAberto = false;
    this.infoCorAnelPercentual = null;
    this.infoCorAnelTitulo = '';
    this.infoCorAnelBasePrimeiraFaixa = null;
  }

  abrirDetalhe(): void {
    this.detalheAberto = true;
    this.carregandoDetalhe = true;
    this.detalhe = null;
    this.detalheSecoesAbertas = { ...DETALHE_SECOES_PADRAO };
    this.detalheReq$.next();
    this.service
      .meuDetalhe()
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
            'Meu desempenho',
          );
        },
      });
  }

  fecharDetalhe(): void {
    this.detalheReq$.next();
    this.detalheAberto = false;
    this.carregandoDetalhe = false;
    this.detalhe = null;
    this.detalheSecoesAbertas = { ...DETALHE_SECOES_PADRAO };
  }

  toggleDetalheSecao(secao: ComercialDetalheSecao): void {
    this.detalheSecoesAbertas = {
      ...this.detalheSecoesAbertas,
      [secao]: !this.detalheSecoesAbertas[secao],
    };
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
