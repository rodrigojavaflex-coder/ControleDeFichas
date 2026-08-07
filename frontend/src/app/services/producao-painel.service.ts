import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ProducaoPainelHistoricoQuery,
  ProducaoPainelHistoricoResponse,
  ProducaoPainelQuery,
  ProducaoPainelResponse,
} from '../models/producao-painel.model';
import { Unidade } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class ProducaoPainelService {
  private http = inject(HttpClient);

  consultar(query: ProducaoPainelQuery): Observable<ProducaoPainelResponse> {
    let params = new HttpParams();
    for (const u of query.unidades) {
      params = params.append('unidades', u);
    }
    return this.http.get<ProducaoPainelResponse>(
      `${environment.apiUrl}/producao/painel`,
      { params },
    );
  }

  historico(
    query: ProducaoPainelHistoricoQuery,
  ): Observable<ProducaoPainelHistoricoResponse> {
    let params = new HttpParams()
      .set('unidade', query.unidade)
      .set('filial', String(query.filial))
      .set('requisicao', String(query.requisicao))
      .set('formula', query.formula);
    return this.http.get<ProducaoPainelHistoricoResponse>(
      `${environment.apiUrl}/producao/painel/historico`,
      { params },
    );
  }
}
