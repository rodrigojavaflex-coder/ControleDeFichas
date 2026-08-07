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
  ProducaoFuncionarioEtapasResponse,
  ProducaoFuncionarioGestaoConfig,
  ProducaoConfigRelatorio,
  AplicarEtapasRemuneradasResponse,
  AplicarEtapasRemuneradasDto,
  RemoverEtapasFuncionariosResponse,
  RemoverEtapasFuncionariosDto,
  AtualizarCodigoUsuarioErpProducaoDto,
  AtualizarCodigoUsuarioErpProducaoResponse,
} from '../models/producao-config.model';
import {
  ImportarFeriadosNacionaisDto,
  ImportarFeriadosNacionaisResponse,
  ProducaoFeriadosListaResponse,
  ProducaoFeriadoToggleDto,
  ProducaoJornadaResponse,
  SalvarProducaoJornadaDto,
} from '../models/producao-jornada-feriado.model';
import { ProducaoPainelRetiradaConfig } from '../models/producao-painel.model';

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
  ): Observable<ProducaoFuncionarioEtapasResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoFuncionarioEtapasResponse>(
      `${base}/funcionarios/${funcionarioId}/etapas`,
      { params },
    );
  }

  salvarEtapasFuncionario(
    funcionarioId: string,
    dto: BulkSaveProducaoFuncionarioEtapasDto,
  ): Observable<ProducaoFuncionarioEtapasResponse> {
    return this.http.put<ProducaoFuncionarioEtapasResponse>(
      `${base}/funcionarios/${funcionarioId}/etapas/bulk`,
      dto,
    );
  }

  atualizarCodigoUsuarioErp(
    funcionarioId: string,
    dto: AtualizarCodigoUsuarioErpProducaoDto,
  ): Observable<AtualizarCodigoUsuarioErpProducaoResponse> {
    return this.http.put<AtualizarCodigoUsuarioErpProducaoResponse>(
      `${base}/funcionarios/${funcionarioId}/codigo-usuario-erp`,
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

  obterJornada(unidade: Unidade): Observable<ProducaoJornadaResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoJornadaResponse>(`${base}/jornada`, {
      params,
    });
  }

  salvarJornada(
    dto: SalvarProducaoJornadaDto,
  ): Observable<ProducaoJornadaResponse> {
    return this.http.put<ProducaoJornadaResponse>(`${base}/jornada`, dto);
  }

  listarFeriados(
    unidade: Unidade,
    ano: number,
    mes?: number,
  ): Observable<ProducaoFeriadosListaResponse> {
    let params = new HttpParams().set('unidade', unidade).set('ano', ano);
    if (mes != null) {
      params = params.set('mes', mes);
    }
    return this.http.get<ProducaoFeriadosListaResponse>(`${base}/feriados`, {
      params,
    });
  }

  incluirFeriado(
    dto: ProducaoFeriadoToggleDto,
  ): Observable<ProducaoFeriadosListaResponse> {
    return this.http.post<ProducaoFeriadosListaResponse>(
      `${base}/feriados/incluir`,
      dto,
    );
  }

  removerFeriado(
    dto: ProducaoFeriadoToggleDto,
  ): Observable<ProducaoFeriadosListaResponse> {
    return this.http.post<ProducaoFeriadosListaResponse>(
      `${base}/feriados/remover`,
      dto,
    );
  }

  importarFeriadosNacionais(
    dto: ImportarFeriadosNacionaisDto,
  ): Observable<ImportarFeriadosNacionaisResponse> {
    return this.http.post<ImportarFeriadosNacionaisResponse>(
      `${base}/feriados/importar-nacionais`,
      dto,
    );
  }

  obterPainelRetirada(
    unidade: Unidade,
  ): Observable<ProducaoPainelRetiradaConfig> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<ProducaoPainelRetiradaConfig>(
      `${base}/painel-retirada`,
      { params },
    );
  }

  salvarPainelRetirada(
    body: ProducaoPainelRetiradaConfig,
  ): Observable<ProducaoPainelRetiradaConfig> {
    return this.http.put<ProducaoPainelRetiradaConfig>(
      `${base}/painel-retirada`,
      body,
    );
  }
}
