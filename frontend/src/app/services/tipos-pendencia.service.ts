import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ResponsavelTipoPendencia,
  TipoPendencia,
  TipoPendenciaOpcao,
  TipoPendenciaPayload,
} from '../models/tipo-pendencia.model';

@Injectable({ providedIn: 'root' })
export class TiposPendenciaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tipos-pendencia`;

  listar(apenasAtivos = false, unidade = ''): Observable<TipoPendencia[]> {
    let params = new HttpParams();
    if (apenasAtivos) {
      params = params.set('apenasAtivos', 'true');
    }
    if (unidade.trim()) {
      params = params.set('unidade', unidade.trim());
    }
    return this.http.get<TipoPendencia[]>(this.api, { params });
  }

  listarAtivos(): Observable<TipoPendenciaOpcao[]> {
    return this.http.get<TipoPendenciaOpcao[]>(`${this.api}/ativos`);
  }

  listarResponsaveis(): Observable<ResponsavelTipoPendencia[]> {
    return this.http.get<ResponsavelTipoPendencia[]>(`${this.api}/responsaveis`);
  }

  obter(id: string): Observable<TipoPendencia> {
    return this.http.get<TipoPendencia>(`${this.api}/${id}`);
  }

  criar(body: TipoPendenciaPayload): Observable<TipoPendencia> {
    return this.http.post<TipoPendencia>(this.api, body);
  }

  atualizar(
    id: string,
    body: Partial<TipoPendenciaPayload>,
  ): Observable<TipoPendencia> {
    return this.http.patch<TipoPendencia>(`${this.api}/${id}`, body);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
