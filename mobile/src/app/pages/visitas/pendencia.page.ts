import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, closeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AppLoadingService } from '../../services/app-loading.service';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { PendenciasAlertaService } from '../../services/pendencias-alerta.service';
import { VisitasService } from '../../services/visitas.service';
import {
  MedicoPendenciaOpcao,
  PeriodoHistoricoFiltro,
  SolicitacaoHistoricoItem,
  SolicitacaoResumo,
  StatusFiltroPendencia,
  TipoPendenciaOpcao,
  formatarDataHoraVisita,
  rotuloCrm,
} from '../../models/visita.model';
import { BuscaMedicoComponent } from './busca-medico.component';
import { PeriodoFiltroComponent } from './periodo-filtro.component';

const LIMITE_PAGINA = 20;

@Component({
  selector: 'app-pendencia',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonBadge,
    IonIcon,
    IonSpinner,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    BuscaMedicoComponent,
    PeriodoFiltroComponent,
  ],
  templateUrl: './pendencia.page.html',
  styleUrls: ['./pendencia.page.scss'],
})
export class PendenciaPage {
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly alertas = inject(AlertController);
  private readonly loading = inject(AppLoadingService);
  private readonly erros = inject(ErrorMessageService);
  private readonly pendenciasAlerta = inject(PendenciasAlertaService);

  constructor() {
    addIcons({ closeOutline, chevronDownOutline, chevronUpOutline });
  }

  filtrosAbertos = false;
  modoCriacao = false;
  texto = '';
  tipoPendenciaId = '';
  tiposPendencia: TipoPendenciaOpcao[] = [];
  tiposCarregados = false;

  medicoCriacao: MedicoPendenciaOpcao | null = null;
  medicoFiltro: MedicoPendenciaOpcao | null = null;

  lista: SolicitacaoResumo[] = [];
  total = 0;
  page = 1;
  hasMore = false;
  painelDisponivel = false;
  carregando = false;
  carregandoMais = false;
  periodo: PeriodoHistoricoFiltro | null = null;
  periodoIncompleto = false;
  statusFiltro: StatusFiltroPendencia = 'todas';
  tipoFiltroId = '';
  concluirAberto = false;
  concluirItem: SolicitacaoResumo | null = null;
  descricaoConclusao = '';
  salvandoConcluir = false;
  resolverAberto = false;
  resolverItem: SolicitacaoResumo | null = null;
  descricaoResolver = '';
  salvandoResolver = false;
  historicoAberto = false;
  historicoTitulo = '';
  historico: SolicitacaoHistoricoItem[] = [];
  carregandoHistorico = false;

  readonly formatarDataHora = formatarDataHoraVisita;
  readonly rotuloCrm = rotuloCrm;
  readonly statusOpcoes: Array<{ valor: StatusFiltroPendencia; rotulo: string }> = [
    { valor: 'ABERTA', rotulo: 'Abertas' },
    { valor: 'RESOLVIDA', rotulo: 'Resolvidas' },
    { valor: 'CONCLUIDA', rotulo: 'Concluídas' },
    { valor: 'REABERTA', rotulo: 'Reabertas' },
    { valor: 'todas', rotulo: 'Todas' },
  ];

  podeRegistrar(): boolean {
    return this.auth.hasPermission('pendencias:create');
  }

  alternarFiltros(): void {
    this.filtrosAbertos = !this.filtrosAbertos;
  }

  get resumoFiltros(): string {
    const partes: string[] = [];
    if (this.periodo) {
      partes.push(this.rotuloPeriodo(this.periodo));
    }
    if (this.medicoFiltro?.nome?.trim()) {
      partes.push(this.medicoFiltro.nome.trim());
    }
    if (this.statusFiltro !== 'todas') {
      const opcao = this.statusOpcoes.find((o) => o.valor === this.statusFiltro);
      partes.push(opcao?.rotulo ?? this.statusFiltro);
    }
    if (this.tipoFiltroId) {
      const tipo = this.tiposPendencia.find((t) => t.id === this.tipoFiltroId);
      partes.push(tipo?.nome ?? 'Tipo');
    }
    return partes.length > 0 ? partes.join(' · ') : 'Nenhum filtro aplicado';
  }

  ionViewWillEnter(): void {
    this.modoCriacao = false;
    this.filtrosAbertos = false;
    const situacao = this.rota.snapshot.queryParamMap.get('situacao');
    if (
      situacao === 'ABERTA' ||
      situacao === 'RESOLVIDA' ||
      situacao === 'CONCLUIDA' ||
      situacao === 'REABERTA'
    ) {
      this.statusFiltro = situacao;
    } else {
      this.statusFiltro = 'todas';
    }
    void this.carregar(true);
    void this.garantirTipos();
    void this.pendenciasAlerta.atualizar();
  }

