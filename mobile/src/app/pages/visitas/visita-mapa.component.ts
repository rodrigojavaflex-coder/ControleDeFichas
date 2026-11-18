import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { VisitasService } from '../../services/visitas.service';

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    __farmaMapsCallbacks?: Record<string, () => void>;
  }
}

/**
 * Mapa da visita: tenta Google Maps JS (mesmo padrão OMNI).
 * No Capacitor a origem é https://localhost — se a chave não permitir esse referrer,
 * cai automaticamente para OpenStreetMap (mapa visível) + link “Abrir no Google Maps”.
 */
@Component({
  selector: 'app-visita-mapa',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mapa-wrap">
      @if (erro && !usarFallback) {
        <p class="mapa-erro">{{ erro }}</p>
      } @else if (carregando) {
        <p class="mapa-estado">Carregando mapa…</p>
      }

      @if (usarFallback && fallbackUrl) {
        <iframe
          class="mapa-iframe"
          title="Mapa da localização"
          [src]="fallbackUrl"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"></iframe>
      } @else {
        <div
          #container
          class="mapa-container"
          [class.mapa-container--oculto]="!!erro || carregando"></div>
      }

      @if (!carregando && temCoordenada && nomeMarcador && usarFallback) {
        <div class="mapa-marcador-nome" aria-hidden="true">{{ nomeMarcador }}</div>
      }

      @if (!carregando && temCoordenada) {
        <div class="mapa-acoes">
          <button type="button" class="mapa-abrir" (click)="abrirNoMaps()">
            Abrir no Google Maps
          </button>
          @if (usarFallback) {
            <span class="mapa-nota">Visualização alternativa · use o botão para o Google Maps</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .mapa-wrap {
        position: relative;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--ion-color-step-150, #e2e8f0);
        background: var(--ion-color-step-50, #f8fafc);
      }
      .mapa-container,
      .mapa-iframe {
        display: block;
        width: 100%;
        height: 480px;
        border: 0;
      }
      .mapa-container--oculto {
        position: absolute;
        inset: 0;
        height: 480px;
        opacity: 0;
        pointer-events: none;
      }
      .mapa-marcador-nome {
        position: absolute;
        top: 12px;
        left: 50%;
        z-index: 2;
        max-width: calc(100% - 24px);
        transform: translateX(-50%);
        padding: 6px 10px;
        border-radius: 8px;
        background: #fff;
        color: #0f172a;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.22);
        font-size: 0.78rem;
        font-weight: 800;
        line-height: 1.25;
        text-align: center;
        overflow-wrap: anywhere;
        pointer-events: none;
      }
      .mapa-erro,
      .mapa-estado {
        margin: 0;
        padding: 16px;
        font-size: 0.88rem;
        color: var(--ion-color-medium, #64748b);
      }
      .mapa-erro {
        color: var(--ion-color-danger, #eb445a);
      }
      .mapa-acoes {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--ion-color-step-150, #e2e8f0);
        background: var(--ion-card-background, #fff);
      }
      .mapa-abrir {
        align-self: flex-start;
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.86rem;
        font-weight: 700;
        color: #fff;
        background: var(--ion-color-primary, #c6284a);
      }
      .mapa-abrir:active {
        opacity: 0.88;
      }
      .mapa-nota {
        font-size: 0.72rem;
        color: var(--ion-color-medium, #64748b);
      }
    `,
  ],
})
export class VisitaMapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('container')
  container?: ElementRef<HTMLDivElement>;

  @Input({ required: true }) latitude!: number;
  @Input({ required: true }) longitude!: number;
  @Input() titulo = '';

  private readonly visitas = inject(VisitasService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);

  private mapa: any = null;
  private marcador: any = null;
  private infoWindow: any = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private authFailureAnterior: (() => void) | undefined;

  carregando = true;
  erro: string | null = null;
  usarFallback = false;
  fallbackUrl: SafeResourceUrl | null = null;

  ngAfterViewInit(): void {
    void this.inicializar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!(changes['latitude'] || changes['longitude'] || changes['titulo'])) {
      return;
    }
    if (this.usarFallback) {
      this.montarFallback();
      return;
    }
    if (this.mapa) {
      this.atualizarPosicao();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (window.gm_authFailure === this.onAuthFailure) {
      window.gm_authFailure = this.authFailureAnterior;
    }
    try {
      this.infoWindow?.close?.();
      this.marcador?.setMap?.(null);
      const eventos = window.google?.maps?.event;
      if (eventos && this.mapa) {
        eventos.clearInstanceListeners(this.mapa);
      }
    } catch {
      // o mapa já pode ter sido removido do DOM
    }
    this.infoWindow = null;
    this.marcador = null;
    this.mapa = null;
    document
      .querySelectorAll('body > .gm-err-container, body > .dismissButton')
      .forEach((el) => el.remove());
  }

  get temCoordenada(): boolean {
    return Number.isFinite(this.lat()) && Number.isFinite(this.lng());
  }

  get nomeMarcador(): string {
    return String(this.titulo ?? '').trim();
  }

  lat(): number {
    return Number(this.latitude);
  }

  lng(): number {
    return Number(this.longitude);
  }

  abrirNoMaps(): void {
    const lat = this.lat();
    const lng = this.lng();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  private readonly onAuthFailure = (): void => {
    this.ativarFallback(
      'Chave do Google Maps sem permissão para este app (referrer).',
    );
  };

  private async inicializar(): Promise<void> {
    if (!Number.isFinite(this.lat()) || !Number.isFinite(this.lng())) {
      this.carregando = false;
      this.erro = 'Coordenada de início indisponível.';
      this.cdr.markForCheck();
      return;
    }

    this.authFailureAnterior = window.gm_authFailure;
    window.gm_authFailure = this.onAuthFailure;

    try {
      const { key } = await firstValueFrom(this.visitas.googleMapsKey());
      if (!key?.trim()) {
        this.ativarFallback('Chave do Google Maps não configurada.');
        return;
      }
      await this.carregarScript(key.trim());
      if (this.destroyed || this.usarFallback) return;
      await this.criarMapa();
      if (this.destroyed || this.usarFallback) return;
      this.carregando = false;
      this.agendarResize();
      // Se o Google injetar o painel de erro após o create, troca para OSM
      window.setTimeout(() => this.detectarErroVisualGoogle(), 1200);
      this.cdr.markForCheck();
    } catch {
      if (this.destroyed) return;
      this.ativarFallback('Não foi possível carregar o Google Maps.');
    }
  }

  private ativarFallback(motivo: string): void {
    if (this.destroyed || this.usarFallback) return;
    this.erro = motivo;
    this.usarFallback = true;
    this.carregando = false;
    this.infoWindow?.close?.();
    this.infoWindow = null;
    this.mapa = null;
    this.marcador = null;
    this.montarFallback();
    this.cdr.detectChanges();
  }

  private montarFallback(): void {
    const lat = this.lat();
    const lng = this.lng();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.fallbackUrl = null;
      return;
    }
    const delta = 0.012;
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const raw =
      `https://www.openstreetmap.org/export/embed.html` +
      `?bbox=${encodeURIComponent(bbox)}` +
      `&layer=mapnik` +
      `&marker=${encodeURIComponent(`${lat},${lng}`)}`;
    this.fallbackUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
  }

  private detectarErroVisualGoogle(): void {
    if (this.destroyed || this.usarFallback) return;
    const el = this.container?.nativeElement;
    if (!el) return;
    const texto = (el.textContent || '').toLowerCase();
    if (
      texto.includes('ops!') ||
      texto.includes('algo deu errado') ||
      texto.includes("didn't load google maps") ||
      texto.includes('não carregou o google maps')
    ) {
      this.ativarFallback('Google Maps bloqueou a chave neste dispositivo.');
    }
  }

  private carregarScript(apiKey: string): Promise<void> {
    if (window.google?.maps?.Map) {
      return Promise.resolve();
    }

    const existente = document.querySelector<HTMLScriptElement>(
      'script[data-farma-google-maps="1"]',
    );
    if (existente) {
      return new Promise((resolve, reject) => {
        if (window.google?.maps?.Map) {
          resolve();
          return;
        }
        existente.addEventListener('load', () =>
          this.aguardarMaps(resolve, reject),
        );
        existente.addEventListener('error', () =>
          reject(new Error('Falha no script')),
        );
      });
    }

    return new Promise((resolve, reject) => {
      const callbackName = `__farmaMapsCb_${Date.now()}`;
      window.__farmaMapsCallbacks = window.__farmaMapsCallbacks ?? {};
      window.__farmaMapsCallbacks[callbackName] = () => {
        delete window.__farmaMapsCallbacks?.[callbackName];
        delete (window as any)[callbackName];
        if (window.google?.maps?.Map) resolve();
        else reject(new Error('Google Maps não inicializou'));
      };
      (window as any)[callbackName] = () => {
        window.__farmaMapsCallbacks?.[callbackName]?.();
      };

      const script = document.createElement('script');
      script.dataset['farmaGoogleMaps'] = '1';
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js` +
        `?key=${encodeURIComponent(apiKey)}` +
        `&callback=${callbackName}` +
        `&loading=async`;
      script.onerror = () => reject(new Error('Falha ao baixar Google Maps'));
      document.head.appendChild(script);
    });
  }

  private aguardarMaps(
    ok: () => void,
    falha: (e: Error) => void,
    tentativas = 40,
  ): void {
    if (window.google?.maps?.Map) {
      ok();
      return;
    }
    if (tentativas <= 0) {
      falha(new Error('Timeout Google Maps'));
      return;
    }
    window.setTimeout(() => this.aguardarMaps(ok, falha, tentativas - 1), 50);
  }

  private async criarMapa(): Promise<void> {
    if (!this.container?.nativeElement || !window.google?.maps) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    if (this.destroyed || this.usarFallback) return;

    const g = window.google;
    const host = this.container?.nativeElement;
    if (!g?.maps || !host) {
      throw new Error('Container/mapa indisponível');
    }

    if (typeof g.maps.importLibrary === 'function') {
      await g.maps.importLibrary('maps');
    }
    if (this.destroyed || this.usarFallback) return;

    const centro = { lat: this.lat(), lng: this.lng() };
    this.mapa = new g.maps.Map(host, {
      center: centro,
      zoom: 15,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false,
    });
    this.atualizarPosicao();
  }

  private atualizarPosicao(): void {
    const g = window.google;
    if (!g?.maps || !this.mapa) return;
    if (!Number.isFinite(this.lat()) || !Number.isFinite(this.lng())) return;

    const posicao = { lat: this.lat(), lng: this.lng() };
    const nome = this.nomeMarcador || 'Início da visita';
    this.mapa.setCenter(posicao);
    this.infoWindow?.close?.();
    if (this.marcador) {
      this.marcador.setMap(null);
    }
    this.marcador = new g.maps.Marker({
      map: this.mapa,
      position: posicao,
      title: nome,
      label: nome
        ? {
            text: this.rotuloCurto(nome),
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '700',
          }
        : undefined,
    });
    this.infoWindow = new g.maps.InfoWindow({
      content: `<div style="font:700 12px/1.3 system-ui,sans-serif;color:#0f172a;max-width:220px">${this.escaparHtml(nome)}</div>`,
    });
    this.infoWindow.open({ map: this.mapa, anchor: this.marcador });
    this.forcarResize(posicao);
  }

  private rotuloCurto(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'M';
    if (partes.length === 1) return partes[0].slice(0, 1).toUpperCase();
    return `${partes[0].slice(0, 1)}${partes[partes.length - 1].slice(0, 1)}`.toUpperCase();
  }

  private escaparHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private agendarResize(): void {
    const el = this.container?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      this.forcarResize({ lat: this.lat(), lng: this.lng() });
      return;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      this.forcarResize({ lat: this.lat(), lng: this.lng() });
    });
    this.resizeObserver.observe(el);
    requestAnimationFrame(() =>
      this.forcarResize({ lat: this.lat(), lng: this.lng() }),
    );
  }

  private forcarResize(centro: { lat: number; lng: number }): void {
    const g = window.google;
    if (!g?.maps?.event || !this.mapa) return;
    g.maps.event.trigger(this.mapa, 'resize');
    if (Number.isFinite(centro.lat) && Number.isFinite(centro.lng)) {
      this.mapa.setCenter(centro);
    }
  }
}
