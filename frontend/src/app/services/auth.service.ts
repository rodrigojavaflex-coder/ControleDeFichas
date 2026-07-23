import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Usuario, Permission, Perfil } from '../models/usuario.model';
import { ThemeService } from './theme.service';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: Usuario;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private apiUrl = `${environment.apiUrl}/auth`;

  // Estado da autenticação
  private currentUserSubject = new BehaviorSubject<Usuario | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private loginTimestampSubject = new BehaviorSubject<number | null>(null);
  public loginTimestamp$ = this.loginTimestampSubject.asObservable();

  private tokenExpirationSubject = new BehaviorSubject<number | null>(null);
  public tokenExpiration$ = this.tokenExpirationSubject.asObservable();

  private readonly LOGIN_TIMESTAMP_KEY = 'login_timestamp';
  private readonly TOKEN_EXPIRATION_KEY = 'token_expiration';
  private readonly REFRESH_EXPIRATION_KEY = 'refresh_expiration';

  constructor() {
    // Verificar se há token salvo no localStorage
    this.checkStoredAuth();
    
    // Expor referência para uso interno (evita dependência circular)
    (window as any).__authService = this;
  }

  /**
   * Realiza login do usuário
   */
  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
    );

    const now = Date.now();

    // Mapear resposta do backend para formato Usuario
    const user = this.mapAuthResponseToUsuario(response.user);

    // Salvar tokens no localStorage
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('user', JSON.stringify(user));
    this.setLoginTimestamp(now);
    this.updateTokenExpirations(response.access_token, response.refresh_token);

    // Atualizar estado
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
    
    // Inicializar tema com preferência do usuário após login
    this.themeService.initializeTheme(user.id, user.tema, false);
  }

  /**
   * Mapeia a resposta de autenticação do backend para o formato Usuario do frontend
   */
  private mapAuthResponseToUsuario(authUser: any): Usuario {
    return {
      id: authUser.id,
      nome: authUser.name || authUser.nome,
      email: authUser.email,
      ativo: authUser.isActive !== undefined ? authUser.isActive : authUser.ativo,
      tema: authUser.tema || 'Claro',
      atalhosHome: authUser.atalhosHome ?? null,
      vendedor: authUser.vendedor ? {
        id: authUser.vendedor.id,
        nome: authUser.vendedor.nome,
        unidade: authUser.vendedor.unidade || 'INHUMAS' as any,
        criadoEm: authUser.vendedor.criadoEm || new Date(),
        atualizadoEm: authUser.vendedor.atualizadoEm || new Date(),
      } : null,
      unidade: authUser.unidade ?? undefined,
      unidadesProdutividade: authUser.unidadesProdutividade ?? null,
      criadoEm: authUser.criadoEm,
      atualizadoEm: authUser.atualizadoEm,
      perfis: this.mapAuthPerfis(authUser),
    };
  }

  private mapAuthPerfis(authUser: {
    perfis?: Perfil[];
    permissions?: Permission[];
  }): Perfil[] {
    if (authUser.perfis?.length) {
      return authUser.perfis;
    }
    if (authUser.permissions?.length) {
      return [
        {
          id: '',
          nomePerfil: '',
          permissoes: authUser.permissions,
        },
      ];
    }
    return [];
  }

  private getUsuarioPermissoesEfetivas(user: Usuario): Permission[] {
    const fromPerfis = (user.perfis ?? [])
      .flatMap((p) => p.permissoes ?? []);
    const legacy = user.perfil?.permissoes ?? [];
    return Array.from(new Set([...fromPerfis, ...legacy]));
  }

  /**
   * Realiza logout do usuário
   */
  async logout(): Promise<void> {
    try {
      // Chamar endpoint de logout no backend
      await firstValueFrom(this.http.post(`${this.apiUrl}/logout`, {}));
    } catch (error) {
      // Continuar com logout local mesmo se der erro no backend
      console.warn('Erro ao fazer logout no servidor:', error);
    }

    // Limpar dados locais
    this.clearAuthData();
    
    // Redirecionar para login
    this.router.navigate(['/login']);
  }

  /**
   * Refresh do token de acesso
   */
  async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
      this.clearAuthData(true);
      return null;
    }

    // Se o refresh já expirou localmente, encerra sessão sem chamar backend
    if (this.isRefreshExpired()) {
      this.clearAuthData(true);
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {
          refresh_token: refreshToken
        })
      );

      // Mapear resposta do backend para formato Usuario
      const user = this.mapAuthResponseToUsuario(response.user);

      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      this.currentUserSubject.next(user);
      this.updateTokenExpirations(response.access_token, response.refresh_token);
      return response.access_token;
    } catch (error) {
      // Se refresh falhar, fazer logout
      this.clearAuthData(true);
      return null;
    }
  }

  /**
   * Busca o perfil do usuário atual
   */
  async getProfile(): Promise<Usuario> {
    return firstValueFrom(
      this.http.get<Usuario>(`${this.apiUrl}/profile`)
    );
  }

  /** Atualiza cache local com dados frescos do backend (unidade, vendedor, etc.). */
  async refreshCurrentUserProfile(): Promise<void> {
    const profile = await this.getProfile();
    const user = this.mapAuthResponseToUsuario(profile);
    this.currentUserSubject.next(user);
    this.persistUserInLocalStorage(user);
  }

  /**
   * Verifica se usuário tem determinada permissão
   */
  hasPermission(permission: Permission): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    const perms = this.getUsuarioPermissoesEfetivas(user);
    return perms.includes(permission);
  }

  /**
   * Verifica se usuário tem alguma das permissões fornecidas
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Obtém usuário atual
   */
  getCurrentUser(): Usuario | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtém token de acesso
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Verifica se usuário está autenticado
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Verifica se token ainda é válido no servidor
   */
  async validateToken(): Promise<boolean> {
    // Antes de qualquer validação, se o refresh expirou, encerra sessão
    if (this.isRefreshExpired()) {
      this.clearAuthData(true);
      return false;
    }

    const token = this.getAccessToken();
    
    if (!token) {
      return false;
    }

    try {
      // Tenta buscar o perfil para validar o token
      const user = await this.getProfile();
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
      return true;
    } catch (error) {
      // Se falhar, tenta refresh token
      const newToken = await this.refreshToken();
      
      if (newToken) {
        try {
          const user = await this.getProfile();
          this.currentUserSubject.next(user);
          this.isAuthenticatedSubject.next(true);
          return true;
        } catch (refreshError) {
          this.clearAuthData(true);
          return false;
        }
      }
      
      this.clearAuthData(true);
      return false;
    }
  }

  /**
   * Verifica autenticação armazenada no localStorage
   */
  private async checkStoredAuth(): Promise<void> {
    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user: Usuario = JSON.parse(userStr);
        
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
        
        this.loadStoredTimingInfo(token, refreshToken || undefined);

        // Inicializar tema com preferência do usuário (forçar reset no refresh)
        this.themeService.initializeTheme(user.id, user.tema, true);
        
        // Validar token no servidor em background
        setTimeout(async () => {
          const isValid = await this.validateToken();
          if (!isValid) {
            // Token expirado - será tratado pelo guard
          }
        }, 100);
        
      } catch (error) {
        // Se der erro ao parsear, limpar dados
        this.clearAuthData();
      }
    }
  }

  /**
   * Limpa dados de autenticação
   */
  /**
   * Atualiza o tema do usuário atual
   * Usado quando o tema é alterado para manter consistência
   */
  updateCurrentUserTheme(tema: string): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const updatedUser = { ...currentUser, tema };
      this.currentUserSubject.next(updatedUser);
      this.persistUserInLocalStorage(updatedUser);
    }
  }

  updateCurrentUserAtalhosHome(atalhosHome: string[] | null): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const updatedUser = { ...currentUser, atalhosHome };
      this.currentUserSubject.next(updatedUser);
      this.persistUserInLocalStorage(updatedUser);
    }
  }

  private persistUserInLocalStorage(user: Usuario): void {
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }

  private clearAuthData(shouldRedirect: boolean = false): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem(this.LOGIN_TIMESTAMP_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRATION_KEY);
    localStorage.removeItem(this.REFRESH_EXPIRATION_KEY);
    
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.loginTimestampSubject.next(null);
    this.tokenExpirationSubject.next(null);
    
    // Resetar o tema para permitir nova inicialização no próximo login
    this.themeService.resetTheme();
    
    if (shouldRedirect && !this.router.url.includes('/login')) {
      this.router.navigate(['/login']);
    }
  }

  private setLoginTimestamp(timestamp: number): void {
    this.loginTimestampSubject.next(timestamp);
    localStorage.setItem(this.LOGIN_TIMESTAMP_KEY, timestamp.toString());
  }

  private updateTokenExpirations(
    accessToken: string | null,
    refreshToken?: string | null,
  ): void {
    const accessExp = accessToken ? this.decodeTokenExpiration(accessToken) : null;
    const refreshExp = refreshToken
      ? this.decodeTokenExpiration(refreshToken)
      : this.decodeTokenExpiration(localStorage.getItem('refresh_token') || '');

    // A sessão expira no menor prazo entre access e refresh
    const nextExp = [accessExp, refreshExp].filter((v): v is number => !!v).reduce<number | null>(
      (acc, cur) => (acc === null ? cur : Math.min(acc, cur)),
      null,
    );

    this.tokenExpirationSubject.next(nextExp);

    if (accessExp) {
      localStorage.setItem(this.TOKEN_EXPIRATION_KEY, accessExp.toString());
    } else {
      localStorage.removeItem(this.TOKEN_EXPIRATION_KEY);
    }

    if (refreshExp) {
      localStorage.setItem(this.REFRESH_EXPIRATION_KEY, refreshExp.toString());
    } else {
      localStorage.removeItem(this.REFRESH_EXPIRATION_KEY);
    }
  }

  private loadStoredTimingInfo(accessToken: string, refreshToken?: string): void {
    const storedLogin = Number(localStorage.getItem(this.LOGIN_TIMESTAMP_KEY));
    if (storedLogin) {
      this.loginTimestampSubject.next(storedLogin);
    } else {
      const now = Date.now();
      this.setLoginTimestamp(now);
    }

    // Sempre recalcula com base nos tokens, mas mantém valores salvos se existirem
    const storedAccessExp = Number(localStorage.getItem(this.TOKEN_EXPIRATION_KEY));
    const storedRefreshExp = Number(localStorage.getItem(this.REFRESH_EXPIRATION_KEY));

    if (storedAccessExp) {
      this.tokenExpirationSubject.next(storedAccessExp);
    }
    if (storedRefreshExp) {
      // Garante que o menor prazo seja mantido
      const currentExp = this.tokenExpirationSubject.value;
      const nextExp =
        currentExp === null ? storedRefreshExp : Math.min(currentExp, storedRefreshExp);
      this.tokenExpirationSubject.next(nextExp);
    }

    // Recalcula a partir dos tokens para evitar drift
    this.updateTokenExpirations(accessToken, refreshToken);
  }

  private decodeTokenExpiration(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payload = JSON.parse(atob(parts[1]));
      if (payload?.exp) {
        return payload.exp * 1000;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private isRefreshExpired(): boolean {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return true;
    }

    const exp = this.decodeTokenExpiration(refreshToken);
    return !!exp && Date.now() >= exp;
  }
}
