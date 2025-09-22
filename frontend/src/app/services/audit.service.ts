import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  AuditLog, 
  AuditLogFilters, 
  PaginatedAuditResponse,
  AuditAction,
  AuditLevel 
} from '../models/audit.model';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly apiUrl = 'http://localhost:3000/api/audit';

  constructor(private http: HttpClient) {}

  /**
   * Buscar logs de auditoria com filtros e paginação
   */
  getAuditLogs(filters?: AuditLogFilters): Observable<PaginatedAuditResponse> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.page !== undefined) {
        params = params.set('page', filters.page.toString());
      }
      if (filters.limit !== undefined) {
        params = params.set('limit', filters.limit.toString());
      }
      if (filters.userId) {
        params = params.set('userId', filters.userId);
      }
      if (filters.action) {
        params = params.set('action', filters.action);
      }
      if (filters.level) {
        params = params.set('level', filters.level);
      }
      if (filters.success !== undefined) {
        params = params.set('success', filters.success.toString());
      }
      if (filters.entityType) {
        params = params.set('entityType', filters.entityType);
      }
      if (filters.startDate) {
        params = params.set('startDate', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        params = params.set('endDate', filters.endDate.toISOString());
      }
      if (filters.search) {
        params = params.set('search', filters.search);
      }
    }

    return this.http.get<PaginatedAuditResponse>(this.apiUrl, { params });
  }

  /**
   * Buscar log de auditoria por ID
   */
  getAuditLogById(id: string): Observable<AuditLog> {
    return this.http.get<AuditLog>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obter lista de ações disponíveis para filtros
   */
  getAvailableActions(): AuditAction[] {
    return Object.values(AuditAction);
  }

  /**
   * Obter lista de níveis disponíveis para filtros  
   */
  getAvailableLevels(): AuditLevel[] {
    return Object.values(AuditLevel);
  }

  /**
   * Exportar logs de auditoria (se implementado no backend)
   */
  exportAuditLogs(filters?: AuditLogFilters): Observable<Blob> {
    let params = new HttpParams();
    
    if (filters) {
      // Aplicar os mesmos filtros da busca
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null) {
          if (value instanceof Date) {
            params = params.set(key, value.toISOString());
          } else {
            params = params.set(key, value.toString());
          }
        }
      });
    }

    return this.http.get(`${this.apiUrl}/export`, { 
      params, 
      responseType: 'blob' 
    });
  }
}