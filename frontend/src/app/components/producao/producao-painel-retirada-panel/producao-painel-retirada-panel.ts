import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProducaoConfigService } from '../../../services/producao-config.service';
import { ErrorModalService } from '../../../services/error-modal.service';
import { AuthService } from '../../../services/auth.service';
import { Permission, Unidade } from '../../../models/usuario.model';
import { ProducaoEtapaRemuneracaoRow } from '../../../models/producao-config.model';
import {
  ALERTAS_PAINEL_PADRAO,
  ProducaoPainelAlertaFormRow,
  ProducaoPainelAlertaTipo,
} from '../../../models/producao-painel.model';
import {
  alertaConfigParaForm,
  alertaFormParaConfig,
  corPainelParaInputColor,
  normalizarCorPainel,
} from '../utils/producao-painel-cor.util';

@Component({
  selector: 'app-producao-painel-retirada-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-painel-retirada-panel.html',
  styleUrls: ['./producao-painel-retirada-panel.css'],
})
export class ProducaoPainelRetiradaPanel implements OnChanges {
  private producaoConfig = inject(ProducaoConfigService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);

  @Input({ required: true }) unidade!: Unidade;

  etapasDisponiveis: ProducaoEtapaRemuneracaoRow[] = [];
  etapasFinalSelecionadas = new Set<string>();
  alertas: ProducaoPainelAlertaFormRow[] = [];

  modalEtapasAberto = false;
  etapasModalDraft = new Set<string>();

  carregando = false;
  salvando = false;
  dirty = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['unidade'] && this.unidade) {
      this.carregar();
    }
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_PAINEL_CONFIG_UPDATE);
  }

  etapasFinalizacaoVisiveis(): ProducaoEtapaRemuneracaoRow[] {
    return this.etapasDisponiveis.filter((e) =>
      this.etapasFinalSelecionadas.has(this.normalizarCodEtapa(e.codEtapa)),
    );
  }

  carregar(): void {
    this.carregando = true;
    this.dirty = false;
    forkJoin({
      etapas: this.producaoConfig.listarEtapas(this.unidade),
      config: this.producaoConfig.obterPainelRetirada(this.unidade),
    }).subscribe({
      next: ({ etapas, config }) => {
        this.etapasDisponiveis = [...etapas].sort(
          (a, b) => a.posicaoEtapa - b.posicaoEtapa,
        );
        this.etapasFinalSelecionadas = new Set(
          config.etapasFinalizacao
            .map((c) => String(c).trim())
            .filter(Boolean),
        );
        const base =
          config.alertas.length > 0 ? config.alertas : ALERTAS_PAINEL_PADRAO;
        this.alertas = base.map((a) => alertaConfigParaForm({ ...a }));
        this.carregando = false;
      },
      error: (e) => {
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar configuração do painel.',
          'Painel de retirada',
        );
        this.carregando = false;
      },
    });
  }

  abrirModalEtapas(): void {
    if (!this.podeEditar()) return;
    this.etapasModalDraft = new Set(this.etapasFinalSelecionadas);
    this.modalEtapasAberto = true;
  }

  normalizarCodEtapa(cod: string): string {
    return String(cod ?? '').trim();
  }

  fecharModalEtapas(): void {
    this.modalEtapasAberto = false;
  }

  toggleEtapaModal(cod: string, checked: boolean): void {
    const key = this.normalizarCodEtapa(cod);
    const next = new Set(this.etapasModalDraft);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.etapasModalDraft = next;
  }

  confirmarModalEtapas(): void {
    this.etapasFinalSelecionadas = new Set(this.etapasModalDraft);
    this.modalEtapasAberto = false;
    if (this.podeEditar()) {
      this.salvar();
    } else {
      this.dirty = true;
    }
  }

  removerEtapaFinal(cod: string): void {
    if (!this.podeEditar()) return;
    const next = new Set(this.etapasFinalSelecionadas);
    next.delete(this.normalizarCodEtapa(cod));
    this.etapasFinalSelecionadas = next;
    this.dirty = true;
  }

  marcarDirty(): void {
    this.dirty = true;
  }

  corInputValue(cor: string): string {
    return corPainelParaInputColor(cor);
  }

  onCorPickerChange(alerta: ProducaoPainelAlertaFormRow, event: Event): void {
    const hex = (event.target as HTMLInputElement).value.toUpperCase();
    alerta.cor = hex;
    this.marcarDirty();
  }

  onCorHexChange(alerta: ProducaoPainelAlertaFormRow): void {
    alerta.cor = normalizarCorPainel(alerta.cor);
    this.marcarDirty();
  }

  aplicarPadraoAlertas(): void {
    if (!this.podeEditar()) return;
    this.alertas = ALERTAS_PAINEL_PADRAO.map((a) => alertaConfigParaForm({ ...a }));
    this.dirty = true;
  }

  adicionarFaixaAntes(): void {
    if (!this.podeEditar()) return;
    this.alertas.push({
      ordem: this.alertas.length,
      tipo: 'ANTES',
      minutosAntes: 60,
      horasAntes: 1,
      cor: '#EAB308',
      rotulo: null,
    });
    this.dirty = true;
  }

  removerAlerta(index: number): void {
    if (!this.podeEditar()) return;
    this.alertas.splice(index, 1);
    this.alertas.forEach((a, i) => {
      a.ordem = i;
    });
    this.dirty = true;
  }

  salvar(): void {
    if (!this.podeEditar() || !this.unidade || this.salvando) return;
    this.salvando = true;
    for (const a of this.alertas) {
      if (
        a.tipo === 'ANTES' &&
        (a.horasAntes == null || Number.isNaN(a.horasAntes) || a.horasAntes <= 0)
      ) {
        a.horasAntes = 1;
      }
    }
    const alertasPayload = this.alertas.map((a, i) => {
      const cfg = alertaFormParaConfig(a);
      return {
        ordem: i,
        tipo: cfg.tipo as ProducaoPainelAlertaTipo,
        minutosAntes: cfg.tipo === 'ANTES' ? cfg.minutosAntes : null,
        cor: cfg.cor,
        rotulo: cfg.rotulo,
      };
    });
    const body = {
      unidade: this.unidade,
      etapasFinalizacao: [...this.etapasFinalSelecionadas].map((c) =>
        this.normalizarCodEtapa(c),
      ),
      alertas: alertasPayload,
    };
    this.producaoConfig.salvarPainelRetirada(body).subscribe({
      next: (config) => {
        this.etapasFinalSelecionadas = new Set(
          config.etapasFinalizacao
            .map((c) => String(c).trim())
            .filter(Boolean),
        );
        this.alertas = config.alertas.map((a) => alertaConfigParaForm({ ...a }));
        this.dirty = false;
        this.salvando = false;
      },
      error: (e) => {
        this.errors.show(
          e?.error?.message ?? 'Erro ao salvar configuração.',
          'Painel de retirada',
        );
        this.salvando = false;
      },
    });
  }
}
