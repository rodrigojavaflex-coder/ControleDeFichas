import { Component, HostListener, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ExcelJS from 'exceljs';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialAcompanhamentoService } from '../../services/comercial-acompanhamento.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ComercialAcompanhamentoDetalhe,
  ComercialAcompanhamentoItem,
  ComercialAcompanhamentoTotais,
  ComercialAcompanhamentoVendedorOpcao,
} from '../../models/comercial-acompanhamento.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';

interface CardResumo {
  titulo: string;
  isTotal: boolean;
  funcionarioId?: string | null;
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

  detalheAberto = false;
  carregandoDetalhe = false;
  itemDetalhe: ComercialAcompanhamentoItem | null = null;
  detalhe: ComercialAcompanhamentoDetalhe | null = null;

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
        titulo: this.rotuloCardTotal(),
        isTotal: true,
        funcionarioId: null,
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
        funcionarioId: item.funcionarioId,
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

  rotuloCardTotal(): string {
    return this.unidadeFiltro ? `TOTAL ${this.unidadeFiltro}` : 'TOTAL';
  }

  valorTotalRecebido(card: CardResumo): number {
    return (
      Number(card.valorRecebidoRequisicao || 0) +
      Number(card.valorRecebidoMarcaPropria || 0)
    );
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.detalheAberto) {
      this.fecharDetalhe();
    }
  }

  abrirDetalhe(card: CardResumo): void {
    if (card.isTotal) return;
    this.abrirDetalhePorId(card.funcionarioId);
  }

  abrirDetalheItem(item: ComercialAcompanhamentoItem): void {
    this.abrirDetalhePorId(item.funcionarioId);
  }

  private abrirDetalhePorId(funcionarioId: string | null | undefined): void {
    if (!funcionarioId || !this.unidadeFiltro) return;
    const item = this.itens.find((i) => i.funcionarioId === funcionarioId);
    if (!item) return;
    this.itemDetalhe = item;
    this.detalheAberto = true;
    this.carregandoDetalhe = true;
    this.detalhe = null;
    this.service
      .detalhe({
        unidade: this.unidadeFiltro,
        ano: this.anoFiltro,
        mes: this.mesFiltro,
        funcionarioId,
      })
      .subscribe({
        next: (res) => {
          this.detalhe = res;
          this.carregandoDetalhe = false;
        },
        error: (e) => {
          this.carregandoDetalhe = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar o detalhe do vendedor.',
            'Acompanhamento Comercial',
          );
        },
      });
  }

  fecharDetalhe(): void {
    this.detalheAberto = false;
    this.carregandoDetalhe = false;
    this.itemDetalhe = null;
    this.detalhe = null;
  }

  get totalDetalheManipulados(): number {
    return (this.detalhe?.manipulados ?? []).reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  get totalDetalheMarcaPropria(): number {
    return (this.detalhe?.marcaPropria ?? []).reduce(
      (acc, row) => acc + Number(row.valor || 0),
      0,
    );
  }

  get totalDetalheRejeitado(): number {
    return (this.detalhe?.rejeitados ?? []).reduce(
      (acc, row) => acc + Number(row.precoVenda || 0),
      0,
    );
  }

  totalComissaoItem(item: ComercialAcompanhamentoItem): number {
    return (
      Number(item.valorComissaoRequisicao || 0) +
      Number(item.valorBonusRequisicao || 0) +
      Number(item.valorComissaoMarcaPropria || 0) +
      Number(item.valorBonusMarcaPropria || 0)
    );
  }

  async exportarExcel(): Promise<void> {
    if (!this.podeLer() || !this.unidadeFiltro || !this.itens.length) {
      this.errors.show('Não há dados para exportar.', 'Aviso');
      return;
    }

    const comissao = this.podeVerComissao();
    const linhas = this.itens.map((item) => {
      const linha: Record<string, string | number> = {
        Vendedor: this.rotuloVendedor(item),
        Manipulados: Number(item.valorRecebidoRequisicao || 0),
        'Marca própria': Number(item.valorRecebidoMarcaPropria || 0),
        Rejeitado: Number(item.valorRejeitado || 0),
        'Meta Manip.': Number(item.valorMetaRequisicao || 0),
        '% Meta Manip.':
          item.percentualMetaRequisicao == null
            ? ''
            : Number(item.percentualMetaRequisicao),
        'Meta Marca Própria': Number(item.valorMetaMarcaPropria || 0),
        '% Meta Marca Própria':
          item.percentualMetaMarcaPropria == null
            ? ''
            : Number(item.percentualMetaMarcaPropria),
      };
      if (comissao) {
        linha['Comissão Manip.'] = Number(item.valorComissaoRequisicao || 0);
        linha['Bônus Manip.'] = Number(item.valorBonusRequisicao || 0);
        linha['Comissão Marca'] = Number(item.valorComissaoMarcaPropria || 0);
        linha['Bônus Marca'] = Number(item.valorBonusMarcaPropria || 0);
      }
      return linha;
    });

    const total: Record<string, string | number> = {
      Vendedor: this.rotuloCardTotal(),
      Manipulados: Number(this.totais.valorRecebidoRequisicao || 0),
      'Marca própria': Number(this.totais.valorRecebidoMarcaPropria || 0),
      Rejeitado: Number(this.totais.valorRejeitado || 0),
      'Meta Manip.': Number(this.totais.valorMetaRequisicao || 0),
      '% Meta Manip.':
        this.totais.percentualMetaRequisicao == null
          ? ''
          : Number(this.totais.percentualMetaRequisicao),
      'Meta Marca Própria': Number(this.totais.valorMetaMarcaPropria || 0),
      '% Meta Marca Própria':
        this.totais.percentualMetaMarcaPropria == null
          ? ''
          : Number(this.totais.percentualMetaMarcaPropria),
    };
    if (comissao) {
      total['Comissão Manip.'] = '';
      total['Bônus Manip.'] = '';
      total['Comissão Marca'] = '';
      total['Bônus Marca'] = '';
    }
    linhas.push(total);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Acompanhamento');
    const headers = Object.keys(linhas[0]);
    sheet.columns = headers.map((header) => ({ header, key: header, width: 18 }));
    linhas.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(linhas.length + 1).font = { bold: true };

    try {
      const competencia = `${this.anoFiltro}-${String(this.mesFiltro).padStart(2, '0')}`;
      const nomeArquivo = `Acompanhamento_Comercial_${this.unidadeFiltro}_${competencia}.xlsx`;
      await this.baixarWorkbook(workbook, nomeArquivo);
    } catch {
      this.errors.show('Erro ao exportar planilha. Tente novamente.', 'Erro');
    }
  }

  imprimirDetalhe(): void {
    if (!this.podeLer() || !this.detalhe || !this.itemDetalhe) return;
    const html = this.montarHtmlImpressaoDetalhe();
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups para imprimir o detalhe.', 'Impressão');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.document.title = `Detalhe comercial ${this.getReportTimestamp()}`;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 200);
  }

  async exportarExcelDetalhe(): Promise<void> {
    if (!this.podeLer() || !this.detalhe || !this.itemDetalhe) {
      this.errors.show('Não há detalhe para exportar.', 'Aviso');
      return;
    }

    const item = this.itemDetalhe;
    const detalhe = this.detalhe;
    const workbook = new ExcelJS.Workbook();

    const resumo = workbook.addWorksheet('Resumo');
    const resumoLinha: Record<string, string | number> = {
      Vendedor: this.rotuloVendedor(item),
      Unidade: this.unidadeFiltro || '',
      Competência: this.rotuloCompetenciaLegenda,
      Manipulados: Number(item.valorRecebidoRequisicao || 0),
      'Qtd manip.': Number(item.quantidadeRecebidoRequisicao || 0),
      'Marca própria': Number(item.valorRecebidoMarcaPropria || 0),
      'Qtd marca': Number(item.quantidadeRecebidoMarcaPropria || 0),
      Rejeitado: Number(item.valorRejeitado || 0),
      'Qtd rejeitado': Number(item.quantidadeRejeitado || 0),
      'Meta Manip.': Number(item.valorMetaRequisicao || 0),
      '% Meta Manip.':
        item.percentualMetaRequisicao == null
          ? ''
          : Number(item.percentualMetaRequisicao),
      'Meta Marca': Number(item.valorMetaMarcaPropria || 0),
      '% Meta Marca':
        item.percentualMetaMarcaPropria == null
          ? ''
          : Number(item.percentualMetaMarcaPropria),
    };
    if (this.podeVerComissao()) {
      resumoLinha['Comissão + bônus'] = this.totalComissaoItem(item);
    }
    const resumoHeaders = Object.keys(resumoLinha);
    resumo.columns = resumoHeaders.map((header) => ({
      header,
      key: header,
      width: 18,
    }));
    resumo.addRow(resumoLinha);
    resumo.getRow(1).font = { bold: true };

    const manip = workbook.addWorksheet('Manipulados');
    manip.columns = [
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Cupom', key: 'cupom', width: 12 },
      { header: 'Requisição', key: 'req', width: 14 },
      { header: 'Valor', key: 'valor', width: 14 },
    ];
    detalhe.manipulados.forEach((row) =>
      manip.addRow({
        data: this.formatarData(row.data),
        cupom: row.numeroCupom,
        req: row.numeroRequisicao,
        valor: Number(row.valor || 0),
      }),
    );
    if (detalhe.manipulados.length) {
      manip.addRow({
        data: 'Total',
        cupom: '',
        req: '',
        valor: this.totalDetalheManipulados,
      });
      manip.getRow(detalhe.manipulados.length + 2).font = { bold: true };
    }
    manip.getRow(1).font = { bold: true };

    const marca = workbook.addWorksheet('Marca própria');
    marca.columns = [
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Cupom', key: 'cupom', width: 12 },
      { header: 'Item', key: 'item', width: 36 },
      { header: 'Qtd', key: 'qtd', width: 10 },
      { header: 'Valor', key: 'valor', width: 14 },
    ];
    detalhe.marcaPropria.forEach((row) =>
      marca.addRow({
        data: this.formatarData(row.data),
        cupom: row.numeroCupom,
        item: row.descricaoItem || '',
        qtd: Number(row.quantidade || 0),
        valor: Number(row.valor || 0),
      }),
    );
    if (detalhe.marcaPropria.length) {
      marca.addRow({
        data: 'Total',
        cupom: '',
        item: '',
        qtd: '',
        valor: this.totalDetalheMarcaPropria,
      });
      marca.getRow(detalhe.marcaPropria.length + 2).font = { bold: true };
    }
    marca.getRow(1).font = { bold: true };

    const rej = workbook.addWorksheet('Rejeitados');
    rej.columns = [
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Orçamento', key: 'orc', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Motivo', key: 'motivo', width: 28 },
      { header: 'Valor', key: 'valor', width: 14 },
    ];
    detalhe.rejeitados.forEach((row) =>
      rej.addRow({
        data: this.formatarData(row.dataOrcamento),
        orc: row.nrOrcamento,
        cliente: row.nomeCliente || '',
        motivo: row.motivoRejeicao || '',
        valor: Number(row.precoVenda || 0),
      }),
    );
    if (detalhe.rejeitados.length) {
      rej.addRow({
        data: 'Total',
        orc: '',
        cliente: '',
        motivo: '',
        valor: this.totalDetalheRejeitado,
      });
      rej.getRow(detalhe.rejeitados.length + 2).font = { bold: true };
    }
    rej.getRow(1).font = { bold: true };

    try {
      const competencia = `${this.anoFiltro}-${String(this.mesFiltro).padStart(2, '0')}`;
      const slug = this.slugArquivo(item.nomeVendedor);
      const nomeArquivo = `Detalhe_Comercial_${slug}_${this.unidadeFiltro}_${competencia}.xlsx`;
      await this.baixarWorkbook(workbook, nomeArquivo);
    } catch {
      this.errors.show('Erro ao exportar o detalhe. Tente novamente.', 'Erro');
    }
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

  formatarData(data: string | null | undefined): string {
    if (!data) return '—';
    const s = data.includes('T') ? data.split('T')[0] : data.slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }

  private async baixarWorkbook(
    workbook: ExcelJS.Workbook,
    nomeArquivo: string,
  ): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private slugArquivo(nome: string): string {
    const slug = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return slug || 'vendedor';
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}`;
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private montarHtmlImpressaoDetalhe(): string {
    const item = this.itemDetalhe!;
    const detalhe = this.detalhe!;
    const titulo = this.rotuloVendedor(item);
    const subtitulo = `${this.unidadeFiltro ?? ''} · ${this.rotuloCompetenciaLegenda}`;
    const usuario =
      this.auth.getCurrentUser()?.nome ||
      this.auth.getCurrentUser()?.email ||
      'Usuário';
    const geradoEm = `Gerado em ${new Date().toLocaleString('pt-BR')} por ${usuario}`;

    const linhasManip = detalhe.manipulados.length
      ? detalhe.manipulados
          .map(
            (r) => `<tr>
          <td>${this.escapeHtml(this.formatarData(r.data))}</td>
          <td>${r.numeroCupom}</td>
          <td>${r.numeroRequisicao}</td>
          <td class="num">${this.escapeHtml(this.formatarMoeda(r.valor))}</td>
        </tr>`,
          )
          .join('\n')
      : '<tr><td colspan="4">Nenhuma requisição no período</td></tr>';

    const linhasMarca = detalhe.marcaPropria.length
      ? detalhe.marcaPropria
          .map(
            (r) => `<tr>
          <td>${this.escapeHtml(this.formatarData(r.data))}</td>
          <td>${r.numeroCupom}</td>
          <td>${this.escapeHtml(r.descricaoItem || '—')}</td>
          <td class="num">${r.quantidade}</td>
          <td class="num">${this.escapeHtml(this.formatarMoeda(r.valor))}</td>
        </tr>`,
          )
          .join('\n')
      : '<tr><td colspan="5">Nenhum produto no período</td></tr>';

    const linhasRej = detalhe.rejeitados.length
      ? detalhe.rejeitados
          .map(
            (r) => `<tr>
          <td>${this.escapeHtml(this.formatarData(r.dataOrcamento))}</td>
          <td>${this.escapeHtml(r.nrOrcamento)}</td>
          <td>${this.escapeHtml(r.nomeCliente || '—')}</td>
          <td>${this.escapeHtml(r.motivoRejeicao || 'Sem motivo')}</td>
          <td class="num">${this.escapeHtml(this.formatarMoeda(r.precoVenda))}</td>
        </tr>`,
          )
          .join('\n')
      : '<tr><td colspan="5">Nenhum orçamento rejeitado no período</td></tr>';

    const comissaoHtml = this.podeVerComissao()
      ? `<div><span>Comissão + bônus</span><strong>${this.escapeHtml(this.formatarMoeda(this.totalComissaoItem(item)))}</strong></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(`Detalhe comercial ${this.getReportTimestamp()}`)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1a202c; font-size: 12px; background: #fff; }
    h1 { margin: 0; font-size: 18px; }
    .subtitle { margin: 4px 0 12px; color: #475569; font-size: 11px; }
    .print-actions { text-align: right; margin-bottom: 12px; }
    .print-actions button { background: #2b6cb0; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .resumo { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
    .resumo div { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
    .resumo span { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; }
    .resumo strong { font-size: 13px; }
    h3 { margin: 16px 0 6px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    footer { margin-top: 24px; font-size: 10px; color: #4a5568; text-align: right; }
    @page { size: A4; margin: 12mm 15mm; }
    @media print { .print-actions { display: none; } }
  </style>
</head>
<body>
  <div class="print-actions"><button type="button" onclick="window.print()">Imprimir PDF</button></div>
  <h1>${this.escapeHtml(titulo)}</h1>
  <div class="subtitle">${this.escapeHtml(subtitulo)}</div>
  <section class="resumo">
    <div><span>Manipulados</span><strong>${this.escapeHtml(this.formatarMoeda(item.valorRecebidoRequisicao))}</strong></div>
    <div><span>Marca própria</span><strong>${this.escapeHtml(this.formatarMoeda(item.valorRecebidoMarcaPropria))}</strong></div>
    <div><span>Rejeitado</span><strong>${this.escapeHtml(this.formatarMoeda(item.valorRejeitado))}</strong></div>
    <div><span>% Meta manip.</span><strong>${this.escapeHtml(this.temMetaCadastrada(item.valorMetaRequisicao) ? this.formatarPercentualMeta(item.percentualMetaRequisicao) : 'Sem meta')}</strong></div>
    <div><span>% Meta marca</span><strong>${this.escapeHtml(this.temMetaCadastrada(item.valorMetaMarcaPropria) ? this.formatarPercentualMeta(item.percentualMetaMarcaPropria) : 'Sem meta')}</strong></div>
    ${comissaoHtml}
  </section>
  <h3>Manipulados</h3>
  <table>
    <thead><tr><th>Data</th><th>Cupom</th><th>Requisição</th><th class="num">Valor</th></tr></thead>
    <tbody>${linhasManip}</tbody>
    ${detalhe.manipulados.length ? `<tfoot><tr><td colspan="3">Total manipulados</td><td class="num">${this.escapeHtml(this.formatarMoeda(this.totalDetalheManipulados))}</td></tr></tfoot>` : ''}
  </table>
  <h3>Marca própria</h3>
  <table>
    <thead><tr><th>Data</th><th>Cupom</th><th>Item</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead>
    <tbody>${linhasMarca}</tbody>
    ${detalhe.marcaPropria.length ? `<tfoot><tr><td colspan="4">Total marca própria</td><td class="num">${this.escapeHtml(this.formatarMoeda(this.totalDetalheMarcaPropria))}</td></tr></tfoot>` : ''}
  </table>
  <h3>Orçamentos rejeitados</h3>
  <table>
    <thead><tr><th>Data</th><th>Orçamento</th><th>Cliente</th><th>Motivo</th><th class="num">Valor</th></tr></thead>
    <tbody>${linhasRej}</tbody>
    ${detalhe.rejeitados.length ? `<tfoot><tr><td colspan="4">Total rejeitado</td><td class="num">${this.escapeHtml(this.formatarMoeda(this.totalDetalheRejeitado))}</td></tr></tfoot>` : ''}
  </table>
  <footer>${this.escapeHtml(geradoEm)}</footer>
</body>
</html>`;
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
