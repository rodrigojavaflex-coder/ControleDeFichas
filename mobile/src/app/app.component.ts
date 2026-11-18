import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonApp,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  clipboardOutline,
  cloudDownloadOutline,
  homeOutline,
  informationCircleOutline,
  keyOutline,
  logOutOutline,
  peopleOutline,
  settingsOutline,
  timeOutline,
} from 'ionicons/icons';
import { AuthService } from './services/auth.service';
import { AppUpdateRequiredService } from './services/app-update-required.service';
import { MobileVersionCheckService } from './services/mobile-version-check.service';
import { PendenciasAlertaService } from './services/pendencias-alerta.service';
import { Usuario } from './models/usuario.model';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  styleUrls: ['app.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    IonApp,
    IonRouterOutlet,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonMenu,
    IonSplitPane,
    IonButton,
    IonIcon,
  ],
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private menuController = inject(MenuController);
  private appUpdateRequired = inject(AppUpdateRequiredService);
  private mobileVersionCheck = inject(MobileVersionCheckService);
  private pendenciasAlerta = inject(PendenciasAlertaService);

  readonly updateRequired = this.appUpdateRequired.required;
  readonly updateMessage = this.appUpdateRequired.message;
  readonly updateVersaoMinima = this.appUpdateRequired.versaoMinima;
  readonly updateVersaoApp = this.appUpdateRequired.versaoApp;

  user: Usuario | null = null;
  isAuthenticated = false;
  isNative = Capacitor.getPlatform() !== 'web';
  totalAlertas = 0;
  pendenciasAbertas = 0;
  pendenciasAConcluir = 0;
  agendamentosProximos = 0;
  notificacoesAbertas = false;

  get badgePendenciasMenu(): number {
    return this.pendenciasAbertas + this.pendenciasAConcluir;
  }

  constructor() {
    addIcons({
      logOutOutline,
      settingsOutline,
      informationCircleOutline,
      keyOutline,
      cloudDownloadOutline,
      peopleOutline,
      homeOutline,
      calendarOutline,
      clipboardOutline,
      timeOutline,
    });

    this.authService.currentUser$.subscribe((user) => {
      this.user = user;
    });

    this.isAuthenticated = this.authService.isAuthenticated();

    this.authService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
      if (isAuthenticated) {
        void this.pendenciasAlerta.atualizar();
      }
    });

    this.pendenciasAlerta.resumo$.subscribe((resumo) => {
      this.totalAlertas = resumo.total;
      this.pendenciasAbertas = resumo.pendenciasAbertas;
      this.pendenciasAConcluir = resumo.pendenciasAConcluir;
      this.agendamentosProximos = resumo.agendamentosProximos;
    });

    void this.configureSystemBars();
    this.mobileVersionCheck.checkAgainstServer().subscribe();
  }

  alternarNotificacoes(): void {
    this.notificacoesAbertas = !this.notificacoesAbertas;
  }

  async abrirNotificacaoAgenda(): Promise<void> {
    await this.menuController.close();
    await this.router.navigate(['/visitas/agenda']);
  }

  async abrirNotificacaoPendencias(
    situacao: 'ABERTA' | 'RESOLVIDA',
  ): Promise<void> {
    await this.menuController.close();
    await this.router.navigate(['/pendencias'], {
      queryParams: { situacao },
    });
  }

  podeVisitas(): boolean {
    return this.authService.hasPermission('visitas:read');
  }

  podeVisitasAgenda(): boolean {
    return this.authService.hasPermission('visitas-agenda:read');
  }

  podePendencias(): boolean {
    return this.authService.hasAnyPermission(['pendencias:read', 'pendencias:create']);
  }

  fecharMenu(): void {
    void this.menuController.close();
  }

  private async configureSystemBars(): Promise<void> {
    if (!this.isNative) {
      return;
    }

    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
  }

  async goTo(route: string): Promise<void> {
    await this.menuController.close();
    await this.router.navigate([route], { queryParams: {} });
  }

  async logout(): Promise<void> {
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
    if (role !== 'confirm') {
      return;
    }

    await this.authService.logout();
  }

}
