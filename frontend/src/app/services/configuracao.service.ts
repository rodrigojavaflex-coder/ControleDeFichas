import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Configuracao, CreateConfiguracaoDto, UpdateConfiguracaoDto } from '../models/configuracao.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracaoService {
  private readonly apiUrl = '/api/configuracao';

  constructor(private http: HttpClient) {}

  getConfiguracao(): Observable<Configuracao> {
    return this.http.get<Configuracao>(this.apiUrl);
  }

  createConfiguracao(data: FormData): Observable<Configuracao> {
    return this.http.post<Configuracao>(this.apiUrl, data);
  }

  updateConfiguracao(id: string, data: FormData): Observable<Configuracao> {
    return this.http.put<Configuracao>(`${this.apiUrl}/${id}`, data);
  }
}
