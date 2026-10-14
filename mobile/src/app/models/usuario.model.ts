export interface Perfil {
  id: string;
  nomePerfil: string;
  permissoes?: string[] | string;
  descricao?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil?: Perfil;
  perfis?: Perfil[];
  ativo?: boolean;
  status?: string;
  tema?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Usuario;
  access_token?: string;
  refresh_token?: string;
}

export interface SavedLoginAccount {
  email: string;
  nome: string;
  lastUsedAt: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
