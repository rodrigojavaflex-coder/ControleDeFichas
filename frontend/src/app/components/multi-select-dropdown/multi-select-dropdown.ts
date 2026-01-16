import { Component, Input, Output, EventEmitter, forwardRef, HostListener, ElementRef, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface MultiSelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectDropdownComponent),
      multi: true
    }
  ],
  templateUrl: './multi-select-dropdown.html',
  styleUrls: ['./multi-select-dropdown.css']
})
export class MultiSelectDropdownComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: MultiSelectOption[] = [];
  @Input() placeholder: string = 'Selecione...';
  @Input() disabled: boolean = false;
  @Input() selectAllLabel: string = 'Marcar todos';
  @Input() deselectAllLabel: string = 'Desmarcar todos';

  @Output() selectionChange = new EventEmitter<any[]>();

  selectedValues: any[] = [];
  isOpen = false;
  private dropdownElement: HTMLElement | null = null;
  private onChange = (value: any[]) => {};
  private onTouched = () => {};

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {
    // Limpar elementos órfãos do multi-select-dropdown ao inicializar
    // Isso previne que dropdowns deixados no body após reiniciar a aplicação bloqueiem a interface
    const orphanDropdowns = document.body.querySelectorAll('.multi-select-dropdown-body');
    orphanDropdowns.forEach(dropdown => dropdown.remove());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    
    const target = event.target as HTMLElement;
    if (!target) {
      this.closeDropdown();
      return;
    }
    
    // Verificar se o clique foi dentro do componente (trigger)
    const clickedInsideComponent = this.elementRef.nativeElement.contains(target);
    
    // Verificar se o clique foi dentro do dropdown (que está no body)
    let clickedInsideDropdown = false;
    if (this.dropdownElement && document.body.contains(this.dropdownElement)) {
      clickedInsideDropdown = this.dropdownElement.contains(target);
    }
    
    // Fechar se clicar fora de ambos
    if (!clickedInsideComponent && !clickedInsideDropdown) {
      // Pequeno delay para evitar fechar imediatamente ao abrir
      setTimeout(() => {
        if (this.isOpen) {
          this.closeDropdown();
        }
      }, 0);
    }
  }
  
  @HostListener('document:focusin', ['$event'])
  onDocumentFocus(event: FocusEvent): void {
    if (!this.isOpen) return;
    
    const target = event.target as HTMLElement;
    if (!target) return;
    
    // Fechar se o foco sair do componente e do dropdown
    const focusedInsideComponent = this.elementRef.nativeElement.contains(target);
    const focusedInsideDropdown = this.dropdownElement?.contains(target);
    
    if (!focusedInsideComponent && !focusedInsideDropdown) {
      // Pequeno delay para permitir que outros componentes recebam o foco primeiro
      setTimeout(() => {
        if (this.isOpen && document.activeElement && 
            !this.elementRef.nativeElement.contains(document.activeElement) &&
            !this.dropdownElement?.contains(document.activeElement)) {
          this.closeDropdown();
        }
      }, 100);
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    if (this.isOpen) {
      this.updateDropdownPosition();
    }
  }

  private setupModalScrollListener(): void {
    // Escutar scroll no modal-corpo também
    const modalCorpo = document.querySelector('.modal-corpo');
    if (modalCorpo) {
      const scrollHandler = () => {
        if (this.isOpen) {
          this.updateDropdownPosition();
        }
      };
      modalCorpo.addEventListener('scroll', scrollHandler, true);
      // Armazenar handler para remover depois
      (this as any)._modalScrollHandler = scrollHandler;
      (this as any)._modalCorpo = modalCorpo;
    }
  }

  private removeModalScrollListener(): void {
    const modalCorpo = (this as any)._modalCorpo;
    const scrollHandler = (this as any)._modalScrollHandler;
    if (modalCorpo && scrollHandler) {
      modalCorpo.removeEventListener('scroll', scrollHandler, true);
      (this as any)._modalScrollHandler = null;
      (this as any)._modalCorpo = null;
    }
  }

  get displayText(): string {
    if (this.selectedValues.length === 0) {
      return this.placeholder;
    }
    if (this.selectedValues.length === 1) {
      const option = this.options.find(opt => opt.value === this.selectedValues[0]);
      return option?.label || this.selectedValues[0];
    }
    return `${this.selectedValues.length} selecionado(s)`;
  }

  get allSelected(): boolean {
    return this.options.length > 0 && this.selectedValues.length === this.options.length;
  }

  get someSelected(): boolean {
    return this.selectedValues.length > 0 && this.selectedValues.length < this.options.length;
  }

  toggleDropdown(): void {
    if (!this.disabled) {
      if (this.isOpen) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    }
  }

  private openDropdown(): void {
    this.isOpen = true;
    // Primeiro criar o dropdown no body
    this.createDropdownInBody();
    this.setupModalScrollListener();
    
    // Aguardar o elemento estar no DOM e então calcular posição
    // Usar múltiplas tentativas para garantir que funciona
    let attempts = 0;
    const tryPosition = () => {
      attempts++;
      if (this.dropdownElement && document.body.contains(this.dropdownElement)) {
        this.updateDropdownPosition();
      } else if (attempts < 5) {
        requestAnimationFrame(tryPosition);
      }
    };
    requestAnimationFrame(tryPosition);
  }

  private closeDropdown(): void {
    this.isOpen = false;
    this.removeDropdownFromBody();
    this.removeModalScrollListener();
    this.onTouched();
  }

  private createDropdownInBody(): void {
    if (this.dropdownElement) return;

    const triggerElement = this.elementRef.nativeElement.querySelector('.multi-select-trigger');
    if (!triggerElement) return;

    // Verificar se está em tema escuro
    const isDarkTheme = document.body.classList.contains('theme-dark');

    // Criar elemento dropdown
    this.dropdownElement = this.renderer.createElement('div');
    this.renderer.addClass(this.dropdownElement, 'multi-select-dropdown-menu');
    this.renderer.addClass(this.dropdownElement, 'multi-select-dropdown-body');

    // Criar conteúdo do dropdown
    const selectAllOption = this.renderer.createElement('div');
    this.renderer.addClass(selectAllOption, 'multi-select-option');
    this.renderer.addClass(selectAllOption, 'select-all-option');
    
    // Aplicar estilos de tema escuro na opção "selecionar todos" se necessário
    if (isDarkTheme) {
      this.renderer.setStyle(selectAllOption, 'color', '#e5e7eb');
      this.renderer.setStyle(selectAllOption, 'background-color', 'rgba(59, 130, 246, 0.1)');
      this.renderer.setStyle(selectAllOption, 'border-bottom', '1px solid rgba(148, 163, 184, 0.3)');
    }
    
    const selectAllCheckbox = this.renderer.createElement('input');
    this.renderer.setAttribute(selectAllCheckbox, 'type', 'checkbox');
    this.renderer.setProperty(selectAllCheckbox, 'checked', this.allSelected);
    this.renderer.setProperty(selectAllCheckbox, 'indeterminate', this.someSelected && !this.allSelected);
    this.renderer.listen(selectAllCheckbox, 'change', () => this.toggleSelectAll());
    // Prevenir que o clique no checkbox propague para a linha
    this.renderer.listen(selectAllCheckbox, 'click', (e) => e.stopPropagation());
    
    const selectAllLabel = this.renderer.createElement('label');
    this.renderer.setProperty(selectAllLabel, 'textContent', this.allSelected ? this.deselectAllLabel : this.selectAllLabel);
    
    // Aplicar estilos de tema escuro no label se necessário
    if (isDarkTheme) {
      this.renderer.setStyle(selectAllLabel, 'color', '#e5e7eb');
    }
    
    // Adicionar listener de clique na linha inteira
    this.renderer.listen(selectAllOption, 'click', () => {
      this.toggleSelectAll();
    });
    
    this.renderer.appendChild(selectAllOption, selectAllCheckbox);
    this.renderer.appendChild(selectAllOption, selectAllLabel);
    this.renderer.appendChild(this.dropdownElement, selectAllOption);

    // Divider
    const divider = this.renderer.createElement('div');
    this.renderer.addClass(divider, 'multi-select-divider');
    // Aplicar estilos de tema escuro no divider se necessário
    if (isDarkTheme) {
      this.renderer.setStyle(divider, 'background-color', 'rgba(148, 163, 184, 0.3)');
    }
    this.renderer.appendChild(this.dropdownElement, divider);
    
    // Options list
    const optionsList = this.renderer.createElement('div');
    this.renderer.addClass(optionsList, 'multi-select-options-list');
    
    // Aplicar estilos de tema escuro na lista de opções se necessário
    if (isDarkTheme) {
      this.renderer.setStyle(optionsList, 'color', '#e5e7eb');
    }

    this.options.forEach(option => {
      const optionElement = this.renderer.createElement('div');
      this.renderer.addClass(optionElement, 'multi-select-option');
      
      // Aplicar estilos de tema escuro nas opções se necessário
      if (isDarkTheme) {
        this.renderer.setStyle(optionElement, 'color', '#e5e7eb');
      }
      
      const checkbox = this.renderer.createElement('input');
      this.renderer.setAttribute(checkbox, 'type', 'checkbox');
      this.renderer.setProperty(checkbox, 'checked', this.isSelected(option.value));
      this.renderer.listen(checkbox, 'change', () => this.toggleOption(option.value));
      // Prevenir que o clique no checkbox propague para a linha
      this.renderer.listen(checkbox, 'click', (e) => e.stopPropagation());
      
      const label = this.renderer.createElement('label');
      this.renderer.setProperty(label, 'textContent', option.label);
      
      // Aplicar estilos de tema escuro no label se necessário
      if (isDarkTheme) {
        this.renderer.setStyle(label, 'color', '#e5e7eb');
      }
      
      // Adicionar listener de clique na linha inteira
      this.renderer.listen(optionElement, 'click', () => {
        this.toggleOption(option.value);
      });
      
      this.renderer.appendChild(optionElement, checkbox);
      this.renderer.appendChild(optionElement, label);
      this.renderer.appendChild(optionsList, optionElement);
    });

    this.renderer.appendChild(this.dropdownElement, optionsList);
    this.renderer.appendChild(document.body, this.dropdownElement);
    // Não usar stopPropagation aqui - precisamos detectar cliques fora
  }

  private removeDropdownFromBody(): void {
    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
    }
  }

  private updateDropdownPosition(): void {
    if (!this.dropdownElement || !document.body.contains(this.dropdownElement)) {
      return;
    }

    // Usar o elemento raiz do componente, não apenas o trigger
    const componentElement = this.elementRef.nativeElement;
    const triggerElement = componentElement.querySelector('.multi-select-trigger');
    if (!triggerElement) {
      return;
    }

    // getBoundingClientRect retorna coordenadas relativas ao viewport
    // Usar o trigger para obter a posição exata
    const rect = triggerElement.getBoundingClientRect();
    
    // Garantir que temos valores válidos
    if (rect.width === 0 || rect.height === 0 || isNaN(rect.top) || isNaN(rect.left)) {
      setTimeout(() => this.updateDropdownPosition(), 50);
      return;
    }
    
    // getBoundingClientRect já retorna coordenadas relativas ao viewport
    // Mas algo está movendo o elemento após aplicar os estilos
    // Vamos aplicar os estilos primeiro e depois verificar a diferença para compensar
    // Colar o dropdown no componente (sem gap)
    let top = Math.round(rect.bottom);
    let left = Math.round(rect.left);
    // A largura do getBoundingClientRect já inclui padding e border
    // Vamos garantir que a largura seja exatamente igual, considerando bordas do dropdown
    const triggerComputedStyle = window.getComputedStyle(triggerElement);
    const triggerBorderLeft = parseFloat(triggerComputedStyle.borderLeftWidth) || 0;
    const triggerBorderRight = parseFloat(triggerComputedStyle.borderRightWidth) || 0;
    // A largura do dropdown deve ser igual à largura total do trigger
    // Adicionar um pequeno ajuste para compensar diferenças visuais
    const width = Math.round(rect.width + 11);
    
    // Se já temos um dropdownElement, verificar se há offset conhecido
    // Isso pode ser causado por algum parent com transform ou position
    if (this.dropdownElement && document.body.contains(this.dropdownElement)) {
      // Aplicar estilos temporariamente para medir o offset
      this.dropdownElement.style.position = 'fixed';
      this.dropdownElement.style.top = `${top}px`;
      this.dropdownElement.style.left = `${left}px`;
      void this.dropdownElement.offsetHeight; // Force reflow
      
      const actualRect = this.dropdownElement.getBoundingClientRect();
      const topDiff = actualRect.top - top;
      const leftDiff = actualRect.left - left;
      
      // Se houver diferença, ajustar
      if (Math.abs(topDiff) > 1 || Math.abs(leftDiff) > 1) {
        top = Math.round(top - topDiff);
        left = Math.round(left - leftDiff);
      }
    }
    
    // Aplicar estilos diretamente no elemento ANTES do log
    // Remover TODAS as classes para evitar herança de CSS
    this.dropdownElement.className = '';
    
    // Limpar TODOS os estilos inline primeiro
    this.dropdownElement.removeAttribute('style');
    this.dropdownElement.removeAttribute('class');
    
    // Resetar TODOS os estilos que podem ser herdados
    const resetStyles = [
      `all: initial`,
      `display: block`,
      `box-sizing: border-box`,
      `font-family: inherit`,
      `font-size: 0.875rem`,
      `line-height: 1.5`
    ].join('; ');
    
    // Verificar se está em tema escuro
    const isDarkTheme = document.body.classList.contains('theme-dark');
    
    // Aplicar estilos usando cssText para garantir que todos sejam aplicados de uma vez
    // Usar valores absolutos e resetar tudo que pode interferir
    const styles = [
      resetStyles,
      `position: fixed !important`,
      `top: ${top}px !important`,
      `left: ${left}px !important`,
      `width: ${width}px !important`,
      `min-width: ${width}px !important`,
      `max-width: ${width}px !important`,
      `box-sizing: border-box !important`,
      `z-index: 10001 !important`,
      `max-height: 300px !important`,
      `overflow-y: auto !important`,
      `background-color: ${isDarkTheme ? '#1f2937' : '#ffffff'} !important`,
      `border: 1px solid ${isDarkTheme ? 'rgba(148, 163, 184, 0.3)' : '#d1d5db'} !important`,
      `border-radius: 8px !important`,
      `box-shadow: ${isDarkTheme ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'} !important`,
      `right: auto !important`,
      `bottom: auto !important`,
      `margin: 0 !important`,
      `padding: 0 !important`,
      `transform: none !important`,
      `translate: none !important`,
      `display: block !important`,
      `visibility: visible !important`,
      `opacity: 1 !important`,
      `float: none !important`,
      `clear: none !important`
    ].join('; ');
    
    this.dropdownElement.setAttribute('style', styles);
    
    // Forçar reflow para garantir que os estilos sejam aplicados
    void this.dropdownElement.offsetHeight;
    
    // Obter boundingRect DEPOIS de aplicar estilos para ver onde realmente está
    const dropdownRect = this.dropdownElement.getBoundingClientRect();
    const dropdownComputedStyle = window.getComputedStyle(this.dropdownElement);
    
    // Verificar se a largura está correta e corrigir se necessário
    // O dropdown deve ter exatamente a mesma largura do trigger
    // Considerar que o dropdown tem border de 1px de cada lado (2px total)
    const widthDiff = dropdownRect.width - width;
    
    if (Math.abs(widthDiff) > 0.5) {
      // A largura do dropdown inclui bordas (box-sizing: border-box)
      // Se a largura atual for menor, precisamos aumentar
      // Se for maior, precisamos diminuir
      const correctedWidth = width - widthDiff;
      
      this.dropdownElement.style.setProperty('width', `${correctedWidth}px`, 'important');
      this.dropdownElement.style.setProperty('min-width', `${correctedWidth}px`, 'important');
      this.dropdownElement.style.setProperty('max-width', `${correctedWidth}px`, 'important');
      
      // Forçar reflow e verificar novamente
      void this.dropdownElement.offsetHeight;
      
      // Verificar novamente após correção
      requestAnimationFrame(() => {
        if (this.dropdownElement) {
          const newRect = this.dropdownElement.getBoundingClientRect();
          const newWidthDiff = newRect.width - width;
          
          if (Math.abs(newWidthDiff) > 0.5) {
            // Aplicar correção mais precisa
            const finalWidth = width - newWidthDiff;
            this.dropdownElement.style.setProperty('width', `${finalWidth}px`, 'important');
            this.dropdownElement.style.setProperty('min-width', `${finalWidth}px`, 'important');
            this.dropdownElement.style.setProperty('max-width', `${finalWidth}px`, 'important');
            
            // Última verificação
            requestAnimationFrame(() => {
              if (this.dropdownElement) {
                const finalRect = this.dropdownElement.getBoundingClientRect();
                const finalWidthDiff = finalRect.width - width;
                if (Math.abs(finalWidthDiff) > 0.5) {
                  const ultimateWidth = width - finalWidthDiff;
                  this.dropdownElement.style.setProperty('width', `${ultimateWidth}px`, 'important');
                  this.dropdownElement.style.setProperty('min-width', `${ultimateWidth}px`, 'important');
                  this.dropdownElement.style.setProperty('max-width', `${ultimateWidth}px`, 'important');
                }
              }
            });
          }
        }
      });
    }
    
    
    // Se houver diferença, tentar corrigir
    if (Math.abs(dropdownRect.top - top) > 1 || Math.abs(dropdownRect.left - left) > 1) {
      // Aplicar correção compensando o offset medido
      const correctedTop = Math.round(top - (dropdownRect.top - top));
      const correctedLeft = Math.round(left - (dropdownRect.left - left));
      
      this.dropdownElement.style.setProperty('top', `${correctedTop}px`, 'important');
      this.dropdownElement.style.setProperty('left', `${correctedLeft}px`, 'important');
      
      // Verificar novamente após correção e aplicar correção final se necessário
      requestAnimationFrame(() => {
        if (this.dropdownElement) {
          const newRect = this.dropdownElement.getBoundingClientRect();
          const finalTopDiff = newRect.top - top;
          const finalLeftDiff = newRect.left - left;
          
          if (Math.abs(finalTopDiff) > 1 || Math.abs(finalLeftDiff) > 1) {
            const finalTop = Math.round(top - finalTopDiff);
            const finalLeft = Math.round(left - finalLeftDiff);
            this.dropdownElement.style.setProperty('top', `${finalTop}px`, 'important');
            this.dropdownElement.style.setProperty('left', `${finalLeft}px`, 'important');
          }
        }
      });
    }
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedValues = [];
    } else {
      this.selectedValues = this.options.map(opt => opt.value);
    }
    this.updateValue();
    this.updateDropdownContent();
  }

  toggleOption(value: any): void {
    const index = this.selectedValues.indexOf(value);
    if (index > -1) {
      this.selectedValues.splice(index, 1);
    } else {
      this.selectedValues.push(value);
    }
    this.updateValue();
    this.updateDropdownContent();
  }

  private updateDropdownContent(): void {
    if (!this.dropdownElement) return;

    const selectAllCheckbox = this.dropdownElement.querySelector('.select-all-option input[type="checkbox"]') as HTMLInputElement;
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = this.allSelected;
      selectAllCheckbox.indeterminate = this.someSelected && !this.allSelected;
    }

    const selectAllLabel = this.dropdownElement.querySelector('.select-all-option label');
    if (selectAllLabel) {
      selectAllLabel.textContent = this.allSelected ? this.deselectAllLabel : this.selectAllLabel;
    }

    this.options.forEach((option, index) => {
      const optionElement = this.dropdownElement?.querySelectorAll('.multi-select-options-list .multi-select-option')[index];
      if (optionElement) {
        const checkbox = optionElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = this.isSelected(option.value);
        }
      }
    });
  }

  isSelected(value: any): boolean {
    return this.selectedValues.includes(value);
  }

  private updateValue(): void {
    this.onChange(this.selectedValues);
    this.selectionChange.emit([...this.selectedValues]);
  }

  ngOnDestroy(): void {
    this.removeDropdownFromBody();
    this.removeModalScrollListener();
  }

  // ControlValueAccessor implementation
  writeValue(value: any[]): void {
    if (value && Array.isArray(value)) {
      this.selectedValues = [...value];
    } else {
      this.selectedValues = [];
    }
  }

  registerOnChange(fn: (value: any[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
