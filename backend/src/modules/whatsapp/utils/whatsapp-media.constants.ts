export const WHATSAPP_UPLOAD_MAX_BYTES = 16 * 1024 * 1024;

export type WhatsappMediaCategoria = 'image' | 'audio' | 'document';

export const WHATSAPP_MIME_IMAGE = new Set([
  'image/jpeg',
  'image/png',
]);

export const WHATSAPP_MIME_AUDIO = new Set([
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/amr',
  'audio/webm',
]);

export const WHATSAPP_MIME_DOCUMENT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const WHATSAPP_EXT_DOCUMENT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

export function categoriaPorMime(mime: string): WhatsappMediaCategoria | null {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (WHATSAPP_MIME_IMAGE.has(m)) return 'image';
  if (WHATSAPP_MIME_AUDIO.has(m)) return 'audio';
  if (WHATSAPP_MIME_DOCUMENT.has(m)) return 'document';
  return null;
}

export function mimePermitidoParaEnvio(mime: string): boolean {
  return categoriaPorMime(mime) !== null;
}

export function extensaoSegura(nome: string): string {
  const idx = nome.lastIndexOf('.');
  if (idx <= 0) return '';
  return nome.slice(idx).toLowerCase();
}

export function rotuloPreviewTipo(tipo: string, nomeArquivo?: string | null, legenda?: string | null): string {
  if (tipo === 'image') return legenda?.trim() || '[Imagem]';
  if (tipo === 'audio') return '[Áudio]';
  if (tipo === 'document') return nomeArquivo?.trim() || '[Documento]';
  if (tipo === 'template') return 'Recibo enviado (template)';
  return '';
}
