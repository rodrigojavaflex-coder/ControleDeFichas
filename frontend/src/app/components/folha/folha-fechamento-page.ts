import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FolhaService } from '../../services/folha.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { GlobalBlockingOverlayService } from '../../services/global-blocking-overlay.service';
import {
  FolhaCompetenciaGridRow,
  FolhaTipo,
} from '../../models/folha.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { MESES_PT, nomeMesPt } from './folha-meses';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-folha-fechamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './folha-fechamento-page.html',
  styleUrls: ['./folha-pages.shared.css'],
})
export class FolhaFechamentoPage implements OnInit, OnDestroy {
  private folha = inject(FolhaService);
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private globalBlocking = inject(GlobalBlockingOverlayService);

  Permission = Permission;
  Unidade = Unidade;
  MESES_PT = MESES_PT;
  nomeMesPt = nomeMesPt;

  /** Formata instante UTC da API para exibição em pt-BR (data e hora). */
  formatarDataHoraAbertura(raw?: string | null): string {
    if (raw === undefined || raw === null || raw === '') {
      return '—';
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  /** Referência exibida: mês e ano da competência (ano não editável diretamente na tela). */
  get referenciaCompetencia(): string {
    return `${this.nomeMesPt(this.mes)} / ${this.ano}`;
  }

  /** '' = todas (escopo liberado pela API conforme vínculo do usuário). */
  unidadeFiltro: Unidade | '' = '';
  ano = new Date().getFullYear();
  mes = new Date().getMonth() + 1;
  tipos: FolhaTipo[] = [];
  tipoId = '';
  registradas: FolhaCompetenciaGridRow[] = [];
  carregandoLista = false;
  enviando = false;
  enviandoRecibosWhatsappMassa = false;

  showFecharLoteModal = false;
  fecharLoteModalMensagem = '';
  private pendenteFecharLoteRow: FolhaCompetenciaGridRow | null = null;

  showReabrirLoteModal = false;
  reabrirLoteModalMensagem = '';
  private pendenteReabrirLoteRow: FolhaCompetenciaGridRow | null = null;

  showEnviarRecibosWhatsappModal = false;
  enviarRecibosWhatsappModalMensagem = '';
  private pendenteEnviarRecibosWhatsappRow: FolhaCompetenciaGridRow | null = null;

  ngOnDestroy(): void {
    if (this.enviandoRecibosWhatsappMassa) {
      this.globalBlocking.hide();
    }
  }

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Controle das competências',
      description:
        'Filtre por competência e gerencie aberturas e fechamento de lotes.',
    });
    this.initializeUnidadeFilter();
    this.folha.listarTipos().subscribe({
      next: (t) => {
        this.tipos = t.filter((x) => x.ativo);
        this.tipoId = '';
        this.carregarRegistradas();
      },
      error: () => this.errors.show('Erro ao carregar tipos.', 'Folha'),
    });
  }

  /**
   * Mesma regra que `VendasListComponent.initializeUnidadeFilter`: se o usuário tem
   * `unidade` preenchida (não vazia), o filtro fica fixo nela e desabilitado; caso
   * contrário pode escolher entre todas (e opção "Todas" na API).
   */
  private initializeUnidadeFilter(): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.unidade && currentUser.unidade.trim() !== '') {
      this.unidadeFiltro = currentUser.unidade as Unidade;
    } else {
      this.unidadeFiltro = '';
    }
  }

  /** Opções do `<select>` — todas as unidades (espelha o conjunto de valores do filtro de Vendas). */
  get unidadesVisiveisParaSelect(): Unidade[] {
    return Object.values(Unidade);
  }

  /** Usuário com `unidade` definida no cadastro ⇒ select travado (igual tela de Vendas). */
  get campoUnidadeDesabilitado(): boolean {
    const u = this.auth.getCurrentUser();
    return !!(u?.unidade && u.unidade.trim() !== '');
  }

  podeVisualizarPagina(): boolean {
    return (
      this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_READ) ||
      this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA) ||
      this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_FECHAR) ||
      this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_REABRIR)
    );
  }

  podePermRegistrarAbertura(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA);
  }

  podePermFecharLote(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_FECHAR);
  }

  podePermReabrirLote(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FECHAMENTO_REABRIR);
  }

  podePermEnviarRecibosWhatsappMassa(): boolean {
    return this.auth.hasPermission(
      Permission.FOLHA_FECHAMENTO_ENVIAR_RECIBOS_WHATSAPP,
    );
  }

  /** Campos válidos para o POST de abertura (além de `podePermRegistrarAbertura`). */
  valoresRegistrarAberturaValidos(): boolean {
    const anoNum = Number(this.ano);
    return (
      this.unidadeFiltro !== '' &&
      Number.isFinite(anoNum) &&
      anoNum >= 2000 &&
      anoNum <= 2100 &&
      this.mes >= 1 &&
      this.mes <= 12 &&
      !!this.tipoId &&
      this.tipos.some((x) => x.id === this.tipoId)
    );
  }

  podeExecutarRegistrarAbertura(): boolean {
    return this.podePermRegistrarAbertura() && this.valoresRegistrarAberturaValidos();
  }

  trackRow(row: FolhaCompetenciaGridRow): string {
    return `${row.unidade}-${row.mes}-${row.folhaTipoId}`;
  }

  mesAnterior(): void {
    if (this.enviando) return;
    if (this.mes <= 1) {
      this.mes = 12;
      this.ano = Number(this.ano) - 1;
    } else {
      this.mes--;
    }
    this.carregarRegistradas();
  }

  proximoMes(): void {
    if (this.enviando) return;
    if (this.mes >= 12) {
      this.mes = 1;
      this.ano = Number(this.ano) + 1;
    } else {
      this.mes++;
    }
    this.carregarRegistradas();
  }

  carregarRegistradas(): void {
    if (!this.podeVisualizarPagina()) return;
    const anoNum = Number(this.ano);
    if (!Number.isFinite(anoNum) || anoNum < 2000 || anoNum > 2100) {
      this.registradas = [];
      return;
    }
    this.carregandoLista = true;
    this.folha
      .listarCompetenciasRegistradas({
        ano: anoNum,
        mes: this.mes,
        unidade: this.unidadeFiltro === '' ? '' : this.unidadeFiltro,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: (rows) => {
          this.registradas = rows;
          this.carregandoLista = false;
        },
        error: () => {
          this.carregandoLista = false;
          this.errors.show('Erro ao carregar competências registradas.', 'Controle');
        },
      });
  }

  registrarAbertura(): void {
    if (!this.podeExecutarRegistrarAbertura()) return;
    const un = this.unidadeFiltro as Unidade;
    this.enviando = true;
    this.folha
      .registrarAberturaCompetencia({
        unidade: un,
        ano: Number(this.ano),
        mes: this.mes,
        folhaTipoId: this.tipoId,
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.carregarRegistradas();
        },
        error: (e) => {
          this.enviando = false;
          this.errors.show(e?.error?.message ?? 'Erro ao registrar abertura.', 'Controle');
        },
      });
  }

  /** Abre modal antes de fechar o lote. */
  fecharLinha(row: FolhaCompetenciaGridRow): void {
    if (!this.podePermFecharLote()) return;
    if (row.situacao !== 'ABERTA') return;
    this.pendenteFecharLoteRow = row;
    this.fecharLoteModalMensagem =
      `Fechar o lote de ${nomeMesPt(row.mes)}/${this.ano} — ${row.folhaTipoDescricao} (${row.unidade})? Depois não será possível alterar capas/itens.`;
    this.showFecharLoteModal = true;
  }

  onCancelarFecharLoteModal(): void {
    this.showFecharLoteModal = false;
    this.pendenteFecharLoteRow = null;
  }

  /** Confirma fechamento exibido no modal (padrão `app-confirmation-modal`). */
  onConfirmarFecharLoteModal(): void {
    const row = this.pendenteFecharLoteRow;
    this.showFecharLoteModal = false;
    this.pendenteFecharLoteRow = null;
    if (!row) return;
    this.enviando = true;
    this.folha
      .fecharLote({
        unidade: row.unidade,
        ano: Number(this.ano),
        mes: row.mes,
        folhaTipoId: row.folhaTipoId,
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.carregarRegistradas();
        },
        error: (e) => {
          this.enviando = false;
          this.errors.show(e?.error?.message ?? 'Erro ao fechar lote.', 'Controle');
        },
      });
  }

  /** Abre modal antes de reabrir competência fechada. */
  abrirModalReabrir(row: FolhaCompetenciaGridRow): void {
    if (!this.podePermReabrirLote()) return;
    if (row.situacao !== 'FECHADA') return;
    this.pendenteReabrirLoteRow = row;
    this.reabrirLoteModalMensagem =
      `Reabrir o lote de ${nomeMesPt(row.mes)}/${this.ano} — ${row.folhaTipoDescricao} (${row.unidade})? ` +
      'Depois será possível alterar capas e itens até um novo fechamento.';
    this.showReabrirLoteModal = true;
  }

  onCancelarReabrirLoteModal(): void {
    this.showReabrirLoteModal = false;
    this.pendenteReabrirLoteRow = null;
  }

  onConfirmarReabrirLoteModal(): void {
    const row = this.pendenteReabrirLoteRow;
    this.showReabrirLoteModal = false;
    this.pendenteReabrirLoteRow = null;
    if (!row) return;
    this.enviando = true;
    this.folha
      .reabrirLote({
        unidade: row.unidade,
        ano: Number(this.ano),
        mes: row.mes,
        folhaTipoId: row.folhaTipoId,
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.carregarRegistradas();
        },
        error: (e) => {
          this.enviando = false;
          this.errors.show(e?.error?.message ?? 'Erro ao reabrir lote.', 'Controle');
        },
      });
  }

  abrirModalEnviarRecibosWhatsapp(row: FolhaCompetenciaGridRow): void {
    if (!this.podePermEnviarRecibosWhatsappMassa()) return;
    if (row.situacao !== 'FECHADA') return;
    this.pendenteEnviarRecibosWhatsappRow = row;
    this.enviarRecibosWhatsappModalMensagem =
      `Enviar recibos WhatsApp para ${nomeMesPt(row.mes)}/${this.ano} — ` +
      `${row.folhaTipoDescricao} (${row.unidade})?`;
    this.showEnviarRecibosWhatsappModal = true;
  }

  onCancelarEnviarRecibosWhatsappModal(): void {
    this.showEnviarRecibosWhatsappModal = false;
    this.pendenteEnviarRecibosWhatsappRow = null;
  }

  onConfirmarEnviarRecibosWhatsappModal(): void {
    const row = this.pendenteEnviarRecibosWhatsappRow;
    this.showEnviarRecibosWhatsappModal = false;
    this.pendenteEnviarRecibosWhatsappRow = null;
    if (!row) return;
    void this.executarEnvioRecibosWhatsappMassa(row);
  }

  private async executarEnvioRecibosWhatsappMassa(
    row: FolhaCompetenciaGridRow,
  ): Promise<void> {
    this.enviando = true;
    this.enviandoRecibosWhatsappMassa = true;

    const competenciaLabel =
      `${nomeMesPt(row.mes)}/${this.ano} — ${row.folhaTipoDescricao} (${row.unidade})`;

    try {
      const capas = await firstValueFrom(
        this.folha.listarCapas({
          unidade: row.unidade,
          ano: Number(this.ano),
          mes: row.mes,
          folhaTipoId: row.folhaTipoId,
        }),
      );

      const total = capas.length;
      if (total === 0) {
        this.errors.show('Nenhuma capa encontrada para envio.', 'WhatsApp');
        return;
      }

      this.globalBlocking.show({
        title: 'Enviando recibos por WhatsApp',
        message: competenciaLabel,
        note:
          'Aguarde a conclusão. O acesso ao sistema permanece bloqueado durante o envio.',
        progressCurrent: 0,
        progressTotal: total,
        progressLabel: 'Preparando envio…',
      });

      let enviados = 0;
      let ignorados = 0;
      const falhas: Array<{ funcionarioId: string; nome: string; motivo: string }> =
        [];

      for (let i = 0; i < capas.length; i++) {
        const capa = capas[i];
        const nome = (capa.funcionario?.nome ?? 'Funcionário').trim() || 'Funcionário';

        this.globalBlocking.updateProgress(
          i,
          total,
          `Enviando para ${nome}…`,
        );

        try {
          await firstValueFrom(
            this.folha.enviarReciboWhatsapp(capa.id, row.unidade),
          );
          enviados += 1;
        } catch (error: unknown) {
          ignorados += 1;
          const motivo =
            (error as { error?: { message?: string } })?.error?.message ??
            'Erro ao enviar recibo por WhatsApp.';
          falhas.push({
            funcionarioId: capa.funcionario?.id ?? '',
            nome,
            motivo,
          });
        }

        this.globalBlocking.updateProgress(
          i + 1,
          total,
          i + 1 < total ? `Concluído: ${nome}` : `Finalizando…`,
        );

        if (i < capas.length - 1) {
          await this.delayMs(900);
        }
      }

      const resumo =
        `Enviados: ${enviados}. Ignorados: ${ignorados}.` +
        (falhas.length
          ? ` Falhas: ${falhas
              .slice(0, 5)
              .map((f) => `${f.nome} (${f.motivo})`)
              .join('; ')}${falhas.length > 5 ? ' ...' : ''}`
          : '');
      this.errors.show(resumo, 'WhatsApp');
      this.carregarRegistradas();
    } catch (error: unknown) {
      this.errors.show(
        (error as { error?: { message?: string } })?.error?.message ??
          'Erro ao preparar envio de recibos por WhatsApp.',
        'WhatsApp',
      );
    } finally {
      this.globalBlocking.hide();
      this.enviando = false;
      this.enviandoRecibosWhatsappMassa = false;
    }
  }

  private delayMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  situacaoRotulo(row: FolhaCompetenciaGridRow): string {
    switch (row.situacao) {
      case 'NAO_REGISTRADA':
        return 'Abertura não registrada';
      case 'ABERTA':
        return 'Aberta para lançamentos';
      case 'FECHADA':
        return 'Lote fechado';
      default:
        return '—';
    }
  }

  situacaoClasse(row: FolhaCompetenciaGridRow): string {
    switch (row.situacao) {
      case 'NAO_REGISTRADA':
        return 'tag-folha-nao-reg';
      case 'ABERTA':
        return 'tag-folha-aberta';
      case 'FECHADA':
        return 'tag-folha-fechada';
      default:
        return '';
    }
  }
}

