import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonMenuButton,
  IonButtons,
  Platform,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { Perfil, Usuario } from '../../models/usuario.model';

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
    IonButtons
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private platform = inject(Platform);
  private backButtonSub?: Subscription;
  private exitPromptOpen = false;

  user: Usuario | null = null;
  isNative = Capacitor.getPlatform() !== 'web';

  async ngOnInit() {
    this.user = this.authService.getCurrentUser();
  }

  ionViewWillEnter(): void {
    this.registrarBotaoVoltarDispositivo();
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = undefined;
  }

  ngOnDestroy(): void {
    this.backButtonSub?.unsubscribe();
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
