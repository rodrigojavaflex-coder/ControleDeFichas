import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { VisitasService } from '../../services/visitas.service';
import {
  VisitaResumo,
  formatarDataHoraVisita,
  rotuloCrm,
  rotuloStatusVisita,
} from '../../models/visita.model';
import { VisitaMidiasComponent } from './visita-midias.component';

@Component({
  selector: 'app-visita-consulta-modal',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonSpinner, VisitaMidiasComponent],
  templateUrl: './visita-consulta-modal.component.html',
  styleUrls: ['./visita-consulta-modal.component.scss'],
})
export class VisitaConsultaModalComponent implements OnChanges {
  @Input() aberto = false;
  @Input() visitaId: string | null = null;
  /** Se true, após trocar médico/excluir volta para agenda. */
  @Input() origemAgenda = false;
  /** Histórico de 12 meses da visita abre só leitura. A aba Histórico libera as ações. */
  @Input() permitirAcoes = true;
  /** Depois de trocar, volta para a lista de visitas em vez da visita. */
  @Input() origemHistorico = false;
  @Output() fechado = new EventEmitter<void>();
  @Output() excluida = new EventEmitter<string>();

  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly erros = inject(ErrorMessageService);
  private readonly alertas = inject(AlertController);
  private readonly router = inject(Router);

  visita: VisitaResumo | null = null;
  carregando = false;
  erro: string | null = null;

  readonly formatarDataHora = formatarDataHoraVisita;
  readonly rotuloCrm = rotuloCrm;
  readonly rotuloStatus = rotuloStatusVisita;

  constructor() {
    addIcons({ closeOutline });
  }

  get podeExcluir(): boolean {
    return (
      this.permitirAcoes &&
      this.auth.hasAnyPermission(['visitas:delete', 'visitas:gerir'])
    );
  }

  get podeTrocarMedico(): boolean {
    return (
      this.permitirAcoes &&
      this.auth.hasAnyPermission(['visitas:update', 'visitas:gerir'])
    );
  }

  ngOnChanges(): void {
    if (this.aberto && this.visitaId) {
      void this.carregar();
    }
    if (!this.aberto) {
      this.visita = null;
      this.erro = null;
    }
  }

  fechar(): void {
    this.fechado.emit();
  }

  async trocarMedico(): Promise<void> {
    if (!this.visita || !this.podeTrocarMedico) return;
    this.fechar();
    await this.router.navigate(['/visitas/trocar', this.visita.id], {
      queryParams: this.origemAgenda
        ? { modo: 'consulta' }
        : this.origemHistorico
          ? { origem: 'historico' }
          : undefined,
    });
  }

  async excluir(): Promise<void> {
    if (!this.visita || !this.podeExcluir) return;
    const alerta = await this.alertas.create({
      header: 'Excluir visita',
      message: 'Deseja Remover a visita atual?',
      cssClass: ['visita-alerta', 'visita-alerta--confirmacao'],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm' || !this.visita) return;
    const id = this.visita.id;
    try {
      await firstValueFrom(this.visitas.excluir(id));
      this.excluida.emit(id);
      this.fechar();
    } catch (error) {
      const falha = await this.alertas.create({
        header: 'Visita',
        message: this.erros.fromApi(error, 'Não foi possível excluir a visita.'),
        buttons: ['OK'],
      });
      await falha.present();
    }
  }

  private async carregar(): Promise<void> {
    if (!this.visitaId) return;
    this.carregando = true;
    this.erro = null;
    this.visita = null;
    try {
      this.visita = await firstValueFrom(this.visitas.obter(this.visitaId));
    } catch (error) {
      this.erro = this.erros.fromApi(
        error,
        'Não foi possível carregar a visita.',
      );
    } finally {
      this.carregando = false;
    }
  }
}
