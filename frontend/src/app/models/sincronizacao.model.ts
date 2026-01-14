export interface SincronizacaoConfig {
  id: string;
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  intervaloMinutos: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateSincronizacaoConfigDto {
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  intervaloMinutos?: number;
  ativo?: boolean;
}

export interface UpdateSincronizacaoConfigDto extends Partial<CreateSincronizacaoConfigDto> {}

export interface SincronizacaoResult {
  agente: string;
  clientesProcessados: number;
  clientesCriados: number;
  clientesAtualizados: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  prescritoresAtualizados: number;
  erros: string[];
}
