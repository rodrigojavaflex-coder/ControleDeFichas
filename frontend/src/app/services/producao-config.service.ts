import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  BulkSaveProducaoEtapasDto,
  BulkSaveProducaoFuncionarioEtapasDto,
  ProducaoEtapaRemuneracaoRow,
  ProducaoFuncionarioConfigRow,
  ProducaoFuncionarioEtapaModalRow,
  ConfirmarVinculoCodigoFuncionarioDto,
  VinculoCodigoFuncionarioConfirmResponse,
  VinculoCodigoFuncionarioPreviewResponse,
  ProducaoConfigRelatorio,
  AplicarEtapasRemuneradasResponse,
  AplicarEtapasRemuneradasDto,
  RemoverEtapasFuncionariosResponse,
  RemoverEtapasFuncionariosDto,
} from '../models/producao-config.model';

const base = `${environment.apiUrl}/producao/config`;

@Injectable({ providedIn: 'root' })
export class ProducaoConfigService {
  private http = inject(HttpClient);

  listarEtapas(unidade: Unidade): Observable<ProducaoEtapaRemuneracaoRow[]> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoEtapaRemuneracaoRow[]>(`${base}/etapas`, {
      params,
    });
  }

  salvarEtapas(
    dto: BulkSaveProducaoEtapasDto,
  ): Observable<ProducaoEtapaRemuneracaoRow[]> {
    return this.http.put<ProducaoEtapaRemuneracaoRow[]>(
      `${base}/etapas/bulk`,
      dto,
    );
  }

  listarFuncionarios(
    unidade: Unidade,
  ): Observable<ProducaoFuncionarioConfigRow[]> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoFuncionarioConfigRow[]>(
      `${base}/funcionarios`,
      { params },
    );
  }

  listarEtapasFuncionario(
    unidade: Unidade,
    funcionarioId: string,
  ): Observable<ProducaoFuncionarioEtapaModalRow[]> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoFuncionarioEtapaModalRow[]>(
      `${base}/funcionarios/${funcionarioId}/etapas`,
      { params },
    );
  }

  salvarEtapasFuncionario(
    funcionarioId: string,
    dto: BulkSaveProducaoFuncionarioEtapasDto,
  ): Observable<ProducaoFuncionarioEtapaModalRow[]> {
    return this.http.put<ProducaoFuncionarioEtapaModalRow[]>(
      `${base}/funcionarios/${funcionarioId}/etapas/bulk`,
      dto,
    );
  }

  previewVincularCodigoFuncionario(
    unidade: Unidade,
  ): Observable<VinculoCodigoFuncionarioPreviewResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<VinculoCodigoFuncionarioPreviewResponse>(
      `${base}/importacao/vincular-codigo-funcionario/preview`,
      { params },
    );
  }

  confirmarVincularCodigoFuncionario(
    dto: ConfirmarVinculoCodigoFuncionarioDto,
  ): Observable<VinculoCodigoFuncionarioConfirmResponse> {
    return this.http.post<VinculoCodigoFuncionarioConfirmResponse>(
      `${base}/importacao/vincular-codigo-funcionario/confirmar`,
      dto,
    );
  }

  gerarRelatorioConfig(unidade: Unidade): Observable<ProducaoConfigRelatorio> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoConfigRelatorio>(`${base}/relatorio`, {
      params,
    });
  }

  aplicarEtapasRemuneradas(
    dto: AplicarEtapasRemuneradasDto,
  ): Observable<AplicarEtapasRemuneradasResponse> {
    return this.http.post<AplicarEtapasRemuneradasResponse>(
      `${base}/funcionarios/aplicar-etapas-remuneradas`,
      dto,
    );
  }

  removerEtapasFuncionarios(
    dto: RemoverEtapasFuncionariosDto,
  ): Observable<RemoverEtapasFuncionariosResponse> {
    return this.http.post<RemoverEtapasFuncionariosResponse>(
      `${base}/funcionarios/remover-etapas`,
      dto,
    );
  }
}
