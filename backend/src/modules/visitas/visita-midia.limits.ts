export const LIMITE_FOTO_BYTES = 5 * 1024 * 1024;
export const LIMITE_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_FOTOS_VISITA = 10;

const MIME_IMAGEM = new Set(['image/jpeg', 'image/png']);
const MIME_AUDIO = new Set([
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/3gpp',
  'audio/amr',
]);

export type TipoMidiaVisita = 'imagem' | 'audio' | 'documento';

export function mimeBase(mime: string | undefined): string {
  return (mime ?? '').toLowerCase().split(';')[0].trim();
}

export function midiaPermitida(
  tipo: TipoMidiaVisita,
  mime: string,
  _nome: string,
): boolean {
  const base = mimeBase(mime);
  if (tipo === 'imagem') return MIME_IMAGEM.has(base);
  if (tipo === 'audio') return MIME_AUDIO.has(base);
  return false;
}

export function limiteBytes(tipo: TipoMidiaVisita): number {
  if (tipo === 'imagem') return LIMITE_FOTO_BYTES;
  return LIMITE_AUDIO_BYTES;
}

export function mensagemLimite(tipo: TipoMidiaVisita): string {
  if (tipo === 'imagem') return 'A foto excede o limite máximo de 5 MB.';
  return 'O áudio excede o limite máximo de 15 MB.';
}

export function nomeArquivoSeguro(nome: string, reserva: string): string {
  const base = nome
    .replace(/[/\\]/g, '')
    .replace(/["\r\n]/g, '')
    .trim();
  return (base || reserva).slice(0, 255);
}
