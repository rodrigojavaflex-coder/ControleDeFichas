import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AcompanhamentoDetalheQuery,
  AcompanhamentoDetalheResponse,
  AcompanhamentoLocalizarQuery,
  AcompanhamentoLocalizarResponse,
  AcompanhamentoQuery,
  AcompanhamentoResumoResponse,
} from '../models/producao-acompanhamento.model';
import { Unidade } from '../models/usuario.model';

const base = `${environment.apiUrl}/producao/acompanhamento`;

@Injectable({ providedIn: 'root' })
export class ProducaoAcompanhamentoService {
  private http = inject(HttpClient);

  resumo(query: AcompanhamentoQuery): Observable<AcompanhamentoResumoResponse> {
    return this.http.get<AcompanhamentoResumoResponse>(`${base}/resumo`, {
      params: this.montarParams(query.unidades),
    });
  }

  detalhe(
    query: AcompanhamentoDetalheQuery,
  ): Observable<AcompanhamentoDetalheResponse> {
    let params = this.montarParams(query.unidades);
    params = params.set('codEtapa', query.codEtapa);
    return this.http.get<AcompanhamentoDetalheResponse>(`${base}/detalhe`, {
      params,
    });
  }

  localizar(
    query: AcompanhamentoLocalizarQuery,
  ): Observable<AcompanhamentoLocalizarResponse> {
    let params = this.montarParams(query.unidades);
    params = params.set('requisicao', String(query.requisicao));
    if (query.formula != null && query.formula.trim() !== '') {
      params = params.set('formula', query.formula.trim());
    }
    if (query.filial != null) {
      params = params.set('filial', String(query.filial));
    }
    return this.http.get<AcompanhamentoLocalizarResponse>(`${base}/localizar`, {
      params,
    });
  }

  private montarParams(unidades: Unidade[]): HttpParams {
    let params = new HttpParams();
    for (const u of unidades) {
      params = params.append('unidades', u);
    }
    return params;
  }
}
