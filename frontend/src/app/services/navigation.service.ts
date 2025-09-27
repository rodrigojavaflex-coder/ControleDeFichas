import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class NavigationService {
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false); // Menu sempre inicia fechado

  public isMobileOpen$ = this.isMobileOpenSubject.asObservable();

  constructor() {
    this.setupMobileDetection();
  }

  get isMobileOpen(): boolean {
    return this.isMobileOpenSubject.value;
  }

  toggleMobile(): void {
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) {
      // Em desktop, apenas alternamos o estado de "aberto"
      const newValue = !this.isMobileOpenSubject.value;
      this.isMobileOpenSubject.next(newValue);
    } else {
      // Em mobile, usamos o comportamento de abrir/fechar
      const newValue = !this.isMobileOpenSubject.value;
      this.isMobileOpenSubject.next(newValue);
    }
  }

  closeMobile(): void {
    const isDesktop = window.innerWidth > 768;
    if (!isDesktop) {
      this.isMobileOpenSubject.next(false);
    }
  }

  /**
   * Fecha o menu ao navegar (funciona tanto em mobile quanto desktop)
   */
  closeOnNavigation(): void {
    this.isMobileOpenSubject.next(false);
  }

  private setupMobileDetection(): void {
    // Detectar mudanças de tamanho da tela
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      
      const handleMobileChange = (e: MediaQueryListEvent | MediaQueryList) => {
        if (e.matches) {
          // Modo mobile - fechar menu mobile por padrão
          this.isMobileOpenSubject.next(false);
        } else {
          // Modo desktop - manter menu fechado por padrão
          this.isMobileOpenSubject.next(false);
        }
      };

      mediaQuery.addEventListener('change', handleMobileChange);
      handleMobileChange(mediaQuery);
    }
  }
}