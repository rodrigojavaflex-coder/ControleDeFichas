import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CarteiraConsulta,
  CarteiraVisitas,
  HistoricoVisita,
  FiltroDiasHistorico,
  MedicoPendenciaOpcao,
  PainelPrescritorVisita,
  PeriodoHistoricoFiltro,
  StatusVisita,
  TipoMidiaVisita,
  VisitaCorDiaAtiva,
  VisitaMidia,
  VisitaResumo,
  FiltroPendenciasApp,
  SolicitacaoHistoricoItem,
  SolicitacaoResumo,
  SolicitacoesListaPaginada,
  TipoPendenciaOpcao,
} from '../models/visita.model';

export interface AgendaAgendamentoItem {
  id: string;
  prescritorId: string;
  prescritorNome: string;
  crm: string;
  uf: string;
  data: string;
  hora: string | null;
  observacao: string | null;
}

export interface AgendaFeriadoDia {
  data: string;
  descricao: string | null;
}

export interface AgendaVisitasMes {
  ano: number;
  mes: number;
  unidade: string | null;
  sabadoDiaUtil: boolean;
  feriados: AgendaFeriadoDia[];
  dias: Array<{
    data: string;
    quantidadeVisitas: number;
    quantidadeAgendamentos: number;
    visitas: Array<{
      id: string;
      prescritorNome: string;
      crm: string;
      uf: string;
      tipoVisitaNome: string;
      status: StatusVisita;
      dataHoraInicio: string;
      dataHoraFim: string | null;
    }>;
    agendamentos: AgendaAgendamentoItem[];
  }>;
}

export interface AgendaAlertas {
  pendenciasAbertas: number;
  pendenciasAConcluir: number;
  agendamentosProximos: number;
  total: number;
}

export interface ChecarDataAgendamento {
  data: string;
  diaSemana: number;
  fimDeSemana: boolean;
  feriado: boolean;
  descricaoFeriado: string | null;
  sabadoDiaUtil: boolean;
  requerAviso: boolean;
  mensagemAviso: string | null;
}

@Injectable({ providedIn: 'root' })
export class VisitasService {
  private readonly api = `${this.baseUrl()}/visitas`;
  private readonly apiCores = `${this.baseUrl()}/visita-cores-dias`;
  private readonly apiSolicitacoes = `${this.baseUrl()}/solicitacoes`;

  constructor(private readonly http: HttpClient) {}

  carteira(consulta?: CarteiraConsulta | string | null): Observable<CarteiraVisitas> {
    const opcoes: CarteiraConsulta =
      typeof consulta === 'string' || consulta == null
        ? { filtroPainel: consulta as CarteiraConsulta['filtroPainel'] }
        : consulta;
    const params: Record<string, string> = {};
    if (opcoes.filtroPainel && opcoes.filtroPainel !== 'todos') {
      params['filtroPainel'] = opcoes.filtroPainel;
    }
    if (opcoes.page != null && opcoes.page > 0) {
      params['page'] = String(opcoes.page);
    }
    if (opcoes.limit != null && opcoes.limit > 0) {
      params['limit'] = String(opcoes.limit);
    }
    if (opcoes.busca && opcoes.busca.trim()) {
      params['busca'] = opcoes.busca.trim();
    }
    return this.http.get<CarteiraVisitas>(`${this.api}/carteira`, {
      params,
    });
  }

  minhas(
    filtro?: PeriodoHistoricoFiltro | null,
    dias?: FiltroDiasHistorico | null,
  ): Observable<HistoricoVisita[]> {
    const params: Record<string, string> = {};
    if (filtro?.periodo) {
      params['periodo'] = filtro.periodo;
      if (filtro.ano != null) params['ano'] = String(filtro.ano);
      if (filtro.mes != null) params['mes'] = String(filtro.mes);
      if (filtro.dataInicio) params['dataInicio'] = filtro.dataInicio;
      if (filtro.dataFim) params['dataFim'] = filtro.dataFim;
    }
    if (dias) {
      params['diasComparacao'] = dias.comparacao;
      params['dias'] = String(dias.dias);
    }
    return this.http.get<HistoricoVisita[]>(`${this.api}/minhas`, { params });
  }

