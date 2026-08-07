import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProducaoConfigService } from '../../../services/producao-config.service';
import { ErrorModalService } from '../../../services/error-modal.service';
import { AuthService } from '../../../services/auth.service';
import { Permission, Unidade } from '../../../models/usuario.model';
import {
  PRODUCAO_DIAS_SEMANA,
  ProducaoJornadaDiaUi,
  ProducaoJornadaIntervaloUi,
} from '../../../models/producao-jornada-feriado.model';

@Component({
  selector: 'app-producao-jornada-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producao-jornada-panel.html',
  styleUrls: ['./producao-jornada-panel.css'],
})
export class ProducaoJornadaPanel implements OnChanges {
  private producaoConfig = inject(ProducaoConfigService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);

  @Input({ required: true }) unidade!: Unidade;

  readonly diasLabels = PRODUCAO_DIAS_SEMANA;

  dias: ProducaoJornadaDiaUi[] = [];
  configurado = false;
  carregando = false;
  salvando = false;
  dirty = false;

  modalCargaPadraoAberto = false;

  /** Valores editáveis no modal de carga padrão (reset ao abrir). */
  cargaPadrao = {
    segSexManhaInicio: '07:00',
    segSexManhaFim: '11:00',
    segSexTardeInicio: '13:00',
    segSexTardeFim: '17:00',
    sabadoInicio: '07:00',
    sabadoFim: '11:00',
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['unidade'] && this.unidade) {
      this.carregar();
    }
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_JORNADA_UPDATE);
  }

  /** Todos os dias marcados sem produção → backend usa tempo corrido no acompanhamento. */
  todosDiasSemProducao(): boolean {
    return (
      this.dias.length > 0 && this.dias.every((d) => d.fechado === true)
    );
  }

  labelDia(diaSemana: number): string {
    return (
      this.diasLabels.find((d) => d.diaSemana === diaSemana)?.label ??
      String(diaSemana)
    );
  }

  private aplicarRespostaJornada(res: {
    configurado: boolean;
    dias: {
      diaSemana: number;
      fechado: boolean;
      intervalos: { horaInicio: string; horaFim: string }[];
    }[];
  }): void {
    this.configurado = res.configurado;
    this.dias = res.dias.map((d) => ({
      diaSemana: d.diaSemana,
      fechado: d.fechado,
      intervalos: d.intervalos.map((i) => ({
        horaInicio: i.horaInicio?.slice(0, 5) ?? '08:00',
        horaFim: i.horaFim?.slice(0, 5) ?? '18:00',
      })),
    }));
  }

  carregar(): void {
    this.carregando = true;
    this.dirty = false;
    this.producaoConfig.obterJornada(this.unidade).subscribe({
      next: (res) => {
        this.aplicarRespostaJornada(res);
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.errors.show(err);
      },
    });
  }

  onFechadoChange(dia: ProducaoJornadaDiaUi): void {
    if (!dia.fechado && dia.intervalos.length === 0) {
      dia.intervalos = [{ horaInicio: '08:00', horaFim: '18:00' }];
    }
    this.dirty = true;
  }

  adicionarFaixa(dia: ProducaoJornadaDiaUi): void {
    dia.fechado = false;
    dia.intervalos.push({ horaInicio: '08:00', horaFim: '18:00' });
    this.dirty = true;
  }

  removerFaixa(dia: ProducaoJornadaDiaUi, idx: number): void {
    dia.intervalos.splice(idx, 1);
    if (dia.intervalos.length === 0) {
      dia.fechado = true;
    }
    this.dirty = true;
  }

  marcarDirty(): void {
    this.dirty = true;
  }

  abrirModalCargaPadrao(): void {
    if (!this.podeEditar() || this.carregando) {
      return;
    }
    this.resetCargaPadraoForm();
    this.modalCargaPadraoAberto = true;
  }

  private resetCargaPadraoForm(): void {
    this.cargaPadrao = {
      segSexManhaInicio: '07:00',
      segSexManhaFim: '11:00',
      segSexTardeInicio: '13:00',
      segSexTardeFim: '17:00',
      sabadoInicio: '07:00',
      sabadoFim: '11:00',
    };
  }

  fecharModalCargaPadrao(): void {
    this.modalCargaPadraoAberto = false;
  }

  confirmarCargaPadrao(): void {
    if (!this.podeEditar()) {
      return;
    }
    const erro = this.validarCargaPadraoForm();
    if (erro) {
      this.errors.show(erro, 'Horários inválidos');
      return;
    }
    this.aplicarCargaHorarioPadrao();
    this.dirty = true;
    this.modalCargaPadraoAberto = false;
  }

  private validarCargaPadraoForm(): string | null {
    const pares: { label: string; inicio: string; fim: string }[] = [
      {
        label: 'Segunda a sexta (1ª faixa)',
        inicio: this.cargaPadrao.segSexManhaInicio,
        fim: this.cargaPadrao.segSexManhaFim,
      },
      {
        label: 'Segunda a sexta (2ª faixa)',
        inicio: this.cargaPadrao.segSexTardeInicio,
        fim: this.cargaPadrao.segSexTardeFim,
      },
      {
        label: 'Sábado',
        inicio: this.cargaPadrao.sabadoInicio,
        fim: this.cargaPadrao.sabadoFim,
      },
    ];
    for (const par of pares) {
      if (!par.inicio?.trim() || !par.fim?.trim()) {
        return `${par.label}: informe início e finalização.`;
      }
      if (par.inicio >= par.fim) {
        return `${par.label}: o horário de início deve ser anterior ao de finalização.`;
      }
    }
    if (
      this.cargaPadrao.segSexManhaFim > this.cargaPadrao.segSexTardeInicio
    ) {
      return 'Segunda a sexta: a 1ª faixa deve terminar antes do início da 2ª faixa.';
    }
    return null;
  }

  private aplicarCargaHorarioPadrao(): void {
    const manha: ProducaoJornadaIntervaloUi = {
      horaInicio: this.cargaPadrao.segSexManhaInicio,
      horaFim: this.cargaPadrao.segSexManhaFim,
    };
    const tarde: ProducaoJornadaIntervaloUi = {
      horaInicio: this.cargaPadrao.segSexTardeInicio,
      horaFim: this.cargaPadrao.segSexTardeFim,
    };
    const sabado: ProducaoJornadaIntervaloUi = {
      horaInicio: this.cargaPadrao.sabadoInicio,
      horaFim: this.cargaPadrao.sabadoFim,
    };

    for (const dia of this.dias) {
      if (dia.diaSemana === 0) {
        dia.fechado = true;
        continue;
      }
      if (dia.diaSemana >= 1 && dia.diaSemana <= 5) {
        dia.fechado = false;
        dia.intervalos = [
          { ...manha },
          { ...tarde },
        ];
        continue;
      }
      if (dia.diaSemana === 6) {
        dia.fechado = false;
        dia.intervalos = [{ ...sabado }];
      }
    }
  }

  salvar(): void {
    if (!this.podeEditar() || !this.unidade) {
      return;
    }
    const payload = {
      unidade: this.unidade,
      dias: this.dias.map((d) => ({
        diaSemana: d.diaSemana,
        fechado: d.fechado,
        intervalos: d.intervalos.map((i, ordem) => ({
              diaSemana: d.diaSemana,
              ordem,
              horaInicio: i.horaInicio,
              horaFim: i.horaFim,
            })),
      })),
    };
    this.salvando = true;
    this.producaoConfig.salvarJornada(payload).subscribe({
      next: (res) => {
        this.aplicarRespostaJornada(res);
        this.dirty = false;
        this.salvando = false;
      },
      error: (err) => {
        this.salvando = false;
        this.errors.show(err);
      },
    });
  }

  trackIntervalo(_idx: number, item: ProducaoJornadaIntervaloUi): string {
    return `${item.horaInicio}-${item.horaFim}`;
  }
}
