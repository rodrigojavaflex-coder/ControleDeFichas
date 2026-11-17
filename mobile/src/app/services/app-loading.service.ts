import { Injectable } from '@angular/core';

/**
 * Loading padrão do app: logo + círculo animado (mesmo visual do boot).
 */
@Injectable({ providedIn: 'root' })
export class AppLoadingService {
  private profundidade = 0;
  private overlay: HTMLElement | null = null;
  private textoEl: HTMLElement | null = null;

  async show(mensagem = 'Carregando…'): Promise<void> {
    this.profundidade += 1;
    this.garantirOverlay();
    if (this.textoEl) {
      this.textoEl.textContent = mensagem;
    }
    this.overlay?.classList.remove('is-hidden');
    this.overlay?.setAttribute('aria-busy', 'true');
  }

  async dismiss(): Promise<void> {
    this.profundidade = Math.max(0, this.profundidade - 1);
    if (this.profundidade > 0) {
      return;
    }
    if (!this.overlay) {
      return;
    }
    this.overlay.classList.add('is-hidden');
    this.overlay.setAttribute('aria-busy', 'false');
    window.setTimeout(() => {
      if (this.profundidade === 0 && this.overlay?.parentElement) {
        this.overlay.remove();
        this.overlay = null;
        this.textoEl = null;
      }
    }, 280);
  }

  private garantirOverlay(): void {
    if (this.overlay) {
      return;
    }
    const root = document.createElement('div');
    root.id = 'app-brand-loading';
    root.className = 'app-brand-loading';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = `
      <div class="app-brand-loading__mark" aria-hidden="true">
        <img class="app-brand-loading__logo" src="${this.logoSrc()}" alt="" width="96" height="96" />
        <span class="app-brand-loading__ring"></span>
      </div>
      <p class="app-brand-loading__text">Carregando…</p>
    `;
    this.textoEl = root.querySelector('.app-brand-loading__text');
    document.body.appendChild(root);
    this.overlay = root;
  }

  /**
   * Sempre na raiz do WebView. Relativo ao path atual quebra em
   * /visitas/:id → /visitas/boot-logo.png (ícone quebrado no loading).
   */
  private logoSrc(): string {
    try {
      const origem =
        typeof window !== 'undefined' && window.location?.origin
          ? `${window.location.origin}/`
          : document.baseURI;
      return new URL('boot-logo.png', origem).href;
    } catch {
      return `${window.location.origin}/boot-logo.png`;
    }
  }
}
