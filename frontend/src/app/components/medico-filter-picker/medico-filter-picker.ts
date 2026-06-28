import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnDestroy,
  Output,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MedicoLimiteExibicaoFiltro,
  MedicoOrdenacaoFiltro,
  OrcamentoMedicoOpcaoFiltro,
} from '../../models/orcamento.model';

@Component({
  selector: 'app-medico-filter-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medico-filter-picker.html',
  styleUrls: ['./medico-filter-picker.css'],
  encapsulation: ViewEncapsulation.None,
})
export class MedicoFilterPickerComponent implements OnDestroy {
  @ViewChild('modalBackdrop') modalBackdrop?: ElementRef<HTMLElement>;

  @Input() opcoes: OrcamentoMedicoOpcaoFiltro[] = [];
  @Input() loading = false;
  @Input() selectedMedicos = new Set<string>();
  @Input() defaultOrdenacao: MedicoOrdenacaoFiltro = 'alfabetica';
  @Input() defaultLimiteExibicao: MedicoLimiteExibicaoFiltro = 20;
  @Input() confirmLabel = 'Adicionar e aplicar';
  @Input() resumoVazio = 'todos';
  @Input() hintTodos = 'Todos os médicos';

  @Output() selectedMedicosChange = new EventEmitter<Set<string>>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cleared = new EventEmitter<void>();

  modalOpen = false;
  selectedRascunho = new Set<string>();
  buscaModal = '';
  ordenacaoModal: MedicoOrdenacaoFiltro = 'alfabetica';
  limiteExibicaoModal: MedicoLimiteExibicaoFiltro = 20;

  readonly limiteExibicaoOpcoes: MedicoLimiteExibicaoFiltro[] = [
    10, 15, 20, 'todos',
  ];

  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private modalAnchor: HTMLElement | null = null;

  get medicoResumo(): string {
    return this.selectedMedicos.size === 0
      ? this.resumoVazio
      : `${this.selectedMedicos.size} selecionado(s)`;
  }

  get medicosSelecionadosLista(): string[] {
    return Array.from(this.selectedMedicos).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  get opcoesFiltradas(): OrcamentoMedicoOpcaoFiltro[] {
    const termo = this.normalizarTexto(this.buscaModal);
    if (!termo) return this.opcoes;
    return this.opcoes.filter((medico) =>
      this.normalizarTexto(medico.nome).includes(termo),
    );
  }

  get sugestoesMedicoOrdenadas(): OrcamentoMedicoOpcaoFiltro[] {
    const sorted = [...this.opcoesFiltradas];
    const compareNome = (
      a: OrcamentoMedicoOpcaoFiltro,
      b: OrcamentoMedicoOpcaoFiltro,
    ) => a.nome.localeCompare(b.nome, 'pt-BR');

    switch (this.ordenacaoModal) {
      case 'total':
        sorted.sort((a, b) => b.total - a.total || compareNome(a, b));
        break;
      case 'aprovados':
        sorted.sort((a, b) => b.aprovados - a.aprovados || compareNome(a, b));
        break;
      case 'rejeitados':
        sorted.sort((a, b) => b.rejeitados - a.rejeitados || compareNome(a, b));
        break;
      case 'alfabetica':
      default:
        sorted.sort(compareNome);
        break;
    }
    return sorted;
  }

  get sugestoesMedico(): OrcamentoMedicoOpcaoFiltro[] {
    const ordenadas = this.sugestoesMedicoOrdenadas;
    if (this.limiteExibicaoModal === 'todos') {
      return ordenadas;
    }
    return ordenadas.slice(0, this.limiteExibicaoModal);
  }

  get todosFiltradosMarcados(): boolean {
    return (
      this.sugestoesMedico.length > 0 &&
      this.sugestoesMedico.every((medico) =>
        this.selectedRascunho.has(medico.nome),
      )
    );
  }

  abrirModal(event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedRascunho = new Set(this.selectedMedicos);
    this.buscaModal = '';
    this.ordenacaoModal = this.defaultOrdenacao;
    this.limiteExibicaoModal = this.defaultLimiteExibicao;
    this.modalOpen = true;
    this.cdr.detectChanges();
    this.scheduleAttachModalToBody();
  }

  fecharModal(): void {
    this.detachModalFromBody();
    this.modalOpen = false;
    this.buscaModal = '';
  }

  ngOnDestroy(): void {
    this.detachModalFromBody();
  }

  limparSelecionados(event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.selectedMedicos.size === 0) return;
    this.selectedMedicosChange.emit(new Set<string>());
    this.cleared.emit();
  }

  toggleRascunho(nome: string, checked: boolean): void {
    if (checked) this.selectedRascunho.add(nome);
    else this.selectedRascunho.delete(nome);
  }

  toggleTodosRascunho(checked: boolean): void {
    if (checked) {
      for (const medico of this.sugestoesMedico) {
        this.selectedRascunho.add(medico.nome);
      }
      return;
    }
    for (const medico of this.sugestoesMedico) {
      this.selectedRascunho.delete(medico.nome);
    }
  }

  confirmar(): void {
    this.selectedMedicosChange.emit(new Set(this.selectedRascunho));
    this.confirmed.emit();
    this.fecharModal();
  }

  trackByMedicoOpcao(_: number, medico: OrcamentoMedicoOpcaoFiltro): string {
    return medico.nome;
  }

  trackByNome(_: number, nome: string): string {
    return nome;
  }

  labelLimiteExibicao(valor: MedicoLimiteExibicaoFiltro): string {
    return valor === 'todos' ? 'Todos' : String(valor);
  }

  private scheduleAttachModalToBody(): void {
    if (this.attachModalToBody()) {
      return;
    }
    afterNextRender(
      () => {
        if (!this.modalOpen) {
          return;
        }
        this.attachModalToBody();
      },
      { injector: this.injector },
    );
  }

  private attachModalToBody(): boolean {
    const backdrop = this.modalBackdrop?.nativeElement;
    if (!backdrop || backdrop.parentElement === this.document.body) {
      return !!backdrop;
    }
    this.modalAnchor = backdrop.parentElement;
    this.renderer.appendChild(this.document.body, backdrop);
    this.renderer.addClass(this.document.body, 'medico-filter-picker-modal-open');
    return true;
  }

  private detachModalFromBody(): void {
    const backdrop = this.modalBackdrop?.nativeElement;
    if (backdrop?.parentElement === this.document.body) {
      if (this.modalAnchor?.isConnected) {
        this.renderer.appendChild(this.modalAnchor, backdrop);
      } else {
        this.renderer.removeChild(this.document.body, backdrop);
      }
    }
    this.modalAnchor = null;
    this.renderer.removeClass(this.document.body, 'medico-filter-picker-modal-open');
  }

  private normalizarTexto(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}
