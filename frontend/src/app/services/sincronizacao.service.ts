import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SincronizacaoConfig,
  CreateSincronizacaoConfigDto,
  UpdateSincronizacaoConfigDto,
  SincronizacaoResult,
} from '../models/sincronizacao.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SincronizacaoService {
  private readonly apiUrl = `${environment.apiUrl}/sincronizacao-config`;
  private readonly syncApiUrl = `${environment.apiUrl}/sincronizacao`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<SincronizacaoConfig[]> {
    return this.http.get<SincronizacaoConfig[]>(this.apiUrl);
  }

  findOne(id: string): Observable<SincronizacaoConfig> {
    return this.http.get<SincronizacaoConfig>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateSincronizacaoConfigDto): Observable<SincronizacaoConfig> {
    return this.http.post<SincronizacaoConfig>(this.apiUrl, data);
  }

  update(
    id: string,
    data: UpdateSincronizacaoConfigDto,
  ): Observable<SincronizacaoConfig> {
    return this.http.patch<SincronizacaoConfig>(`${this.apiUrl}/${id}`, data);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  executarSincronizacao(): Observable<SincronizacaoResult[]> {
    return this.http.post<SincronizacaoResult[]>(
      `${this.syncApiUrl}/executar`,
      {},
    );
  }
}
