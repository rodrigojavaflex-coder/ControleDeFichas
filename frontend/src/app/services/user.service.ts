import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, CreateUsuarioDto, UpdateUsuarioDto, FindUsuariosDto, PaginatedResponse, PermissionGroup, ChangePasswordDto, Perfil } from '../models/usuario.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /**
   * Criar novo usuário
   */
  createUser(createUsuarioDto: CreateUsuarioDto): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, createUsuarioDto);
  }

  /**
   * Listar usuários com paginação e filtros
   */
  getUsers(findUsuariosDto?: FindUsuariosDto): Observable<PaginatedResponse<Usuario>> {
    let params = new HttpParams();
    
    if (findUsuariosDto) {
      if (findUsuariosDto.page) {
        params = params.set('page', findUsuariosDto.page.toString());
      }
      if (findUsuariosDto.limit) {
        params = params.set('limit', findUsuariosDto.limit.toString());
      }
      if (findUsuariosDto.nome) {
        params = params.set('nome', findUsuariosDto.nome);
      }
      if (findUsuariosDto.email) {
        params = params.set('email', findUsuariosDto.email);
      }
    }

    return this.http.get<PaginatedResponse<Usuario>>(this.apiUrl, { params });
  }

  /**
   * Buscar usuário por ID
   */
  getUserById(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  /**
   * Buscar dados do usuário formatados para impressão
   */
  getUserPrintData(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/print`);
  }

  /**
   * Atualizar usuário
   */
  updateUser(id: string, updateUsuarioDto: UpdateUsuarioDto): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}`, updateUsuarioDto);
  }

  /**
   * Atualizar tema do usuário
   */
  updateTema(id: string, tema: string): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}/tema`, { tema });
  }

  /**
   * Remover usuário
   */
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Buscar permissões disponíveis
   */
  getPermissions(): Observable<PermissionGroup> {
    return this.http.get<PermissionGroup>(`${this.apiUrl}/permissions`);
  }
  /**
   * Buscar perfis disponíveis
   */
  getProfiles(): Observable<Perfil[]> {
    return this.http.get<Perfil[]>(`${this.apiUrl}/profiles`);
  }

  /**
   * Alterar senha do usuário
   */
  changePassword(userId: string, changePasswordDto: ChangePasswordDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${userId}/change-password`, changePasswordDto);
  }
}