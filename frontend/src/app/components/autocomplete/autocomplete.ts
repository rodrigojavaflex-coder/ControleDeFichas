import { Component, Input, Output, EventEmitter, forwardRef, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, firstValueFrom } from 'rxjs';
import { ClientesService } from '../../services/clientes.service';
import { VendedoresService } from '../../services/vendedores.service';
import { PrescritoresService } from '../../services/prescritores.service';
import { Cliente } from '../../models/cliente.model';
import { Vendedor } from '../../models/vendedor.model';
import { Prescritor } from '../../models/prescritor.model';
import { AuthService } from '../../services/auth.service';
import { Unidade, Permission } from '../../models/usuario.model';

export type AutocompleteType = 'cliente' | 'vendedor' | 'prescritor';

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete.html',
  styleUrls: ['./autocomplete.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true
    }
  ]
})
export class AutocompleteComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() type!: AutocompleteType;
  @Input() id?: string;
  @Input() placeholder: string = 'Digite para buscar...';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() limit: number = 20;
  @Output() selected = new EventEmitter<Cliente | Vendedor | Prescritor | null>();
  @Output() createNew = new EventEmitter<string>();

  @ViewChild('inputElement', { static: false }) inputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('dropdown', { static: false }) dropdownElement?: ElementRef<HTMLDivElement>;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  searchText: string = '';
  results: (Cliente | Vendedor | Prescritor)[] = [];
  showDropdown: boolean = false;
  selectedItem: Cliente | Vendedor | Prescritor | null = null;
  loading: boolean = false;
  error: string | null = null;
  highlightedIndex: number = -1;

  private onChange = (value: string | null) => {};
  onTouched = () => {};

  constructor(
    private clientesService: ClientesService,
    private vendedoresService: VendedoresService,
    private prescritoresService: PrescritoresService,
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Configurar busca com debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchText: string) => {
        if (!searchText || searchText.trim().length < 2) {
          this.showDropdown = false;
          return of([]);
        }
        this.loading = true;
        this.error = null;
        return this.performSearch(searchText.trim());
      }),
      catchError((error) => {
        this.loading = false;
        this.error = 'Erro ao buscar. Tente novamente.';
        console.error('Erro na busca:', error);
        return of([]);
      })
    ).subscribe((results) => {
      this.results = results;
      this.loading = false;
      // Mostrar dropdown se houver resultados OU se não houver resultados mas usuário pode criar (cliente ou prescritor)
      // Não mostrar opção de criar se já há um item selecionado
      const canShowEmpty = (this.type === 'cliente' || this.type === 'prescritor') && 
                          this.searchText.trim().length >= 2 && 
                          !this.selectedItem &&
                          this.canCreateNew();
      this.showDropdown = (results.length > 0 || canShowEmpty) && this.searchText.trim().length >= 2;
      this.highlightedIndex = -1; // Resetar índice quando novos resultados chegam
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  private async performSearch(searchText: string): Promise<(Cliente | Vendedor | Prescritor)[]> {
    const currentUser = this.authService.getCurrentUser();
    const unidade = currentUser?.unidade;

    try {
      switch (this.type) {
        case 'cliente':
          return await firstValueFrom(this.clientesService.search(searchText, this.limit));
        case 'vendedor':
          return await firstValueFrom(this.vendedoresService.search(searchText, this.limit));
        case 'prescritor':
          return await firstValueFrom(this.prescritoresService.search(searchText, this.limit));
        default:
          return [];
      }
    } catch (error) {
      console.error('Erro na busca:', error);
      return [];
    }
  }

  onInputChange(value: string): void {
    this.searchText = value;
    this.highlightedIndex = -1; // Resetar índice destacado
    if (!value || value.trim().length === 0) {
      this.selectedItem = null;
      this.onChange(null);
      this.selected.emit(null);
      this.showDropdown = false;
      return;
    }
    this.searchSubject.next(value);
  }

  onInputFocus(): void {
    if (this.searchText && this.searchText.trim().length >= 2) {
      // Mostrar dropdown se houver resultados ou se pode criar novo (cliente ou prescritor)
      // Não mostrar opção de criar se já há um item selecionado
      const canShowEmpty = (this.type === 'cliente' || this.type === 'prescritor') && 
                          !this.selectedItem && 
                          this.canCreateNew();
      if (this.results.length > 0 || canShowEmpty) {
        this.showDropdown = true;
      }
    }
  }

  onInputKeyDown(event: KeyboardEvent): void {
    // Verificar se pode criar novo (cliente ou prescritor)
    // Não permitir criar se já há um item selecionado
    const canCreate = (this.type === 'cliente' || this.type === 'prescritor') && 
                     this.searchText.trim().length >= 2 && 
                     this.results.length === 0 && 
                     !this.selectedItem &&
                     this.canCreateNew();

    // Se não há dropdown visível, tentar mostrar
    if (!this.showDropdown) {
      if (event.key === 'ArrowDown' && this.searchText.trim().length >= 2) {
        // Se há resultados, mostrar dropdown
        if (this.results.length > 0) {
          this.showDropdown = true;
          this.highlightedIndex = 0;
        } else if (canCreate) {
          // Se pode criar, mostrar dropdown com opção de criar
          this.showDropdown = true;
          this.highlightedIndex = -1; // -1 significa opção de criar
        }
      }
      // Se Enter e pode criar, criar novo
      if (event.key === 'Enter' && canCreate) {
        event.preventDefault();
        this.onCreateNew();
        return;
      }
      return;
    }

    // Calcular total de itens (resultados + opção de criar se disponível)
    const totalItems = this.results.length + (canCreate ? 1 : 0);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.highlightedIndex < 0) {
          // Se estava na opção de criar, ir para primeiro resultado
          this.highlightedIndex = this.results.length > 0 ? 0 : -1;
        } else {
          // Navegar pelos resultados
          if (this.highlightedIndex < this.results.length - 1) {
            this.highlightedIndex++;
          } else if (canCreate) {
            // Se estava no último resultado e pode criar, ir para opção de criar
            this.highlightedIndex = -1;
          } else {
            // Voltar para o primeiro
            this.highlightedIndex = 0;
          }
        }
        this.scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.highlightedIndex <= 0) {
          // Se estava no primeiro ou opção de criar, ir para opção de criar se disponível
          if (canCreate && this.highlightedIndex !== -1) {
            this.highlightedIndex = -1;
          } else {
            // Ir para o último item
            this.highlightedIndex = this.results.length > 0 ? this.results.length - 1 : -1;
          }
        } else {
          this.highlightedIndex--;
        }
        this.scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex === -1 && canCreate) {
          // Opção de criar está destacada
          this.onCreateNew();
        } else if (this.highlightedIndex >= 0 && this.highlightedIndex < this.results.length) {
          // Selecionar item destacado
          this.selectItem(this.results[this.highlightedIndex]);
        } else if (canCreate) {
          // Se não há resultados mas pode criar, criar novo
          this.onCreateNew();
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.showDropdown = false;
        this.highlightedIndex = -1;
        if (this.inputElement) {
          this.inputElement.nativeElement.blur();
        }
        break;
    }
  }

  private scrollToHighlighted(): void {
    if (!this.dropdownElement) {
      return;
    }
    // Se highlightedIndex é -1 (opção de criar), não precisa scroll
    if (this.highlightedIndex < 0) {
      return;
    }

    const dropdown = this.dropdownElement.nativeElement;
    const items = dropdown.querySelectorAll('.autocomplete-item');
    const highlightedItem = items[this.highlightedIndex] as HTMLElement;

    if (highlightedItem) {
      const dropdownRect = dropdown.getBoundingClientRect();
      const itemRect = highlightedItem.getBoundingClientRect();

      // Scroll para cima se o item está acima da área visível
      if (itemRect.top < dropdownRect.top) {
        highlightedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      // Scroll para baixo se o item está abaixo da área visível
      else if (itemRect.bottom > dropdownRect.bottom) {
        highlightedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  selectItem(item: Cliente | Vendedor | Prescritor): void {
    this.selectedItem = item;
    this.searchText = item.nome;
    this.showDropdown = false;
    this.highlightedIndex = -1; // Resetar índice destacado
    this.onChange(item.id);
    this.selected.emit(item);
    this.onTouched();
  }

  clearSelection(): void {
    this.selectedItem = null;
    this.searchText = '';
    this.showDropdown = false;
    this.results = [];
    this.highlightedIndex = -1; // Resetar índice destacado
    this.onChange(null);
    this.selected.emit(null);
    this.onTouched();
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  getDisplayText(item: Cliente | Vendedor | Prescritor): string {
    if (this.type === 'prescritor') {
      const prescritor = item as Prescritor;
      if (prescritor.numeroCRM && prescritor.UFCRM) {
        return `${item.nome} (CRM ${prescritor.numeroCRM}/${prescritor.UFCRM})`;
      }
    }
    return item.nome;
  }

  getSecondaryText(item: Cliente | Vendedor | Prescritor): string | null {
    if (this.type === 'cliente') {
      const cliente = item as Cliente;
      // Mostrar apenas a unidade (CPF só aparece no cadastro)
      if (cliente.unidade) {
        return `Unidade: ${cliente.unidade}`;
      }
    }
    if (this.type === 'vendedor') {
      const vendedor = item as Vendedor;
      if (vendedor.unidade) {
        return `Unidade: ${vendedor.unidade}`;
      }
    }
    return null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: string | null): void {
    if (!value) {
      this.selectedItem = null;
      this.searchText = '';
      return;
    }

    // Se temos um ID, buscar o item completo
    // Por enquanto, apenas limpar se não houver item selecionado
    if (!this.selectedItem || this.selectedItem.id !== value) {
      // O item será buscado quando o formulário for inicializado com dados
      this.searchText = '';
      this.selectedItem = null;
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Método público para inicializar com um item já selecionado
  setSelectedItem(item: Cliente | Vendedor | Prescritor | null): void {
    if (item) {
      this.selectedItem = item;
      this.searchText = item.nome;
      this.onChange(item.id);
      this.selected.emit(item);
    } else {
      this.clearSelection();
    }
  }

  // Verificar se usuário pode criar novo item (cliente ou prescritor)
  canCreateNew(): boolean {
    if (this.type === 'cliente') {
      return this.authService.hasPermission(Permission.CLIENTE_CREATE);
    }
    if (this.type === 'prescritor') {
      return this.authService.hasPermission(Permission.PRESCRITOR_CREATE);
    }
    return false;
  }

  // Método para criar novo item
  onCreateNew(): void {
    if (this.searchText.trim().length >= 2 && this.canCreateNew()) {
      this.createNew.emit(this.searchText.trim());
      this.showDropdown = false;
      this.highlightedIndex = -1;
    }
  }
}
