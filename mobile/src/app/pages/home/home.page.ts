import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonMenuButton,
  IonButtons,
  IonIcon,
  Platform,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { PendenciasAlertaService } from '../../services/pendencias-alerta.service';
import { VisitacaoAcompanhamentoService } from '../../services/visitacao-acompanhamento.service';
import { Usuario } from '../../models/usuario.model';
import {
  VisitacaoAcompanhamentoMeuCard,
  VisitacaoAcompanhamentoMeuHome,
} from '../../models/visitacao-acompanhamento-home.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    NgIf,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonMenuButton,
    IonButtons,
    IonIcon,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private platform = inject(Platform);
  private readonly visitacaoAcomp = inject(VisitacaoAcompanhamentoService);
  private readonly pendenciasAlerta = inject(PendenciasAlertaService);
  private backButtonSub?: Subscription;
  private exitPromptOpen = false;
  private alertaSub?: Subscription;

  user: Usuario | null = null;
  isNative = Capacitor.getPlatform() !== 'web';
  totalAlertas = 0;
  pendenciasAbertas = 0;
  pendenciasAConcluir = 0;
  agendamentosProximos = 0;
  notificacoesAbertas = false;

  carregandoAcomp = false;
  acomp: VisitacaoAcompanhamentoMeuHome | null = null;
  erroAcomp: string | null = null;

  constructor() {
    addIcons({
      personOutline,
      refreshOutline,
    });
  }

  get podeVerAgenda(): boolean {
    return this.authService.hasPermission('visitas-agenda:read');
  }

  get podeVerPendencias(): boolean {
    return this.authService.hasAnyPermission([
      'pendencias:read',
      'pendencias:create',
    ]);
  }

  podeCarregarAcompanhamento(): boolean {
    return this.authService.hasAnyPermission([
      'visitacao-acompanhamento:read',
      'visitas:read',
    ]);
  }

  /** Só exibe título/bloco quando há representante e dados. */
  get mostrarAcompanhamento(): boolean {
    return !!this.card && !!this.acomp?.disponivel;
  }

  get card(): VisitacaoAcompanhamentoMeuCard | null {
    return this.acomp?.disponivel ? this.acomp.card ?? null : null;
  }

  async ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.alertaSub = this.pendenciasAlerta.resumo$.subscribe((resumo) => {
      this.totalAlertas = resumo.total;
      this.pendenciasAbertas = resumo.pendenciasAbertas;
      this.pendenciasAConcluir = resumo.pendenciasAConcluir;
      this.agendamentosProximos = resumo.agendamentosProximos;
    });
  }

  ionViewWillEnter(): void {
    this.registrarBotaoVoltarDispositivo();
    void this.pendenciasAlerta.atualizar();
    if (this.podeCarregarAcompanhamento()) {
      void this.carregarAcompanhamento();
    } else {
      this.acomp = null;
    }
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = undefined;
  }

  ngOnDestroy(): void {
    this.backButtonSub?.unsubscribe();
    this.alertaSub?.unsubscribe();
  }

  alternarNotificacoes(): void {
    this.notificacoesAbertas = !this.notificacoesAbertas;
  }

  async abrirAgenda(): Promise<void> {
    await this.router.navigate(['/visitas/agenda']);
  }

  async abrirPendencias(situacao: 'ABERTA' | 'RESOLVIDA'): Promise<void> {
    await this.router.navigate(['/pendencias'], {
      queryParams: { situacao },
    });
  }

  async carregarAcompanhamento(): Promise<void> {
    if (!this.podeCarregarAcompanhamento()) {
      this.acomp = null;
      return;
    }
    this.carregandoAcomp = true;
    this.erroAcomp = null;
    try {
      this.acomp = await firstValueFrom(this.visitacaoAcomp.meu());
    } catch {
      this.acomp = null;
      this.erroAcomp = 'Não foi possível carregar o acompanhamento.';
    } finally {
      this.carregandoAcomp = false;
    }
  }

  formatarMoeda(valor: number | null | undefined): string {
    const n = Number(valor);
    if (!Number.isFinite(n)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(n);
  }

  formatarDataCaixa(iso: string | null | undefined): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  formatarDias(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(valor)) return '—';
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  formatarPct(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(valor)) return '—';
    return `${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  private registrarBotaoVoltarDispositivo(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, () => {
      void this.confirmarSaidaDoSistema();
    });
  }

  private async confirmarSaidaDoSistema(): Promise<void> {
    if (this.exitPromptOpen) {
      return;
    }

    this.exitPromptOpen = true;
    const alert = await this.alertController.create({
      header: 'Sair do sistema',
      message: 'Deseja realmente sair?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sair', role: 'confirm' },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    this.exitPromptOpen = false;

    if (role !== 'confirm') {
      return;
    }

    await this.authService.logout();
  }

}
