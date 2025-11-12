import { Injectable, signal, effect } from '@angular/core';

export type Tema = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class TemaService {
  private readonly CHAVE_TEMA = 'app-tema';
  
  // Signal reativo para o tema atual
  public readonly temaAtual = signal<Tema>(this.obterTemaSalvo());
  
  constructor() {
    // Aplicar tema inicial
    this.aplicarTema(this.temaAtual());
    
    // Effect para sincronizar mudanças de tema
    effect(() => {
      const tema = this.temaAtual();
      this.aplicarTema(tema);
      this.salvarTema(tema);
    });
    
    // Observar mudanças de preferência do sistema
    this.observarPreferenciaSistema();
  }
  
  /**
   * Alterna entre tema claro e escuro
   */
  alternarTema(): void {
    const novoTema: Tema = this.temaAtual() === 'light' ? 'dark' : 'light';
    this.temaAtual.set(novoTema);
  }
  
  /**
   * Define um tema específico
   */
  definirTema(tema: Tema): void {
    this.temaAtual.set(tema);
  }
  
  /**
   * Verifica se o tema atual é escuro
   */
  get temaEscuro(): boolean {
    return this.temaAtual() === 'dark';
  }
  
  /**
   * Verifica se o tema atual é claro
   */
  get temaClaro(): boolean {
    return this.temaAtual() === 'light';
  }
  
  /**
   * Aplica o tema no documento
   */
  private aplicarTema(tema: Tema): void {
    document.documentElement.setAttribute('data-theme', tema);
    
    // Adicionar classe para compatibilidade com código legado
    if (tema === 'dark') {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
  }
  
  /**
   * Salva o tema no localStorage
   */
  private salvarTema(tema: Tema): void {
    try {
      localStorage.setItem(this.CHAVE_TEMA, tema);
    } catch (error) {
      console.warn('Não foi possível salvar o tema no localStorage:', error);
    }
  }
  
  /**
   * Obtém o tema salvo ou detecta a preferência do sistema
   */
  private obterTemaSalvo(): Tema {
    try {
      const temaSalvo = localStorage.getItem(this.CHAVE_TEMA) as Tema;
      if (temaSalvo === 'light' || temaSalvo === 'dark') {
        return temaSalvo;
      }
    } catch (error) {
      console.warn('Não foi possível ler o tema do localStorage:', error);
    }
    
    // Detectar preferência do sistema
    return this.detectarPreferenciaSistema();
  }
  
  /**
   * Detecta a preferência de tema do sistema operacional
   */
  private detectarPreferenciaSistema(): Tema {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefereTemaEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefereTemaEscuro ? 'dark' : 'light';
    }
    return 'light'; // Padrão
  }
  
  /**
   * Observa mudanças na preferência de tema do sistema
   */
  private observarPreferenciaSistema(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Listener para mudanças de preferência do sistema
      const listener = (event: MediaQueryListEvent) => {
        // Apenas atualizar se não houver preferência salva pelo usuário
        try {
          const temaSalvo = localStorage.getItem(this.CHAVE_TEMA);
          if (!temaSalvo) {
            const novoTema: Tema = event.matches ? 'dark' : 'light';
            this.temaAtual.set(novoTema);
          }
        } catch (error) {
          console.warn('Erro ao observar preferência do sistema:', error);
        }
      };
      
      // Adicionar listener (suporte para navegadores antigos e novos)
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(listener);
      }
    }
  }
  
  /**
   * Reseta o tema para a preferência do sistema
   */
  resetarTema(): void {
    try {
      localStorage.removeItem(this.CHAVE_TEMA);
      const temaSistema = this.detectarPreferenciaSistema();
      this.temaAtual.set(temaSistema);
    } catch (error) {
      console.warn('Erro ao resetar tema:', error);
    }
  }
  
  /**
   * Obtém informações sobre o tema atual
   */
  obterInfoTema() {
    return {
      tema: this.temaAtual(),
      escuro: this.temaEscuro,
      claro: this.temaClaro,
      preferenciasSistema: this.detectarPreferenciaSistema()
    };
  }
}
