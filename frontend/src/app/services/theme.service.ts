import { Injectable, inject, EventEmitter } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { UserService } from './user.service';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'app-theme';
  private themeSubject = new BehaviorSubject<Theme>('light');
  private isInitialized = false;
  private currentUserId: string | null = null;
  private userService = inject(UserService);
  
  currentTheme$ = this.themeSubject.asObservable();
  
  // EventEmitter para notificar mudança de tema
  themeChanged = new EventEmitter<{theme: Theme, message: string}>();
  
  constructor() {
    // Não inicializar tema automaticamente - será iniciado após login
  }
  
  initializeTheme(userId?: string, userTema?: string, forceReset: boolean = false): void {
    // Se forceReset for true, resetar antes de continuar
    if (forceReset) {
      this.isInitialized = false;
    }
    
    if (this.isInitialized && !forceReset) {
      return;
    }
    
    this.currentUserId = userId || null;
    
    // Lógica de tema após login:
    // 1. Se usuário tem tema salvo (não nulo/vazio), usar esse tema
    // 2. Se tema é nulo/vazio, usar 'light' (Claro) como padrão
    let theme: Theme = 'light'; // padrão é sempre claro
    
    if (userTema && userTema.trim()) {
      // Usuário tem tema definido - converter para formato interno
      const convertedTheme = this.convertTemaToTheme(userTema);
      if (convertedTheme) {
        theme = convertedTheme;
      }
    }
    
    // Aplicar o tema imediatamente (sem salvar no servidor)
    this.setTheme(theme, false);
    this.isInitialized = true;
    
    //console.log(`🎨 Tema inicializado: ${userTema || 'padrão'} → ${theme}`);
  }

  private convertTemaToTheme(tema?: string): Theme | null {
    if (!tema) return null;
    switch (tema) {
      case 'Claro': return 'light';
      case 'Escuro': return 'dark';
      default: return null;
    }
  }

  private convertThemeToTema(theme: Theme): string {
    switch (theme) {
      case 'light': return 'Claro';
      case 'dark': return 'Escuro';
      default: return 'Claro';
    }
  }
  
  private detectPreferredTheme(): Theme {
    // Se não há preferência salva, usar tema do navegador
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  
  setTheme(theme: Theme, saveToServer: boolean = true): void {
    this.themeSubject.next(theme);
    localStorage.setItem(this.THEME_STORAGE_KEY, theme);
    this.updateBodyClass(theme);
    
    if (this.isInitialized) {
      // Emitir evento para mostrar notificação via componente
      const message = `Tema ${theme === 'dark' ? 'Escuro' : 'Claro'} ativado`;
      this.themeChanged.emit({ theme, message });
      
      // Salvar tema no servidor se usuário estiver logado
      if (saveToServer && this.currentUserId) {
        this.saveThemeToServer(theme);
      }
    }
  }
  
  private async saveThemeToServer(theme: Theme): Promise<void> {
    if (!this.currentUserId) {
      console.warn('Usuário não está logado, tema não será salvo no servidor');
      return;
    }

    try {
      const tema = this.convertThemeToTema(theme);
      
      // Usar firstValueFrom ao invés de toPromise (deprecated)
      await firstValueFrom(this.userService.updateTema(this.currentUserId, tema));
      //console.log('✅ Tema salvo no servidor:', tema);
      
      // CORREÇÃO: Atualizar o usuário no localStorage com o novo tema
      this.updateUserThemeInLocalStorage(tema);
      
    } catch (error: any) {
      console.warn('❌ Erro ao salvar tema no servidor:', error);
      
      // Se for erro de validação, mostrar mensagem específica
      if (error?.status === 400 || error?.status === 409) {
        console.error('Erro de validação do tema:', error.error?.message || error.message);
      }
    }
  }
  
  /**
   * Atualiza o tema do usuário no localStorage
   * Isso garante que no refresh o tema correto seja aplicado
   */
  private updateUserThemeInLocalStorage(tema: string): void {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.tema = tema;
        localStorage.setItem('user', JSON.stringify(user));
        //console.log('📱 localStorage atualizado com tema:', tema);
        
        // Também atualizar o current user do AuthService se disponível
        this.updateAuthServiceCurrentUser(tema);
      }
    } catch (error) {
      console.warn('Erro ao atualizar tema no localStorage:', error);
    }
  }
  
  /**
   * Atualiza o tema no AuthService (evita dependência circular)
   */
  private updateAuthServiceCurrentUser(tema: string): void {
    try {
      // Usar uma abordagem que evita dependência circular
      const authService = (window as any).__authService;
      if (authService && authService.updateCurrentUserTheme) {
        authService.updateCurrentUserTheme(tema);
      }
    } catch (error) {
      console.warn('Não foi possível atualizar AuthService:', error);
    }
  }
  
  toggleTheme(): void {
    const currentTheme = this.themeSubject.value;
    const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme, true); // Salvar no servidor
  }
  
  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  /**
   * Reseta o tema para permitir nova inicialização
   * Remove classes CSS do body e marca como não inicializado
   */
  resetTheme(): void {
    // Remover classes de tema do body para voltar ao comportamento padrão do navegador
    document.body.classList.remove('theme-light', 'theme-dark');
    
    // Marcar como não inicializado para permitir nova inicialização
    this.isInitialized = false;
    this.currentUserId = null;
    
    // Reset do subject para estado inicial
    this.themeSubject.next('light');
  }
  
  private updateBodyClass(theme: Theme): void {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add(`theme-${theme}`);
  }
}