import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Cliente,
  CreateClienteDto,
  UpdateClienteDto,
  FindClientesDto,
  ClientePaginatedResponse
} from '../models/cliente.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clientes`;

  create(createClienteDto: CreateClienteDto): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, createClienteDto);
  }

  findAll(findClientesDto?: FindClientesDto): Observable<ClientePaginatedResponse> {
    let params = new HttpParams();
    
    if (findClientesDto) {
      if (findClientesDto.page) {
        params = params.set('page', findClientesDto.page.toString());
      }
      if (findClientesDto.limit) {
        params = params.set('limit', findClientesDto.limit.toString());
      }
      if (findClientesDto.nome) {
        params = params.set('nome', findClientesDto.nome);
      }
      if (findClientesDto.cpf) {
        params = params.set('cpf', findClientesDto.cpf);
      }
      if (findClientesDto.unidade) {
        params = params.set('unidade', findClientesDto.unidade);
      }
    }

    return this.http.get<ClientePaginatedResponse>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.apiUrl}/${id}`);
  }

  update(id: string, updateClienteDto: UpdateClienteDto): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.apiUrl}/${id}`, updateClienteDto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  search(nome: string, limit: number = 20): Observable<Cliente[]> {
    let params = new HttpParams()
      .set('nome', nome)
      .set('limit', limit.toString());
    
    return this.http.get<Cliente[]>(`${this.apiUrl}/search`, { params });
  }
}

