import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ComercialAnaliseOpcoes,
  ComercialAnaliseResponse,
  FindComercialAnaliseDto,
  FindComercialAnaliseOpcoesDto,
} from '../models/comercial-analise.model';

@Injectable({ providedIn: 'root' })
export class ComercialAnaliseService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/comercial/analise`;

  opcoes(
    filters: FindComercialAnaliseOpcoesDto,
  ): Observable<ComercialAnaliseOpcoes> {
    let params = new HttpParams();
    if (filters.unidade) {
      params = params.set('unidade', filters.unidade);
    }
    return this.http.get<ComercialAnaliseOpcoes>(`${this.apiUrl}/opcoes`, {
      params,
    });
  }

  analisar(
    filters: FindComercialAnaliseDto,
  ): Observable<ComercialAnaliseResponse> {
    const modo = filters.modo ?? 'comparar';
    const dimensao = filters.dimensao ?? 'vendedor';
    let params = new HttpParams()
      .set('modo', modo)
      .set('dimensao', dimensao)
      .set('metrica', filters.metrica ?? 'valor')
      .set('base', filters.base ?? 'totalVendido');

    if (modo === 'ranking' || modo === 'evolucao') {
      const competencias = (filters.competencias ?? [])
        .map((c) => String(c).trim())
        .filter(Boolean);
      if (competencias.length) {
        params = params.set('competencias', competencias.join(','));
      }
    } else if (modo === 'semanas') {
      const leitura = filters.leitura ?? 'comparar';
      params = params.set('leitura', leitura);
      if (leitura === 'comparar') {
        if (filters.s1) params = params.set('s1', filters.s1);
        if (filters.s2) params = params.set('s2', filters.s2);
      }
    } else {
      if (filters.c1) params = params.set('c1', filters.c1);
      if (filters.c2) params = params.set('c2', filters.c2);
    }

    if (dimensao === 'unidade') {
      if (filters.unidades != null) {
        params = params.set('unidades', filters.unidades.join(','));
      }
    } else {
      if (filters.unidade) {
        params = params.set('unidade', filters.unidade);
      }
      if (filters.funcionarioIds != null) {
        params = params.set('funcionarioIds', filters.funcionarioIds.join(','));
      }
    }
    return this.http.get<ComercialAnaliseResponse>(this.apiUrl, { params });
  }
}
