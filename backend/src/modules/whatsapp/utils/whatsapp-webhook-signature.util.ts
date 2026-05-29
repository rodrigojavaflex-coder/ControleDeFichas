import { createHmac, timingSafeEqual } from 'crypto';

export function validarAssinaturaWebhook(
  rawBody: Buffer | string,
  assinaturaHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!assinaturaHeader?.startsWith('sha256=')) {
    return false;
  }
  const recebida = assinaturaHeader.slice('sha256='.length);
  const esperada = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  try {
    const bufRecebida = Buffer.from(recebida, 'hex');
    const bufEsperada = Buffer.from(esperada, 'hex');
    if (bufRecebida.length !== bufEsperada.length) {
      return false;
    }
    return timingSafeEqual(bufRecebida, bufEsperada);
  } catch {
    return false;
  }
}