  async abrirCriacao(): Promise<void> {
    if (!this.podeRegistrar()) return;
    await this.garantirTipos();
    this.modoCriacao = true;
    this.texto = '';
    this.tipoPendenciaId = '';
    this.medicoCriacao = null;
  }

  fecharCriacao(): void {
    this.modoCriacao = false;
    this.texto = '';
    this.tipoPendenciaId = '';
    this.medicoCriacao = null;
  }

  async aoFiltrarPeriodo(filtro: PeriodoHistoricoFiltro | null): Promise<void> {
    this.periodo = filtro;
    if (
      filtro?.periodo === 'personalizado' &&
      (!filtro.dataInicio || !filtro.dataFim)
    ) {
      this.periodoIncompleto = true;
      this.lista = [];
      this.total = 0;
      this.hasMore = false;
      return;
    }
    this.periodoIncompleto = false;
    await this.carregar(true);
  }

  async selecionarStatus(valor: StatusFiltroPendencia): Promise<void> {
    if (this.statusFiltro === valor) return;
    this.statusFiltro = valor;
    await this.carregar(true);
  }

  async selecionarTipo(id: string): Promise<void> {
    if (this.tipoFiltroId === id) return;
    this.tipoFiltroId = id;
    await this.carregar(true);
  }

  async carregar(reiniciar: boolean): Promise<void> {
    if (this.periodoIncompleto) return;
    if (reiniciar) {
      this.page = 1;
      this.carregando = true;
    } else {
      this.carregandoMais = true;
    }
    try {
      const resposta = await firstValueFrom(
        this.visitas.minhasSolicitacoes({
          status: this.statusFiltro,
          tipoPendenciaId: this.tipoFiltroId || null,
          prescritorId: this.medicoFiltro?.id ?? null,
          periodo: this.periodo,
          page: this.page,
          limit: LIMITE_PAGINA,
        }),
      );
      this.painelDisponivel = resposta.painelDisponivel;
      this.total = resposta.total;
      this.hasMore = resposta.hasMore;
      this.lista = reiniciar
        ? resposta.items
        : [...this.lista, ...resposta.items];
    } catch (error) {
      if (reiniciar) {
        this.lista = [];
        this.total = 0;
        this.hasMore = false;
      }
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar as pendências.'),
      );
    } finally {
      this.carregando = false;
      this.carregandoMais = false;
    }
  }

  async carregarMais(): Promise<void> {
    if (!this.hasMore || this.carregandoMais || this.carregando) return;
    this.page += 1;
    await this.carregar(false);
  }

  onMedicoCriacaoChange(medico: MedicoPendenciaOpcao | null): void {
    this.medicoCriacao = medico;
  }

  async onMedicoFiltroChange(
    medico: MedicoPendenciaOpcao | null,
  ): Promise<void> {
    this.medicoFiltro = medico;
    await this.carregar(true);
  }

  async registrar(): Promise<void> {
    const texto = this.texto.trim();
    if (!texto) {
      await this.avisar('Informe o texto da pendência.');
      return;
    }
    if (!this.tipoPendenciaId) {
      await this.avisar('Selecione o tipo da pendência.');
      return;
    }
    try {
      await this.loading.show('Registrando pendência…');
      await firstValueFrom(
        this.visitas.criarSolicitacao({
          texto,
          tipoPendenciaId: this.tipoPendenciaId,
          prescritorId: this.medicoCriacao?.id,
        }),
      );
      await this.loading.dismiss();
      await this.avisar('Pendência registrada.');
      this.fecharCriacao();
      await this.carregar(true);
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível registrar a pendência.'),
      );
    } finally {
      await this.loading.dismiss();
    }
  }

  async voltar(): Promise<void> {
    if (this.modoCriacao) {
      this.fecharCriacao();
      return;
    }
    await this.router.navigate(['/home']);
  }

  rotuloStatus(status: SolicitacaoResumo['status']): string {
    if (status === 'ABERTA') return 'Aberta';
    if (status === 'RESOLVIDA') return 'Resolvida';
    if (status === 'REABERTA') return 'Reaberta';
    return 'Concluída';
  }

  corStatus(status: SolicitacaoResumo['status']): string {
    if (status === 'ABERTA') return 'primary';
    if (status === 'RESOLVIDA') return 'warning';
    if (status === 'REABERTA') return 'tertiary';
    return 'medium';
  }

  rotuloDias(item: SolicitacaoResumo): string {
    return item.rotuloDias?.trim() || '—';
  }

  podeResolver(item: SolicitacaoResumo): boolean {
    return item.status === 'ABERTA' || item.status === 'REABERTA';
  }

  podeConcluir(item: SolicitacaoResumo): boolean {
    return item.status === 'RESOLVIDA';
  }

  abrirResolver(item: SolicitacaoResumo): void {
    this.resolverItem = item;
    this.descricaoResolver = '';
    this.resolverAberto = true;
  }

  fecharResolver(): void {
    if (this.salvandoResolver) return;
    this.resolverAberto = false;
    this.resolverItem = null;
    this.descricaoResolver = '';
  }

  async confirmarResolver(): Promise<void> {
    const item = this.resolverItem;
    const descricao = this.descricaoResolver.trim();
    if (!item || !descricao || this.salvandoResolver) return;
    this.salvandoResolver = true;
    try {
      await this.loading.show('Resolvendo pendência…');
      await firstValueFrom(this.visitas.resolverSolicitacao(item.id, descricao));
      this.resolverAberto = false;
      this.resolverItem = null;
      this.descricaoResolver = '';
      await this.loading.dismiss();
      await this.avisar('Pendência resolvida.');
      await this.carregar(true);
      void this.pendenciasAlerta.atualizar();
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível resolver a pendência.'),
      );
    } finally {
      this.salvandoResolver = false;
      await this.loading.dismiss();
    }
  }

  abrirConcluir(item: SolicitacaoResumo): void {
    this.concluirItem = item;
    this.descricaoConclusao = '';
    this.concluirAberto = true;
  }

  fecharConcluir(): void {
    if (this.salvandoConcluir) return;
    this.concluirAberto = false;
    this.concluirItem = null;
    this.descricaoConclusao = '';
  }

  async confirmarConcluir(): Promise<void> {
    const item = this.concluirItem;
    const descricao = this.descricaoConclusao.trim();
    if (!item || !descricao || this.salvandoConcluir) return;
    this.salvandoConcluir = true;
    try {
      await this.loading.show('Concluindo pendência…');
      await firstValueFrom(this.visitas.concluirSolicitacao(item.id, descricao));
      this.concluirAberto = false;
      this.concluirItem = null;
      this.descricaoConclusao = '';
      await this.loading.dismiss();
      await this.avisar('Pendência concluída.');
      await this.carregar(true);
      void this.pendenciasAlerta.atualizar();
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível concluir a pendência.'),
      );
    } finally {
      this.salvandoConcluir = false;
      await this.loading.dismiss();
    }
  }

  async abrirHistorico(item: SolicitacaoResumo): Promise<void> {
    this.historicoTitulo =
      item.prescritorNome?.trim() || item.tipoPendenciaNome || 'Pendência';
    this.historico = [];
    this.historicoAberto = true;
    this.carregandoHistorico = true;
    try {
      this.historico = await firstValueFrom(
        this.visitas.historicoSolicitacao(item.id),
      );
    } catch (error) {
      this.historicoAberto = false;
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar o histórico.'),
      );
    } finally {
      this.carregandoHistorico = false;
    }
  }

  fecharHistorico(): void {
    this.historicoAberto = false;
    this.historicoTitulo = '';
    this.historico = [];
    this.carregandoHistorico = false;
  }

  private rotuloPeriodo(filtro: PeriodoHistoricoFiltro): string {
    if (filtro.periodo === 'ano' && filtro.ano != null) {
      return String(filtro.ano);
    }
    if (filtro.periodo === 'mes' && filtro.ano != null && filtro.mes != null) {
      const meses = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ];
      return `${meses[filtro.mes - 1]}/${filtro.ano}`;
    }
    if (filtro.periodo === 'personalizado') {
      if (filtro.dataInicio && filtro.dataFim) {
        return `${filtro.dataInicio} → ${filtro.dataFim}`;
      }
      return 'Personalizado';
    }
    return 'Período';
  }

  private async garantirTipos(): Promise<void> {
    if (this.tiposCarregados) return;
    try {
      this.tiposPendencia = await firstValueFrom(
        this.visitas.listarTiposPendencia(),
      );
      this.tiposCarregados = true;
    } catch {
      this.tiposPendencia = [];
    }
  }

  private async avisar(mensagem: string): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Pendência',
      message: mensagem,
      buttons: ['OK'],
    });
    await alerta.present();
    await alerta.onDidDismiss();
  }
}
