import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AppLoadingService } from '../../services/app-loading.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { GeolocalizacaoService } from '../../services/geolocalizacao.service';
import { VisitasService } from '../../services/visitas.service';
import {
  CarteiraVisitas,
  FiltroPainelVisita,
  HistoricoVisita,
  FiltroDiasHistorico,
  MedicoCarteira,
  PeriodoHistoricoFiltro,
  VisitaCorDiaAtiva,
  corPorDias,
  formatarDataHoraVisita,
  rotuloCrm,
  rotuloStatusVisita,
  textoSobreCor,
} from '../../models/visita.model';
import { PeriodoFiltroComponent } from './periodo-filtro.component';
import { VisitaConsultaModalComponent } from './visita-consulta-modal.component';

@Component({
  selector: 'app-carteira-visitas',
  standalone: true,
  templateUrl: './carteira.page.html',
  styleUrls: ['./carteira.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonFooter,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonButton,
    PeriodoFiltroComponent,
    VisitaConsultaModalComponent,
  ],
})
export class CarteiraVisitasPage {
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly geo = inject(GeolocalizacaoService);
  private readonly alertas = inject(AlertController);
  private readonly loading = inject(AppLoadingService);
  private readonly erros = inject(ErrorMessageService);
  @ViewChild('conteudo') private conteudo?: IonContent;

  private buscaTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pageSize = 40;

  aba: 'carteira' | 'historico' = 'carteira';
  filtroPainel: FiltroPainelVisita = 'todos';
  busca = '';
  page = 1;
  hasMore = false;
  total = 0;
  carregando = false;
  carregandoMais = false;
  carteira: CarteiraVisitas | null = null;
  medicosLista: MedicoCarteira[] = [];
  historico: HistoricoVisita[] = [];
  faixasCor: VisitaCorDiaAtiva[] = [];
  periodo: PeriodoHistoricoFiltro | null = null;
  filtroDias: FiltroDiasHistorico | null = null;
  periodoIncompleto = false;
  carregandoHistorico = false;
  modalAberto = false;
  modalVisitaId: string | null = null;
  readonly formatarDataHora = formatarDataHoraVisita;
  readonly rotuloCrm = rotuloCrm;
  readonly rotuloStatus = rotuloStatusVisita;

  ionViewWillEnter(): void {
    const tela = this.rota.snapshot.data['tela'];
    this.aba = tela === 'historico' ? 'historico' : 'carteira';
    void this.carregar();
  }

  get tituloTela(): string {
    return this.aba === 'historico' ? 'Histórico' : 'Visitas';
  }

  ionViewDidEnter(): void {
    this.liberarRolagem();
  }

  podeCriar(): boolean {
    return this.auth.hasPermission('visitas:create');
  }

  aoBuscar(evento: CustomEvent): void {
    this.busca = String(evento.detail?.value ?? '');
    if (this.buscaTimer) {
      clearTimeout(this.buscaTimer);
    }
    this.buscaTimer = setTimeout(() => {
      if (this.aba === 'carteira') {
        void this.carregarMedicos(true);
      }
    }, 350);
  }

  async selecionarFiltroPainel(valor: FiltroPainelVisita): Promise<void> {
    if (
      (valor === 'no_painel' || valor === 'fora_painel') &&
      !this.carteira?.painelDisponivel
    ) {
      return;
    }
    this.filtroPainel =
      valor === 'no_painel' || valor === 'fora_painel' ? valor : 'todos';
    if (this.aba === 'carteira') {
      await this.carregarMedicos(true);
    }
  }

  listaHistorico(): HistoricoVisita[] {
    const termo = this.normalizar(this.busca);
    return this.historico.filter((visita) => {
      if (this.filtroPainel === 'no_painel' && !visita.noPainel) return false;
      if (this.filtroPainel === 'fora_painel' && visita.noPainel) return false;
      if (!termo) return true;
      return this.normalizar(
        `${visita.prescritorNome} ${visita.crm} ${visita.tipoVisitaNome}`,
      ).includes(termo);
    });
  }

