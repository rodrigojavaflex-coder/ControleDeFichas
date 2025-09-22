import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private isExpandedSubject = new BehaviorSubject<boolean>(true);
  private isPinnedSubject = new BehaviorSubject<boolean>(true);
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);

  public isExpanded$ = this.isExpandedSubject.asObservable();
  public isPinned$ = this.isPinnedSubject.asObservable();
  public isMobileOpen$ = this.isMobileOpenSubject.asObservable();

  constructor() {
    this.loadSettings();
    this.setupMobileDetection();
  }

  get isExpanded(): boolean {
    return this.isExpandedSubject.value;
  }

  get isPinned(): boolean {
    return this.isPinnedSubject.value;
  }

  get isMobileOpen(): boolean {
    return this.isMobileOpenSubject.value;
  }

  toggleExpanded(): void {
    const newValue = !this.isExpandedSubject.value;
    this.isExpandedSubject.next(newValue);
    this.saveSettings();
  }

  togglePinned(): void {
    const newValue = !this.isPinnedSubject.value;
    this.isPinnedSubject.next(newValue);
    
    // Se desafixar, colapsar automaticamente
    if (!newValue) {
      this.isExpandedSubject.next(false);
    }
    
    this.saveSettings();
  }

  toggleMobile(): void {
    const newValue = !this.isMobileOpenSubject.value;
    this.isMobileOpenSubject.next(newValue);
  }

  closeMobile(): void {
    this.isMobileOpenSubject.next(false);
  }

  setExpanded(expanded: boolean): void {
    this.isExpandedSubject.next(expanded);
  }

  /**
   * Reseta as configurações para os valores padrão
   */
  resetToDefault(): void {
    this.isExpandedSubject.next(true);
    this.isPinnedSubject.next(true);
    this.saveSettings();
  }

  private loadSettings(): void {
    const settings = localStorage.getItem('navigationSettings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        this.isExpandedSubject.next(parsed.isExpanded ?? true);
        this.isPinnedSubject.next(parsed.isPinned ?? true);
      } catch (error) {
        console.warn('Erro ao carregar configurações do menu:', error);
        // Em caso de erro, usar valores padrão
        this.isExpandedSubject.next(true);
        this.isPinnedSubject.next(true);
      }
    } else {
      // Primeira vez - garantir que os valores padrão são aplicados
      this.isExpandedSubject.next(true);
      this.isPinnedSubject.next(true);
    }
  }

  private saveSettings(): void {
    const settings = {
      isExpanded: this.isExpandedSubject.value,
      isPinned: this.isPinnedSubject.value
    };
    localStorage.setItem('navigationSettings', JSON.stringify(settings));
  }

  private setupMobileDetection(): void {
    // Detectar mudanças de tamanho da tela
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      
      const handleMobileChange = (e: MediaQueryListEvent | MediaQueryList) => {
        if (e.matches) {
          // Modo mobile - fechar menu mobile por padrão
          this.isMobileOpenSubject.next(false);
        }
      };

      mediaQuery.addEventListener('change', handleMobileChange);
      handleMobileChange(mediaQuery);
    }
  }
}