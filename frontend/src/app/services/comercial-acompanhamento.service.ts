import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  ComercialAcompanhamentoListResponse,
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

  listarVendedores(
    unidade: Unidade,
  ): Observable<ComercialAcompanhamentoVendedorOpcao[]> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ComercialAcompanhamentoVendedorOpcao[]>(
      `${base}/vendedores`,
      { params },
    );
  }
}
