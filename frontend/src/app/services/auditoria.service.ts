import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Auditoria, AuditLogFilters, PaginatedAuditResponse } from '../models/auditoria.model';
import { environment } from '../../environments/environment';

export interface RollbackResult {
  success: boolean;
  message: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  private apiUrl = `${environment.apiUrl}/auditoria`;

  constructor(private http: HttpClient) {}

  getAuditLogs(filters: AuditLogFilters): Observable<PaginatedAuditResponse> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.acao) params = params.set('acao', filters.acao);
    if (filters.usuarioId) params = params.set('usuarioId', filters.usuarioId);
    if (filters.entidade) params = params.set('entidade', filters.entidade);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((response): PaginatedAuditResponse => {
        // Verificar se a resposta tem a estrutura esperada
        if (response && response.data && response.meta) {
          return response as PaginatedAuditResponse;
        }
        
        // Verificar se tem estrutura direta (sem meta)
        if (response && response.data && response.total !== undefined) {
          return {
            data: response.data,
            meta: {
              total: response.total,
              page: response.page || 1,
              limit: response.limit || 20,
              totalPages: Math.ceil(response.total / (response.limit || 20)),
              hasPreviousPage: (response.page || 1) > 1,
              hasNextPage: (response.page || 1) < Math.ceil(response.total / (response.limit || 20))
            }
          };
        }
        
        throw new Error('Resposta da API em formato inválido');
      }),
      catchError((error: any) => {
        return throwError(() => error);
      })
    );
  }

  getUndoableChanges(): Observable<Auditoria[]> {
    return this.http.get<Auditoria[]>(`${this.apiUrl}/undoable`);
  }

  undoChange(logId: string): Observable<RollbackResult> {
    return this.http.post<RollbackResult>(`${this.apiUrl}/${logId}/undo`, {});
  }

  getHistoryByEntity(entidade: string, entidadeId: string): Promise<Auditoria[]> {
    return this.http.get<Auditoria[]>(`${this.apiUrl}/entity/${entidade}/${entidadeId}`).toPromise().then(result => result || []);
  }
}