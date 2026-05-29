import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Unidade } from '../models/usuario.model';
import {
  FuncionarioFolha,
  FuncionarioPaginated,
  FolhaCapaDetalheResponse,
  FolhaCapa,
  FolhaCompetenciaGridRow,
  FolhaFechamentoStatus,
  FolhaTipo,
  FolhaVerba,
  FolhaMovimentoTipo,
  FolhaCadastroSimples,
  EnviarReciboWhatsappResponse,
  EnviarRecibosWhatsappMassaResponse,
  WhatsappConversaDetalhe,
  WhatsappConversaLista,
  WhatsappMensagemItem,
  WhatsappAudioGravacaoStatus,
} from '../models/folha.model';

const base = `${environment.apiUrl}/folha`;

@Injectable({ providedIn: 'root' })
export class FolhaService {
  private http = inject(HttpClient);

  listarFuncionarios(
    unidade?: Unidade,
    page = 1,
    limit = 10,
    nome?: string,
  ): Observable<FuncionarioPaginated> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (unidade) params = params.set('unidade', unidade);
    if (nome?.trim()) params = params.set('nome', nome.trim());
    return this.http.get<FuncionarioPaginated>(`${base}/funcionarios`, { params });
  }

  /** Lista completa (impressão), com opção de eventos fixos. */
  listarFuncionariosTodos(
    unidade?: Unidade,
    nome?: string,
    comEventosFixos = false,
  ): Observable<FuncionarioFolha[]> {
    let params = new HttpParams().set('todos', 'true');
    if (unidade) params = params.set('unidade', unidade);
    if (nome?.trim()) params = params.set('nome', nome.trim());
    if (comEventosFixos) params = params.set('comEventosFixos', 'true');
    return this.http.get<FuncionarioFolha[]>(`${base}/funcionarios`, { params });
  }

  criarFuncionario(body: Partial<FuncionarioFolha> & { unidade: Unidade }): Observable<FuncionarioFolha> {
    return this.http.post<FuncionarioFolha>(`${base}/funcionarios`, body);
  }

  getFuncionario(id: string): Observable<FuncionarioFolha> {
    return this.http.get<FuncionarioFolha>(`${base}/funcionarios/${id}`);
  }

  patchFuncionario(
    id: string,
    body: Partial<FuncionarioFolha>,
  ): Observable<FuncionarioFolha> {
    return this.http.patch<FuncionarioFolha>(
      `${base}/funcionarios/${id}`,
      body,
    );
  }

  excluirFuncionario(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/funcionarios/${id}`);
  }

  listarFuncionariosParaLancamento(
    unidade: Unidade,
    ano?: number,
    mes?: number,
    filtroCompetenciaMensal?: boolean,
  ): Observable<FuncionarioFolha[]> {
    let params = new HttpParams().set('unidade', unidade);
    if (ano != null && mes != null) {
      params = params.set('ano', String(ano)).set('mes', String(mes));
    }
    if (filtroCompetenciaMensal === true) {
      params = params.set('filtroCompetenciaMensal', 'true');
    }
    return this.http.get<FuncionarioFolha[]>(
      `${base}/funcionarios/lancamento`,
      { params },
    );
  }

  listarCargos(): Observable<FolhaCadastroSimples[]> {
    return this.http.get<FolhaCadastroSimples[]>(`${base}/cargos`);
  }

  getCargo(id: string): Observable<FolhaCadastroSimples> {
    return this.http.get<FolhaCadastroSimples>(`${base}/cargos/${id}`);
  }

  criarCargo(body: { descricao: string; ativo?: boolean }): Observable<FolhaCadastroSimples> {
    return this.http.post<FolhaCadastroSimples>(`${base}/cargos`, body);
  }

  patchCargo(
    id: string,
    body: Partial<{ descricao: string; ativo: boolean }>,
  ): Observable<FolhaCadastroSimples> {
    return this.http.patch<FolhaCadastroSimples>(`${base}/cargos/${id}`, body);
  }

  deleteCargo(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/cargos/${id}`);
  }

  listarSetores(): Observable<FolhaCadastroSimples[]> {
    return this.http.get<FolhaCadastroSimples[]>(`${base}/setores`);
  }

  getSetor(id: string): Observable<FolhaCadastroSimples> {
    return this.http.get<FolhaCadastroSimples>(`${base}/setores/${id}`);
  }

  criarSetor(body: { descricao: string; ativo?: boolean }): Observable<FolhaCadastroSimples> {
    return this.http.post<FolhaCadastroSimples>(`${base}/setores`, body);
  }

  patchSetor(
    id: string,
    body: Partial<{ descricao: string; ativo: boolean }>,
  ): Observable<FolhaCadastroSimples> {
    return this.http.patch<FolhaCadastroSimples>(`${base}/setores/${id}`, body);
  }

  deleteSetor(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/setores/${id}`);
  }

  listarVerbas(): Observable<FolhaVerba[]> {
    return this.http.get<FolhaVerba[]>(`${base}/verbas`);
  }

  getVerba(id: string): Observable<FolhaVerba> {
    return this.http.get<FolhaVerba>(`${base}/verbas/${id}`);
  }

  criarVerba(body: {
    descricao: string;
    tipoMovimento: FolhaMovimentoTipo;
    ativo?: boolean;
  }): Observable<FolhaVerba> {
    return this.http.post<FolhaVerba>(`${base}/verbas`, body);
  }

  patchVerba(
    id: string,
    body: Partial<{ descricao: string; tipoMovimento: FolhaMovimentoTipo; ativo: boolean }>,
  ): Observable<FolhaVerba> {
    return this.http.patch<FolhaVerba>(`${base}/verbas/${id}`, body);
  }

  deleteVerba(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/verbas/${id}`);
  }

  listarTipos(): Observable<FolhaTipo[]> {
    return this.http.get<FolhaTipo[]>(`${base}/tipos`);
  }

  getTipo(id: string): Observable<FolhaTipo> {
    return this.http.get<FolhaTipo>(`${base}/tipos/${id}`);
  }

  criarTipo(body: {
    descricao: string;
    ativo?: boolean;
    ordenacao?: number;
    folhaMensal?: boolean;
  }): Observable<FolhaTipo> {
    return this.http.post<FolhaTipo>(`${base}/tipos`, body);
  }

  patchTipo(
    id: string,
    body: Partial<{
      descricao: string;
      ativo: boolean;
      ordenacao: number;
      folhaMensal: boolean;
    }>,
  ): Observable<FolhaTipo> {
    return this.http.patch<FolhaTipo>(`${base}/tipos/${id}`, body);
  }

  deleteTipo(id: string): Observable<void> {
    return this.http.delete<void>(`${base}/tipos/${id}`);
  }

  postCapa(body: {
    funcionarioId: string;
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<FolhaCapaDetalheResponse> {
    return this.http.post<FolhaCapaDetalheResponse>(
      `${base}/capas`,
      body,
    );
  }

  postCarregarCompetencia(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<FolhaCapaDetalheResponse[]> {
    return this.http.post<FolhaCapaDetalheResponse[]>(
      `${base}/capas/carregar-competencia`,
      body,
    );
  }

  /** @deprecated Use `postCarregarCompetencia` — alias que chama `carregar-competencia`. */
  postCarregarMensal(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<FolhaCapaDetalheResponse[]> {
    return this.postCarregarCompetencia(body);
  }

  listarCapas(filters: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
    funcionarioId?: string;
  }): Observable<FolhaCapa[]> {
    let params = new HttpParams()
      .set('unidade', filters.unidade)
      .set('ano', String(filters.ano))
      .set('mes', String(filters.mes))
      .set('folhaTipoId', filters.folhaTipoId);
    if (filters.funcionarioId) {
      params = params.set('funcionarioId', filters.funcionarioId);
    }
    return this.http.get<FolhaCapa[]>(`${base}/capas`, { params });
  }

  /** Lista capas da competência com itens e totais (query `comDetalhe=true` na API). */
  listarCapasComDetalhe(filters: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
    funcionarioId?: string;
  }): Observable<FolhaCapaDetalheResponse[]> {
    let params = new HttpParams()
      .set('unidade', filters.unidade)
      .set('ano', String(filters.ano))
      .set('mes', String(filters.mes))
      .set('folhaTipoId', filters.folhaTipoId)
      .set('comDetalhe', 'true');
    if (filters.funcionarioId) {
      params = params.set('funcionarioId', filters.funcionarioId);
    }
    return this.http.get<FolhaCapaDetalheResponse[]>(`${base}/capas`, { params });
  }

  getCapaCompleta(
    id: string,
    unidade: Unidade,
  ): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.get<FolhaCapaDetalheResponse>(
      `${base}/capas/${id}/completa`,
      { params },
    );
  }

  postItem(
    capaId: string,
    unidade: Unidade,
    body: { folhaVerbaId: string; valor: number; quantidade?: number },
  ): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.post<FolhaCapaDetalheResponse>(
      `${base}/capas/${capaId}/itens`,
      body,
      { params },
    );
  }

  patchItem(
    capaId: string,
    itemId: string,
    unidade: Unidade,
    body: { valor?: number; quantidade?: number },
  ): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.patch<FolhaCapaDetalheResponse>(
      `${base}/capas/${capaId}/itens/${itemId}`,
      body,
      { params },
    );
  }

  deleteItem(
    capaId: string,
    itemId: string,
    unidade: Unidade,
  ): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.delete<FolhaCapaDetalheResponse>(
      `${base}/capas/${capaId}/itens/${itemId}`,
      { params },
    );
  }

  postCongelarCapa(capaId: string, unidade: Unidade): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.post<FolhaCapaDetalheResponse>(
      `${base}/capas/${capaId}/congelar`,
      {},
      { params },
    );
  }

  postLiberarCapa(capaId: string, unidade: Unidade): Observable<FolhaCapaDetalheResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.post<FolhaCapaDetalheResponse>(
      `${base}/capas/${capaId}/liberar`,
      {},
      { params },
    );
  }

  statusFechamento(
    unidade: Unidade,
    ano: number,
    mes: number,
    folhaTipoId: string,
  ): Observable<FolhaFechamentoStatus> {
    const params = new HttpParams()
      .set('unidade', unidade)
      .set('ano', String(ano))
      .set('mes', String(mes))
      .set('folhaTipoId', folhaTipoId);
    return this.http.get<FolhaFechamentoStatus>(
      `${base}/fechamento/status`,
      { params },
    );
  }

  listarCompetenciasRegistradas(filters: {
    ano: number;
    mes?: number;
    unidade?: Unidade | null | '';
    folhaTipoId?: string | null | '';
  }): Observable<FolhaCompetenciaGridRow[]> {
    let params = new HttpParams().set('ano', String(filters.ano));
    if (filters.unidade !== undefined && filters.unidade !== '' && filters.unidade != null) {
      params = params.set('unidade', filters.unidade);
    }
    if (filters.mes != null && filters.mes !== undefined) {
      params = params.set('mes', String(filters.mes));
    }
    const tid =
      filters.folhaTipoId != null &&
      filters.folhaTipoId !== undefined &&
      filters.folhaTipoId !== ''
        ? filters.folhaTipoId
        : undefined;
    if (tid) {
      params = params.set('folhaTipoId', tid);
    }
    return this.http.get<FolhaCompetenciaGridRow[]>(
      `${base}/fechamento/competencias-registradas`,
      { params },
    );
  }

  registrarAberturaCompetencia(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<unknown> {
    return this.http.post(`${base}/fechamento/abertura`, body);
  }

  fecharLote(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<unknown> {
    return this.http.post(`${base}/fechamento/fechar`, body);
  }

  reabrirLote(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<unknown> {
    return this.http.post(`${base}/fechamento/reabrir`, body);
  }

  enviarReciboWhatsapp(
    capaId: string,
    unidade: Unidade,
  ): Observable<EnviarReciboWhatsappResponse> {
    const params = new HttpParams().set('unidade', unidade);
    return this.http.post<EnviarReciboWhatsappResponse>(
      `${base}/capas/${capaId}/enviar-recibo-whatsapp`,
      {},
      { params },
    );
  }

  enviarRecibosWhatsappMassa(body: {
    unidade: Unidade;
    ano: number;
    mes: number;
    folhaTipoId: string;
  }): Observable<EnviarRecibosWhatsappMassaResponse> {
    return this.http.post<EnviarRecibosWhatsappMassaResponse>(
      `${base}/fechamento/enviar-recibos-whatsapp`,
      body,
    );
  }

  listarWhatsappConversas(): Observable<WhatsappConversaLista[]> {
    return this.http.get<WhatsappConversaLista[]>(`${base}/whatsapp/conversas`);
  }

  obterWhatsappAudioGravacaoDisponivel(): Observable<WhatsappAudioGravacaoStatus> {
    return this.http.get<WhatsappAudioGravacaoStatus>(
      `${base}/whatsapp/audio-gravacao/disponivel`,
    );
  }

  obterWhatsappConversa(id: string): Observable<WhatsappConversaDetalhe> {
    return this.http.get<WhatsappConversaDetalhe>(`${base}/whatsapp/conversas/${id}`);
  }

  marcarWhatsappConversaLida(id: string): Observable<void> {
    return this.http.patch<void>(`${base}/whatsapp/conversas/${id}/lida`, {});
  }

  responderWhatsappConversa(
    id: string,
    texto: string,
  ): Observable<WhatsappMensagemItem> {
    return this.http.post<WhatsappMensagemItem>(
      `${base}/whatsapp/conversas/${id}/responder`,
      { texto },
    );
  }

  enviarWhatsappAnexo(
    conversaId: string,
    file: File,
    legenda?: string,
  ): Observable<WhatsappMensagemItem> {
    const form = new FormData();
    form.append('file', file);
    if (legenda?.trim()) {
      form.append('legenda', legenda.trim());
    }
    return this.http.post<WhatsappMensagemItem>(
      `${base}/whatsapp/conversas/${conversaId}/anexo`,
      form,
    );
  }

  baixarWhatsappMensagemArquivo(mensagemId: string): Observable<Blob> {
    return this.http.get(`${base}/whatsapp/mensagens/${mensagemId}/arquivo`, {
      responseType: 'blob',
    });
  }
}
