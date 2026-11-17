import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
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
  NavController,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AppLoadingService } from '../../services/app-loading.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { VisitasService } from '../../services/visitas.service';
import {
  CarteiraVisitas,
  FiltroPainelVisita,
  MedicoCarteira,
  rotuloCrm,
} from '../../models/visita.model';

@Component({
  selector: 'app-trocar-medico',
  standalone: true,
  templateUrl: './trocar.page.html',
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
    IonButton,
  ],
})
export class TrocarMedicoPage {
  private readonly rota = inject(ActivatedRoute);
  private readonly nav = inject(NavController);
  private readonly visitas = inject(VisitasService);
  private readonly alertas = inject(AlertController);
  private readonly loading = inject(AppLoadingService);
  private readonly erros = inject(ErrorMessageService);

  private buscaTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pageSize = 40;
  private trocando = false;

  busca = '';
  filtroPainel: FiltroPainelVisita = 'todos';
  page = 1;
  hasMore = false;
  total = 0;
  medicos: MedicoCarteira[] = [];
  prescritorAtual = '';
  visitaId = '';
  carteira: CarteiraVisitas | null = null;
  carregando = false;
  carregandoMais = false;
  readonly rotuloCrm = rotuloCrm;

  voltar(): void {
    const modoConsulta =
      this.rota.snapshot.queryParamMap.get('modo') === 'consulta';
    if (modoConsulta) {
      void this.nav.navigateBack(['/visitas/agenda']);
      return;
    }
    const origemHistorico =
      this.rota.snapshot.queryParamMap.get('origem') === 'historico';
    if (origemHistorico) {
      void this.nav.navigateBack(['/visitas']);
      return;
    }
    if (this.visitaId) {
      void this.nav.navigateBack(['/visitas', this.visitaId]);
      return;
    }
    void this.nav.navigateBack(['/visitas']);
  }

  ionViewWillEnter(): void {
    this.visitaId = this.rota.snapshot.paramMap.get('id') ?? '';
    void this.iniciar();
  }

  aoBuscar(evento: CustomEvent): void {
    this.busca = String(evento.detail?.value ?? '');
    if (this.buscaTimer) {
      clearTimeout(this.buscaTimer);
    }
    this.buscaTimer = setTimeout(() => {
      void this.carregarMedicos(true);
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
    await this.carregarMedicos(true);
  }

  lista(): MedicoCarteira[] {
    // Troca não exige podeIniciar (permite trocar com visita ABERTA existente).
    return this.medicos.filter(
      (medico) =>
        !!medico.prescritorId && medico.prescritorId !== this.prescritorAtual,
    );
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
      this.medicos = [...this.medicos, ...carteira.medicos];
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar mais médicos.'),
      );
    } finally {
      this.carregandoMais = false;
    }
  }

  async escolher(medico: MedicoCarteira): Promise<void> {
    if (this.trocando) return;
    const visitaId = this.visitaId || this.rota.snapshot.paramMap.get('id');
    if (!visitaId || !medico.prescritorId) return;

    const alerta = await this.alertas.create({
      header: 'Trocar médico',
      message: `Vincular a visita a <strong>${medico.nome}</strong>?`,
      cssClass: ['visita-alerta', 'visita-alerta--confirmacao'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'visita-alerta-cancelar' },
        { text: 'Trocar', role: 'confirm', cssClass: 'visita-alerta-ok' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;

    this.trocando = true;
    await this.loading.show('Trocando médico…');
    try {
      await firstValueFrom(
        this.visitas.atualizar(visitaId, { prescritorId: medico.prescritorId }),
      );
      await this.loading.dismiss();
      const modoConsulta =
        this.rota.snapshot.queryParamMap.get('modo') === 'consulta';
      const origemHistorico =
        this.rota.snapshot.queryParamMap.get('origem') === 'historico';
      if (modoConsulta) {
        await this.nav.navigateRoot(['/visitas/agenda']);
      } else if (origemHistorico) {
        await this.nav.navigateRoot(['/visitas']);
      } else {
        await this.nav.navigateRoot(['/visitas', visitaId], {
          queryParams: { r: String(Date.now()) },
        });
      }
      void this.avisar(`Médico alterado para ${medico.nome}.`, 'sucesso');
    } catch (error) {
      await this.loading.dismiss();
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível trocar o médico.'),
      );
    } finally {
      this.trocando = false;
      await this.loading.dismiss();
    }
  }

  private async iniciar(): Promise<void> {
    if (!this.visitaId) return;
    this.carregando = true;
    try {
      const visita = await firstValueFrom(this.visitas.obter(this.visitaId));
      this.prescritorAtual = visita.prescritorId;
      await this.carregarMedicos(true);
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar os médicos.'),
      );
    } finally {
      this.carregando = false;
    }
  }

  private async carregarMedicos(reset: boolean): Promise<void> {
    if (reset) {
      this.page = 1;
      this.medicos = [];
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
      this.carteira = carteira;
      this.aplicarMeta(carteira);
      this.medicos = carteira.medicos;
      if (!carteira.vinculoOk) {
        await this.avisar(carteira.vinculoMensagem ?? 'Lista indisponível.');
      }
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar os médicos.'),
      );
    } finally {
      this.carregando = false;
    }
  }

  private aplicarMeta(carteira: CarteiraVisitas): void {
    this.hasMore = !!carteira.hasMore;
    this.total = carteira.total ?? 0;
    this.page = carteira.page ?? this.page;
    if (
      !carteira.painelDisponivel &&
      (this.filtroPainel === 'no_painel' || this.filtroPainel === 'fora_painel')
    ) {
      this.filtroPainel = 'todos';
    }
  }

  private async avisar(
    mensagem: string,
    tipo: 'aviso' | 'sucesso' = 'aviso',
  ): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Visita',
      message: mensagem,
      cssClass: ['visita-alerta', `visita-alerta--${tipo}`],
      buttons: [{ text: 'OK', cssClass: 'visita-alerta-ok' }],
    });
    await alerta.present();
    await alerta.onDidDismiss();
  }
}
