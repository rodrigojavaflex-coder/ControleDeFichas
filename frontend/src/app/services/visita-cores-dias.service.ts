import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VisitaCorDia, VisitaCorDiaPayload } from '../models/visita-cor-dia.model';

@Injectable({ providedIn: 'root' })
export class VisitaCoresDiasService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/visita-cores-dias`;

  listar(unidade = ''): Observable<VisitaCorDia[]> {
    let params = new HttpParams();
    if (unidade.trim()) {
      params = params.set('unidade', unidade.trim());
    }
    return this.http.get<VisitaCorDia[]>(this.api, { params });
  }

  obter(id: string): Observable<VisitaCorDia> {
    return this.http.get<VisitaCorDia>(`${this.api}/${id}`);
  }

  criar(body: VisitaCorDiaPayload): Observable<VisitaCorDia> {
    return this.http.post<VisitaCorDia>(this.api, body);
  }

  atualizar(id: string, body: Partial<VisitaCorDiaPayload>): Observable<VisitaCorDia> {
    return this.http.patch<VisitaCorDia>(`${this.api}/${id}`, body);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
