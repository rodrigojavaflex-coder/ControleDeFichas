import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  closeOutline,
  micOutline,
  trashOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { VisitaMidia } from '../../models/visita.model';
import { AppLoadingService } from '../../services/app-loading.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { VisitasService } from '../../services/visitas.service';

@Component({
  selector: 'app-visita-midias',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonSpinner],
  templateUrl: './visita-midias.component.html',
  styleUrls: ['./visita-midias.component.scss'],
})
export class VisitaMidiasComponent implements OnChanges, OnDestroy {
  @Input() visitaId = '';
  @Input() aberta = false;
  @Input() podeAlterar = false;

  private readonly visitas = inject(VisitasService);
  private readonly erros = inject(ErrorMessageService);
  private readonly alertas = inject(AlertController);
  private readonly loading = inject(AppLoadingService);
  private readonly cdr = inject(ChangeDetectorRef);

  midias: VisitaMidia[] = [];
  previews = new Map<string, string>();
  exibirModalGravacao = false;
  fotoAmpliadaUrl: string | null = null;
  fotoAmpliadaNome = '';
  gravacaoPreparando = false;
  gravando = false;
  tempoGravacaoSegundos = 0;
  private contadorTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({ cameraOutline, closeOutline, micOutline, trashOutline });
  }

  get fotos(): VisitaMidia[] {
    return this.midias.filter((item) => item.tipo === 'imagem');
  }

  get audios(): VisitaMidia[] {
    return this.midias.filter((item) => item.tipo === 'audio');
  }

  get podeEditar(): boolean {
    return this.aberta && this.podeAlterar;
  }

  get tempoGravacaoFormatado(): string {
    const total = Math.max(0, this.tempoGravacaoSegundos);
    const minutos = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const segundos = (total % 60).toString().padStart(2, '0');
    return `${minutos}:${segundos}`;
  }

  ngOnChanges(): void {
    if (this.visitaId) {
      void this.carregar();
    }
  }

  ngOnDestroy(): void {
    this.previews.forEach((url) => URL.revokeObjectURL(url));
    this.pararContador();
    if (this.gravando || this.gravacaoPreparando) {
      void VoiceRecorder.stopRecording().catch(() => undefined);
    }
  }

  ampliarFoto(foto: VisitaMidia): void {
    const url = this.previews.get(foto.id);
    if (!url) return;
    this.fotoAmpliadaUrl = url;
    this.fotoAmpliadaNome = foto.nomeArquivo || 'Foto';
  }

  fecharFotoAmpliada(): void {
    this.fotoAmpliadaUrl = null;
    this.fotoAmpliadaNome = '';
  }

  async escolherFoto(): Promise<void> {
    if (this.fotos.length >= 10) {
      await this.avisar('A visita aceita no máximo 10 fotos.');
      return;
    }
    const alerta = await this.alertas.create({
      header: 'Adicionar foto',
      buttons: [
        { text: 'Câmera', role: 'camera' },
        { text: 'Galeria', role: 'galeria' },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role === 'camera') {
      await this.capturarFoto(CameraSource.Camera);
    } else if (role === 'galeria') {
      await this.capturarFoto(CameraSource.Photos);
    }
  }

  async abrirGravacaoAudio(): Promise<void> {
    if (this.gravando || this.gravacaoPreparando) return;
    this.gravacaoPreparando = true;
    this.exibirModalGravacao = true;
    this.tempoGravacaoSegundos = 0;
    this.cdr.detectChanges();
    try {
      const permissao = await VoiceRecorder.hasAudioRecordingPermission();
      if (!permissao.value) {
        const pedida = await VoiceRecorder.requestAudioRecordingPermission();
        if (!pedida.value) {
          await this.avisar('Permissão de áudio negada.');
          this.fecharModalGravacao();
          return;
        }
      }
      await VoiceRecorder.startRecording();
      this.gravacaoPreparando = false;
      this.gravando = true;
      this.iniciarContador();
      this.cdr.detectChanges();
    } catch {
      await this.avisar('Não foi possível iniciar a gravação.');
      this.fecharModalGravacao();
    }
  }

  async finalizarGravacao(): Promise<void> {
    if (this.gravacaoPreparando || !this.gravando) return;
    this.pararContador();
    try {
      const result = await VoiceRecorder.stopRecording();
      this.gravando = false;
      this.exibirModalGravacao = false;
      this.cdr.detectChanges();
      const base64 = result.value?.recordDataBase64;
      if (!base64) {
        await this.avisar('Não foi possível obter o áudio gravado.');
        return;
      }
      const mime = result.value.mimeType || 'audio/mp4';
      const blob = this.base64ParaBlob(base64, mime);
      await this.enviar(blob, 'audio.m4a', 'audio', result.value.msDuration);
    } catch {
      this.gravando = false;
      this.exibirModalGravacao = false;
      await this.avisar('Não foi possível finalizar a gravação.');
    }
  }

  async descartarGravacao(): Promise<void> {
    if (this.gravacaoPreparando) return;
    const alerta = await this.alertas.create({
      header: 'Descartar gravação?',
      message: 'O áudio em andamento não será salvo.',
      buttons: [
        { text: 'Continuar gravando', role: 'cancel' },
        { text: 'Descartar', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;
    try {
      await VoiceRecorder.stopRecording();
    } catch {
      /* já interrompida */
    }
    this.fecharModalGravacao();
  }

  async remover(midia: VisitaMidia): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Remover mídia',
      message: `Remover ${midia.nomeArquivo}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;
    try {
      await firstValueFrom(this.visitas.excluirMidia(this.visitaId, midia.id));
      const preview = this.previews.get(midia.id);
      if (preview) URL.revokeObjectURL(preview);
      this.previews.delete(midia.id);
      this.midias = this.midias.filter((item) => item.id !== midia.id);
    } catch (error) {
      await this.avisar(this.erros.fromApi(error, 'Não foi possível remover a mídia.'));
    }
  }

  private async capturarFoto(source: CameraSource): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const permitido = await this.permissaoFoto(source);
        if (!permitido) {
          await this.avisar(
            source === CameraSource.Photos
              ? 'Permissão de acesso à galeria negada.'
              : 'Permissão de câmera negada.',
          );
          return;
        }
      }
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source,
        allowEditing: false,
        width: 1600,
        height: 1600,
        correctOrientation: true,
      });
      if (!photo.base64String) return;
      const bruto = this.base64ParaBlob(photo.base64String, 'image/jpeg');
      const comprimido = await this.comprimirImagem(bruto, {
        maxLado: 1280,
        qualidade: 0.72,
      });
      const nome = `foto-${this.fotos.length + 1}.jpg`;
      await this.enviar(comprimido, nome, 'imagem');
    } catch (error) {
      if (this.cancelou(error)) return;
      await this.avisar(
        this.erros.fromApi(
          error,
          source === CameraSource.Photos
            ? 'Não foi possível obter a imagem da galeria.'
            : 'Não foi possível capturar a foto.',
        ),
      );
    }
  }

  /**
   * Redimensiona (lado máx.) e reencode JPEG no canvas.
   * Câmera e galeria usam o mesmo caminho.
   */
  private async comprimirImagem(
    origem: Blob,
    opcoes: { maxLado: number; qualidade: number },
  ): Promise<Blob> {
    try {
      const bitmap = await createImageBitmap(origem);
      const maior = Math.max(bitmap.width, bitmap.height);
      const escala =
        maior > opcoes.maxLado ? opcoes.maxLado / maior : 1;
      const largura = Math.max(1, Math.round(bitmap.width * escala));
      const altura = Math.max(1, Math.round(bitmap.height * escala));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return origem;
      }
      ctx.drawImage(bitmap, 0, 0, largura, altura);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (resultado) => resolve(resultado),
          'image/jpeg',
          opcoes.qualidade,
        );
      });
      if (!blob || blob.size === 0) return origem;
      // Se a compressão ficou maior que o original, mantém o menor.
      return blob.size < origem.size ? blob : origem;
    } catch {
      return origem;
    }
  }

  private async enviar(
    arquivo: Blob,
    nome: string,
    tipo: 'imagem' | 'audio',
    duracaoMs?: number,
  ): Promise<void> {
    await this.loading.show('Enviando mídia…');
    try {
      const salva = await firstValueFrom(
        this.visitas.enviarMidia(this.visitaId, arquivo, nome, tipo, duracaoMs),
      );
      this.midias = [...this.midias, salva];
      this.previews.set(salva.id, URL.createObjectURL(arquivo));
    } catch (error) {
      await this.avisar(this.erros.fromApi(error, 'Não foi possível enviar a mídia.'));
    } finally {
      await this.loading.dismiss();
    }
  }

  private async carregar(): Promise<void> {
    try {
      this.midias = await firstValueFrom(this.visitas.listarMidias(this.visitaId));
    } catch (error) {
      await this.avisar(
        this.erros.fromApi(error, 'Não foi possível carregar as mídias.'),
      );
      return;
    }
    const comArquivo = this.midias.filter(
      (item) => item.tipo === 'imagem' || item.tipo === 'audio',
    );
    let falhas = 0;
    for (const item of comArquivo) {
      try {
        await this.carregarPreview(item);
        this.cdr.detectChanges();
      } catch {
        falhas += 1;
      }
    }
    if (falhas > 0) {
      await this.avisar(
        falhas === comArquivo.length
          ? 'Não foi possível baixar os anexos desta visita.'
          : 'Alguns anexos não puderam ser baixados.',
      );
    }
  }

  private async carregarPreview(midia: VisitaMidia): Promise<void> {
    if (this.previews.has(midia.id)) return;
    const blob = await firstValueFrom(
      this.visitas.baixarMidia(this.visitaId, midia.id),
    );
    this.previews.set(midia.id, URL.createObjectURL(blob));
  }

  private async permissaoFoto(source: CameraSource): Promise<boolean> {
    try {
      const atual = await Camera.checkPermissions();
      if (source === CameraSource.Photos) {
        if (atual.photos === 'granted' || atual.photos === 'limited') return true;
        const pedida = await Camera.requestPermissions({ permissions: ['photos'] });
        return pedida.photos === 'granted' || pedida.photos === 'limited';
      }
      if (atual.camera === 'granted') return true;
      const pedida = await Camera.requestPermissions({ permissions: ['camera'] });
      return pedida.camera === 'granted';
    } catch {
      return false;
    }
  }

  private iniciarContador(): void {
    this.pararContador();
    this.tempoGravacaoSegundos = 0;
    this.contadorTimer = setInterval(() => {
      this.tempoGravacaoSegundos += 1;
      this.cdr.detectChanges();
    }, 1000);
  }

  private pararContador(): void {
    if (this.contadorTimer) {
      clearInterval(this.contadorTimer);
      this.contadorTimer = null;
    }
  }

  private fecharModalGravacao(): void {
    this.pararContador();
    this.gravando = false;
    this.gravacaoPreparando = false;
    this.exibirModalGravacao = false;
    this.tempoGravacaoSegundos = 0;
    this.cdr.detectChanges();
  }

  private base64ParaBlob(base64: string, mime: string): Blob {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) {
      bytes[i] = binario.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  private cancelou(error: unknown): boolean {
    const texto = error instanceof Error ? error.message : String(error ?? '');
    return /cancel/i.test(texto);
  }

  private async avisar(mensagem: string): Promise<void> {
    const alerta = await this.alertas.create({
      header: 'Mídia',
      message: mensagem,
      buttons: ['OK'],
    });
    await alerta.present();
  }
}
