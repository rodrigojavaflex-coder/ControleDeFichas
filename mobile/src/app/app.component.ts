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
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline,
  informationCircleOutline,
  keyOutline,
  logOutOutline,
  settingsOutline,
} from 'ionicons/icons';
import { AuthService } from './services/auth.service';
import { AppUpdateRequiredService } from './services/app-update-required.service';
import { MobileVersionCheckService } from './services/mobile-version-check.service';
import { Perfil, Usuario } from './models/usuario.model';

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

  readonly updateRequired = this.appUpdateRequired.required;
  readonly updateMessage = this.appUpdateRequired.message;
  readonly updateVersaoMinima = this.appUpdateRequired.versaoMinima;
  readonly updateVersaoApp = this.appUpdateRequired.versaoApp;

  user: Usuario | null = null;
  isAuthenticated = false;
  isNative = Capacitor.getPlatform() !== 'web';

  get profileNames(): string[] {
    return this.getUserProfiles()
      .map((perfil) => perfil.nomePerfil?.trim() ?? '')
      .filter((nome) => nome.length > 0);
  }

  get userAtivo(): boolean {
    if (!this.user) {
      return false;
    }
    if (typeof this.user.ativo === 'boolean') {
      return this.user.ativo;
    }
    return (this.user.status ?? '').toUpperCase() === 'ATIVO';
  }

  constructor() {
    addIcons({
      logOutOutline,
      settingsOutline,
      informationCircleOutline,
      keyOutline,
      cloudDownloadOutline,
    });

    this.authService.currentUser$.subscribe((user) => {
      this.user = user;
    });

    this.isAuthenticated = this.authService.isAuthenticated();

    this.authService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
    });

    void this.configureSystemBars();
    this.mobileVersionCheck.checkAgainstServer().subscribe();
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
    await this.router.navigate([route]);
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

  private getUserProfiles(): Perfil[] {
    if (!this.user) {
      return [];
    }
    if (Array.isArray(this.user.perfis) && this.user.perfis.length > 0) {
      return this.user.perfis;
    }
    if (this.user.perfil) {
      return [this.user.perfil];
    }
    return [];
  }
}