  async carregarMais(): Promise<void> {
    if (!this.hasMore || this.carregandoMais || this.carregando) return;
    this.carregandoMais = true;
    try {
      const proxima = this.page + 1;
      const carteira = await firstValueFrom(
        this.visitas.carteira({
          filtroPainel: this.filtroPainel,
          page: proxima,
          limit: this.pageSize,
          busca: this.busca,
        }),
      );
      this.aplicarMeta(carteira);
      this.page = carteira.page;
      this.medicosLista = [...this.medicosLista, ...carteira.medicos];
      if (this.carteira) {
        this.carteira = {
          ...this.carteira,
          ...carteira,
          medicos: this.medicosLista,
        };
      }
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar mais médicos.'),
      );
    } finally {
      this.carregandoMais = false;
    }
  }

  async abrirMedico(medico: MedicoCarteira): Promise<void> {
    const aberta = this.carteira?.visitaAberta;
    if (!medico.podeIniciar || !medico.prescritorId) {
      await this.avisar('Médico inválido para iniciar visita.');
      return;
    }
    if (aberta && aberta.prescritorId === medico.prescritorId) {
      await this.router.navigate(['/visitas', aberta.id]);
      return;
    }
    if (aberta) {
      await this.avisar('Encerre a visita em andamento antes de iniciar outra.');
      return;
    }
    if (!this.podeCriar()) {
      await this.avisar('Você não tem permissão para iniciar visita.');
      return;
    }
    const tipoId = this.carteira?.tipos?.[0]?.id;
    if (!tipoId) {
      await this.avisar('Cadastre um tipo de visita ativo antes de iniciar.');
      return;
    }

    const confirma = await this.confirmarInicio(medico.nome);
    if (!confirma) return;

    await this.loading.show('Obtendo localização…');
    try {
      const coordenada = await this.geo.obter();
      const visita = await firstValueFrom(
        this.visitas.iniciar({
          prescritorId: medico.prescritorId,
          tipoVisitaId: tipoId,
          latitude: coordenada.latitude,
          longitude: coordenada.longitude,
        }),
      );
      await this.router.navigate(['/visitas', visita.id], { replaceUrl: true });
    } catch (error) {
      const mensagem =
        error instanceof Error && !('status' in error)
          ? error.message
          : this.erros.fromApi(error, 'Não foi possível iniciar a visita.');
      await this.avisar(mensagem);
    } finally {
      await this.loading.dismiss();
    }
  }

  private async confirmarInicio(nomeMedico: string): Promise<boolean> {
    const alerta = await this.alertas.create({
      header: 'Iniciar visita',
      message: `Deseja iniciar a visita com ${nomeMedico}?`,
      cssClass: ['visita-alerta', 'visita-alerta--confirmacao'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'visita-alerta-cancelar' },
        { text: 'Confirmar', role: 'confirm', cssClass: 'visita-alerta-ok' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    return role === 'confirm';
  }

  voltar(): void {
    void this.router.navigate(['/home']);
  }

  async aoFiltrarPeriodo(filtro: PeriodoHistoricoFiltro | null): Promise<void> {
    this.periodo = filtro;
    if (
      filtro?.periodo === 'personalizado' &&
      (!filtro.dataInicio || !filtro.dataFim)
    ) {
      this.periodoIncompleto = true;
      this.historico = [];
      return;
    }
    this.periodoIncompleto = false;
    await this.carregarHistorico();
  }

  async aoFiltrarDias(filtro: FiltroDiasHistorico | null): Promise<void> {
    this.filtroDias = filtro;
    if (this.periodoIncompleto) return;
    await this.carregarHistorico();
  }

  verMais(visita: HistoricoVisita): void {
    this.modalVisitaId = visita.id;
    this.modalAberto = true;
  }

  fundoDias(visita: HistoricoVisita): string | null {
    return corPorDias(visita.diasDesdeVisita, this.faixasCor);
  }

  textoDias(visita: HistoricoVisita): string | null {
    const cor = this.fundoDias(visita);
    return cor ? textoSobreCor(cor) : null;
  }

  fecharModal(): void {
    this.modalAberto = false;
    this.modalVisitaId = null;
  }

  async aposExcluirHistorico(): Promise<void> {
    this.fecharModal();
    await this.carregarHistorico();
  }

  async continuarAberta(): Promise<void> {
    const id = this.carteira?.visitaAberta?.id;
    if (!id) return;
    await this.router.navigate(['/visitas', id]);
  }

  private async carregarHistorico(): Promise<void> {
    this.carregandoHistorico = true;
    try {
      this.historico = await firstValueFrom(
        this.visitas.minhas(this.periodo, this.filtroDias),
      );
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar o histórico.'),
      );
    } finally {
      this.carregandoHistorico = false;
    }
  }

  private async carregar(): Promise<void> {
    this.carregando = true;
    try {
      if (this.aba === 'historico') {
        const [historico, faixas] = await Promise.all([
          firstValueFrom(this.visitas.minhas(this.periodo, this.filtroDias)),
          firstValueFrom(this.visitas.coresDias()).catch(
            () => [] as VisitaCorDiaAtiva[],
          ),
        ]);
        this.historico = historico;
        this.faixasCor = faixas;
        // Painel disponível também no histórico (chips No painel / Fora).
        const meta = await firstValueFrom(
          this.visitas.carteira({
            filtroPainel: 'todos',
            page: 1,
            limit: 1,
            busca: '',
          }),
        ).catch(() => null);
        if (meta) {
          this.carteira = {
            ...(this.carteira ?? meta),
            ...meta,
            medicos: this.carteira?.medicos ?? [],
          };
        }
      } else {
        await this.carregarMedicos(true);
      }
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(
          error,
          this.aba === 'historico'
            ? 'Não foi possível carregar o histórico.'
            : 'Não foi possível carregar as visitas.',
        ),
      );
    } finally {
      this.carregando = false;
      setTimeout(() => this.liberarRolagem(), 0);
    }
  }

  /**
   * Depois de encerrar a visita, o ion-content pode ficar com o gesto de rolagem
   * preso. Recria o overflow ao entrar na tela.
   */
  private liberarRolagem(): void {
    const content = this.conteudo;
    if (!content) return;
    void content
      .getScrollElement()
      .then((scroll) => {
        scroll.style.overflowY = 'hidden';
        scroll.style.pointerEvents = 'auto';
        requestAnimationFrame(() => {
          scroll.style.overflowY = '';
          void content.scrollToTop(0);
        });
      })
      .catch(() => undefined);
  }

  private async carregarMedicos(reset: boolean): Promise<void> {
    if (reset) {
      this.page = 1;
      this.medicosLista = [];
    }
    this.carregando = true;
    try {
      const carteira = await firstValueFrom(
        this.visitas.carteira({
          filtroPainel: this.filtroPainel,
          page: this.page,
          limit: this.pageSize,
          busca: this.busca,
        }),
      );
      this.aplicarMeta(carteira);
      this.medicosLista = carteira.medicos;
      this.carteira = {
        ...carteira,
        medicos: this.medicosLista,
      };
      this.filtroPainel = carteira.filtroPainel;
    } finally {
      this.carregando = false;
    }
  }

  private aplicarMeta(carteira: CarteiraVisitas): void {
    this.page = carteira.page;
    this.hasMore = carteira.hasMore;
    this.total = carteira.total;
  }

  private async avisar(mensagem: string): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.tituloTela,
      message: mensagem,
      buttons: ['OK'],
    });
    await alerta.present();
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}
