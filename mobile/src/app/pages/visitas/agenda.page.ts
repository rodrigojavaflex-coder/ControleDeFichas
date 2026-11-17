import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
import {
  calendarOutline,
  chevronBackOutline,
  chevronForwardOutline,
  todayOutline,
  trashOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { PendenciasAlertaService } from '../../services/pendencias-alerta.service';
import {
  AgendaAgendamentoItem,
  VisitasService,
} from '../../services/visitas.service';
import {
  StatusVisita,
  formatarDataHoraVisita,
  rotuloCrm,
  rotuloStatusVisita,
} from '../../models/visita.model';
import { VisitaConsultaModalComponent } from './visita-consulta-modal.component';

interface CelulaAgenda {
  data: string | null;
  diaNumero: number | null;
  foraMes: boolean;
  hoje: boolean;
  feriado: boolean;
  feriadoDescricao: string | null;
  fimDeSemana: boolean;
  quantidadeVisitas: number;
  quantidadeAgendamentos: number;
}

interface VisitaAgendaItem {
  id: string;
  prescritorNome: string;
  crm: string;
  uf: string;
  tipoVisitaNome: string;
  status: StatusVisita;
  dataHoraInicio: string;
  dataHoraFim: string | null;
}

@Component({
  selector: 'app-visitas-agenda',
  standalone: true,
  templateUrl: './agenda.page.html',
  styleUrls: ['./agenda.page.scss'],
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
    VisitaConsultaModalComponent,
  ],
})
export class AgendaVisitasPage {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly erros = inject(ErrorMessageService);
  private readonly alertCtrl = inject(AlertController);
  private readonly alertas = inject(PendenciasAlertaService);
  private readonly cdr = inject(ChangeDetectorRef);

  ano = 0;
  mes = 0;
  carregando = false;
  erro: string | null = null;
  celulas: CelulaAgenda[] = [];
  sabadoDiaUtil = false;
  private feriadosPorDia = new Map<string, string | null>();
  private visitasPorDia = new Map<string, VisitaAgendaItem[]>();
  private agendamentosPorDia = new Map<string, AgendaAgendamentoItem[]>();
  private cargaSeq = 0;

  diaSelecionado: string | null = null;
  listaDia: VisitaAgendaItem[] = [];
  listaAgendamentosDia: AgendaAgendamentoItem[] = [];
  modalAberto = false;
  modalVisitaId: string | null = null;

  readonly semanas = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  readonly formatarDataHora = formatarDataHoraVisita;
  readonly rotuloCrm = rotuloCrm;
  readonly rotuloStatus = rotuloStatusVisita;

  constructor() {
    addIcons({
      calendarOutline,
      chevronBackOutline,
      chevronForwardOutline,
      todayOutline,
      trashOutline,
    });
    const atual = this.competenciaAtual();
    const [a, m] = atual.split('-').map(Number);
    this.ano = a;
    this.mes = m;
  }

  get rotuloMes(): string {
    const nome = new Date(this.ano, this.mes - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }

  get podeAvancarMes(): boolean {
    const [ay, am] = this.competenciaAtual().split('-').map(Number);
    let limY = ay;
    let limM = am + 12;
    while (limM > 12) {
      limM -= 12;
      limY += 1;
    }
    return this.ano * 12 + this.mes < limY * 12 + limM;
  }

  get podeCriarAgendamento(): boolean {
    return this.auth.hasPermission('visitas-agenda:create');
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
      void this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }
    this.aplicarQueryRetorno();
    void this.carregar();
  }

  async mesAnterior(): Promise<void> {
    if (this.carregando) return;
    if (this.mes === 1) {
      this.mes = 12;
      this.ano -= 1;
    } else {
      this.mes -= 1;
    }
    this.diaSelecionado = null;
    await this.carregar();
  }

  async mesProximo(): Promise<void> {
    if (this.carregando || !this.podeAvancarMes) return;
    if (this.mes === 12) {
      this.mes = 1;
      this.ano += 1;
    } else {
      this.mes += 1;
    }
    this.diaSelecionado = null;
    await this.carregar();
  }

  async irHoje(): Promise<void> {
    if (this.carregando) return;
    const [a, m] = this.competenciaAtual().split('-').map(Number);
    this.ano = a;
    this.mes = m;
    this.diaSelecionado = this.hojeYmd();
    await this.carregar();
  }

  selecionarDia(celula: CelulaAgenda): void {
    if (!celula.data || celula.foraMes) return;
    this.diaSelecionado = celula.data;
    this.atualizarListasDia();
  }

  abrirVisita(id: string): void {
    this.modalVisitaId = id;
    this.modalAberto = true;
  }

  fecharModal(): void {
    this.modalAberto = false;
    this.modalVisitaId = null;
  }

  async aposExcluirVisita(): Promise<void> {
    this.fecharModal();
    await this.carregar();
  }

