import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  SalvarVisitacaoComissaoFaixaDto,
  VisitacaoComissaoFaixaItem,
  VisitacaoComissaoRepresentantesResponse,
} from '../models/visitacao-comissao.model';

const base = `${environment.apiUrl}/visitacao/comissoes`;

@Injectable({ providedIn: 'root' })
export class VisitacaoComissaoService {
  private http = inject(HttpClient);

  listarRepresentantes(
    unidade?: Unidade,
  ): Observable<VisitacaoComissaoRepresentantesResponse> {
    let params = new HttpParams();
    if (unidade) {
      params = params.set('unidade', unidade);
    }
    return this.http.get<VisitacaoComissaoRepresentantesResponse>(
      `${base}/representantes`,
      { params },
    );
  }

  listarFaixas(
    funcionarioId: string,
  ): Observable<VisitacaoComissaoFaixaItem[]> {
    const params = new HttpParams().set('funcionarioId', funcionarioId);
    return this.http.get<VisitacaoComissaoFaixaItem[]>(base, { params });
  }

  criarFaixa(
    dto: SalvarVisitacaoComissaoFaixaDto,
  ): Observable<VisitacaoComissaoFaixaItem[]> {
    return this.http.post<VisitacaoComissaoFaixaItem[]>(base, dto);
  }

  atualizarFaixa(
    id: string,
    dto: SalvarVisitacaoComissaoFaixaDto,
  ): Observable<VisitacaoComissaoFaixaItem[]> {
    return this.http.patch<VisitacaoComissaoFaixaItem[]>(`${base}/${id}`, dto);
  }

  excluirFaixa(id: string): Observable<VisitacaoComissaoFaixaItem[]> {
    return this.http.delete<VisitacaoComissaoFaixaItem[]>(`${base}/${id}`);
  }

  carregarPadrao(
    funcionarioId: string,
  ): Observable<VisitacaoComissaoFaixaItem[]> {
    return this.http.post<VisitacaoComissaoFaixaItem[]>(
      `${base}/carregar-padrao`,
      { funcionarioId },
    );
  }
}
