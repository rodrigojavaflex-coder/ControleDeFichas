import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoConfigService } from '../../services/producao-config.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ProducaoEtapaEditRow,
  ProducaoFuncionarioConfigRow,
  ProducaoFuncionarioEtapaModalRow,
  FiltroEtapasRecebe,
  FiltroFuncionarioEtapas,
  ProducaoConfigRelatorio,
  AcaoEtapasFuncionariosModal,
  AplicarEtapasRemuneradasDto,
  RemoverEtapasFuncionariosDto,
} from '../../models/producao-config.model';

@Component({
  selector: 'app-producao-config-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-config-page.html',
  styleUrls: ['./producao-config-page.css'],
})
export class ProducaoConfigPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private producaoConfig = inject(ProducaoConfigService);

  Permission = Permission;
  Unidade = Unidade;
  unidades = Object.values(Unidade);

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;

  carregandoEtapas = false;
  carregandoFuncionarios = false;
  salvandoEtapas = false;

  etapas: ProducaoEtapaEditRow[] = [];
  etapasDirty = false;
  filtroEtapas: FiltroEtapasRecebe = 'todas';
  filtroNomeEtapa = '';
  funcionarios: ProducaoFuncionarioConfigRow[] = [];
  filtroNomeFuncionario = '';
  filtroSetorFuncionario = '';
  filtroCargoFuncionario = '';
  filtroEtapasFuncionario: FiltroFuncionarioEtapas = 'todas';

  modalAberto = false;
  modalFuncionario: ProducaoFuncionarioConfigRow | null = null;
  modalEtapas: ProducaoFuncionarioEtapaModalRow[] = [];
  modalCarregando = false;
  modalSalvando = false;

  relatorioCarregando = false;
  funcionariosSelecionados = new Set<string>();
  acaoEtapasModal: AcaoEtapasFuncionariosModal | null = null;
  processandoAcaoEtapas = false;

  private moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração de produção',
      description:
        'Parametrize etapas remuneradas e quais etapas cada funcionário recebe. Configuração permanente, sem período.',
    });
    this.initializeUnidadeFilter();
    if (this.unidadeFiltro) {
      this.recarregar();
    }
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_CONFIG_READ);
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_CONFIG_UPDATE);
  }

  onUnidadeChange(): void {
    if (!this.unidadeFiltro) return;
    this.filtroEtapas = 'todas';
    this.filtroNomeEtapa = '';
    this.filtroNomeFuncionario = '';
    this.filtroSetorFuncionario = '';
    this.filtroCargoFuncionario = '';
    this.filtroEtapasFuncionario = 'todas';
    this.funcionariosSelecionados.clear();
    this.recarregar();
  }

  etapasFiltradas(): ProducaoEtapaEditRow[] {
    let lista: ProducaoEtapaEditRow[];
    switch (this.filtroEtapas) {
      case 'recebe':
        lista = this.etapas.filter((e) => e.recebe);
        break;
      case 'nao_recebe':
        lista = this.etapas.filter((e) => !e.recebe);
        break;
      default:
        lista = this.etapas;
    }

    const termo = this.filtroNomeEtapa.trim().toLowerCase();
    if (!termo) return lista;

    return lista.filter((e) => e.etapa.toLowerCase().includes(termo));
  }

  setoresDisponiveis(): string[] {
    const valores = new Set<string>();
    for (const f of this.funcionarios) {
      if (f.setor) valores.add(f.setor);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  cargosDisponiveis(): string[] {
    const valores = new Set<string>();
    for (const f of this.funcionarios) {
      if (f.cargo) valores.add(f.cargo);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  funcionariosFiltrados(): ProducaoFuncionarioConfigRow[] {
    let lista = this.funcionarios;

    const nome = this.filtroNomeFuncionario.trim().toLowerCase();
    if (nome) {
      lista = lista.filter((f) => f.nome.toLowerCase().includes(nome));
    }

    if (this.filtroSetorFuncionario) {
      lista = lista.filter((f) => f.setor === this.filtroSetorFuncionario);
    }

    if (this.filtroCargoFuncionario) {
      lista = lista.filter((f) => f.cargo === this.filtroCargoFuncionario);
    }

    switch (this.filtroEtapasFuncionario) {
      case 'com_etapas':
        lista = lista.filter((f) => f.qtdEtapasConfiguradas > 0);
        break;
      case 'sem_etapas':
        lista = lista.filter((f) => f.qtdEtapasConfiguradas === 0);
        break;
    }

    return lista;
  }

  etapasRemuneradasSalvas(): ProducaoEtapaEditRow[] {
    return this.etapas.filter((e) => e.recebe);
  }

  podeImprimirRelatorio(): boolean {
    return !!this.unidadeFiltro && !this.relatorioCarregando && !this.carregandoEtapas;
  }

  podeAplicarEtapasSelecionados(): boolean {
    return (
      this.podeEditar() &&
      !!this.unidadeFiltro &&
      !this.processandoAcaoEtapas &&
      !this.carregandoFuncionarios &&
      this.funcionariosSelecionados.size > 0
    );
  }

  qtdFuncionariosSelecionados(): number {
    return this.funcionariosSelecionados.size;
  }

  isFuncionarioSelecionado(id: string): boolean {
    return this.funcionariosSelecionados.has(id);
  }

  toggleSelecaoFuncionario(id: string): void {
    if (this.funcionariosSelecionados.has(id)) {
      this.funcionariosSelecionados.delete(id);
    } else {
      this.funcionariosSelecionados.add(id);
    }
  }

  toggleSelecionarTodosFuncionarios(): void {
    const visiveis = this.funcionariosFiltrados();
    const todosMarcados =
      visiveis.length > 0 &&
      visiveis.every((f) => this.funcionariosSelecionados.has(f.id));

    if (todosMarcados) {
      for (const f of visiveis) {
        this.funcionariosSelecionados.delete(f.id);
      }
      return;
    }

    for (const f of visiveis) {
      this.funcionariosSelecionados.add(f.id);
    }
  }

  todosFuncionariosFiltradosSelecionados(): boolean {
    const visiveis = this.funcionariosFiltrados();
    return (
      visiveis.length > 0 &&
      visiveis.every((f) => this.funcionariosSelecionados.has(f.id))
    );
  }

  selecaoFuncionariosIndeterminada(): boolean {
    const visiveis = this.funcionariosFiltrados();
    if (visiveis.length === 0) return false;
    const marcados = visiveis.filter((f) =>
      this.funcionariosSelecionados.has(f.id),
    ).length;
    return marcados > 0 && marcados < visiveis.length;
  }

  abrirConfirmacaoAplicarEtapas(): void {
    if (!this.podeAplicarEtapasSelecionados()) return;
    this.acaoEtapasModal = 'aplicar';
  }

  abrirConfirmacaoRemoverEtapas(): void {
    if (!this.podeAplicarEtapasSelecionados()) return;
    this.acaoEtapasModal = 'remover';
  }

  cancelarAcaoEtapasModal(): void {
    if (this.processandoAcaoEtapas) return;
    this.acaoEtapasModal = null;
  }

  tituloAcaoEtapasModal(): string {
    return this.acaoEtapasModal === 'remover'
      ? 'Remover etapas dos funcionários'
      : 'Aplicar etapas aos funcionários';
  }

  mensagemAcaoEtapasModal(): string {
    const qtd = this.qtdFuncionariosSelecionados();
    if (this.acaoEtapasModal === 'remover') {
      return `Confirma remover todas as etapas configuradas de ${qtd} funcionário(s) selecionado(s)?`;
    }

    const qtdEtapas = this.etapasRemuneradasSalvas().length;
    const etapasTexto = this.etapasDirty
      ? 'as etapas remuneradas já salvas no sistema'
      : `${qtdEtapas} etapa(s) remunerada(s) salva(s)`;
    const avisoDirty = this.etapasDirty
      ? ' Alterações pendentes em «Etapas remuneradas» não serão aplicadas até você salvar.'
      : '';
    return `Confirma aplicar ${etapasTexto} a ${qtd} funcionário(s) selecionado(s)? A configuração individual de cada um será substituída.${avisoDirty}`;
  }

  confirmarAcaoEtapasModal(): void {
    if (!this.unidadeFiltro || !this.acaoEtapasModal || this.processandoAcaoEtapas) {
      return;
    }

    const funcionarioIds = [...this.funcionariosSelecionados];
    if (funcionarioIds.length === 0) return;

    this.processandoAcaoEtapas = true;

    if (this.acaoEtapasModal === 'remover') {
      const dto: RemoverEtapasFuncionariosDto = {
        unidade: this.unidadeFiltro,
        funcionarioIds,
      };
      this.producaoConfig.removerEtapasFuncionarios(dto).subscribe({
        next: (res) => {
          this.processandoAcaoEtapas = false;
          this.acaoEtapasModal = null;
          this.funcionariosSelecionados.clear();
          this.carregarFuncionarios();
          this.errors.show(
            `${res.funcionariosAtualizados} funcionário(s) tiveram as etapas removidas.`,
            'Produção',
          );
        },
        error: (e) => {
          this.processandoAcaoEtapas = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao remover etapas dos funcionários.',
            'Produção',
          );
        },
      });
      return;
    }

    const dto: AplicarEtapasRemuneradasDto = {
      unidade: this.unidadeFiltro,
      funcionarioIds,
    };
    this.producaoConfig.aplicarEtapasRemuneradas(dto).subscribe({
      next: (res) => {
        this.processandoAcaoEtapas = false;
        this.acaoEtapasModal = null;
        this.funcionariosSelecionados.clear();
        this.carregarFuncionarios();
        this.errors.show(
          `${res.funcionariosAtualizados} funcionário(s) atualizado(s) com ${res.etapasAplicadas} etapa(s) remunerada(s).`,
          'Produção',
        );
      },
      error: (e) => {
        this.processandoAcaoEtapas = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao aplicar etapas aos funcionários.',
          'Produção',
        );
      },
    });
  }

  imprimirRelatorio(): void {
    if (!this.podeLer() || !this.unidadeFiltro || this.relatorioCarregando) return;
    this.relatorioCarregando = true;
    this.producaoConfig.gerarRelatorioConfig(this.unidadeFiltro).subscribe({
      next: (relatorio) => {
        this.relatorioCarregando = false;
        this.abrirRelatorioImpressao(relatorio);
      },
      error: (e) => {
        this.relatorioCarregando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao gerar relatório.',
          'Produção',
        );
      },
    });
  }

  etapaValorInvalido(row: ProducaoEtapaEditRow): boolean {
    return row.recebe && this.valorEtapaObrigatorio(row) <= 0;
  }

  private valorEtapaObrigatorio(row: ProducaoEtapaEditRow): number {
    if (!row.recebe) return 0;
    const parsed = this.parseMoeda(row.valorDisplay);
    return parsed > 0 ? parsed : row.valor;
  }

  private validarEtapasAntesSalvar(): string | null {
    const invalidas = this.etapas.filter((e) => this.etapaValorInvalido(e));
    if (invalidas.length === 0) return null;
    const nomes = invalidas
      .slice(0, 5)
      .map((e) => e.etapa)
      .join(', ');
    const sufixo =
      invalidas.length > 5 ? ` e mais ${invalidas.length - 5} etapa(s)` : '';
    return `Informe valor maior que zero para etapa(s) marcada(s) como Recebe: ${nomes}${sufixo}.`;
  }

  recarregar(): void {
    if (!this.podeLer() || !this.unidadeFiltro) return;
    this.carregarEtapas();
    this.carregarFuncionarios();
  }

  alternarRecebeEtapa(row: ProducaoEtapaEditRow): void {
    if (!this.podeEditar()) return;
    row.recebe = !row.recebe;
    if (!row.recebe) {
      row.valor = 0;
      row.valorDisplay = this.formatarMoeda(0);
    }
    row.dirty = true;
    this.etapasDirty = true;
  }

  onValorEtapaInput(row: ProducaoEtapaEditRow): void {
    if (!row.recebe) return;
    row.valor = this.parseMoeda(row.valorDisplay);
    row.dirty = true;
    this.etapasDirty = true;
  }

  onValorEtapaBlur(row: ProducaoEtapaEditRow): void {
    row.valor = this.parseMoeda(row.valorDisplay);
    row.valorDisplay = this.formatarMoeda(row.valor);
    if (row.recebe) {
      row.dirty = true;
      this.etapasDirty = true;
    }
  }

  salvarEtapas(): void {
    if (!this.podeEditar() || !this.unidadeFiltro || this.salvandoEtapas) return;

    for (const row of this.etapas) {
      if (row.recebe) {
        row.valor = this.parseMoeda(row.valorDisplay);
      }
    }

    const msgValidacao = this.validarEtapasAntesSalvar();
    if (msgValidacao) {
      this.errors.show(msgValidacao, 'Produção');
      return;
    }

    this.salvandoEtapas = true;
    this.producaoConfig
      .salvarEtapas({
        unidade: this.unidadeFiltro,
        itens: this.etapas.map((e) => ({
          codEtapa: e.codEtapa,
          etapa: e.etapa,
          posicaoEtapa: e.posicaoEtapa,
          recebe: e.recebe,
          valor: e.recebe ? Math.max(0, this.valorEtapaObrigatorio(e)) : 0,
        })),
      })
      .subscribe({
        next: (lista) => {
          this.etapas = this.mapEtapasEdit(lista);
          this.etapasDirty = false;
          this.salvandoEtapas = false;
        },
        error: (e) => {
          this.salvandoEtapas = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar etapas.',
            'Produção',
          );
        },
      });
  }

  abrirModalFuncionario(f: ProducaoFuncionarioConfigRow): void {
    if (!this.podeLer() || !this.unidadeFiltro) return;
    this.modalFuncionario = f;
    this.modalAberto = true;
    this.modalCarregando = true;
    this.modalEtapas = [];
    this.producaoConfig
      .listarEtapasFuncionario(this.unidadeFiltro, f.id)
      .subscribe({
        next: (rows) => {
          this.modalEtapas = rows;
          this.modalCarregando = false;
        },
        error: (e) => {
          this.modalCarregando = false;
          this.fecharModal();
          this.errors.show(
            e?.error?.message ?? 'Erro ao carregar etapas do funcionário.',
            'Produção',
          );
        },
      });
  }

  fecharModal(): void {
    this.modalAberto = false;
    this.modalFuncionario = null;
    this.modalEtapas = [];
  }

  alternarRecebeModal(row: ProducaoFuncionarioEtapaModalRow): void {
    if (!this.podeEditar()) return;
    row.recebe = !row.recebe;
  }

  todosModalEtapasRecebem(): boolean {
    return (
      this.modalEtapas.length > 0 &&
      this.modalEtapas.every((e) => e.recebe)
    );
  }

  algunsModalEtapasRecebem(): boolean {
    if (this.modalEtapas.length === 0) return false;
    const qtd = this.modalEtapas.filter((e) => e.recebe).length;
    return qtd > 0 && qtd < this.modalEtapas.length;
  }

  alternarMarcarTodosModalEtapas(): void {
    if (!this.podeEditar() || this.modalEtapas.length === 0) return;
    const marcar = !this.todosModalEtapasRecebem();
    for (const row of this.modalEtapas) {
      row.recebe = marcar;
    }
  }

  salvarModalFuncionario(): void {
    if (
      !this.podeEditar() ||
      !this.unidadeFiltro ||
      !this.modalFuncionario ||
      this.modalSalvando
    ) {
      return;
    }
    this.modalSalvando = true;
    this.producaoConfig
      .salvarEtapasFuncionario(this.modalFuncionario.id, {
        unidade: this.unidadeFiltro,
        itens: this.modalEtapas.map((e) => ({
          codEtapa: e.codEtapa,
          recebe: e.recebe,
        })),
      })
      .subscribe({
        next: () => {
          this.modalSalvando = false;
          this.fecharModal();
          this.carregarFuncionarios();
        },
        error: (e) => {
          this.modalSalvando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar etapas do funcionário.',
            'Produção',
          );
        },
      });
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
  }

  formatarMoeda(valor: number): string {
    return this.moedaFmt.format(Number.isFinite(valor) ? valor : 0);
  }

  private initializeUnidadeFilter(): void {
    const u = this.auth.getCurrentUser();
    if (u?.unidade && String(u.unidade).trim() !== '') {
      this.unidadeFiltro = u.unidade as Unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeFiltro = '';
      this.unidadeDisabled = false;
    }
  }

  private carregarEtapas(): void {
    if (!this.unidadeFiltro) return;
    this.carregandoEtapas = true;
    this.producaoConfig.listarEtapas(this.unidadeFiltro).subscribe({
      next: (lista) => {
        this.etapas = this.mapEtapasEdit(lista);
        this.etapasDirty = false;
        this.carregandoEtapas = false;
      },
      error: (e) => {
        this.carregandoEtapas = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar etapas.',
          'Produção',
        );
      },
    });
  }

  private carregarFuncionarios(): void {
    if (!this.unidadeFiltro) return;
    this.carregandoFuncionarios = true;
    this.producaoConfig.listarFuncionarios(this.unidadeFiltro).subscribe({
      next: (lista) => {
        this.funcionarios = lista;
        this.carregandoFuncionarios = false;
      },
      error: (e) => {
        this.carregandoFuncionarios = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar funcionários.',
          'Produção',
        );
      },
    });
  }

  private mapEtapasEdit(
    lista: {
      codEtapa: string;
      etapa: string;
      posicaoEtapa: number;
      recebe: boolean;
      valor: number;
    }[],
  ): ProducaoEtapaEditRow[] {
    return lista.map((e) => ({
      ...e,
      valor: Number(e.valor) || 0,
      valorDisplay: this.formatarMoeda(Number(e.valor) || 0),
      dirty: false,
    }));
  }

  private parseMoeda(texto: string): number {
    const t = (texto || '').trim();
    if (!t) return 0;
    const limpo = t
      .replace(/\s/g, '')
      .replace(/^R\$/i, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const n = Number(limpo);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private abrirRelatorioImpressao(relatorio: ProducaoConfigRelatorio): void {
    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errors.show(
        'Não foi possível abrir o relatório. Verifique bloqueadores de pop-up.',
        'Produção',
      );
      return;
    }

    const linhasEtapas = relatorio.etapasRemuneradas
      .map(
        (e) => `
          <tr>
            <td class="col-etapa">${this.escapeHtml(e.etapa)}</td>
            <td class="col-valor">${this.formatarMoeda(e.valor)}</td>
          </tr>`,
      )
      .join('');

    const cardsFuncionarios = relatorio.funcionarios
      .map((f) => {
        const desligado =
          f.desligado && f.dataDemissao
            ? `<span class="func-desligado">Desligado em ${this.formatarData(f.dataDemissao)}</span>`
            : '';
        const setor = this.escapeHtml(f.setor || '—');
        const cargo = this.escapeHtml(f.cargo || '—');
        const qtdLabel =
          f.etapas.length === 1
            ? 'Possui 1 Etapa configurada:'
            : `Possui ${f.etapas.length} Etapas configuradas:`;
        return `
          <article class="func-card">
            <div class="func-card-header">
              <p class="func-identidade">
                <strong>${this.escapeHtml(f.nome)}</strong>
                ${setor} ${cargo} (Cód. ERP: ${f.codigoFuncionarioErp})
              </p>
              <p class="func-etapas-titulo">${qtdLabel}</p>
              ${desligado}
            </div>
            ${this.renderEtapasPilhaRelatorio(f.etapas)}
          </article>`;
      })
      .join('');

    const agora = new Date().toLocaleString('pt-BR');
    const titulo = 'Configuração de produção';

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${titulo}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1f2937; background: #fff; font-size: 12px; }
            h1 { margin: 0; font-size: 20px; color: #0f172a; }
            h2 { margin: 24px 0 8px; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; }
            .print-actions { text-align: right; margin-bottom: 12px; }
            .print-actions button { padding: 8px 16px; border: none; background: #2563eb; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
            .subheader { color: #64748b; font-size: 12px; margin-top: 4px; }
            .table-wrapper { border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
            .table-wrapper-compact { display: inline-block; max-width: 100%; }
            table { border-collapse: collapse; font-size: 12px; }
            table.table-etapas { width: auto; max-width: 100%; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; vertical-align: top; }
            tr:last-child td { border-bottom: none; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #475569; white-space: nowrap; }
            table.table-etapas .col-etapa { padding-right: 0.35rem; }
            table.table-etapas .col-valor { padding-left: 0.35rem; white-space: nowrap; color: #334155; font-weight: 500; }
            table.table-etapas th.col-valor { font-weight: 600; }
            .func-cards { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
            .func-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; background: #fff; }
            .func-card-header { padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
            .func-identidade { margin: 0; font-size: 13px; color: #334155; line-height: 1.45; }
            .func-identidade strong { color: #0f172a; font-weight: 600; }
            .func-etapas-titulo { margin: 0.35rem 0 0; font-size: 12px; color: #475569; font-weight: 600; }
            .func-desligado { display: block; margin-top: 4px; font-size: 11px; color: #b45309; font-weight: 500; }
            .func-etapas-pilha { column-gap: 1.25rem; line-height: 1.45; }
            .func-etapa-item { break-inside: avoid; padding: 2px 0; font-size: 11px; color: #334155; }
            .func-sem-etapas { margin: 0; font-size: 11px; color: #94a3b8; font-style: italic; }
            @media print { .print-actions { display: none; } .func-card { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button type="button" onclick="window.print()">Imprimir</button>
          </div>
          <h1>${titulo}</h1>
          <div class="subheader">Unidade: ${this.escapeHtml(relatorio.unidade)} · Emitido em ${agora}</div>

          <h2>Etapas remuneradas</h2>
          <div class="table-wrapper table-wrapper-compact">
            <table class="table-etapas">
              <thead>
                <tr>
                  <th class="col-etapa">Etapa</th>
                  <th class="col-valor">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${
                  linhasEtapas ||
                  '<tr><td colspan="2">Nenhuma etapa remunerada configurada.</td></tr>'
                }
              </tbody>
            </table>
          </div>

          <h2>Funcionários e etapas configuradas</h2>
          <div class="func-cards">
            ${
              cardsFuncionarios ||
              '<p class="func-sem-etapas">Nenhum funcionário com código ERP.</p>'
            }
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  }

  private renderEtapasPilhaRelatorio(
    etapas: { etapa: string }[],
  ): string {
    if (etapas.length === 0) {
      return '<p class="func-sem-etapas">Nenhuma etapa configurada.</p>';
    }

    const colunas = etapas.length <= 2 ? 1 : etapas.length <= 4 ? 2 : 3;
    const items = etapas
      .map(
        (e) =>
          `<div class="func-etapa-item">${this.escapeHtml(e.etapa)}</div>`,
      )
      .join('');

    return `<div class="func-etapas-pilha" style="column-count: ${colunas}">${items}</div>`;
  }

  private escapeHtml(texto: string): string {
    return (texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
