import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VisitacaoAcompanhamentoMeuHome } from '../models/visitacao-acompanhamento-home.model';

@Injectable({ providedIn: 'root' })
export class VisitacaoAcompanhamentoService {
  constructor(private readonly http: HttpClient) {}

  meu(ano?: number, mes?: number): Observable<VisitacaoAcompanhamentoMeuHome> {
    const params: Record<string, string> = {};
    if (ano != null && mes != null) {
      params['ano'] = String(ano);
      params['mes'] = String(mes);
    }
    return this.http.get<VisitacaoAcompanhamentoMeuHome>(
      `${this.baseUrl()}/visitacao/acompanhamento/meu`,
      { params },
    );
  }

  private baseUrl(): string {
    const nativo = Capacitor.getPlatform() !== 'web';
    return nativo
      ? environment.apiUrlNative || environment.apiUrl
      : environment.apiUrl;
  }
}
