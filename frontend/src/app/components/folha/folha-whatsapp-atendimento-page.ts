import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, fromEvent, interval } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { FolhaService } from '../../services/folha.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import {
  WhatsappConversaDetalhe,
  WhatsappConversaLista,
  WhatsappMensagemItem,
} from '../../models/folha.model';
import { Permission } from '../../models/usuario.model';

const POLL_INBOX_MS = 8000;
const POLL_THREAD_MS = 4000;
const SCROLL_FIM_THRESHOLD_PX = 80;
const UPLOAD_MAX_BYTES = 16 * 1024 * 1024;

@Component({
  selector: 'app-folha-whatsapp-atendimento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './folha-whatsapp-atendimento-page.html',
  styleUrls: ['./folha-whatsapp-atendimento-page.css', './folha-pages.shared.css'],
})
export class FolhaWhatsappAtendimentoPage implements OnInit, OnDestroy {
  private folha = inject(FolhaService);
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();

  @ViewChild('mensagensEl') mensagensEl?: ElementRef<HTMLElement>;
  @ViewChild('composerInput') composerInput?: ElementRef<HTMLTextAreaElement>;

  Permission = Permission;

  conversas: WhatsappConversaLista[] = [];
  detalhe: WhatsappConversaDetalhe | null = null;
  conversaSelecionadaId: string | null = null;
  textoResposta = '';
  carregandoLista = false;
  carregandoDetalhe = false;
  enviandoResposta = false;
  enviandoMidia = false;
  enviarComEnter = true;
  gravandoAudio = false;
  gravacaoPausada = false;
  tempoGravacaoSeg = 0;
  waveformBars: number[] = Array.from({ length: 32 }, () => 18);
  audioGravacaoDisponivel = true;
  motivoAudioGravacaoIndisponivel: string | null = null;
  sincronizando = false;
  ultimaSyncEm: Date | null = null;
  emojiPickerAberto = false;
  readonly emojisRapidos = [
    '😀', '😊', '😂', '🙂', '😉', '😢', '😍', '🤔',
    '👍', '👏', '🙏', '👋', '🤝', '💪', '❤️', '✅',
    '❌', '⚠️', '🎉', '🔥', '💬', '📎', '📷', '⭐',
  ];

  mediaUrls: Record<string, string> = {};
  private mediaCarregandoIds = new Set<string>();
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private gravacaoStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private waveformFrameId: number | null = null;
  private gravacaoTimerId: ReturnType<typeof setInterval> | null = null;
  private gravacaoTickInicio = 0;
  private tempoGravacaoAcumuladoMs = 0;
  private enviarAposParar = false;
  private descartarAposParar = false;
  private forcarScrollAoAbrir = false;

