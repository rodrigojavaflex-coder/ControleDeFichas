
export interface Configuracao {
  id: string;
  nomeCliente?: string;
  logoRelatorio?: string;
  farmaceuticoResponsavel?: string;
  // Configurações de Auditoria
  auditarConsultas: boolean;
  auditarLoginLogOff: boolean;
  auditarCriacao: boolean;
  auditarAlteracao: boolean;
  auditarExclusao: boolean;
  auditarSenhaAlterada: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateConfiguracaoDto {
  nomeCliente?: string;
  logoRelatorio?: string;
  farmaceuticoResponsavel?: string;
  // Configurações de Auditoria
  auditarConsultas?: boolean;
  auditarLoginLogOff?: boolean;
  auditarCriacao?: boolean;
  auditarAlteracao?: boolean;
  auditarExclusao?: boolean;
  auditarSenhaAlterada?: boolean;
}

export interface UpdateConfiguracaoDto extends Partial<CreateConfiguracaoDto> {}
