import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FindVisitacaoPainelMedicoDto,
  VisitacaoPainelMedicoPaginatedResponse,
  VisitacaoPainelMedicoRepresentante,
} from '../models/visitacao-painel-medico.model';
import { Unidade } from '../models/usuario.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VisitacaoPainelMedicoService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/visitacao/painel-medico`;

  findAll(
    filters?: FindVisitacaoPainelMedicoDto,
  ): Observable<VisitacaoPainelMedicoPaginatedResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.page != null) {
        params = params.set('page', String(filters.page));
      }
      if (filters.limit != null) {
        params = params.set('limit', String(filters.limit));
      }
      if (filters.unidade) {
        params = params.set('unidade', filters.unidade);
      }
      if (filters.nomeMedico?.trim()) {
        params = params.set('nomeMedico', filters.nomeMedico.trim());
      }
      if (filters.crmMedico?.trim()) {
        params = params.set('crmMedico', filters.crmMedico.trim());
      }
      if (filters.ufCrmMedico?.trim()) {
        params = params.set('ufCrmMedico', filters.ufCrmMedico.trim());
      }
      if (filters.nomeRepresentante?.trim()) {
        params = params.set('nomeRepresentante', filters.nomeRepresentante.trim());
      }
      if (filters.funcionarioId) {
        params = params.set('funcionarioId', filters.funcionarioId);
      }
      if (filters.codigoRepresentante != null) {
        params = params.set(
          'codigoRepresentante',
          String(filters.codigoRepresentante),
        );
      }
    }

    return this.http.get<VisitacaoPainelMedicoPaginatedResponse>(this.apiUrl, {
      params,
    });
  }

  listarRepresentantes(
    unidade?: Unidade,
  ): Observable<VisitacaoPainelMedicoRepresentante[]> {
    let params = new HttpParams();
    if (unidade) {
      params = params.set('unidade', unidade);
    }
    return this.http.get<VisitacaoPainelMedicoRepresentante[]>(
      `${this.apiUrl}/representantes`,
      { params },
    );
  }
}
