import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialAcompanhamentoService } from '../../services/comercial-acompanhamento.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ComercialAcompanhamentoItem,
  ComercialAcompanhamentoTotais,
  ComercialAcompanhamentoVendedorOpcao,
} from '../../models/comercial-acompanhamento.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';

interface CardResumo {
  titulo: string;
  isTotal: boolean;
  mesAberto: boolean;
  valorRecebidoRequisicao: number;
  quantidadeRecebidoRequisicao: number;
  valorRecebidoMarcaPropria: number;
  quantidadeRecebidoMarcaPropria: number;
  valorMetaRequisicao?: number | null;
  percentualMetaRequisicao?: number | null;
  valorProjetadoRequisicao?: number | null;
  percentualProjecaoRequisicao?: number | null;
  valorMetaMarcaPropria?: number | null;
  percentualMetaMarcaPropria?: number | null;
  valorProjetadoMarcaPropria?: number | null;
  percentualProjecaoMarcaPropria?: number | null;
  valorComissaoRequisicao?: number | null;
  valorBonusRequisicao?: number | null;
  valorComissaoMarcaPropria?: number | null;
  valorBonusMarcaPropria?: number | null;
}

const TOTAIS_VAZIOS: ComercialAcompanhamentoTotais = {
  valorRecebidoRequisicao: 0,
  quantidadeRecebidoRequisicao: 0,
  valorRecebidoMarcaPropria: 0,
  quantidadeRecebidoMarcaPropria: 0,
  valorRejeitado: 0,
  quantidadeRejeitado: 0,
  quantidadeVendedores: 0,
};

