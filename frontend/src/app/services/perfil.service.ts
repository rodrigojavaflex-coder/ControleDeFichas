import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Perfil } from '../models/usuario.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly apiUrl = `${environment.apiUrl}/perfil`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<Perfil[]> {
    return this.http.get<Perfil[]>(this.apiUrl);
  }
  
  findOne(id: string): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.apiUrl}/${id}`);
  }
  
  create(data: Partial<Perfil>): Observable<Perfil> {
    return this.http.post<Perfil>(this.apiUrl, data);
  }
  
  update(id: string, data: Partial<Perfil>): Observable<Perfil> {
    return this.http.patch<Perfil>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<any> {
    // Retorna any para capturar corpo JSON de erro com message
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}