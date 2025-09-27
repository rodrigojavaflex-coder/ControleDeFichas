import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, CreateUserDto, UpdateUserDto, FindUsersDto, PaginatedResponse, PermissionGroup } from '../models/user.model';
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
  createUser(createUserDto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, createUserDto);
  }

  /**
   * Listar usuários com paginação e filtros
   */
  getUsers(findUsersDto?: FindUsersDto): Observable<PaginatedResponse<User>> {
    let params = new HttpParams();
    
    if (findUsersDto) {
      if (findUsersDto.page) {
        params = params.set('page', findUsersDto.page.toString());
      }
      if (findUsersDto.limit) {
        params = params.set('limit', findUsersDto.limit.toString());
      }
      if (findUsersDto.name) {
        params = params.set('name', findUsersDto.name);
      }
      if (findUsersDto.email) {
        params = params.set('email', findUsersDto.email);
      }
    }

    return this.http.get<PaginatedResponse<User>>(this.apiUrl, { params });
  }

  /**
   * Buscar usuário por ID
   */
  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
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
  updateUser(id: string, updateUserDto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, updateUserDto);
  }

  /**
   * Atualizar tema do usuário
   */
  updateTema(id: string, tema: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/tema`, { tema });
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
}