@Component({
  selector: 'app-comercial-acompanhamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comercial-acompanhamento-page.html',
  styleUrls: ['../vendas-list/vendas-list.css', './comercial-acompanhamento-page.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ComercialAcompanhamentoPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(ComercialAcompanhamentoService);

  MESES_PT = MESES_PT;

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  anoFiltro = 2026;
  mesFiltro = new Date().getMonth() + 1;
  funcionarioIdFiltro = '';
  anosDisponiveis: number[] = [];

  vendedores: ComercialAcompanhamentoVendedorOpcao[] = [];
  carregandoVendedores = false;
  carregando = false;

  itens: ComercialAcompanhamentoItem[] = [];
  totais: ComercialAcompanhamentoTotais = { ...TOTAIS_VAZIOS };

  ngOnInit(): void {
    if (!this.podeLer()) {
      this.errors.show(
        'Você não possui permissão para visualizar o acompanhamento comercial.',
        'Acesso Negado',
      );
      return;
    }

    this.pageCtx.setContext({
      title: 'Acompanhamento Comercial',
      description:
        'Recebidos de manipulados e produtos, rejeitados e percentuais de meta por vendedor.',
    });

    this.initializeCompetenciaFilter();
    this.initializeUnidadeFilter();
    this.carregarVendedores();
    if (this.unidadeFiltro) {
      this.carregarDados();
    }
  }

  get unidadesVisiveis(): Unidade[] {
    return Object.values(Unidade);
  }

  get cardsResumo(): CardResumo[] {
    if (!this.itens.length && !this.totais.quantidadeVendedores) {
      return [];
    }
    const cards: CardResumo[] = [
      {
        titulo: 'Total',
        isTotal: true,
        mesAberto: this.totais.mesAberto === true,
        valorRecebidoRequisicao: this.totais.valorRecebidoRequisicao,
        quantidadeRecebidoRequisicao: this.totais.quantidadeRecebidoRequisicao,
        valorRecebidoMarcaPropria: this.totais.valorRecebidoMarcaPropria,
        quantidadeRecebidoMarcaPropria: this.totais.quantidadeRecebidoMarcaPropria,
        valorMetaRequisicao: this.totais.valorMetaRequisicao,
        percentualMetaRequisicao: this.totais.percentualMetaRequisicao,
        valorProjetadoRequisicao: this.totais.valorProjetadoRequisicao,
        percentualProjecaoRequisicao: this.totais.percentualProjecaoRequisicao,
        valorMetaMarcaPropria: this.totais.valorMetaMarcaPropria,
        percentualMetaMarcaPropria: this.totais.percentualMetaMarcaPropria,
        valorProjetadoMarcaPropria: this.totais.valorProjetadoMarcaPropria,
        percentualProjecaoMarcaPropria: this.totais.percentualProjecaoMarcaPropria,
      },
    ];
    for (const item of this.itens) {
      if (!item.funcionarioId) continue;
      cards.push({
        titulo: this.rotuloVendedor(item),
        isTotal: false,
        mesAberto: item.mesAberto === true,
        valorRecebidoRequisicao: item.valorRecebidoRequisicao,
        quantidadeRecebidoRequisicao: item.quantidadeRecebidoRequisicao,
        valorRecebidoMarcaPropria: item.valorRecebidoMarcaPropria,
        quantidadeRecebidoMarcaPropria: item.quantidadeRecebidoMarcaPropria,
        valorMetaRequisicao: item.valorMetaRequisicao,
        percentualMetaRequisicao: item.percentualMetaRequisicao,
        valorProjetadoRequisicao: item.valorProjetadoRequisicao,
        percentualProjecaoRequisicao: item.percentualProjecaoRequisicao,
        valorMetaMarcaPropria: item.valorMetaMarcaPropria,
        percentualMetaMarcaPropria: item.percentualMetaMarcaPropria,
        valorProjetadoMarcaPropria: item.valorProjetadoMarcaPropria,
        percentualProjecaoMarcaPropria: item.percentualProjecaoMarcaPropria,
        valorComissaoRequisicao: item.valorComissaoRequisicao,
        valorBonusRequisicao: item.valorBonusRequisicao,
        valorComissaoMarcaPropria: item.valorComissaoMarcaPropria,
        valorBonusMarcaPropria: item.valorBonusMarcaPropria,
      });
    }
    return cards;
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ACOMPANHAMENTO_READ);
  }

  podeVerComissao(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_ACOMPANHAMENTO_COMISSAO);
  }

  rotuloVendedor(item: {
    nomeVendedor: string;
    codigoVendedorErp: number | null;
  }): string {
    const codigo =
      item.codigoVendedorErp != null ? String(item.codigoVendedorErp) : '—';
    return `${item.nomeVendedor} (${codigo})`;
  }

  get rotuloCompetenciaLegenda(): string {
    if (!this.unidadeFiltro || this.carregando) return '';
    return `${nomeMesPt(this.mesFiltro)} ${this.anoFiltro}`;
  }

  get rotuloDiasUteis(): string {
    const mes = this.totais.diasUteisMes;
    if (mes == null) return '';
    return `${this.formatarDiasUteis(mes)} dias úteis`;
  }

  get rotuloDiasRealizados(): string {
    const realizados = this.totais.diasRealizados;
    if (realizados == null) return '';
    return `${this.formatarDiasUteis(realizados)} dias realizados`;
  }

  formatarDiasUteis(valor: number | null | undefined): string {
    if (valor == null) return '—';
    return Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: valor % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  }

  larguraBarraMeta(valor: number | null | undefined): number {
    if (valor == null || !Number.isFinite(valor) || valor <= 0) return 0;
    return Math.min(100, valor);
  }

  temMetaCadastrada(valor: number | null | undefined): boolean {
    return valor != null && valor > 0;
  }

  onFiltroChange(): void {
    if (!this.unidadeFiltro) {
      this.itens = [];
      this.totais = { ...TOTAIS_VAZIOS };
      return;
    }
    this.carregarVendedores();
    this.carregarDados();
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

  private carregarVendedores(): void {
    if (!this.unidadeFiltro) {
      this.vendedores = [];
      return;
    }
    this.carregandoVendedores = true;
    this.service.listarVendedores(this.unidadeFiltro).subscribe({
      next: (rows) => {
        this.vendedores = rows;
        if (
          this.funcionarioIdFiltro &&
          !rows.some((v) => v.funcionarioId === this.funcionarioIdFiltro)
        ) {
          this.funcionarioIdFiltro = '';
        }
        this.carregandoVendedores = false;
      },
      error: () => {
        this.carregandoVendedores = false;
        this.vendedores = [];
      },
    });
  }

  private carregarDados(): void {
    if (!this.unidadeFiltro || !this.podeLer()) return;
    this.carregando = true;
    this.service
      .listar({
        unidade: this.unidadeFiltro,
        ano: this.anoFiltro,
        mes: this.mesFiltro,
        funcionarioId: this.funcionarioIdFiltro || undefined,
      })
      .subscribe({
        next: (res) => {
          this.itens = res.itens;
          this.totais = res.totais ?? { ...TOTAIS_VAZIOS };
          this.carregando = false;
        },
        error: (e) => {
          this.carregando = false;
          this.itens = [];
          this.totais = { ...TOTAIS_VAZIOS };
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar o acompanhamento comercial.',
            'Acompanhamento Comercial',
          );
        },
      });
  }

  private initializeUnidadeFilter(): void {
    const raw = this.auth.getCurrentUser()?.unidade?.trim() ?? '';
    const match = this.unidadesVisiveis.find((u) => u === raw);
    if (match) {
      this.unidadeFiltro = match;
      this.unidadeDisabled = true;
    } else {
      this.unidadeFiltro = '';
      this.unidadeDisabled = false;
    }
  }

  private initializeCompetenciaFilter(): void {
    for (let a = 2026; a <= 2033; a += 1) {
      this.anosDisponiveis.push(a);
    }
    const now = new Date();
    let ano = now.getFullYear();
    if (ano < 2026) ano = 2026;
    if (ano > 2033) ano = 2033;
    this.anoFiltro = ano;
    this.mesFiltro = now.getMonth() + 1;
  }
}
