import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FindVisitacaoAcompanhamentoDetalheDto,
  FindVisitacaoAcompanhamentoDto,
  VisitacaoAcompanhamentoDetalhe,
  VisitacaoAcompanhamentoListResponse,
  VisitacaoAcompanhamentoOpcoesFiltro,
} from '../models/visitacao-acompanhamento.model';
import { VisitacaoPainelMedicoRepresentante } from '../models/visitacao-painel-medico.model';
import { Unidade } from '../models/usuario.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VisitacaoAcompanhamentoService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/visitacao/acompanhamento`;

  findAll(
    filters: FindVisitacaoAcompanhamentoDto,
  ): Observable<VisitacaoAcompanhamentoListResponse> {
    return this.http.get<VisitacaoAcompanhamentoListResponse>(this.apiUrl, {
      params: this.buildParams(filters),
    });
  }

  opcoesFiltro(
    filters: FindVisitacaoAcompanhamentoDto,
  ): Observable<VisitacaoAcompanhamentoOpcoesFiltro> {
    const { page: _p, limit: _l, nomesMedico: _n, ...rest } = filters;
    return this.http.get<VisitacaoAcompanhamentoOpcoesFiltro>(
      `${this.apiUrl}/opcoes-filtro`,
      { params: this.buildParams(rest) },
    );
  }

  detalhe(
    dto: FindVisitacaoAcompanhamentoDetalheDto,
  ): Observable<VisitacaoAcompanhamentoDetalhe> {
    let params = new HttpParams()
      .set('unidade', dto.unidade)
      .set('crmMedico', dto.crmMedico)
      .set('ufCrmMedico', dto.ufCrmMedico)
      .set('dataInicial', dto.dataInicial)
      .set('dataFinal', dto.dataFinal);

    if (dto.nomeMedico?.trim()) {
      params = params.set('nomeMedico', dto.nomeMedico.trim());
    }

    return this.http.get<VisitacaoAcompanhamentoDetalhe>(
      `${this.apiUrl}/detalhe`,
      { params },
    );
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

  private buildParams(filters: FindVisitacaoAcompanhamentoDto): HttpParams {
    let params = new HttpParams()
      .set('dataInicial', filters.dataInicial)
      .set('dataFinal', filters.dataFinal);

    if (filters.page != null && !filters.todos) {
      params = params.set('page', String(filters.page));
    }
    if (filters.limit != null && !filters.todos) {
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
    if (filters.funcionarioId) {
      params = params.set('funcionarioId', filters.funcionarioId);
    }
    if (filters.naCarteira && filters.naCarteira !== 'todos') {
      params = params.set('naCarteira', filters.naCarteira);
    }
    if (filters.ordenarPor) {
      params = params.set('ordenarPor', filters.ordenarPor);
    }
    if (filters.ordem) {
      params = params.set('ordem', filters.ordem);
    }
    if (filters.nomesMedico?.length) {
      for (const nome of filters.nomesMedico) {
        params = params.append('nomesMedico', nome);
      }
    }
    if (filters.todos) {
      params = params.set('todos', 'true');
    }
    return params;
  }
}