  async confirmarExcluirAgendamento(item: AgendaAgendamentoItem): Promise<void> {
    if (!this.podeExcluirAgendamento) return;
    const alert = await this.alertCtrl.create({
      header: 'Excluir agendamento',
      message: `Remover visita agendada com ${item.prescritorNome}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;
    await this.excluirAgendamento(item.id);
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

  irAgendar(): void {
    const params: Record<string, string> = {};
    if (this.diaSelecionado && this.diaSelecionado >= this.hojeYmd()) {
      params['data'] = this.diaSelecionado;
    }
    void this.router.navigate(['/visitas/agenda/agendar'], {
      queryParams: params,
    });
  }

  irConsultar(): void {
    void this.router.navigate(['/visitas/agenda/consultar']);
  }

  voltar(): void {
    void this.router.navigate(['/home']);
  }

  private async excluirAgendamento(id: string): Promise<void> {
    try {
      await firstValueFrom(this.visitas.excluirAgendamento(id));
      this.removerAgendamentoLocal(id);
      void this.alertas.atualizar();
      await this.carregar();
      this.cdr.detectChanges();
    } catch (error) {
      const alert = await this.alertCtrl.create({
        header: 'Agenda',
        message: this.erros.fromApi(
          error,
          'Não foi possível excluir o agendamento.',
        ),
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  /** Remove da grade/lista do dia antes do reload (feedback imediato). */
  private removerAgendamentoLocal(id: string): void {
    for (const [data, lista] of [...this.agendamentosPorDia.entries()]) {
      const filtrada = lista.filter((item) => item.id !== id);
      if (filtrada.length !== lista.length) {
        this.agendamentosPorDia.set(data, filtrada);
      }
    }
    this.listaAgendamentosDia = this.listaAgendamentosDia.filter(
      (item) => item.id !== id,
    );
    this.montarGrade();
    this.atualizarListasDia();
  }

  /** Após salvar agendamento: posiciona mês/dia da query `?data=`. */
  private aplicarQueryRetorno(): void {
    const data = this.rota.snapshot.queryParamMap.get('data');
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    const [a, m] = data.split('-').map(Number);
    if (!Number.isFinite(a) || m < 1 || m > 12) return;
    this.ano = a;
    this.mes = m;
    this.diaSelecionado = data;
  }

  private async carregar(): Promise<void> {
    const seq = ++this.cargaSeq;
    const ano = this.ano;
    const mes = this.mes;
    if (!Number.isFinite(ano) || ano < 2000 || mes < 1 || mes > 12) {
      const [a, m] = this.competenciaAtual().split('-').map(Number);
      this.ano = a;
      this.mes = m;
    }
    this.carregando = true;
    this.erro = null;
    try {
      const resp = await firstValueFrom(
        this.visitas.agendaMes(this.ano, this.mes),
      );
      if (seq !== this.cargaSeq) return;
      this.sabadoDiaUtil = !!resp.sabadoDiaUtil;
      this.feriadosPorDia.clear();
      for (const f of resp.feriados ?? []) {
        this.feriadosPorDia.set(f.data, f.descricao);
      }
      this.visitasPorDia.clear();
      this.agendamentosPorDia.clear();
      for (const dia of resp.dias) {
        this.visitasPorDia.set(dia.data, dia.visitas);
        this.agendamentosPorDia.set(dia.data, dia.agendamentos ?? []);
      }
      this.montarGrade();
      this.atualizarListasDia();
    } catch (error) {
      if (seq !== this.cargaSeq) return;
      this.erro = this.erros.fromApi(
        error,
        'Não foi possível carregar a agenda.',
      );
      this.celulas = [];
    } finally {
      if (seq === this.cargaSeq) {
        this.carregando = false;
      }
    }
  }

  private atualizarListasDia(): void {
    if (!this.diaSelecionado) {
      this.listaDia = [];
      this.listaAgendamentosDia = [];
      return;
    }
    this.listaDia = this.visitasPorDia.get(this.diaSelecionado) ?? [];
    this.listaAgendamentosDia =
      this.agendamentosPorDia.get(this.diaSelecionado) ?? [];
  }

  private montarGrade(): void {
    const primeiro = new Date(this.ano, this.mes - 1, 1);
    const inicioSemana = primeiro.getDay();
    const diasNoMes = new Date(this.ano, this.mes, 0).getDate();
    const hoje = this.hojeYmd();
    const celulas: CelulaAgenda[] = [];

    const vazia = (): CelulaAgenda => ({
      data: null,
      diaNumero: null,
      foraMes: true,
      hoje: false,
      feriado: false,
      feriadoDescricao: null,
      fimDeSemana: false,
      quantidadeVisitas: 0,
      quantidadeAgendamentos: 0,
    });

    for (let i = 0; i < inicioSemana; i++) celulas.push(vazia());

    for (let d = 1; d <= diasNoMes; d++) {
      const data = `${this.ano}-${String(this.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const diaSemana = new Date(this.ano, this.mes - 1, d).getDay();
      const feriado = this.feriadosPorDia.has(data);
      celulas.push({
        data,
        diaNumero: d,
        foraMes: false,
        hoje: data === hoje,
        feriado,
        feriadoDescricao: feriado
          ? this.feriadosPorDia.get(data) ?? null
          : null,
        fimDeSemana:
          diaSemana === 0 || (diaSemana === 6 && !this.sabadoDiaUtil),
        quantidadeVisitas: this.visitasPorDia.get(data)?.length ?? 0,
        quantidadeAgendamentos:
          this.agendamentosPorDia.get(data)?.length ?? 0,
      });
    }

    while (celulas.length % 7 !== 0) celulas.push(vazia());
    this.celulas = celulas;
  }

  private competenciaAtual(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const ano = partes.find((p) => p.type === 'year')?.value ?? '2026';
    const mes = partes.find((p) => p.type === 'month')?.value ?? '01';
    return `${ano}-${mes}`;
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
}
