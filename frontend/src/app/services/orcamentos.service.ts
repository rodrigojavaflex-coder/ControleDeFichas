import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BulkUpdateRejeitadosDto,
  CreateOrcamentoMotivoRejeicaoDto,
  FindOrcamentosDto,
  FindOrcamentosRejeitadosDto,
  OrcamentoMotivoRejeicao,
  OrcamentosRejeitadosOpcoesFiltro,
  OrcamentosRejeitadosPaginatedResponse,
  UpdateOrcamentoMotivoRejeicaoDto,
} from '../models/orcamento.model';
import {
  FindOrcamentosDashboardDto,
  OrcamentosDashboardIndicadores,
  OrcamentosDashboardOpcoesFiltro,
} from '../models/orcamento-dashboard.model';

@Injectable({ providedIn: 'root' })
export class OrcamentosService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orcamentos`;
  private readonly motivosUrl = `${environment.apiUrl}/orcamentos-motivos-rejeicao`;

  listarOrcamentos(
    filters?: FindOrcamentosDto,
  ): Observable<OrcamentosRejeitadosPaginatedResponse> {
    return this.http.get<OrcamentosRejeitadosPaginatedResponse>(
      this.baseUrl,
      { params: this.buildListaParams(filters) },
    );
  }

  /** @deprecated Use listarOrcamentos */
  listarRejeitados(
    filters?: FindOrcamentosRejeitadosDto,
  ): Observable<OrcamentosRejeitadosPaginatedResponse> {
    return this.listarOrcamentos(filters);
  }

  getOrcamentosOpcoesFiltro(
    filters?: Pick<
      FindOrcamentosDto,
      'unidade' | 'dataInicial' | 'dataFinal' | 'status'
    >,
  ): Observable<OrcamentosRejeitadosOpcoesFiltro> {
    return this.http.get<OrcamentosRejeitadosOpcoesFiltro>(
      `${this.baseUrl}/opcoes-filtro`,
      { params: this.buildListaParams(filters) },
    );
  }

  /** @deprecated Use getOrcamentosOpcoesFiltro */
  getRejeitadosOpcoesFiltro(
    filters?: Pick<
      FindOrcamentosRejeitadosDto,
      'unidade' | 'dataInicial' | 'dataFinal'
    >,
  ): Observable<OrcamentosRejeitadosOpcoesFiltro> {
    return this.getOrcamentosOpcoesFiltro(filters);
  }

  private buildListaParams(
    filters?: FindOrcamentosDto,
  ): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) {
            params = params.append(key, String(item));
          }
        });
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
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

  getDashboardIndicadores(
    filters?: FindOrcamentosDashboardDto,
  ): Observable<OrcamentosDashboardIndicadores> {
    return this.http.get<OrcamentosDashboardIndicadores>(
      `${this.baseUrl}/dashboard/indicadores`,
      { params: this.buildDashboardParams(filters) },
    );
  }

  getDashboardOpcoesFiltro(
    filters?: FindOrcamentosDashboardDto,
  ): Observable<OrcamentosDashboardOpcoesFiltro> {
    return this.http.get<OrcamentosDashboardOpcoesFiltro>(
      `${this.baseUrl}/dashboard/opcoes-filtro`,
      { params: this.buildDashboardParams(filters) },
    );
  }

  private buildDashboardParams(
    filters?: FindOrcamentosDashboardDto,
  ): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    const appendArray = (key: string, values?: string[]) => {
      values?.forEach((v) => {
        if (v) params = params.append(key, v);
      });
    };

    if (filters.dataInicial) {
      params = params.set('dataInicial', filters.dataInicial);
    }
    if (filters.dataFinal) {
      params = params.set('dataFinal', filters.dataFinal);
    }
    appendArray('unidades', filters.unidades);
    appendArray('nomesVendedor', filters.nomesVendedor);
    appendArray('nomesMedico', filters.nomesMedico);
    appendArray('status', filters.status);
    if (filters.granularidadeTemporal) {
      params = params.set('granularidadeTemporal', filters.granularidadeTemporal);
    }
    if (filters.topVendedores !== undefined) {
      params = params.set('topVendedores', String(filters.topVendedores));
    }
    return params;
  }
}
