import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  chevronForwardOutline,
  fingerPrintOutline,
  keyOutline,
  settingsOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  templateUrl: './configuracoes.page.html',
  styleUrls: ['./configuracoes.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonButton,
    IonContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonToggle,
  ],
})
export class ConfiguracoesPage implements OnInit {
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private router = inject(Router);

  biometricAvailable = false;
  biometricEnabled = false;
  biometricSaving = false;

  constructor() {
    addIcons({
      settingsOutline,
      fingerPrintOutline,
      keyOutline,
      chevronForwardOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.refreshBiometricState();
  }

  voltar(): void {
    this.router.navigate(['/home']);
  }

  irParaAlterarSenha(): void {
    void this.router.navigate(['/alterar-senha']);
  }

  async onBiometricToggle(event: CustomEvent): Promise<void> {
    if (this.biometricSaving) {
      return;
    }

    const shouldEnable = Boolean(event.detail?.checked);
    if (!shouldEnable) {
      this.biometricSaving = true;
      await this.authService.disableBiometricLogin();
      this.biometricEnabled = false;
      this.biometricSaving = false;
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user?.email) {
      this.biometricEnabled = false;
      await this.presentToast('Não foi possível identificar o usuário atual.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Ativar login por digital',
      message: 'Confirme sua senha para habilitar o login por biometria.',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Senha',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Ativar',
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    const password = data?.values?.password?.trim();
    if (role !== 'confirm' || !password) {
      this.biometricEnabled = false;
      return;
    }

    this.biometricSaving = true;
    const enabled = await this.authService.enableBiometricLogin(user.email, password);
    this.biometricEnabled = enabled;
    this.biometricSaving = false;

    if (!enabled) {
      await this.presentToast('Não foi possível ativar o login por biometria.');
    }
  }

  private async refreshBiometricState(): Promise<void> {
    this.biometricAvailable = await this.authService.isBiometricAvailable();
    this.biometricEnabled = await this.authService.isBiometricEnabled();
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color: 'danger',
      position: 'top',
    });
    await toast.present();
  }
}
