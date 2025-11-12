import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Baixa, CreateBaixaDto, UpdateBaixaDto, FindBaixasDto, BaixaPaginatedResponse } from '../models/baixa.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BaixasService {
  private readonly apiUrl = `${environment.apiUrl}/baixas`;

  constructor(private http: HttpClient) {}

  /**
   * Listar baixas com paginação e filtros
   */
  getBaixas(findBaixasDto?: FindBaixasDto): Observable<BaixaPaginatedResponse> {
    let params = new HttpParams();

    if (findBaixasDto) {
      if (findBaixasDto.page) {
        params = params.set('page', findBaixasDto.page.toString());
      }
      if (findBaixasDto.limit) {
        params = params.set('limit', findBaixasDto.limit.toString());
      }
      if (findBaixasDto.idvenda) {
        params = params.set('idvenda', findBaixasDto.idvenda);
      }
      if (findBaixasDto.tipoDaBaixa) {
        params = params.set('tipoDaBaixa', findBaixasDto.tipoDaBaixa);
      }
      if (findBaixasDto.dataInicial) {
        params = params.set('dataInicial', findBaixasDto.dataInicial);
      }
      if (findBaixasDto.dataFinal) {
        params = params.set('dataFinal', findBaixasDto.dataFinal);
      }
    }

    return this.http.get<BaixaPaginatedResponse>(this.apiUrl, { params });
  }

  /**
   * Buscar baixa por ID
   */
  getBaixaById(id: string): Observable<Baixa> {
    return this.http.get<Baixa>(`${this.apiUrl}/${id}`);
  }

  /**
   * Criar nova baixa
   */
  createBaixa(createBaixaDto: CreateBaixaDto): Observable<Baixa> {
    return this.http.post<Baixa>(this.apiUrl, createBaixaDto);
  }

  /**
   * Atualizar baixa
   */
  updateBaixa(id: string, updateBaixaDto: UpdateBaixaDto): Observable<Baixa> {
    return this.http.patch<Baixa>(`${this.apiUrl}/${id}`, updateBaixaDto);
  }

  /**
   * Remover baixa
   */
  deleteBaixa(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}