/** Política de gravação em sincronizacao_log_erro (por agente). todos = info+warn+error. */
export enum SincronizacaoNivelLog {
  TODOS = 'todos',
  ALERTAS = 'alertas',
  ERROS = 'erros',
  NAO_GRAVAR = 'nao_gravar',
}

export const SINCRONIZACAO_NIVEL_LOG_VALUES = Object.values(
  SincronizacaoNivelLog,
) as string[];
