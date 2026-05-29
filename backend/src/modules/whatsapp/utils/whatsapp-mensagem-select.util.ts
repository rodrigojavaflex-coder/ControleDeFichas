import { FindOptionsSelect } from 'typeorm';
import { WhatsappMensagem } from '../entities/whatsapp-mensagem.entity';

/** Campos da mensagem para listagem de thread — exclui bytea pesado. */
export const WHATSAPP_MENSAGEM_SELECT_THREAD: FindOptionsSelect<WhatsappMensagem> =
  {
    id: true,
    conversaId: true,
    wamid: true,
    direcao: true,
    tipo: true,
    conteudoTexto: true,
    nomeArquivo: true,
    mimeType: true,
    metaMediaId: true,
    arquivoPath: true,
    legenda: true,
    status: true,
    temArquivo: true,
    arquivoExpiraEm: true,
    usuarioRespostaId: true,
    folhaCapaId: true,
    erroCodigo: true,
    erroMensagem: true,
    metaTimestamp: true,
    criadoEm: true,
    atualizadoEm: true,
  };
