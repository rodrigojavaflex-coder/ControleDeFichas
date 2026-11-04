import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  ComercialAcompanhamentoDetalhe,
  ComercialAcompanhamentoListResponse,
  ComercialAcompanhamentoMeuCard,
  ComercialAcompanhamentoUnidadeCardsResponse,
  ComercialAcompanhamentoVendedorOpcao,
  FindComercialAcompanhamentoDto,
} from '../models/comercial-acompanhamento.model';

const base = `${environment.apiUrl}/comercial/acompanhamento`;

@Injectable({ providedIn: 'root' })
export class ComercialAcompanhamentoService {
  private http = inject(HttpClient);

  listar(
    dto: FindComercialAcompanhamentoDto,
  ): Observable<ComercialAcompanhamentoListResponse> {
    let params = new HttpParams()
      .set('unidade', dto.unidade)
      .set('ano', String(dto.ano))
      .set('mes', String(dto.mes));
    if (dto.funcionarioId) {
      params = params.set('funcionarioId', dto.funcionarioId);
    }
    return this.http.get<ComercialAcompanhamentoListResponse>(base, { params });
  }

  meuCard(competencia?: {
    ano?: number;
    mes?: number;
  }): Observable<ComercialAcompanhamentoMeuCard> {
    let params = new HttpParams();
    if (competencia?.ano != null && competencia?.mes != null) {
      params = params
        .set('ano', String(competencia.ano))
        .set('mes', String(competencia.mes));
    }
    return this.http.get<ComercialAcompanhamentoMeuCard>(`${base}/meu`, {
      params,
    });
  }

  meuDetalhe(filtro?: {
    ano?: number;
    mes?: number;
    dataInicial?: string;
    dataFinal?: string;
  }): Observable<ComercialAcompanhamentoDetalhe> {
    let params = new HttpParams();
    if (filtro?.ano != null && filtro?.mes != null) {
      params = params
        .set('ano', String(filtro.ano))
        .set('mes', String(filtro.mes));
    }
    if (filtro?.dataInicial) {
      params = params.set('dataInicial', filtro.dataInicial);
    }
    if (filtro?.dataFinal) {
      params = params.set('dataFinal', filtro.dataFinal);
    }
    return this.http.get<ComercialAcompanhamentoDetalhe>(`${base}/meu/detalhe`, {
      params,
    });
  }

  unidadeCards(): Observable<ComercialAcompanhamentoUnidadeCardsResponse> {
    return this.http.get<ComercialAcompanhamentoUnidadeCardsResponse>(
      `${base}/unidade`,
    );
  }

  unidadeDetalhe(
    unidade: Unidade,
    filtroDia?: { dataInicial?: string; dataFinal?: string },
  ): Observable<ComercialAcompanhamentoDetalhe> {
    let params = new HttpParams().set('unidade', unidade);
    if (filtroDia?.dataInicial) {
      params = params.set('dataInicial', filtroDia.dataInicial);
    }
    if (filtroDia?.dataFinal) {
      params = params.set('dataFinal', filtroDia.dataFinal);
    }
    return this.http.get<ComercialAcompanhamentoDetalhe>(
      `${base}/unidade/detalhe`,
      { params },
    );
  }

  listarVendedores(
    unidade: Unidade,
  ): Observable<ComercialAcompanhamentoVendedorOpcao[]> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ComercialAcompanhamentoVendedorOpcao[]>(
      `${base}/vendedores`,
      { params },
    );
  }

  detalhe(
    dto: FindComercialAcompanhamentoDto,
  ): Observable<ComercialAcompanhamentoDetalhe> {
    let params = new HttpParams()
      .set('unidade', dto.unidade)
      .set('ano', String(dto.ano))
      .set('mes', String(dto.mes));
    if (dto.funcionarioId) {
      params = params.set('funcionarioId', dto.funcionarioId);
    }
    if (dto.dataInicial) {
      params = params.set('dataInicial', dto.dataInicial);
    }
    if (dto.dataFinal) {
      params = params.set('dataFinal', dto.dataFinal);
    }
    return this.http.get<ComercialAcompanhamentoDetalhe>(`${base}/detalhe`, {
      params,
    });
  }
}
