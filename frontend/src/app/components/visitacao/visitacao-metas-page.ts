import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { VisitacaoMetaService } from '../../services/visitacao-meta.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { Configuracao } from '../../models/configuracao.model';
import {
  UnidadesComissaoResponse,
  VisitacaoMetaItem,
  VisitacaoMetaListResponse,
  VisitacaoPainelConflito,
} from '../../models/visitacao-meta.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { environment } from '../../../environments/environment';

interface MetaRow extends VisitacaoMetaItem {
  draft: string;
  salvando: boolean;
  editando: boolean;
  salvandoUnidades: boolean;
}

@Component({
  selector: 'app-visitacao-metas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './visitacao-metas-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../producao/producao-config-page.css',
    './visitacao-metas-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class VisitacaoMetasPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(VisitacaoMetaService);
  private configuracaoService = inject(ConfiguracaoService);

  private configuracao: Configuracao | null = null;

  MESES_PT = MESES_PT;

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  /** 0 = todos os meses. */
  mesFiltro = new Date().getMonth() + 1;
  anoFiltro = 2026;
  anosDisponiveis: number[] = [];

  carregando = false;
  copiando = false;
  linhas: MetaRow[] = [];

  confirmVisivel = false;
  confirmTitulo = '';
  confirmMensagem = '';
  confirmVariante: 'danger' | 'primary' = 'primary';
  private confirmAcao: (() => void) | null = null;

  conflitoAberto = false;
  conflitoTitulo = '';
  conflitoLinhas: VisitacaoPainelConflito[] = [];
  conflitoFuncionarioId: string | null = null;
  reavaliandoPainel = false;
  reavaliandoFuncionarioId: string | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração Metas',
      description:
        'Meta mensal dos representantes com Filial do painel e Código representante painel preenchidos.',
    });
    for (let a = 2026; a <= 2033; a += 1) {
      this.anosDisponiveis.push(a);
    }
    this.initializeUnidadeFilter();
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => (this.configuracao = config),
      error: () => (this.configuracao = null),
    });
    if (this.unidadeFiltro) {
      this.carregarMetas();
    }
  }

  get unidadesVisiveis(): Unidade[] {
    return Object.values(Unidade);
  }

  get unidadesComissaoOpcoes(): Unidade[] {
    return Object.values(Unidade);
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_META_READ);
  }

  podeEditarMeta(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_META_UPDATE);
  }

  temLinhaEmEdicao(): boolean {
    return this.linhas.some((r) => r.editando);
  }

  nomeMes(mes: number): string {
    return nomeMesPt(mes);
  }

  onFiltroChange(): void {
    if (!this.unidadeFiltro) {
      this.linhas = [];
      return;
    }
    this.carregarMetas();
  }

  carregarMetas(): void {
    if (!this.unidadeFiltro || !this.podeLer()) return;
    this.carregando = true;
    const mes = this.mesFiltro > 0 ? this.mesFiltro : undefined;
    this.service.listar(this.unidadeFiltro, this.anoFiltro, mes).subscribe({
      next: (res) => {
        this.aplicarLista(res);
        this.carregando = false;
      },
      error: (e) => {
        this.carregando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar metas.',
          'Configuração Metas',
        );
      },
    });
  }

  incluirLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draft = '';
  }

  alterarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draft = this.formatarMoedaInput(row.valorMeta);
  }

  cancelarEdicao(row: MetaRow): void {
    row.editando = false;
    row.draft = this.formatarMoedaInput(row.valorMeta);
    row.salvando = false;
  }

  formatarDraftDigitacao(row: MetaRow): void {
    row.draft = this.formatarMoedaDigitacao(row.draft);
  }

  salvarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || row.salvando || !row.editando) return;
    const valor = this.parseValor(row.draft);
    if (valor == null) {
      this.errors.show(
        'Informe um valor de meta válido (ex.: R$ 1.250,00).',
        'Configuração Metas',
      );
      return;
    }
    row.salvando = true;
    this.service
      .salvar({
        funcionarioId: row.funcionarioId,
        anoMes: row.anoMes,
        valorMeta: valor,
      })
      .subscribe({
        next: () => {
          this.carregarMetas();
        },
        error: (e) => {
          row.salvando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar meta.',
            'Configuração Metas',
          );
        },
      });
  }

  pedirCopiarMesAnterior(): void {
    if (!this.podeEditarMeta() || !this.unidadeFiltro || this.mesFiltro <= 0) {
      return;
    }
    const destino = this.anoMesSelecionado();
    const origem = this.mesAnterior(destino);
    this.abrirConfirmacao(
      'Copiar mês anterior',
      `Copiar as metas de ${this.rotuloAnoMes(origem)} para ${this.rotuloAnoMes(destino)}? Valores já cadastrados no destino serão substituídos.`,
      () => this.copiarMesAnterior(origem, destino),
      'primary',
    );
  }

  confirmarAcao(): void {
    const acao = this.confirmAcao;
    this.confirmVisivel = false;
    this.confirmAcao = null;
    acao?.();
  }

  cancelarConfirmacao(): void {
    this.confirmVisivel = false;
    this.confirmAcao = null;
  }

  formatarMoeda(valor: number | null): string {
    if (valor == null) return '—';
    return this.moedaFmt.format(valor);
  }

  private readonly moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  private formatarMoedaInput(valor: number | null): string {
    if (valor == null) return '';
    return this.moedaFmt.format(valor);
  }

  private formatarMoedaDigitacao(texto: string): string {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return '';
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return '';
    return this.moedaFmt.format(cents / 100);
  }

  private parseValor(texto: string): number | null {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return null;
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return null;
    return Math.round(cents) / 100;
  }

  private copiarMesAnterior(origem: string, destino: string): void {
    if (!this.unidadeFiltro) return;
    this.copiando = true;
    this.service
      .copiar({
        unidade: this.unidadeFiltro,
        anoMesOrigem: origem,
        anoMesDestino: destino,
      })
      .subscribe({
        next: () => {
          this.copiando = false;
          this.carregarMetas();
        },
        error: (e) => {
          this.copiando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao copiar metas do mês anterior.',
            'Configuração Metas',
          );
        },
      });
  }

  private aplicarLista(res: VisitacaoMetaListResponse): void {
    this.linhas = res.itens.map((item) => ({
      ...item,
      unidadesComissao: item.unidadesComissao?.length
        ? item.unidadesComissao
        : [item.unidade],
      quantidadeConflitosPainel: item.quantidadeConflitosPainel ?? 0,
      draft: this.formatarMoedaInput(item.valorMeta),
      salvando: false,
      editando: false,
      salvandoUnidades: false,
    }));
  }

  unidadeComissaoMarcada(row: MetaRow, unidade: Unidade): boolean {
    return (row.unidadesComissao ?? []).includes(unidade);
  }

  unidadeComissaoTravada(row: MetaRow, unidade: Unidade): boolean {
    return unidade === row.unidade;
  }

  onUnidadeComissaoChange(
    row: MetaRow,
    unidade: Unidade,
    event: Event,
  ): void {
    const alvo = event.target as HTMLInputElement | null;
    this.alternarUnidadeComissao(row, unidade, !!alvo?.checked);
  }

  alternarUnidadeComissao(row: MetaRow, unidade: Unidade, marcada: boolean): void {
    if (!this.podeEditarMeta() || !row.editando || row.salvandoUnidades) return;
    if (this.unidadeComissaoTravada(row, unidade)) return;
    const atuais = new Set(row.unidadesComissao ?? [row.unidade]);
    atuais.add(row.unidade);
    if (marcada) {
      atuais.add(unidade);
    } else {
      atuais.delete(unidade);
    }
    const unidades = this.unidadesComissaoOpcoes.filter((u) => atuais.has(u));
    this.persistirUnidades(row.funcionarioId, unidades);
  }

  abrirConflitos(row: MetaRow): void {
    this.conflitoFuncionarioId = row.funcionarioId;
    this.conflitoTitulo = `Prescritores em conflito — ${row.nome}`;
    this.conflitoAberto = true;
    this.conflitoLinhas = [];
    this.reavaliandoPainel = true;
    this.service.obterUnidadesComissao(row.funcionarioId).subscribe({
      next: (res) => {
        this.aplicarUnidadesNasLinhas(res);
        this.conflitoLinhas = res.conflitos;
        this.reavaliandoPainel = false;
      },
      error: (e) => {
        this.reavaliandoPainel = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar conflitos de painel.',
          'Configuração Metas',
        );
      },
    });
  }

  fecharConflitos(): void {
    this.conflitoAberto = false;
    this.conflitoFuncionarioId = null;
    this.conflitoLinhas = [];
  }

  reavaliarPainelModal(): void {
    if (!this.conflitoFuncionarioId || this.reavaliandoPainel) return;
    this.reavaliarPainel(this.conflitoFuncionarioId, true);
  }

  reavaliarPainelLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.reavaliandoPainel) return;
    const atualizarModal =
      this.conflitoAberto && this.conflitoFuncionarioId === row.funcionarioId;
    this.reavaliarPainel(row.funcionarioId, atualizarModal);
  }

  imprimirConflitos(): void {
    if (!this.conflitoLinhas.length) return;
    const linhas = this.conflitoLinhas
      .map(
        (c) => `
      <tr>
        <td>${this.escapeHtml(c.nomeMedico)}</td>
        <td>${this.escapeHtml(c.crm)}</td>
        <td>${this.escapeHtml(c.uf)}</td>
        <td>${this.escapeHtml(c.unidades.join(', '))}</td>
        <td>${this.escapeHtml(c.representantes.join(', '))}</td>
      </tr>`,
      )
      .join('');
    const corpo = `
  <p class="report-hint">O mesmo CRM está no painel de mais de uma unidade selecionada para comissão. Ajuste no ERP (FC04200).</p>
  <table class="lista-funcionarios-table">
    <thead>
      <tr>
        <th>Médico</th>
        <th>CRM</th>
        <th>UF</th>
        <th>Unidades</th>
        <th>Representantes no ERP</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>`;
    const html = this.montarShellRelatorio(
      'Prescritores em conflito',
      this.subtituloConflitosImpressao(),
      corpo,
    );
    this.abrirJanelaImpressao('Prescritores em conflito', html);
  }

  private reavaliarPainel(funcionarioId: string, atualizarModal: boolean): void {
    this.reavaliandoFuncionarioId = funcionarioId;
    this.reavaliandoPainel = true;
    this.service.reavaliarPainel(funcionarioId).subscribe({
      next: (res) => {
        this.aplicarUnidadesNasLinhas(res);
        if (atualizarModal && this.conflitoAberto) {
          this.conflitoLinhas = res.conflitos;
          if (!res.quantidadeConflitosPainel) {
            this.fecharConflitos();
          }
        }
        this.reavaliandoPainel = false;
        this.reavaliandoFuncionarioId = null;
      },
      error: (e) => {
        this.reavaliandoPainel = false;
        this.reavaliandoFuncionarioId = null;
        this.errors.show(
          e?.error?.message ?? 'Erro ao reavaliar o painel.',
          'Configuração Metas',
        );
      },
    });
  }

  private montarShellRelatorio(
    reportTitle: string,
    subtituloHtml: string,
    conteudo: string,
  ): string {
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `${reportTitle} ${reportTimestamp}`;
    const currentUser = this.auth.getCurrentUser();
    const usuarioLabel =
      currentUser?.nome || currentUser?.email || 'Usuário não identificado';
    const dataGeracao = new Date();
    const dataFormatada = dataGeracao.toLocaleDateString('pt-BR');
    const horaFormatada = dataGeracao.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const geradoEmTexto = `Gerado em ${dataFormatada}, ${horaFormatada} por ${usuarioLabel}`;
    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo do sistema" />`
      : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(reportDocumentTitle)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1a202c; font-size: 12px; background: #fff; margin-bottom: 80px; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
    .report-subtitle { margin-top: 6px; font-size: 11px; color: #475569; font-weight: 500; }
    .report-hint { margin: 0 0 12px; color: #475569; }
    .print-actions { text-align: right; margin-bottom: 12px; }
    .print-actions button { background: #2b6cb0; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .logo-area, .header-spacer { flex: 0 0 220px; display: flex; align-items: center; justify-content: flex-start; }
    .header-spacer { visibility: hidden; }
    .logo-area img { max-height: 60px; width: auto; display: block; }
    .title-area { flex: 1 1 auto; text-align: center; }
    .lista-funcionarios-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .lista-funcionarios-table th, .lista-funcionarios-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    .lista-funcionarios-table th { background: #f8fafc; font-weight: 700; color: #1e293b; }
    .lista-funcionarios-table tr:last-child td { border-bottom: none; }
    footer { text-align: right; font-size: 10px; color: #4a5568; margin-top: 32px; }
    @page { size: A4; margin: 12mm 15mm 28mm 15mm; }
    @media print {
      .print-actions { display: none; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .report-header { break-after: avoid-page; page-break-after: avoid; }
      .lista-funcionarios-table thead { display: table-header-group; }
      footer {
        position: fixed; bottom: 0; left: 0; right: 0; margin: 0;
        padding: 0 15mm 10mm; text-align: right; font-size: 10px; color: #4a5568; background: #fff;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button type="button" onclick="window.print()">Imprimir PDF</button>
  </div>
  <header class="report-header">
    <div class="logo-area">${logoHtml}</div>
    <div class="title-area">
      <h1>${this.escapeHtml(reportTitle)}</h1>
      ${subtituloHtml}
    </div>
    <div class="header-spacer">&nbsp;</div>
  </header>
  ${conteudo}
  <footer>${this.escapeHtml(geradoEmTexto)}</footer>
</body>
</html>`;
  }

  private subtituloConflitosImpressao(): string {
    const partes: string[] = [];
    if (this.unidadeFiltro) {
      partes.push(`Unidade: ${this.unidadeFiltro}`);
    }
    const competencia =
      this.mesFiltro > 0
        ? `${nomeMesPt(this.mesFiltro)}/${this.anoFiltro}`
        : `Todos / ${this.anoFiltro}`;
    partes.push(`Competência: ${competencia}`);
    const representante = this.linhas.find(
      (item) => item.funcionarioId === this.conflitoFuncionarioId,
    )?.nome;
    if (representante) {
      partes.push(`Representante: ${representante}`);
    }
    partes.push(`${this.conflitoLinhas.length} conflito(s)`);
    return `<div class="report-subtitle">${this.escapeHtml(partes.join(' · '))}</div>`;
  }

  private getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.hasLogo) return null;
    return `${environment.apiUrl}/configuracao/logo`;
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}`;
  }

  private abrirJanelaImpressao(tituloRelatorio: string, html: string): void {
    const win = globalThis.window.open('', '_blank');
    if (!win) {
      this.errors.show('Permita pop-ups para imprimir a lista.', 'Impressão');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.document.title = `${tituloRelatorio} ${this.getReportTimestamp()}`;
    win.focus();
    globalThis.window.setTimeout(() => win.print(), 200);
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private persistirUnidades(funcionarioId: string, unidades: Unidade[]): void {
    for (const linha of this.linhas) {
      if (linha.funcionarioId === funcionarioId) {
        linha.salvandoUnidades = true;
      }
    }
    this.service.salvarUnidadesComissao(funcionarioId, unidades).subscribe({
      next: (res) => {
        this.aplicarUnidadesNasLinhas(res);
        if (res.quantidadeConflitosPainel > 0 && !this.conflitoAberto) {
          const linha = this.linhas.find(
            (item) => item.funcionarioId === res.funcionarioId,
          );
          this.conflitoFuncionarioId = res.funcionarioId;
          this.conflitoTitulo = `Prescritores em conflito — ${linha?.nome ?? ''}`;
          this.conflitoLinhas = res.conflitos;
          this.conflitoAberto = true;
        }
      },
      error: (e) => {
        for (const linha of this.linhas) {
          if (linha.funcionarioId === funcionarioId) {
            linha.salvandoUnidades = false;
          }
        }
        this.errors.show(
          e?.error?.message ?? 'Erro ao salvar unidades de comissão.',
          'Configuração Metas',
        );
        this.carregarMetas();
      },
    });
  }

  private aplicarUnidadesNasLinhas(res: UnidadesComissaoResponse): void {
    for (const linha of this.linhas) {
      if (linha.funcionarioId !== res.funcionarioId) continue;
      linha.unidadesComissao = res.unidadesComissao;
      linha.quantidadeConflitosPainel = res.quantidadeConflitosPainel;
      linha.salvandoUnidades = false;
    }
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

  private anoMesSelecionado(): string {
    return `${this.anoFiltro}-${String(this.mesFiltro).padStart(2, '0')}`;
  }

  private abrirConfirmacao(
    titulo: string,
    mensagem: string,
    acao: () => void,
    variante: 'danger' | 'primary' = 'primary',
  ): void {
    this.confirmTitulo = titulo;
    this.confirmMensagem = mensagem;
    this.confirmAcao = acao;
    this.confirmVariante = variante;
    this.confirmVisivel = true;
  }

  private mesAnterior(anoMes: string): string {
    const [ano, mes] = anoMes.split('-').map((n) => Number(n));
    const data = new Date(ano, mes - 2, 1);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  }

  private rotuloAnoMes(anoMes: string): string {
    const [ano, mes] = anoMes.split('-').map((n) => Number(n));
    return `${nomeMesPt(mes)}/${ano}`;
  }
}
