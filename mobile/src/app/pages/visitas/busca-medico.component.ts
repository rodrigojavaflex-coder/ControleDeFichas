import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSearchbar } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { VisitasService } from '../../services/visitas.service';
import {
  FiltroPainelVisita,
  MedicoPendenciaOpcao,
  rotuloCrm,
} from '../../models/visita.model';

@Component({
  selector: 'app-busca-medico',
  standalone: true,
  templateUrl: './busca-medico.component.html',
  styleUrls: ['./busca-medico.component.scss'],
  imports: [CommonModule, IonSearchbar],
})
export class BuscaMedicoComponent implements OnInit, OnChanges, OnDestroy {
  private readonly visitas = inject(VisitasService);
  private readonly auth = inject(AuthService);

  @Input() label = 'Médico';
  /** `caixa` = formulário (padrão pendências); `filtro` = bloco de filtros. */
  @Input() variante: 'caixa' | 'filtro' = 'caixa';
  @Input() medico: MedicoPendenciaOpcao | null = null;
  @Input() painelDisponivel: boolean | null = null;
  @Input() searchbarId = 'busca-medico';

  @Output() medicoChange = new EventEmitter<MedicoPendenciaOpcao | null>();

  busca = '';
  sugestoes: MedicoPendenciaOpcao[] = [];
  buscando = false;
  filtroPainel: FiltroPainelVisita = 'todos';
  painelOk = false;

  readonly rotuloCrm = rotuloCrm;
  private buscaTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    if (this.painelDisponivel != null) {
      this.painelOk = this.painelDisponivel;
      return;
    }
    await this.detectarPainel();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['painelDisponivel'] && this.painelDisponivel != null) {
      this.painelOk = this.painelDisponivel;
      if (!this.painelOk && this.filtroPainel !== 'todos') {
        this.filtroPainel = 'todos';
      }
    }
  }

  ngOnDestroy(): void {
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
  }

  get podeBuscar(): boolean {
    return this.auth.hasAnyPermission([
      'pendencias:read',
      'pendencias:create',
      'visitas-agenda:create',
      'visitas-agenda:read',
    ]);
  }

  selecionarFiltroPainel(valor: FiltroPainelVisita): void {
    if (
      (valor === 'no_painel' || valor === 'fora_painel') &&
      !this.painelOk
    ) {
      return;
    }
    if (this.filtroPainel === valor) return;
    this.filtroPainel = valor;
    const termo = this.busca.trim();
    if (termo.length >= 2) {
      void this.buscar(termo);
    }
  }

  aoBuscar(evento: CustomEvent): void {
    this.busca = String(evento.detail?.value ?? '');
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    const termo = this.busca.trim();
    if (termo.length < 2) {
      this.sugestoes = [];
      return;
    }
    this.buscaTimer = setTimeout(() => {
      void this.buscar(termo);
    }, 350);
  }

  escolher(medico: MedicoPendenciaOpcao): void {
    this.medico = medico;
    this.sugestoes = [];
    this.busca = '';
    this.medicoChange.emit(medico);
  }

  limpar(): void {
    this.medico = null;
    this.sugestoes = [];
    this.busca = '';
    this.medicoChange.emit(null);
  }

  private async detectarPainel(): Promise<void> {
    try {
      if (this.auth.hasPermission('visitas:read')) {
        const carteira = await firstValueFrom(
          this.visitas.carteira({ page: 1, limit: 1 }),
        );
        this.painelOk = !!carteira.painelDisponivel;
        return;
      }
      if (
        this.auth.hasAnyPermission(['pendencias:read', 'pendencias:create'])
      ) {
        const lista = await firstValueFrom(
          this.visitas.minhasSolicitacoes({ page: 1, limit: 1 }),
        );
        this.painelOk = !!lista.painelDisponivel;
      }
    } catch {
      this.painelOk = false;
    }
  }

  private async buscar(termo: string): Promise<void> {
    if (!this.podeBuscar) {
      this.sugestoes = [];
      return;
    }
    this.buscando = true;
    try {
      this.sugestoes = await firstValueFrom(
        this.visitas.buscarMedicosPendencia(termo, this.filtroPainel),
      );
    } catch {
      this.sugestoes = [];
    } finally {
      this.buscando = false;
    }
  }
}
