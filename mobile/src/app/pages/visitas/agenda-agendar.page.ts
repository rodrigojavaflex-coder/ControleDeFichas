import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonTextarea,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { PendenciasAlertaService } from '../../services/pendencias-alerta.service';
import { VisitasService } from '../../services/visitas.service';
import {
  MedicoPendenciaOpcao,
  rotuloCrm,
} from '../../models/visita.model';
import { BuscaMedicoComponent } from './busca-medico.component';

@Component({
  selector: 'app-agenda-agendar',
  standalone: true,
  templateUrl: './agenda-agendar.page.html',
  styleUrls: ['./agenda-agendar.page.scss'],
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
    IonInput,
    IonTextarea,
    BuscaMedicoComponent,
  ],
})
export class AgendaAgendarPage {
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly rota = inject(ActivatedRoute);
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly erros = inject(ErrorMessageService);
  private readonly alertCtrl = inject(AlertController);
  private readonly alertas = inject(PendenciasAlertaService);

  agendamentoId: string | null = null;
  dataSelecionada = '';
  formHora = '';
  formObs = '';
  formMedico: MedicoPendenciaOpcao | null = null;
  formMedicoTravado = false;
  salvando = false;
  formErro: string | null = null;
  avisoData: string | null = null;
  avisoDataFeriado = false;

  readonly rotuloCrm = rotuloCrm;

  get editando(): boolean {
    return !!this.agendamentoId;
  }

  get dataMinima(): string {
    const hoje = this.hojeYmd();
    if (
      this.editando &&
      this.dataSelecionada &&
      this.dataSelecionada < hoje
    ) {
      return this.dataSelecionada;
    }
    return hoje;
  }

  get podeSalvar(): boolean {
    if (this.editando) {
      return this.auth.hasPermission('visitas-agenda:update');
    }
    return this.auth.hasPermission('visitas-agenda:create');
  }

  ionViewWillEnter(): void {
    const podeAbrir =
      this.auth.hasPermission('visitas-agenda:create') ||
      this.auth.hasPermission('visitas-agenda:update');
    if (!podeAbrir) {
      void this.router.navigate(['/visitas/agenda'], { replaceUrl: true });
      return;
    }
    this.aplicarQueryInicial();
    void this.atualizarAvisoData();
  }

  onMedicoChange(medico: MedicoPendenciaOpcao | null): void {
    if (this.formMedicoTravado) return;
    this.formMedico = medico;
  }

  async aoAlterarData(): Promise<void> {
    this.formErro = null;
    await this.atualizarAvisoData();
  }

  aoDigitarHora(evento: CustomEvent): void {
    const bruto = String(
      (evento.detail as { value?: string | null } | undefined)?.value ?? '',
    );
    const digitos = bruto.replace(/\D/g, '').slice(0, 4);
    this.formHora =
      digitos.length <= 2
        ? digitos
        : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
  }

  async salvar(): Promise<void> {
    if (!this.podeSalvar) {
      this.formErro = this.editando
        ? 'Sem permissão para alterar agendamento.'
        : 'Sem permissão para criar agendamento.';
      return;
    }
    if (!this.formMedico) {
      this.formErro = 'Selecione o médico.';
      return;
    }
    const data = this.dataSelecionada.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < this.hojeYmd()) {
      this.formErro = 'Informe uma data válida (hoje ou futura).';
      return;
    }
    const hora = this.formHora.trim();
    if (!hora || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hora)) {
      this.formErro = 'Informe a hora no formato HH:mm (ex.: 14:30).';
      return;
    }

    try {
      const checagem = await firstValueFrom(
        this.visitas.checarDataAgendamento(data),
      );
      if (checagem.requerAviso) {
        const ok = await this.confirmar(
          'Atenção',
          checagem.mensagemAviso ||
            'A data cai em fim de semana ou feriado. Deseja agendar mesmo assim?',
        );
        if (!ok) return;
      }
    } catch {
      // segue
    }

    this.salvando = true;
    this.formErro = null;
    try {
      if (this.agendamentoId) {
        await firstValueFrom(
          this.visitas.atualizarAgendamento(this.agendamentoId, {
            prescritorId: this.formMedico.id,
            data,
            hora,
            observacao: this.formObs.trim() || null,
          }),
        );
        void this.alertas.atualizar();
        await this.avisar('Agendamento atualizado.');
      } else {
        await firstValueFrom(
          this.visitas.criarAgendamento({
            prescritorId: this.formMedico.id,
            data,
            hora,
            observacao: this.formObs.trim() || null,
          }),
        );
        void this.alertas.atualizar();
        await this.avisar('Agendamento criado.');
      }
      // navigateRoot evita stack Ionic quebrada após alert + replaceUrl.
      await this.nav.navigateRoot(['/visitas/agenda'], {
        queryParams: { data },
        animated: false,
      });
    } catch (error) {
      this.formErro = this.erros.fromApi(
        error,
        this.editando
          ? 'Não foi possível atualizar o agendamento.'
          : 'Não foi possível criar o agendamento.',
      );
    } finally {
      this.salvando = false;
    }
  }

  voltar(): void {
    void this.nav.navigateRoot(['/visitas/agenda'], { animated: true });
  }

  private aplicarQueryInicial(): void {
    const q = this.rota.snapshot.queryParamMap;
    this.agendamentoId = q.get('id');

    const data = q.get('data');
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
      this.dataSelecionada = data;
    } else if (!this.dataSelecionada) {
      this.dataSelecionada = this.hojeYmd();
    }

    const hora = q.get('hora');
    if (hora && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hora)) {
      this.formHora = hora;
    } else if (!this.formHora) {
      const agora = new Date();
      this.formHora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    }

    const obs = q.get('observacao');
    if (obs != null) {
      this.formObs = obs;
    }

    const prescritorId = q.get('prescritorId');
    if (prescritorId) {
      this.formMedico = {
        id: prescritorId,
        nome: q.get('nome') || 'Médico',
        crm: q.get('crm') || '',
        uf: q.get('uf') || '',
      };
      // Travado só no fluxo pós-encerrar (novo agendamento com médico pré-preenchido).
      this.formMedicoTravado = !this.agendamentoId;
    } else {
      this.formMedicoTravado = false;
    }
  }

  private async atualizarAvisoData(): Promise<void> {
    this.avisoData = null;
    this.avisoDataFeriado = false;
    const data = this.dataSelecionada.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    try {
      const checagem = await firstValueFrom(
        this.visitas.checarDataAgendamento(data),
      );
      if (checagem.feriado) {
        this.avisoDataFeriado = true;
        this.avisoData = checagem.descricaoFeriado
          ? `Feriado: ${checagem.descricaoFeriado}`
          : 'Feriado';
      } else if (checagem.fimDeSemana) {
        this.avisoData = 'Fim de semana';
      }
    } catch {
      // silencioso
    }
  }

  private hojeYmd(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const ano = partes.find((p) => p.type === 'year')?.value ?? '2026';
    const mes = partes.find((p) => p.type === 'month')?.value ?? '01';
    const dia = partes.find((p) => p.type === 'day')?.value ?? '01';
    return `${ano}-${mes}-${dia}`;
  }

  private async avisar(mensagem: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.editando ? 'Editar agendamento' : 'Agendar visita',
      message: mensagem,
      buttons: ['OK'],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  private async confirmar(titulo: string, mensagem: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: titulo,
      message: mensagem,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Agendar mesmo assim', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}
