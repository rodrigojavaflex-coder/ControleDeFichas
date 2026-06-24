import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BulkUpdateRejeitadosDto,
  CreateOrcamentoMotivoRejeicaoDto,
  FindOrcamentosRejeitadosDto,
  OrcamentoMotivoRejeicao,
  OrcamentosRejeitadosPaginatedResponse,
  UpdateOrcamentoMotivoRejeicaoDto,
} from '../models/orcamento.model';

@Injectable({ providedIn: 'root' })
export class OrcamentosService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orcamentos`;
  private readonly motivosUrl = `${environment.apiUrl}/orcamentos-motivos-rejeicao`;

  listarRejeitados(
    filters?: FindOrcamentosRejeitadosDto,
  ): Observable<OrcamentosRejeitadosPaginatedResponse> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<OrcamentosRejeitadosPaginatedResponse>(
      `${this.baseUrl}/rejeitados`,
      { params },
    );
  }

  atualizarRejeitadosEmMassa(
    dto: BulkUpdateRejeitadosDto,
  ): Observable<{ atualizados: number }> {
    return this.http.patch<{ atualizados: number }>(
      `${this.baseUrl}/rejeitados/em-massa`,
      dto,
    );
  }

  listarMotivos(apenasAtivos = false): Observable<OrcamentoMotivoRejeicao[]> {
    let params = new HttpParams();
    if (apenasAtivos) {
      params = params.set('apenasAtivos', 'true');
    }
    return this.http.get<OrcamentoMotivoRejeicao[]>(this.motivosUrl, { params });
  }

  getMotivo(id: string): Observable<OrcamentoMotivoRejeicao> {
    return this.http.get<OrcamentoMotivoRejeicao>(`${this.motivosUrl}/${id}`);
  }

  criarMotivo(
    dto: CreateOrcamentoMotivoRejeicaoDto,
  ): Observable<OrcamentoMotivoRejeicao> {
    return this.http.post<OrcamentoMotivoRejeicao>(this.motivosUrl, dto);
  }

  patchMotivo(
    id: string,
    dto: UpdateOrcamentoMotivoRejeicaoDto,
  ): Observable<OrcamentoMotivoRejeicao> {
    return this.http.patch<OrcamentoMotivoRejeicao>(
      `${this.motivosUrl}/${id}`,
      dto,
    );
  }

  deleteMotivo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.motivosUrl}/${id}`);
  }
}