  private abaVisivel = typeof document !== 'undefined' ? !document.hidden : true;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Atendimento WhatsApp',
      description:
        'Respostas ao número da API (recibo). Responder só dentro da janela de 24h após mensagem do funcionário.',
    });
    this.carregarLista();
    this.carregarStatusGravacaoAudio();
    this.iniciarPollingAutomatico();
    this.observarVisibilidadeAba();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelarAudioGravado();
    this.fecharImagemAmpliada();
    this.limparMidias();
  }

  @HostListener('document:keydown.escape')
  onEscapeGlobal(): void {
    if (this.imagemAmpliadaUrl) {
      this.fecharImagemAmpliada();
    }
    if (this.emojiPickerAberto) {
      this.emojiPickerAberto = false;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.emojiPickerAberto = false;
  }

  podeVerPagina(): boolean {
    return this.auth.hasAnyPermission([Permission.FOLHA_WHATSAPP_READ]);
  }

  podeResponder(): boolean {
    return this.auth.hasAnyPermission([Permission.FOLHA_WHATSAPP_REPLY]);
  }

  get exibirBarraGravacao(): boolean {
    return this.gravandoAudio || this.gravacaoPausada;
  }

  get podeEnviarTexto(): boolean {
    return (
      !this.enviandoResposta &&
      !this.enviandoMidia &&
      !!this.textoResposta.trim()
    );
  }

  imagemAmpliadaUrl: string | null = null;
  imagemAmpliadaLegenda: string | null = null;

  formatarTempoGravacao(): string {
    const total = Math.max(0, this.tempoGravacaoSeg);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  rotuloUltimaSync(): string {
    if (!this.ultimaSyncEm) return '';
    const sec = Math.floor((Date.now() - this.ultimaSyncEm.getTime()) / 1000);
    if (sec < 8) return 'Atualizado agora';
    if (sec < 60) return `Atualizado há ${sec}s`;
    const min = Math.floor(sec / 60);
    return min === 1 ? 'Atualizado há 1 min' : `Atualizado há ${min} min`;
  }

  iniciaisConversa(c: WhatsappConversaLista): string {
    if (!c.identificado) return '?';
    const nome = c.nomeExibicao?.trim();
    if (!nome) return '?';
    const partes = nome.split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  carregarLista(silencioso = false): void {
    if (!this.podeVerPagina()) return;
    if (!silencioso) this.carregandoLista = true;
    if (silencioso) this.sincronizando = true;

    this.folha.listarWhatsappConversas().subscribe({
      next: (lista) => {
        this.conversas = lista;
        this.carregandoLista = false;
        this.sincronizando = false;
        this.ultimaSyncEm = new Date();
      },
      error: (err) => {
        this.carregandoLista = false;
        this.sincronizando = false;
        if (!silencioso) {
          this.errors.show(
            err?.error?.message ?? 'Não foi possível carregar as conversas.',
            'WhatsApp',
          );
        }
      },
    });
  }

  selecionarConversa(c: WhatsappConversaLista): void {
    this.conversaSelecionadaId = c.id;
    this.carregandoDetalhe = true;
    this.textoResposta = '';
    this.emojiPickerAberto = false;
    this.detalhe = null;
    this.limparMidias();
    this.fecharImagemAmpliada();
    this.cancelarAudioGravado();
    this.forcarScrollAoAbrir = true;

    this.folha.obterWhatsappConversa(c.id).subscribe({
      next: (d) => {
        this.detalhe = d;
        this.carregandoDetalhe = false;
        this.ultimaSyncEm = new Date();
        this.carregarMidiasMensagens();
        this.scrollThreadParaFim();
        if (d.conversa.naoLida) {
          this.marcarConversaLida(c.id);
        }
      },
      error: (err) => {
        this.carregandoDetalhe = false;
        this.errors.show(
          err?.error?.message ?? 'Não foi possível abrir a conversa.',
          'WhatsApp',
        );
      },
    });
  }

  enviarResposta(): void {
    if (!this.conversaSelecionadaId || !this.podeResponder()) return;
    const texto = this.textoResposta.trim();
    if (!texto) return;
    if (!this.detalhe?.conversa.janela24hAberta) return;

    this.enviandoResposta = true;
    this.folha.responderWhatsappConversa(this.conversaSelecionadaId, texto).subscribe({
      next: (msg) => {
        this.enviandoResposta = false;
        this.textoResposta = '';
        this.resetarAlturaComposer();
        if (this.detalhe) {
          this.detalhe.mensagens = [...this.detalhe.mensagens, msg];
          this.detalhe.conversa.janela24hAberta = true;
        }
        this.scrollThreadParaFim();
        this.carregarLista(true);
        this.focarComposer();
      },
      error: (err) => {
        this.enviandoResposta = false;
        this.errors.show(
          err?.error?.message ?? 'Não foi possível enviar a resposta.',
          'WhatsApp',
        );
        this.focarComposer();
      },
    });
  }

  onRespostaKeydown(event: KeyboardEvent): void {
    if (!this.enviarComEnter || event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (this.podeEnviarTexto) {
      this.enviarResposta();
    }
  }

  ajustarAlturaComposer(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.emojiPickerAberto = !this.emojiPickerAberto;
  }

  inserirEmoji(emoji: string, event: Event): void {
    event.stopPropagation();
    const el = this.composerInput?.nativeElement;
    if (!el || el.disabled) return;

    const start = el.selectionStart ?? this.textoResposta.length;
    const end = el.selectionEnd ?? start;
    const before = this.textoResposta.slice(0, start);
    const after = this.textoResposta.slice(end);
    this.textoResposta = before + emoji + after;

    const pos = start + emoji.length;
    el.focus();
    requestAnimationFrame(() => {
      el.setSelectionRange(pos, pos);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    });
  }

  urlMidia(m: WhatsappMensagemItem): string {
    return this.mediaUrls[m.id] ?? '';
  }

  abrirImagemAmpliada(m: WhatsappMensagemItem): void {
    const url = this.urlMidia(m);
    if (!url) return;
    this.imagemAmpliadaUrl = url;
    this.imagemAmpliadaLegenda = m.legenda || 'Imagem';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  fecharImagemAmpliada(): void {
    this.imagemAmpliadaUrl = null;
    this.imagemAmpliadaLegenda = null;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  midiaCarregando(m: WhatsappMensagemItem): boolean {
    return this.mediaCarregandoIds.has(m.id);
  }

  onSelecionarArquivo(event: Event, _tipo: 'image' | 'document'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.conversaSelecionadaId) return;
    if (file.size > UPLOAD_MAX_BYTES) {
      this.errors.show('Arquivo excede o limite de 16 MB.', 'WhatsApp');
      return;
    }
    this.enviarAnexo(file);
  }

  async iniciarGravacao(): Promise<void> {
    if (!this.audioGravacaoDisponivel) {
      this.errors.show(
        this.motivoAudioGravacaoIndisponivel ??
          'Envio de áudio gravado temporariamente indisponível.',
        'WhatsApp',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errors.show('Gravação de áudio não suportada neste navegador.', 'WhatsApp');
      return;
    }
    try {
      this.cancelarAudioGravado();
      this.gravacaoStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.tempoGravacaoSeg = 0;
      this.tempoGravacaoAcumuladoMs = 0;
      this.gravacaoPausada = false;
      this.enviarAposParar = false;
      this.descartarAposParar = false;

      this.mediaRecorder = new MediaRecorder(this.gravacaoStream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => this.onGravacaoParada();

      this.mediaRecorder.start(200);
      this.gravandoAudio = true;
      this.iniciarTimerGravacao();
      this.iniciarWaveform();
    } catch {
      this.errors.show(
        'Não foi possível acessar o microfone. Verifique as permissões do navegador.',
        'WhatsApp',
      );
      this.limparRecursosGravacao();
    }
  }

  togglePausaGravacao(): void {
    if (!this.mediaRecorder) return;
    if (this.gravacaoPausada) {
      if (typeof this.mediaRecorder.resume === 'function') {
        this.mediaRecorder.resume();
      }
      this.gravacaoPausada = false;
      this.gravandoAudio = true;
      this.iniciarTimerGravacao();
      this.iniciarWaveform();
      return;
    }
    if (this.mediaRecorder.state === 'recording') {
      if (typeof this.mediaRecorder.pause === 'function') {
        this.mediaRecorder.pause();
        this.gravacaoPausada = true;
        this.gravandoAudio = false;
        this.pararTimerGravacao();
        this.pararWaveform();
      }
    }
  }

  cancelarAudioGravado(): void {
    this.descartarAposParar = true;
    this.enviarAposParar = false;
    if (this.mediaRecorder?.state === 'recording' || this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.stop();
      return;
    }
    this.limparRecursosGravacao();
  }

  enviarAudioGravado(): void {
    if (!this.conversaSelecionadaId || this.enviandoMidia) return;
    if (!this.mediaRecorder) return;
    this.enviarAposParar = true;
    this.descartarAposParar = false;
    if (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.stop();
    }
  }

  get pausaGravacaoSuportada(): boolean {
    return typeof MediaRecorder !== 'undefined' && 'pause' in MediaRecorder.prototype;
  }

  private onGravacaoParada(): void {
    const descartar = this.descartarAposParar;
    const enviar = this.enviarAposParar;
    this.descartarAposParar = false;
    this.enviarAposParar = false;

    const chunks = [...this.audioChunks];
    const mime = this.mediaRecorder?.mimeType || 'audio/webm';
    this.limparRecursosGravacao();

    if (descartar || !chunks.length) return;

    const blob = new Blob(chunks, { type: mime });
    if (enviar) {
      const file = new File([blob], 'gravacao.webm', { type: mime });
      this.enviarAnexo(file);
    }
  }

  private iniciarTimerGravacao(): void {
    this.pararTimerGravacao();
    this.gravacaoTickInicio = Date.now();
    this.gravacaoTimerId = setInterval(() => {
      const elapsed = Date.now() - this.gravacaoTickInicio;
      this.tempoGravacaoSeg = Math.floor((this.tempoGravacaoAcumuladoMs + elapsed) / 1000);
    }, 200);
  }

  private pararTimerGravacao(): void {
    if (this.gravacaoTimerId) {
      clearInterval(this.gravacaoTimerId);
      this.gravacaoTimerId = null;
    }
    if (this.gravacaoTickInicio) {
      this.tempoGravacaoAcumuladoMs += Date.now() - this.gravacaoTickInicio;
      this.gravacaoTickInicio = 0;
      this.tempoGravacaoSeg = Math.floor(this.tempoGravacaoAcumuladoMs / 1000);
    }
  }

  private iniciarWaveform(): void {
    this.pararWaveform();
    if (!this.gravacaoStream) return;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.gravacaoStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.75;
    source.connect(this.analyser);

    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    const loop = (): void => {
      if (!this.analyser || (!this.gravandoAudio && !this.gravacaoPausada)) return;
      this.analyser.getByteFrequencyData(buffer);
      const slice = Math.max(8, Math.floor(buffer.length / this.waveformBars.length));
      this.waveformBars = this.waveformBars.map((_, i) => {
        const start = i * slice;
        let sum = 0;
        for (let j = start; j < start + slice && j < buffer.length; j++) {
          sum += buffer[j];
        }
        const avg = sum / slice;
        const pct = Math.max(12, Math.min(100, Math.round((avg / 255) * 100)));
        return this.gravacaoPausada ? Math.min(pct, 22) : pct;
      });
      this.waveformFrameId = requestAnimationFrame(loop);
    };
    this.waveformFrameId = requestAnimationFrame(loop);
  }

  private pararWaveform(): void {
    if (this.waveformFrameId != null) {
      cancelAnimationFrame(this.waveformFrameId);
      this.waveformFrameId = null;
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.analyser = null;
  }

  private limparRecursosGravacao(): void {
    this.pararTimerGravacao();
    this.pararWaveform();
    this.pararStreamGravacao();
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.gravandoAudio = false;
    this.gravacaoPausada = false;
    this.tempoGravacaoSeg = 0;
    this.tempoGravacaoAcumuladoMs = 0;
    this.waveformBars = Array.from({ length: 32 }, () => 18);
  }

  baixarDocumento(m: WhatsappMensagemItem): void {
    if (!m.arquivoDisponivel) return;
    this.folha.baixarWhatsappMensagemArquivo(m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = m.nomeArquivo ?? 'documento';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.errors.show(
          err?.error?.message ?? 'Não foi possível baixar o documento.',
          'WhatsApp',
        );
      },
    });
  }

  onMidiaRenderizada(): void {
    if (this.forcarScrollAoAbrir) {
      this.aplicarScrollFim();
    }
  }

  formatarDataHora(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  statusLabel(status: string | null): string {
    if (!status) return '';
    const map: Record<string, string> = {
      sent: 'Enviada',
      delivered: 'Entregue',
      read: 'Lida',
      failed: 'Falhou',
    };
    return map[status] ?? status;
  }

  private iniciarPollingAutomatico(): void {
    interval(POLL_INBOX_MS)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.abaVisivel && this.podeVerPagina()),
      )
      .subscribe(() => this.carregarLista(true));

    interval(POLL_THREAD_MS)
      .pipe(
        takeUntil(this.destroy$),
        filter(
          () =>
            this.abaVisivel &&
            this.podeVerPagina() &&
            !!this.conversaSelecionadaId &&
            !this.carregandoDetalhe &&
            !this.enviandoResposta &&
            !this.enviandoMidia,
        ),
      )
      .subscribe(() => this.atualizarThreadSilenciosa());
  }

  private observarVisibilidadeAba(): void {
    if (typeof document === 'undefined') return;

    fromEvent(document, 'visibilitychange')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.abaVisivel = !document.hidden;
        if (this.abaVisivel && this.podeVerPagina()) {
          this.carregarLista(true);
          this.atualizarThreadSilenciosa();
        }
      });
  }

  private atualizarThreadSilenciosa(): void {
    const id = this.conversaSelecionadaId;
    if (!id || this.carregandoDetalhe || this.enviandoResposta || this.enviandoMidia) return;

    const estavaNoFim = this.usuarioEstaNoFimDaThread();
    const qtdAntes = this.detalhe?.mensagens.length ?? 0;

    this.folha.obterWhatsappConversa(id).subscribe({
      next: (d) => {
        this.detalhe = d;
        this.atualizarItemInbox(d.conversa);
        this.ultimaSyncEm = new Date();
        this.carregarMidiasMensagens();
        if (d.conversa.naoLida) {
          this.marcarConversaLida(id);
        }
        if (estavaNoFim || d.mensagens.length > qtdAntes) {
          this.scrollThreadParaFim();
        }
      },
    });
  }

  private marcarConversaLida(conversaId: string): void {
    this.folha.marcarWhatsappConversaLida(conversaId).subscribe({
      next: () => {
        const item = this.conversas.find((c) => c.id === conversaId);
        if (item) item.naoLida = false;
        if (this.detalhe?.conversa.id === conversaId) {
          this.detalhe.conversa.naoLida = false;
        }
      },
    });
  }

  private atualizarItemInbox(conversa: WhatsappConversaLista): void {
    const idx = this.conversas.findIndex((c) => c.id === conversa.id);
    if (idx >= 0) {
      this.conversas[idx] = { ...this.conversas[idx], ...conversa };
    }
  }

  private usuarioEstaNoFimDaThread(): boolean {
    const el = this.mensagensEl?.nativeElement;
    if (!el) return true;
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_FIM_THRESHOLD_PX
    );
  }

  private scrollThreadParaFim(): void {
    afterNextRender(
      () => {
        this.repetirScrollFim(5);
      },
      { injector: this.injector },
    );
  }

  private repetirScrollFim(restantes: number): void {
    if (restantes <= 0) {
      this.forcarScrollAoAbrir = false;
      return;
    }
    this.aplicarScrollFim();
    requestAnimationFrame(() => {
      this.aplicarScrollFim();
      setTimeout(() => this.repetirScrollFim(restantes - 1), 60);
    });
  }

  private aplicarScrollFim(): void {
    const el = this.mensagensEl?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private carregarStatusGravacaoAudio(): void {
    if (!this.podeVerPagina()) return;
    this.folha.obterWhatsappAudioGravacaoDisponivel().subscribe({
      next: (s) => {
        this.audioGravacaoDisponivel = s.disponivel;
        this.motivoAudioGravacaoIndisponivel = s.motivo;
      },
      error: () => {
        this.audioGravacaoDisponivel = false;
        this.motivoAudioGravacaoIndisponivel =
          'Envio de áudio gravado temporariamente indisponível.';
      },
    });
  }

  private enviarAnexo(file: File, aoSucesso?: () => void): void {
    if (!this.conversaSelecionadaId || !this.podeResponder()) return;
    if (!this.detalhe?.conversa.janela24hAberta) return;

    this.enviandoMidia = true;
    this.folha.enviarWhatsappAnexo(this.conversaSelecionadaId, file).subscribe({
      next: (msg) => {
        this.enviandoMidia = false;
        if (this.detalhe) {
          this.detalhe.mensagens = [...this.detalhe.mensagens, msg];
        }
        aoSucesso?.();
        this.carregarMidiasMensagens();
        this.scrollThreadParaFim();
        this.carregarLista(true);
      },
      error: (err) => {
        this.enviandoMidia = false;
        const msg =
          err?.error?.message ??
          (typeof err?.error === 'string' ? err.error : null) ??
          'Não foi possível enviar o arquivo.';
        this.errors.show(msg, 'WhatsApp');
      },
    });
  }

  private carregarMidiasMensagens(): void {
    for (const m of this.detalhe?.mensagens ?? []) {
      if (m.tipo !== 'image' && m.tipo !== 'audio') continue;
      if (!m.arquivoDisponivel) continue;
      if (this.mediaUrls[m.id] || this.mediaCarregandoIds.has(m.id)) continue;

      this.mediaCarregandoIds.add(m.id);
      this.folha.baixarWhatsappMensagemArquivo(m.id).subscribe({
        next: (blob) => {
          this.mediaUrls[m.id] = URL.createObjectURL(blob);
          this.mediaCarregandoIds.delete(m.id);
          if (this.forcarScrollAoAbrir) {
            this.aplicarScrollFim();
          }
        },
        error: () => {
          this.mediaCarregandoIds.delete(m.id);
        },
      });
    }
  }

  private limparMidias(): void {
    for (const url of Object.values(this.mediaUrls)) {
      URL.revokeObjectURL(url);
    }
    this.mediaUrls = {};
    this.mediaCarregandoIds.clear();
  }

  private pararStreamGravacao(): void {
    this.gravacaoStream?.getTracks().forEach((t) => t.stop());
    this.gravacaoStream = null;
  }

  private resetarAlturaComposer(): void {
    const el = this.composerInput?.nativeElement;
    if (el) {
      el.style.height = 'auto';
    }
  }

  private focarComposer(): void {
    setTimeout(() => this.composerInput?.nativeElement?.focus(), 0);
  }
}
