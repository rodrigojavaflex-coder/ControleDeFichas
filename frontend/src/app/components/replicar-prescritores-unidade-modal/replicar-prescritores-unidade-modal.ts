import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { ReplicarPrescritoresUnidadeResponse } from '../../models/sincronizacao.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

type Fase = 'idle' | 'preview' | 'aplicando';

interface EtapaAplicar {
  id: string;
  label: string;
}

@Component({
  selector: 'app-replicar-prescritores-unidade-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replicar-prescritores-unidade-modal.html',
  styleUrls: ['./replicar-prescritores-unidade-modal.css'],
})
export class ReplicarPrescritoresUnidadeModalComponent implements OnDestroy {
  private readonly sincronizacaoService = inject(SincronizacaoService);
  private readonly errorModalService = inject(ErrorModalService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private relogioTimer: ReturnType<typeof setInterval> | null = null;
  private pollSub: Subscription | null = null;
  private pollSeq = 0;
  private inicioAplicar = 0;

  readonly etapas: EtapaAplicar[] = [
    { id: 'agentes', label: 'Cadastro dos agentes' },
    { id: 'uso', label: 'Movimentos e vendas' },
    { id: 'plano', label: 'Plano de cópias' },
    { id: 'prescritores', label: 'Gravando prescritores' },
    { id: 'terceiro', label: 'Venda de terceiro' },
    { id: 'pfcrm', label: 'Profissão vazia' },
    { id: 'vendas', label: 'Vendas' },
    { id: 'retrato', label: 'Retrato' },
    { id: 'carteira', label: 'Carteira' },
    { id: 'historico', label: 'Histórico' },
    { id: 'producao', label: 'Produção' },
    { id: 'commit', label: 'Confirmando' },
  ];

  visible = false;
  fase: Fase = 'idle';
  statusMsg = '';
  statusEtapa = '';
  decorrido = '';
  error = '';
  preview: ReplicarPrescritoresUnidadeResponse | null = null;
  result: ReplicarPrescritoresUnidadeResponse | null = null;

  @Output() concluido = new EventEmitter<ReplicarPrescritoresUnidadeResponse>();

  get loading(): boolean {
    return this.fase === 'preview' || this.fase === 'aplicando';
  }

  get painel(): ReplicarPrescritoresUnidadeResponse | null {
    return this.result ?? this.preview;
  }

  get mostrarAndamento(): boolean {
    return this.fase === 'aplicando' || this.statusEtapa === 'concluido' || this.statusEtapa === 'erro';
  }

  ngOnDestroy(): void {
    this.pararAcompanhamento();
  }

  abrir(): void {
    this.pararAcompanhamento();
    this.error = '';
    this.preview = null;
    this.result = null;
    this.fase = 'idle';
    this.statusMsg = '';
    this.statusEtapa = '';
    this.decorrido = '';
    this.visible = true;
  }

  fechar(): void {
    if (this.loading) return;
    this.pararAcompanhamento();
    this.visible = false;
  }

  etapaFeita(id: string): boolean {
    if (this.statusEtapa === 'concluido') return true;
    const atual = this.etapas.findIndex((e) => e.id === this.statusEtapa);
    const indice = this.etapas.findIndex((e) => e.id === id);
    return atual >= 0 && indice >= 0 && indice < atual;
  }

  etapaAtual(id: string): boolean {
    return this.statusEtapa === id && this.fase === 'aplicando';
  }

  executarPrevia(): void {
    this.executar(false);
  }

  executarAplicar(): void {
    if (!this.preview) {
      this.errorModalService.show(
        'Rode a prévia antes de aplicar.',
        'Réplica por unidade',
      );
      return;
    }
    this.executar(true);
  }

  private executar(aplicar: boolean): void {
    this.error = '';
    this.fase = aplicar ? 'aplicando' : 'preview';
    if (!aplicar) {
      this.pararAcompanhamento();
      this.statusEtapa = '';
      this.decorrido = '';
      this.preview = null;
      this.result = null;
      this.statusMsg =
        'Lendo o cadastro de cada ERP e varrendo orçamento, caixa, produção, visitação e vendas…';
    } else {
      this.statusEtapa = 'agentes';
      this.statusMsg = 'Consultando o FC04000 de cada agente…';
      this.inicioAplicar = Date.now();
      this.atualizarDecorrido();
      this.iniciarAcompanhamento();
    }

    this.sincronizacaoService.replicarPrescritoresUnidade({ aplicar }).subscribe({
      next: (res) => {
        this.pararAcompanhamento();
        this.fase = 'idle';
        if (aplicar) {
          this.result = res;
          this.preview = res;
          this.statusEtapa = 'concluido';
          this.statusMsg = `Aplicado: ${res.copiasCriadas} cópias, ${res.atribuicoes} atribuições, ${res.vendasRepontadas} vendas.`;
          this.concluido.emit(res);
        } else {
          this.statusMsg = '';
          this.preview = res;
        }
        if (res.erros?.length) {
          this.error = res.erros.join(' ');
        }
      },
      error: (err) => {
        this.pararAcompanhamento();
        this.fase = 'idle';
        this.error = extrairMensagemErroApi(err);
        if (aplicar) {
          this.statusEtapa = 'erro';
          this.statusMsg = this.error;
        } else {
          this.statusMsg = '';
        }
        this.errorModalService.show(this.error, 'Réplica por unidade');
      },
    });
  }

  private iniciarAcompanhamento(): void {
    this.pararAcompanhamento();
    const seq = ++this.pollSeq;
    this.relogioTimer = setInterval(() => this.atualizarDecorrido(), 1000);
    this.pollTimer = setInterval(() => this.buscarStatus(seq), 1500);
    this.buscarStatus(seq);
  }

  private buscarStatus(seq: number): void {
    this.pollSub?.unsubscribe();
    this.pollSub = this.sincronizacaoService.statusReplicarPrescritoresUnidade().subscribe({
      next: (status) => {
        if (seq !== this.pollSeq || this.fase !== 'aplicando') return;
        if (!status.mensagem) return;
        this.statusEtapa = status.etapa;
        this.statusMsg = status.mensagem;
      },
    });
  }

  private atualizarDecorrido(): void {
    const segundos = Math.max(0, Math.floor((Date.now() - this.inicioAplicar) / 1000));
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;
    this.decorrido = minutos > 0 ? `${minutos} min ${resto}s` : `${resto}s`;
  }

  private pararAcompanhamento(): void {
    this.pollSeq++;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.relogioTimer) {
      clearInterval(this.relogioTimer);
      this.relogioTimer = null;
    }
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }
}
