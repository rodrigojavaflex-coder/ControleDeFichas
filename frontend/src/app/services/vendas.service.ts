import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Venda,
  CreateVendaDto,
  UpdateVendaDto,
  FindVendasDto,
  VendaPaginatedResponse,
  FecharVendasEmMassaResponse,
  ImportacaoRpsPreviewResult
} from '../models/venda.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VendaService {
  private readonly apiUrl = `${environment.apiUrl}/vendas`;

  constructor(private http: HttpClient) {}

  /**
   * Criar nova venda
   */
  createVenda(createVendaDto: CreateVendaDto): Observable<Venda> {
    return this.http.post<Venda>(this.apiUrl, createVendaDto);
  }

  /**
   * Listar vendas com paginação e filtros
   */
  getVendas(findVendasDto?: FindVendasDto): Observable<VendaPaginatedResponse> {
    const params = this.buildQueryParams(findVendasDto);
    return this.http.get<VendaPaginatedResponse>(this.apiUrl, { params });
  }

  /**
   * Listar vendas no modo acompanhamento
   */
  getAcompanhamentoVendas(findVendasDto?: FindVendasDto): Observable<VendaPaginatedResponse> {
    const params = this.buildQueryParams(findVendasDto);
    return this.http.get<VendaPaginatedResponse>(`${this.apiUrl}/acompanhar`, { params });
  }

  /**
   * Buscar venda por ID
   */
  getVendaById(id: string): Observable<Venda> {
    return this.http.get<Venda>(`${this.apiUrl}/${id}`);
  }

  /**
   * Atualizar venda
   */
  updateVenda(id: string, updateVendaDto: UpdateVendaDto): Observable<Venda> {
    return this.http.patch<Venda>(`${this.apiUrl}/${id}`, updateVendaDto);
  }

  /**
   * Remover venda
   */
  deleteVenda(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Buscar dados da venda formatados para impressão
   */
  getVendaPrintData(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/print`);
  }

  /**
   * Fechar vendas em massa
   */
  fecharVendasEmMassa(vendaIds: string[], dataFechamento?: string): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(`${this.apiUrl}/fechamento-massa`, {
      vendaIds,
      dataFechamento
    });
  }

  /**
   * Registrar data de envio em massa
   */
  registrarEnvio(vendaIds: string[], dataEnvio: string): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(`${this.apiUrl}/registrar-envio`, {
      vendaIds,
      dataEnvio
    });
  }

  /**
   * Cancelar fechamento de vendas em massa
   */
  cancelarFechamentosEmMassa(vendaIds: string[]): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(`${this.apiUrl}/cancelamento-massa`, {
      vendaIds
    });
  }

  /**
   * Atualizar valor de compra em massa via agente
   */
  atualizarValorCompraEmMassa(vendaIds: string[], atualizarComValorCliente?: boolean): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(`${this.apiUrl}/atualizar-valor-compra-massa`, {
      vendaIds,
      atualizarComValorCliente
    });
  }

  /**
   * Editar V. Compra e/ou V. Fechamento (venda sem fechamento)
   */
  editarValoresFechamento(
    id: string,
    payload: { valorCompra?: number; valorPago?: number }
  ): Observable<Venda> {
    return this.http.patch<Venda>(`${this.apiUrl}/${id}/valores-fechamento`, payload);
  }

  /**
   * Preview da importação de um ou mais PDFs de RPS
   */
  previewImportacaoRps(files: File[]): Observable<ImportacaoRpsPreviewResult> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    return this.http.post<ImportacaoRpsPreviewResult>(
      `${this.apiUrl}/importar-rps/preview`,
      formData
    );
  }

  /**
   * Confirma gravação do valorPago a partir do RPS
   */
  confirmarImportacaoRps(
    itens: Array<{ vendaId: string; valorPago: number; arquivoOrigem?: string }>
  ): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(
      `${this.apiUrl}/importar-rps/confirmar`,
      { itens }
    );
  }

  private buildQueryParams(findVendasDto?: FindVendasDto): HttpParams {
    let params = new HttpParams();

    if (!findVendasDto) {
      return params;
    }

    const entries = Object.entries(findVendasDto) as [keyof FindVendasDto, any][];

    entries.forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (key === 'page' || key === 'limit') {
        params = params.set(key, value.toString());
        return;
      }

      // Tratar arrays (para seleção múltipla)
      if (Array.isArray(value) && value.length > 0) {
        value.forEach((item: any) => {
          params = params.append(key as string, item.toString());
        });
      } else if (!Array.isArray(value)) {
        params = params.set(key as string, value.toString());
      }
    });

    return params;
  }
}
