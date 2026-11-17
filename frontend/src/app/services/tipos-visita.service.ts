import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TipoVisita, TipoVisitaPayload } from '../models/tipo-visita.model';

@Injectable({ providedIn: 'root' })
export class TiposVisitaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tipos-visita`;

  listar(apenasAtivos = false, unidade = ''): Observable<TipoVisita[]> {
    let params = new HttpParams();
    if (apenasAtivos) {
      params = params.set('apenasAtivos', 'true');
    }
    if (unidade.trim()) {
      params = params.set('unidade', unidade.trim());
    }
    return this.http.get<TipoVisita[]>(this.api, { params });
  }

  obter(id: string): Observable<TipoVisita> {
    return this.http.get<TipoVisita>(`${this.api}/${id}`);
  }

  criar(body: TipoVisitaPayload): Observable<TipoVisita> {
    return this.http.post<TipoVisita>(this.api, body);
  }

  atualizar(id: string, body: Partial<TipoVisitaPayload>): Observable<TipoVisita> {
    return this.http.patch<TipoVisita>(`${this.api}/${id}`, body);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
