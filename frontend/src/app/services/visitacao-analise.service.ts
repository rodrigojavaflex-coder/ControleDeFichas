import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FindVisitacaoAnaliseDto,
  FindVisitacaoAnaliseOpcoesDto,
  VisitacaoAnaliseOpcoes,
  VisitacaoAnaliseResponse,
} from '../models/visitacao-analise.model';

@Injectable({ providedIn: 'root' })
export class VisitacaoAnaliseService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/visitacao/analise`;

  opcoes(
    filters: FindVisitacaoAnaliseOpcoesDto,
  ): Observable<VisitacaoAnaliseOpcoes> {
    let params = new HttpParams();
    if (filters.unidade) {
      params = params.set('unidade', filters.unidade);
    }
    if (filters.comAnalise) {
      params = params.set('comAnalise', 'true');
    }
    return this.http.get<VisitacaoAnaliseOpcoes>(`${this.apiUrl}/opcoes`, {
      params,
    });
  }

  analisar(
    filters: FindVisitacaoAnaliseDto,
  ): Observable<VisitacaoAnaliseResponse> {
    const modo = filters.modo ?? 'comparar';
    let params = new HttpParams().set('modo', modo);

    if (modo === 'ranking') {
      const competencias = (filters.competencias ?? [])
        .map((c) => String(c).trim())
        .filter(Boolean);
      if (competencias.length) {
        params = params.set('competencias', competencias.join(','));
      }
    } else {
      if (filters.c1) {
        params = params.set('c1', filters.c1);
      }
      if (filters.c2) {
        params = params.set('c2', filters.c2);
      }
    }

    if (filters.unidade) {
      params = params.set('unidade', filters.unidade);
    }
    if (filters.funcionarioId) {
      params = params.set('funcionarioId', filters.funcionarioId);
    }
    if (filters.nomeMedico?.trim()) {
      params = params.set('nomeMedico', filters.nomeMedico.trim());
    }
    if (filters.naCarteira) {
      params = params.set('naCarteira', filters.naCarteira);
    }
    if (filters.top != null) {
      params = params.set('top', String(filters.top));
    }
    return this.http.get<VisitacaoAnaliseResponse>(this.apiUrl, { params });
  }
}
