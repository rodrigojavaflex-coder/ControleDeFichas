import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  CopiarVisitacaoMetaDto,
  CopiarVisitacaoMetaResponse,
  SalvarVisitacaoMetaDto,
  VisitacaoMetaListResponse,
} from '../models/visitacao-meta.model';

const base = `${environment.apiUrl}/visitacao/metas`;

@Injectable({ providedIn: 'root' })
export class VisitacaoMetaService {
  private http = inject(HttpClient);

  listar(
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Observable<VisitacaoMetaListResponse> {
    let params = new HttpParams()
      .set('unidade', unidade)
      .set('ano', String(ano));
    if (mes != null) {
      params = params.set('mes', String(mes));
    }
    return this.http.get<VisitacaoMetaListResponse>(base, { params });
  }

  salvar(dto: SalvarVisitacaoMetaDto): Observable<VisitacaoMetaListResponse> {
    return this.http.put<VisitacaoMetaListResponse>(base, dto);
  }

  copiar(dto: CopiarVisitacaoMetaDto): Observable<CopiarVisitacaoMetaResponse> {
    return this.http.post<CopiarVisitacaoMetaResponse>(`${base}/copiar`, dto);
  }
}
