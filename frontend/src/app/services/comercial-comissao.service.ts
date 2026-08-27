import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import { ComercialTipoBase } from '../models/comercial-meta.model';
import {
  ComercialComissaoFaixaItem,
  ComercialComissaoVendedoresResponse,
  SalvarComercialComissaoFaixaDto,
  CarregarComercialComissaoPadraoPendentesResponse,
  ComercialComissaoPoliticaResponse,
  SalvarComercialComissaoPoliticaDto,
} from '../models/comercial-comissao.model';

const base = `${environment.apiUrl}/comercial/comissoes`;

@Injectable({ providedIn: 'root' })
export class ComercialComissaoService {
  private http = inject(HttpClient);

  listarVendedores(
    unidade: Unidade,
  ): Observable<ComercialComissaoVendedoresResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ComercialComissaoVendedoresResponse>(
      `${base}/vendedores`,
      { params },
    );
  }

  listarFaixas(
    funcionarioId: string,
    tipoBase: ComercialTipoBase,
  ): Observable<ComercialComissaoFaixaItem[]> {
    const params = new HttpParams()
      .set('funcionarioId', funcionarioId)
      .set('tipoBase', tipoBase);
    return this.http.get<ComercialComissaoFaixaItem[]>(base, { params });
  }

  carregarPadrao(
    funcionarioId: string,
    tipoBase: ComercialTipoBase,
  ): Observable<ComercialComissaoFaixaItem[]> {
    return this.http.post<ComercialComissaoFaixaItem[]>(
      `${base}/carregar-padrao`,
      { funcionarioId, tipoBase },
    );
  }

  carregarPadraoPendentes(
    unidade: Unidade,
  ): Observable<CarregarComercialComissaoPadraoPendentesResponse> {
    return this.http.post<CarregarComercialComissaoPadraoPendentesResponse>(
      `${base}/carregar-padrao-pendentes`,
      { unidade },
    );
  }

  criarFaixa(
    dto: SalvarComercialComissaoFaixaDto,
  ): Observable<ComercialComissaoFaixaItem[]> {
    return this.http.post<ComercialComissaoFaixaItem[]>(base, dto);
  }

  atualizarFaixa(
    id: string,
    dto: SalvarComercialComissaoFaixaDto,
  ): Observable<ComercialComissaoFaixaItem[]> {
    return this.http.patch<ComercialComissaoFaixaItem[]>(`${base}/${id}`, dto);
  }

  excluirFaixa(id: string): Observable<ComercialComissaoFaixaItem[]> {
    return this.http.delete<ComercialComissaoFaixaItem[]>(`${base}/${id}`);
  }

  listarPolitica(
    funcionarioId: string,
  ): Observable<ComercialComissaoPoliticaResponse> {
    const params = new HttpParams().set('funcionarioId', funcionarioId);
    return this.http.get<ComercialComissaoPoliticaResponse>(
      `${base}/politica`,
      { params },
    );
  }

  salvarPolitica(
    dto: SalvarComercialComissaoPoliticaDto,
  ): Observable<ComercialComissaoPoliticaResponse> {
    return this.http.put<ComercialComissaoPoliticaResponse>(
      `${base}/politica`,
      dto,
    );
  }
}
