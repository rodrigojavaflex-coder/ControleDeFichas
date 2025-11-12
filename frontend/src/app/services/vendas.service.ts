import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Venda,
  CreateVendaDto,
  UpdateVendaDto,
  FindVendasDto,
  VendaPaginatedResponse,
  FecharVendasEmMassaResponse
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
    let params = new HttpParams();

    if (findVendasDto) {
      if (findVendasDto.page) {
        params = params.set('page', findVendasDto.page.toString());
      }
      if (findVendasDto.limit) {
        params = params.set('limit', findVendasDto.limit.toString());
      }
      if (findVendasDto.protocolo) {
        params = params.set('protocolo', findVendasDto.protocolo);
      }
      if (findVendasDto.cliente) {
        params = params.set('cliente', findVendasDto.cliente);
      }
      if (findVendasDto.vendedor) {
        params = params.set('vendedor', findVendasDto.vendedor);
      }
      if (findVendasDto.origem) {
        params = params.set('origem', findVendasDto.origem);
      }
      if (findVendasDto.status) {
        params = params.set('status', findVendasDto.status);
      }
      if (findVendasDto.dataInicial) {
        params = params.set('dataInicial', findVendasDto.dataInicial);
      }
      if (findVendasDto.dataFinal) {
        params = params.set('dataFinal', findVendasDto.dataFinal);
      }
      if (findVendasDto.unidade) {
        params = params.set('unidade', findVendasDto.unidade);
      }
      if (findVendasDto.ativo) {
        params = params.set('ativo', findVendasDto.ativo);
      }
    }

    return this.http.get<VendaPaginatedResponse>(this.apiUrl, { params });
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
   * Cancelar fechamento de vendas em massa
   */
  cancelarFechamentosEmMassa(vendaIds: string[]): Observable<FecharVendasEmMassaResponse> {
    return this.http.post<FecharVendasEmMassaResponse>(`${this.apiUrl}/cancelamento-massa`, {
      vendaIds
    });
  }
}
