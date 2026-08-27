import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  CopiarComercialMetaDto,
  CopiarComercialMetaResponse,
  SalvarComercialMetaDto,
  SalvarComercialMetaUnidadeDto,
  ComercialMetaListResponse,
} from '../models/comercial-meta.model';

const base = `${environment.apiUrl}/comercial/metas`;

@Injectable({ providedIn: 'root' })
export class ComercialMetaService {
  private http = inject(HttpClient);

  listar(
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Observable<ComercialMetaListResponse> {
    let params = new HttpParams()
      .set('unidade', unidade)
      .set('ano', String(ano));
    if (mes != null) {
      params = params.set('mes', String(mes));
    }
    return this.http.get<ComercialMetaListResponse>(base, { params });
  }

  salvar(dto: SalvarComercialMetaDto): Observable<ComercialMetaListResponse> {
    return this.http.put<ComercialMetaListResponse>(base, dto);
  }

  salvarUnidade(
    dto: SalvarComercialMetaUnidadeDto,
  ): Observable<ComercialMetaListResponse> {
    return this.http.put<ComercialMetaListResponse>(`${base}/unidade`, dto);
  }

  copiar(dto: CopiarComercialMetaDto): Observable<CopiarComercialMetaResponse> {
    return this.http.post<CopiarComercialMetaResponse>(`${base}/copiar`, dto);
  }
}
