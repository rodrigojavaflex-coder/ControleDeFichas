import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { PendenciasAlertaService } from '../../services/pendencias-alerta.service';
import {
  AgendaAgendamentoItem,
  VisitasService,
} from '../../services/visitas.service';
import {
  MedicoPendenciaOpcao,
  rotuloCrm,
} from '../../models/visita.model';
import { BuscaMedicoComponent } from './busca-medico.component';

@Component({
  selector: 'app-agenda-consultar',
  standalone: true,
  templateUrl: './agenda-consultar.page.html',
  styleUrls: ['./agenda-consultar.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    BuscaMedicoComponent,
  ],
})
export class AgendaConsultarPage {
  private readonly router = inject(Router);
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly erros = inject(ErrorMessageService);
  private readonly alertCtrl = inject(AlertController);
  private readonly alertas = inject(PendenciasAlertaService);
  @ViewChild('conteudo') private conteudo?: IonContent;

  consultaMedico: MedicoPendenciaOpcao | null = null;
  consultaLista: AgendaAgendamentoItem[] = [];
  consultaCarregando = false;
  consultaErro: string | null = null;

  readonly rotuloCrm = rotuloCrm;

  constructor() {
    addIcons({ trashOutline });
  }

  get podeAbrirAgendamento(): boolean {
    return (
      this.auth.hasPermission('visitas-agenda:create') ||
      this.auth.hasPermission('visitas-agenda:update')
    );
  }

  get podeExcluirAgendamento(): boolean {
    return this.auth.hasPermission('visitas-agenda:delete');
  }

  ionViewWillEnter(): void {
    if (!this.auth.hasPermission('visitas-agenda:read')) {
      void this.router.navigate(['/visitas/agenda'], { replaceUrl: true });
      return;
    }
    void this.carregarConsulta();
  }

  ionViewDidEnter(): void {
    this.liberarRolagem();
  }

  async onConsultaMedicoChange(
    medico: MedicoPendenciaOpcao | null,
  ): Promise<void> {
    this.consultaMedico = medico;
    await this.carregarConsulta();
  }

  abrirAgendamento(item: AgendaAgendamentoItem): void {
    if (!this.podeAbrirAgendamento) return;
    void this.router.navigate(['/visitas/agenda/agendar'], {
      queryParams: {
        id: item.id,
        prescritorId: item.prescritorId,
        nome: item.prescritorNome,
        crm: item.crm,
        uf: item.uf,
        data: item.data,
        hora: item.hora || '',
        observacao: item.observacao || '',
      },
    });
  }

  async confirmarExcluir(item: AgendaAgendamentoItem): Promise<void> {
    if (!this.podeExcluirAgendamento) return;
    const alert = await this.alertCtrl.create({
      header: 'Excluir agendamento',
      message: `Remover visita agendada em ${item.data.slice(8, 10)}/${item.data.slice(5, 7)}/${item.data.slice(0, 4)}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;
    await this.excluir(item.id);
  }

  voltar(): void {
    void this.router.navigate(['/visitas/agenda']);
  }

  private async carregarConsulta(): Promise<void> {
    this.consultaCarregando = true;
    this.consultaErro = null;
    try {
      this.consultaLista = await firstValueFrom(
        this.visitas.listarAgendamentos({
          prescritorId: this.consultaMedico?.id,
        }),
      );
    } catch (error) {
      this.consultaLista = [];
      this.consultaErro = this.erros.fromApi(
        error,
        'Não foi possível consultar os agendamentos.',
      );
    } finally {
      this.consultaCarregando = false;
      setTimeout(() => this.liberarRolagem(), 0);
    }
  }

  /** Evita ion-content “preso” após teclado/foco, que bloqueia toque nos filtros. */
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
        });
      })
      .catch(() => undefined);
  }

  private async excluir(id: string): Promise<void> {
    try {
      await firstValueFrom(this.visitas.excluirAgendamento(id));
      this.consultaLista = this.consultaLista.filter((item) => item.id !== id);
      void this.alertas.atualizar();
      await this.carregarConsulta();
    } catch (error) {
      const alerta = await this.alertCtrl.create({
        header: 'Consultar agendamentos',
        message: this.erros.fromApi(
          error,
          'Não foi possível excluir o agendamento.',
        ),
        buttons: ['OK'],
      });
      await alerta.present();
    }
  }
}
