import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ProdutividadeAnaliticoResponse,
  ProdutividadeConsultaResponse,
  ProdutividadeQuery,
} from '../models/producao-produtividade.model';

const base = `${environment.apiUrl}/producao/produtividade`;

@Injectable({ providedIn: 'root' })
export class ProducaoProdutividadeService {
  private http = inject(HttpClient);

  consultar(query: ProdutividadeQuery): Observable<ProdutividadeConsultaResponse> {
    return this.http.get<ProdutividadeConsultaResponse>(base, {
      params: this.montarParams(query),
    });
  }

  consultarAnalitico(
    query: ProdutividadeQuery,
  ): Observable<ProdutividadeAnaliticoResponse> {
    return this.http.get<ProdutividadeAnaliticoResponse>(`${base}/analitico`, {
      params: this.montarParams(query),
    });
  }

  private montarParams(query: ProdutividadeQuery): HttpParams {
    let params = new HttpParams()
      .set('dataInicio', query.dataInicio)
      .set('dataFim', query.dataFim);
    query.unidades.forEach((u) => {
      params = params.append('unidades', u);
    });
    return params;
  }
}
