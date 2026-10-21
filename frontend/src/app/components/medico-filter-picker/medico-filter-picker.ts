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
  @Input() confirmLabel = 'Adicionar e aplicar';
  @Input() resumoVazio = 'todos';
  @Input() hintTodos = 'Todos os médicos';
  /** Quando false, não lista chips com nomes — só o contador no título. */
  @Input() exibirNomesSelecionados = true;

  /** @deprecated Ignorado — seleção é por busca. Mantido por compatibilidade. */
  @Input() defaultOrdenacao: MedicoOrdenacaoFiltro = 'alfabetica';
  /** @deprecated Ignorado — seleção é por busca. Mantido por compatibilidade. */
  @Input() defaultLimiteExibicao: MedicoLimiteExibicaoFiltro = 20;
  /** @deprecated Ignorado — seleção é por busca. Mantido por compatibilidade. */
  @Input() ordenacaoOpcoes: Array<{
    value: MedicoOrdenacaoFiltro;
    label: string;
  }> = [];

  @Output() selectedMedicosChange = new EventEmitter<Set<string>>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cleared = new EventEmitter<void>();

  modalOpen = false;
  selectedRascunho = new Set<string>();
  buscaModal = '';

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

  get rascunhoLista(): string[] {
    return Array.from(this.selectedRascunho).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  get temBusca(): boolean {
    return this.normalizarTexto(this.buscaModal).length > 0;
  }

  get sugestoesMedicoOrdenadas(): OrcamentoMedicoOpcaoFiltro[] {
    const termo = this.normalizarTexto(this.buscaModal);
    if (!termo) return [];
    return this.opcoes
      .filter((medico) => this.normalizarTexto(medico.nome).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** Resultados da busca ainda não incluídos no rascunho. */
  get sugestoesParaIncluir(): OrcamentoMedicoOpcaoFiltro[] {
    return this.sugestoesMedicoOrdenadas.filter(
      (medico) => !this.selectedRascunho.has(medico.nome),
    );
  }

  abrirModal(event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedRascunho = new Set(this.selectedMedicos);
    this.buscaModal = '';
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

  incluirMedico(nome: string): void {
    const trimmed = String(nome ?? '').trim();
    if (!trimmed || this.selectedRascunho.has(trimmed)) return;
    const next = new Set(this.selectedRascunho);
    next.add(trimmed);
    this.selectedRascunho = next;
    this.buscaModal = '';
    this.cdr.markForCheck();
  }

  removerRascunho(nome: string): void {
    if (!this.selectedRascunho.has(nome)) return;
    const next = new Set(this.selectedRascunho);
    next.delete(nome);
    this.selectedRascunho = next;
    this.cdr.markForCheck();
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
