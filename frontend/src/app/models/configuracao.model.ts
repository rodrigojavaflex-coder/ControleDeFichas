
export interface Configuracao {
  id: string;
  nomeCliente?: string;
  logoRelatorio?: string;
  farmaceuticoResponsavel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConfiguracaoDto {
  nomeCliente?: string;
  logoRelatorio?: string;
  farmaceuticoResponsavel?: string;
}

export interface UpdateConfiguracaoDto extends Partial<CreateConfiguracaoDto> {}