  coresDias(): Observable<VisitaCorDiaAtiva[]> {
    return this.http.get<VisitaCorDiaAtiva[]>(`${this.apiCores}/ativas`);
  }

  agendaMes(ano: number, mes: number): Observable<AgendaVisitasMes> {
    return this.http.get<AgendaVisitasMes>(`${this.api}/agenda`, {
      params: { ano: String(ano), mes: String(mes) },
    });
  }

  agendaAlertas(): Observable<AgendaAlertas> {
    return this.http.get<AgendaAlertas>(`${this.api}/agenda/alertas`);
  }

  listarAgendamentos(filtro?: {
    prescritorId?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Observable<AgendaAgendamentoItem[]> {
    const params: Record<string, string> = {};
    if (filtro?.prescritorId) params['prescritorId'] = filtro.prescritorId;
    if (filtro?.dataInicio) params['dataInicio'] = filtro.dataInicio;
    if (filtro?.dataFim) params['dataFim'] = filtro.dataFim;
    return this.http.get<AgendaAgendamentoItem[]>(`${this.api}/agendamentos`, {
      params,
    });
  }

  /** @deprecated Preferir listarAgendamentos */
  listarAgendamentosMedico(filtro: {
    prescritorId: string;
    dataInicio?: string;
    dataFim?: string;
  }): Observable<AgendaAgendamentoItem[]> {
    return this.listarAgendamentos(filtro);
  }

  checarDataAgendamento(data: string): Observable<ChecarDataAgendamento> {
    return this.http.get<ChecarDataAgendamento>(
      `${this.api}/agendamentos/checar-data`,
      { params: { data } },
    );
  }

  criarAgendamento(body: {
    prescritorId: string;
    data: string;
    hora: string;
    observacao?: string | null;
  }): Observable<AgendaAgendamentoItem> {
    return this.http.post<AgendaAgendamentoItem>(
      `${this.api}/agendamentos`,
      body,
    );
  }

  atualizarAgendamento(
    id: string,
    body: {
      prescritorId?: string;
      data?: string;
      hora?: string | null;
      observacao?: string | null;
    },
  ): Observable<AgendaAgendamentoItem> {
    return this.http.patch<AgendaAgendamentoItem>(
      `${this.api}/agendamentos/${id}`,
      body,
    );
  }

  excluirAgendamento(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/agendamentos/${id}`);
  }

  obter(id: string): Observable<VisitaResumo> {
    return this.http.get<VisitaResumo>(`${this.api}/${id}`);
  }

  painelPrescritor(
    id: string,
    competencia?: string | null,
  ): Observable<PainelPrescritorVisita> {
    const params: Record<string, string> = {};
    if (competencia && /^\d{4}-\d{2}$/.test(competencia)) {
      params['competencia'] = competencia;
    }
    return this.http.get<PainelPrescritorVisita>(`${this.api}/${id}/painel`, {
      params,
    });
  }

  googleMapsKey(): Observable<{ key: string }> {
    return this.http.get<{ key: string }>(`${this.baseUrl()}/config/google-maps-key`);
  }

  iniciar(body: {
    prescritorId: string;
    tipoVisitaId: string;
    latitude: number;
    longitude: number;
  }): Observable<VisitaResumo> {
    return this.http.post<VisitaResumo>(this.api, body);
  }

  encerrar(
    id: string,
    body: {
      descricao: string;
      pendencia?: string | null;
      tipoPendenciaId?: string | null;
      material?: string | null;
    },
  ): Observable<VisitaResumo> {
    return this.http.post<VisitaResumo>(`${this.api}/${id}/encerrar`, body);
  }

  atualizar(
    id: string,
    body: {
      prescritorId?: string;
      tipoVisitaId?: string;
      descricao?: string | null;
      pendencia?: string | null;
      tipoPendenciaId?: string | null;
      material?: string | null;
    },
  ): Observable<VisitaResumo> {
    return this.http.patch<VisitaResumo>(`${this.api}/${id}`, body);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  criarSolicitacao(body: {
    texto: string;
    tipoPendenciaId: string;
    prescritorId?: string | null;
  }): Observable<SolicitacaoResumo> {
    return this.http.post<SolicitacaoResumo>(this.apiSolicitacoes, body);
  }

  listarTiposPendencia(): Observable<TipoPendenciaOpcao[]> {
    return this.http.get<TipoPendenciaOpcao[]>(
      `${environment.apiUrl}/tipos-pendencia/ativos`,
    );
  }

  minhasSolicitacoes(
    filtro?: FiltroPendenciasApp | null,
  ): Observable<SolicitacoesListaPaginada> {
    const params: Record<string, string | number> = {
      page: filtro?.page ?? 1,
      limit: filtro?.limit ?? 20,
    };
    if (filtro?.status) params['status'] = filtro.status;
    if (filtro?.tipoPendenciaId) params['tipoPendenciaId'] = filtro.tipoPendenciaId;
    if (filtro?.prescritorId) params['prescritorId'] = filtro.prescritorId;
    if (filtro?.periodo?.periodo) {
      params['periodo'] = filtro.periodo.periodo;
      if (filtro.periodo.ano != null) params['ano'] = filtro.periodo.ano;
      if (filtro.periodo.mes != null) params['mes'] = filtro.periodo.mes;
      if (filtro.periodo.dataInicio) params['dataInicio'] = filtro.periodo.dataInicio;
      if (filtro.periodo.dataFim) params['dataFim'] = filtro.periodo.dataFim;
    }
    return this.http.get<SolicitacoesListaPaginada>(this.apiSolicitacoes, { params });
  }

  resolverSolicitacao(id: string, descricao: string): Observable<SolicitacaoResumo> {
    return this.http.patch<SolicitacaoResumo>(`${this.apiSolicitacoes}/${id}/resolver`, {
      descricao,
    });
  }

  concluirSolicitacao(id: string, descricao: string): Observable<SolicitacaoResumo> {
    return this.http.patch<SolicitacaoResumo>(`${this.apiSolicitacoes}/${id}/concluir`, {
      descricao,
    });
  }

  historicoSolicitacao(id: string): Observable<SolicitacaoHistoricoItem[]> {
    return this.http.get<SolicitacaoHistoricoItem[]>(`${this.apiSolicitacoes}/${id}/historico`);
  }

  buscarMedicosPendencia(
    busca: string,
    filtroPainel?: string,
  ): Observable<MedicoPendenciaOpcao[]> {
    const params: Record<string, string> = { busca };
    if (filtroPainel && filtroPainel !== 'todos') {
      params['filtroPainel'] = filtroPainel;
    }
    return this.http.get<MedicoPendenciaOpcao[]>(`${this.apiSolicitacoes}/medicos`, {
      params,
    });
  }

  listarMidias(visitaId: string): Observable<VisitaMidia[]> {
    return this.http.get<VisitaMidia[]>(`${this.api}/${visitaId}/midias`);
  }

  enviarMidia(
    visitaId: string,
    arquivo: Blob,
    nome: string,
    tipo: TipoMidiaVisita,
    duracaoMs?: number,
  ): Observable<VisitaMidia> {
    const dados = new FormData();
    dados.append('file', arquivo, nome);
    dados.append('tipo', tipo);
    if (duracaoMs != null) {
      dados.append('duracaoMs', String(Math.round(duracaoMs)));
    }
    return this.http.post<VisitaMidia>(`${this.api}/${visitaId}/midias`, dados);
  }

  baixarMidia(visitaId: string, midiaId: string): Observable<Blob> {
    return this.http.get(`${this.api}/${visitaId}/midias/${midiaId}/arquivo`, {
      responseType: 'blob',
    });
  }

  excluirMidia(visitaId: string, midiaId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${visitaId}/midias/${midiaId}`);
  }

  private baseUrl(): string {
    const nativo = Capacitor.getPlatform() !== 'web';
    return nativo
      ? environment.apiUrlNative || environment.apiUrl
      : environment.apiUrl;
  }
}
