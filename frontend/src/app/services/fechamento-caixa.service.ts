import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CaixaSaldoInicialUnidade,
  FechamentoCaixaDetalhado,
  FechamentoConsolidado,
  ImportarCaixaErpDto,
  ImportarCaixaErpResponse,
  SalvarFechamentoRascunhoDto,
} from '../models/fechamento-caixa.model';
import { Unidade } from '../models/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class FechamentoCaixaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fechamento`;

  importarCaixaErp(
    dto: ImportarCaixaErpDto,
  ): Observable<ImportarCaixaErpResponse> {
    return this.http.post<ImportarCaixaErpResponse>(
      `${this.apiUrl}/importar-caixa-erp`,
      dto,
    );
  }

  listarSaldosIniciais(): Observable<CaixaSaldoInicialUnidade[]> {
    return this.http.get<CaixaSaldoInicialUnidade[]>(
      `${this.apiUrl}/saldos-iniciais`,
    );
  }

  atualizarSaldoInicial(
    unidade: Unidade,
    saldoInicial: number,
    dataSaldo: string,
  ): Observable<CaixaSaldoInicialUnidade> {
    return this.http.put<CaixaSaldoInicialUnidade>(
      `${this.apiUrl}/saldos-iniciais`,
      { unidade, saldoInicial, dataSaldo },
    );
  }

  obterConsolidado(
    unidade: Unidade,
    data: string,
  ): Observable<FechamentoConsolidado> {
    return this.http.get<FechamentoConsolidado>(`${this.apiUrl}/consolidado`, {
      params: { unidade, data },
    });
  }

  obterCaixaDetalhado(
    unidade: Unidade,
    data: string,
  ): Observable<FechamentoCaixaDetalhado> {
    return this.http.get<FechamentoCaixaDetalhado>(
      `${this.apiUrl}/consolidado/detalhado`,
      { params: { unidade, data } },
    );
  }

  salvarRascunho(
    dto: SalvarFechamentoRascunhoDto,
  ): Observable<FechamentoConsolidado> {
    return this.http.put<FechamentoConsolidado>(
      `${this.apiUrl}/consolidado/rascunho`,
      dto,
    );
  }

  confirmarFechamento(
    unidade: Unidade,
    data: string,
  ): Observable<FechamentoConsolidado> {
    return this.http.post<FechamentoConsolidado>(
      `${this.apiUrl}/consolidado/confirmar`,
      { unidade, data },
    );
  }

  reabrirFechamento(
    unidade: Unidade,
    data: string,
  ): Observable<FechamentoConsolidado> {
    return this.http.post<FechamentoConsolidado>(
      `${this.apiUrl}/consolidado/reabrir`,
      { unidade, data },
    );
  }
}
