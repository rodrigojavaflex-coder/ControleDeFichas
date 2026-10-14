import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import {
  APP_BUILD,
  APP_VERSION,
  APP_VERSION_DATE,
} from '../../constants/app-version';

@Component({
  selector: 'app-sobre',
  standalone: true,
  templateUrl: './sobre.page.html',
  styleUrls: ['./sobre.page.scss'],
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
  ],
})
export class SobrePage implements OnInit {
  private router = inject(Router);

  readonly appName = signal('App Farma +');
  readonly appVersion = signal(APP_VERSION);
  readonly buildVersion = signal(APP_BUILD);
  readonly versaoDataExibicao = computed(() => {
    const [ano, mes, dia] = APP_VERSION_DATE.split('-');
    return `${dia}/${mes}/${ano}`;
  });
  readonly inicialApp = computed(() => {
    const nome = this.appName().trim();
    return nome ? nome.charAt(0).toUpperCase() : 'O';
  });

  async ngOnInit(): Promise<void> {
    try {
      const info = await App.getInfo();
      this.appName.set(info.name || this.appName());
    } catch {
      this.appName.set('App Farma +');
    }
    this.appVersion.set(APP_VERSION);
    this.buildVersion.set(APP_BUILD);
  }

  voltar(): void {
    this.router.navigate(['/home']);
  }
}
