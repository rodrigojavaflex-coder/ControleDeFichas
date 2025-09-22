import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FichaTecnica,
  CreateFichaTecnicaDto,
  UpdateFichaTecnicaDto,
  FindFichaTecnicaDto,
  FichaTecnicaPaginatedResponse
} from '../models/ficha-tecnica.model';

@Injectable({
  providedIn: 'root'
})
export class FichaTecnicaService {
  private readonly apiUrl = 'http://localhost:3000/api/fichas-tecnicas';

  constructor(private http: HttpClient) {}

  create(createFichaTecnicaDto: CreateFichaTecnicaDto): Observable<FichaTecnica> {
    return this.http.post<FichaTecnica>(this.apiUrl, createFichaTecnicaDto);
  }

  findAll(query: FindFichaTecnicaDto = {}): Observable<FichaTecnicaPaginatedResponse> {
    let params = new HttpParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<FichaTecnicaPaginatedResponse>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<FichaTecnica> {
    return this.http.get<FichaTecnica>(`${this.apiUrl}/${id}`);
  }

  update(id: string, updateFichaTecnicaDto: UpdateFichaTecnicaDto): Observable<FichaTecnica> {
    return this.http.patch<FichaTecnica>(`${this.apiUrl}/${id}`, updateFichaTecnicaDto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  count(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/count`);
  }

  findRecent(limit: number = 5): Observable<FichaTecnica[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<FichaTecnica[]>(`${this.apiUrl}/recent`, { params });
  }
}