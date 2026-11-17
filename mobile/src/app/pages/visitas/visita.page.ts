import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  NavController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AppLoadingService } from '../../services/app-loading.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { VisitasService } from '../../services/visitas.service';
import {
  PainelPrescritorVisita,
  TipoPendenciaOpcao,
  TipoVisitaOpcao,
  VisitaResumo,
  formatarDataHoraVisita,
  rotuloCrm,
  rotuloStatusVisita,
} from '../../models/visita.model';
import { VisitaMidiasComponent } from './visita-midias.component';
import { VisitaMapaComponent } from './visita-mapa.component';
import { VisitaConsultaModalComponent } from './visita-consulta-modal.component';

@Component({
  selector: 'app-visita',
  standalone: true,
  templateUrl: './visita.page.html',
  styleUrls: ['./visita.page.scss'],
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
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonIcon,
    VisitaMidiasComponent,
    VisitaMapaComponent,
    VisitaConsultaModalComponent,
  ],
})
export class VisitaPage {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertController);
  private readonly loading = inject(AppLoadingService);
  private readonly erros = inject(ErrorMessageService);

  visita: VisitaResumo | null = null;
  painel: PainelPrescritorVisita | null = null;
  tipos: TipoVisitaOpcao[] = [];
  tiposPendencia: TipoPendenciaOpcao[] = [];
  tipoVisitaId = '';
  tipoPendenciaId = '';
  descricao = '';
  pendencia = '';
  material = '';
  carregando = false;
  carregandoPainel = false;
  /** false = painel do prescritor; true = formulário de registro */
  modoFormulario = false;
  /** Aberta pela agenda: só leitura dos dados; excluir/trocar médico se houver permissão. */
  somenteConsulta = false;
  competencia = '';
  readonly formatarDataHora = formatarDataHoraVisita;
  readonly rotuloCrm = rotuloCrm;
  readonly rotuloStatus = rotuloStatusVisita;

  /** Ao abrir a visita: só médico, competência e localização. */
  cardsAbertos: Record<string, boolean> = {
    medico: true,
    pendencias: false,
    historico: false,
    competencia: true,
    orcamentos: false,
    ativos: false,
    mapa: true,
  };

  modalConsultaAberto = false;
  modalConsultaVisitaId: string | null = null;
  modalConsultaAcoes = false;

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      chevronDownOutline,
      chevronUpOutline,
    });
  }

  cardAberto(id: string): boolean {
    return this.cardsAbertos[id] !== false;
  }

  alternarCard(id: string, event?: Event): void {
    event?.stopPropagation();
    // Nova referência para o Angular detectar e o ion-icon remontar
    this.cardsAbertos = {
      ...this.cardsAbertos,
      [id]: !this.cardAberto(id),
    };
  }

  abrirConsultaVisita(id: string, permitirAcoes = false): void {
    if (!id || id === this.visita?.id) return;
    this.modalConsultaVisitaId = id;
    this.modalConsultaAcoes = permitirAcoes;
    this.modalConsultaAberto = true;
  }

  fecharConsultaVisita(): void {
    this.modalConsultaAberto = false;
    this.modalConsultaVisitaId = null;
  }

  async aposExcluirConsultaVisita(): Promise<void> {
    this.fecharConsultaVisita();
    await this.carregarPainel();
  }

  ionViewWillEnter(): void {
    void this.carregar();
  }

  podeAlterar(): boolean {
    return this.auth.hasAnyPermission(['visitas:update', 'visitas:gerir']);
  }

  podeExcluir(): boolean {
    return this.auth.hasAnyPermission(['visitas:delete', 'visitas:gerir']);
  }

  /** Campos da visita (tipo/textos/mídias) — bloqueados em consulta. */
  podeEditarCampos(): boolean {
    return this.podeAlterar() && !this.somenteConsulta;
  }

  /** Troca de médico: mesma regra do backend (update na própria ou gerir). */
  podeTrocarMedico(): boolean {
    return this.auth.hasAnyPermission(['visitas:update', 'visitas:gerir']);
  }

  /** Só "Registrar visita" enquanto a visita está ABERTA no formulário. */
  get tituloPagina(): string {
    if (this.somenteConsulta) return 'Consulta da visita';
    if (this.visita?.status === 'ABERTA') {
      return this.modoFormulario ? 'Registrar visita' : 'Visita';
    }
    return 'Consulta da visita';
  }

  get competenciaRotulo(): string {
    if (!/^\d{4}-\d{2}$/.test(this.competencia)) return this.competencia;
    const [anoStr, mesStr] = this.competencia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!Number.isFinite(ano) || !Number.isFinite(mes)) return this.competencia;
    const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
    });
    const nomeMes = nome.charAt(0).toUpperCase() + nome.slice(1);
    return `${nomeMes} de ${ano}`;
  }

  get podeAvancarMes(): boolean {
    const atual = this.competenciaAtual();
    if (!/^\d{4}-\d{2}$/.test(this.competencia) || !/^\d{4}-\d{2}$/.test(atual)) {
      return false;
    }
    return this.competencia < atual;
  }

  get totalOrcamentosMes(): number {
    if (!this.painel) return 0;
    return this.painel.aprovados.quantidade + this.painel.rejeitados.quantidade;
  }

  get percentualAprovacaoMes(): number {
    const total = this.totalOrcamentosMes;
    if (total <= 0 || !this.painel) return 0;
    return Math.round((this.painel.aprovados.quantidade / total) * 100);
  }

  async voltar(): Promise<void> {
    if (this.somenteConsulta) {
      await this.sairDaVisita('/visitas/agenda');
      return;
    }
    if (this.modoFormulario && this.visita?.status === 'ABERTA') {
      this.modoFormulario = false;
      return;
    }
    await this.sairDaVisita('/visitas');
  }

  abrirFormulario(): void {
    if (this.somenteConsulta) return;
    this.modoFormulario = true;
  }

  async mesAnterior(): Promise<void> {
    this.competencia = this.deslocarCompetencia(this.competencia, -1);
    await this.carregarPainel();
  }

  async mesProximo(): Promise<void> {
    const proxima = this.deslocarCompetencia(this.competencia, 1);
    const atual = this.competenciaAtual();
    if (proxima > atual) return;
    this.competencia = proxima;
    await this.carregarPainel();
  }

  async abrirOpcoesEncerrar(): Promise<void> {
    if (
      !this.visita ||
      this.visita.status !== 'ABERTA' ||
      !this.podeEditarCampos()
    ) {
      return;
    }
    this.soltarFoco();
    const alerta = await this.alertas.create({
      header: 'Encerrar visita',
      message: 'Escolha como deseja gravar os dados desta visita.',
      cssClass: ['visita-alerta', 'visita-alerta--confirmacao', 'visita-alerta--encerrar'],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'visita-alerta-cancelar',
        },
        {
          text: 'Salvar',
          cssClass: 'visita-alerta-ok',
          handler: () => {
            void this.salvar();
          },
        },
        {
          text: 'Salvar e Encerrar',
          cssClass: 'visita-alerta-ok',
          handler: () => {
            void this.salvarEEncerrar();
          },
        },
      ],
    });
    await alerta.present();
  }

  async salvarEEncerrar(): Promise<void> {
    if (!this.visita || !this.podeEditarCampos()) return;
    if (!this.tipoVisitaId) {
      await this.avisar('Selecione o tipo de visita.', 'aviso');
      return;
    }
    if (!this.descricao.trim()) {
      await this.avisar('Descrição da visita é obrigatória.', 'aviso');
      return;
    }
    if (this.pendencia.trim() && !this.tipoPendenciaId) {
      await this.avisar('Selecione o tipo da pendência.', 'aviso');
      return;
    }
    this.soltarFoco();
    await this.loading.show('Encerrando visita…');
    try {
      if (this.tipoVisitaId !== this.visita.tipoVisitaId) {
        await firstValueFrom(
          this.visitas.atualizar(this.visita.id, {
            tipoVisitaId: this.tipoVisitaId,
          }),
        );
      }
      this.visita = await firstValueFrom(
        this.visitas.encerrar(this.visita.id, {
          descricao: this.descricao,
          pendencia: this.pendencia,
          tipoPendenciaId: this.pendencia.trim() ? this.tipoPendenciaId : null,
          material: this.material,
        }),
      );
      this.preencherCampos();
      await this.loading.dismiss();
      await this.aposEncerrarComSucesso();
    } catch (error) {
      await this.avisar(
        this.mensagem(error, 'Não foi possível encerrar a visita.'),
        'erro',
      );
    } finally {
      await this.loading.dismiss();
    }
  }

  private async aposEncerrarComSucesso(): Promise<void> {
    const visita = this.visita;
    const podeAgendar = this.auth.hasPermission('visitas-agenda:create');
    if (!podeAgendar || !visita?.prescritorId) {
      await this.avisar('Visita encerrada com sucesso.', 'sucesso');
      await this.sairDaVisita('/visitas');
      return;
    }

    const alerta = await this.alertas.create({
      header: 'Visita',
      message: 'Visita encerrada com sucesso. Deseja agendar a próxima visita?',
      cssClass: ['visita-alerta', 'visita-alerta--sucesso'],
      buttons: [
        {
          text: 'Agendar próxima',
          cssClass: 'visita-alerta-ok',
          role: 'agendar',
        },
        {
          text: 'OK',
          cssClass: 'visita-alerta-cancelar',
          role: 'ok',
        },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    this.soltarFoco();
    if (role === 'agendar') {
      await this.nav.navigateRoot(['/visitas/agenda/agendar'], {
        queryParams: {
          prescritorId: visita.prescritorId,
          nome: visita.prescritorNome,
          crm: visita.crm,
          uf: visita.uf,
        },
      });
      return;
    }
    await this.sairDaVisita('/visitas');
  }

  async salvar(): Promise<void> {
    if (!this.visita || !this.podeEditarCampos()) return;
    if (!this.tipoVisitaId) {
      await this.avisar('Selecione o tipo de visita.', 'aviso');
      return;
    }
    if (this.pendencia.trim() && !this.tipoPendenciaId) {
      await this.avisar('Selecione o tipo da pendência.', 'aviso');
      return;
    }
    try {
      this.visita = await firstValueFrom(
        this.visitas.atualizar(this.visita.id, {
          tipoVisitaId: this.tipoVisitaId,
          descricao: this.descricao,
          pendencia: this.pendencia,
          tipoPendenciaId: this.pendencia.trim() ? this.tipoPendenciaId : null,
          material: this.material,
        }),
      );
      this.preencherCampos();
      await this.avisar(
        'As informações da visita foram gravadas com sucesso!',
        'sucesso',
      );
    } catch (error) {
      await this.avisar(
        this.mensagem(error, 'Não foi possível salvar a visita.'),
        'erro',
      );
    }
  }

  async trocarMedico(): Promise<void> {
    if (!this.visita || !this.podeTrocarMedico()) return;
    await this.router.navigate(['/visitas/trocar', this.visita.id], {
      queryParams: this.somenteConsulta ? { modo: 'consulta' } : undefined,
    });
  }

  async excluir(): Promise<void> {
    if (!this.visita) return;
    const confirma = await this.confirmar(
      'Excluir visita',
      'Deseja Remover a visita atual?',
    );
    if (!confirma) return;
    try {
      await firstValueFrom(this.visitas.excluir(this.visita.id));
      const destino = this.somenteConsulta ? '/visitas/agenda' : '/visitas';
      await this.sairDaVisita(destino);
    } catch (error) {
      await this.avisar(
        this.mensagem(error, 'Não foi possível excluir a visita.'),
        'erro',
      );
    }
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  }

  formatarDataCurta(iso: string | null): string {
    if (!iso) return '—';
    const data = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    if (Number.isNaN(data.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(data);
  }

  private async carregar(): Promise<void> {
    const id = this.rota.snapshot.paramMap.get('id');
    if (!id) return;
    this.carregando = true;
    this.modoFormulario = false;
    this.somenteConsulta =
      this.rota.snapshot.queryParamMap.get('modo') === 'consulta';
    try {
      const visita = await firstValueFrom(this.visitas.obter(id));
      this.visita = visita;
      const edicaoAberta = !this.somenteConsulta && visita.status === 'ABERTA';
      if (edicaoAberta) {
        const carteira = await firstValueFrom(
          this.visitas.carteira({ page: 1, limit: 1 }),
        );
        this.tipos = carteira.tipos;
        if (
          visita.tipoVisitaId &&
          !this.tipos.some((tipo) => tipo.id === visita.tipoVisitaId)
        ) {
          this.tipos = [
            {
              id: visita.tipoVisitaId,
              nome: visita.tipoVisitaNome || 'Tipo atual',
            },
            ...this.tipos,
          ];
        }
        this.tiposPendencia = await firstValueFrom(
          this.visitas.listarTiposPendencia(),
        );
      }
      this.preencherCampos();
      this.competencia = this.competenciaAtual();
      // Encerrada / consulta: leitura estática (sem ion-select/textarea).
      // Visita ABERTA abre no painel; o formulário Ionic só no Finalizar.
      this.modoFormulario = !edicaoAberta;
      if (edicaoAberta) {
        await this.carregarPainel();
      }
    } catch (error) {
      await this.avisar(
        this.mensagem(error, 'Não foi possível abrir a visita.'),
        'erro',
      );
      const destino = this.somenteConsulta ? '/visitas/agenda' : '/visitas';
      await this.sairDaVisita(destino);
    } finally {
      this.carregando = false;
    }
  }

  private async carregarPainel(): Promise<void> {
    if (!this.visita) return;
    this.carregandoPainel = true;
    try {
      this.painel = await firstValueFrom(
        this.visitas.painelPrescritor(this.visita.id, this.competencia),
      );
      this.competencia = this.painel.competencia;
    } catch (error) {
      await this.avisar(
        this.mensagem(error, 'Não foi possível carregar o painel do médico.'),
        'erro',
      );
    } finally {
      this.carregandoPainel = false;
    }
  }

  private preencherCampos(): void {
    this.tipoVisitaId = this.visita?.tipoVisitaId ?? '';
    this.descricao = this.visita?.descricao ?? '';
    this.pendencia = this.visita?.pendencia ?? '';
    this.material = this.visita?.material ?? '';
    if (!this.pendencia.trim()) {
      this.tipoPendenciaId = '';
    }
  }

  temTextoPendencia(): boolean {
    return this.pendencia.trim().length > 0;
  }

  /** Sempre `YYYY-MM` (WebView Android às vezes formata mês/ano fora de ordem). */
  private competenciaAtual(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const ano = partes.find((p) => p.type === 'year')?.value ?? '';
    const mes = partes.find((p) => p.type === 'month')?.value ?? '';
    if (/^\d{4}$/.test(ano) && /^\d{2}$/.test(mes)) {
      return `${ano}-${mes}`;
    }
    // Fallback seguro
    const agora = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  }

  private deslocarCompetencia(competencia: string, delta: number): string {
    const base = /^\d{4}-\d{2}$/.test(competencia)
      ? competencia
      : this.competenciaAtual();
    const [anoStr, mesStr] = base.split('-');
    let ano = Number(anoStr);
    let mes = Number(mesStr) + delta;
    while (mes < 1) {
      mes += 12;
      ano -= 1;
    }
    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }
    return `${ano}-${String(mes).padStart(2, '0')}`;
  }

  private mensagem(error: unknown, fallback: string): string {
    if (error instanceof Error && !('status' in error)) {
      return error.message;
    }
    return this.erros.fromApi(error, fallback);
  }

  /**
   * Sai da visita pela raiz da navegação. `replaceUrl` deixava a página
   * (mapa/teclado) na pilha e travava o toque em Médicos/Histórico.
   */
  private async sairDaVisita(destino: string): Promise<void> {
    this.soltarFoco();
    await this.nav.navigateRoot(destino);
  }

  private soltarFoco(): void {
    const ativo = document.activeElement;
    if (ativo instanceof HTMLElement) {
      ativo.blur();
    }
  }

  private async avisar(
    mensagem: string,
    tipo: 'sucesso' | 'aviso' | 'erro' = 'aviso',
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

  private async confirmar(titulo: string, mensagem: string): Promise<boolean> {
    const alerta = await this.alertas.create({
      header: titulo,
      message: mensagem,
      cssClass: ['visita-alerta', 'visita-alerta--confirmacao'],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'visita-alerta-cancelar' },
        { text: 'Confirmar', role: 'confirm', cssClass: 'visita-alerta-ok' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    return role === 'confirm';
  }
}
