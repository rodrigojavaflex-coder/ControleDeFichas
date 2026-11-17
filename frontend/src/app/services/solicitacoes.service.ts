import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FiltroStatusSolicitacao,
  SolicitacaoGestao,
  SolicitacaoHistorico,
  StatusSolicitacao,
} from '../models/solicitacao.model';

@Injectable({ providedIn: 'root' })
export class SolicitacoesService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/solicitacoes`;

  listarGestao(
    status: FiltroStatusSolicitacao,
    busca: string,
    unidade: string,
  ): Observable<SolicitacaoGestao[]> {
    const params: Record<string, string> = { status };
    const termo = busca.trim();
    if (termo) params['busca'] = termo;
    if (unidade.trim()) params['unidade'] = unidade.trim();
    return this.http.get<SolicitacaoGestao[]>(`${this.api}/gestao`, { params });
  }

  tratar(
    id: string,
    status: Extract<StatusSolicitacao, 'RESOLVIDA' | 'REABERTA'>,
    descricao: string,
  ): Observable<SolicitacaoGestao> {
    return this.http.patch<SolicitacaoGestao>(`${this.api}/${id}/tratar`, {
      status,
      descricao,
    });
  }

  historico(id: string): Observable<SolicitacaoHistorico[]> {
    return this.http.get<SolicitacaoHistorico[]>(`${this.api}/${id}/historico`);
  }
}
