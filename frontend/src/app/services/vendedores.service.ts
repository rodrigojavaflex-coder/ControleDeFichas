import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Vendedor,
  CreateVendedorDto,
  UpdateVendedorDto,
  FindVendedoresDto,
  VendedorPaginatedResponse
} from '../models/vendedor.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VendedoresService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vendedores`;

  create(createVendedorDto: CreateVendedorDto): Observable<Vendedor> {
    return this.http.post<Vendedor>(this.apiUrl, createVendedorDto);
  }

  findAll(findVendedoresDto?: FindVendedoresDto): Observable<VendedorPaginatedResponse> {
    let params = new HttpParams();
    
    if (findVendedoresDto) {
      if (findVendedoresDto.page) {
        params = params.set('page', findVendedoresDto.page.toString());
      }
      if (findVendedoresDto.limit) {
        params = params.set('limit', findVendedoresDto.limit.toString());
      }
      if (findVendedoresDto.nome) {
        params = params.set('nome', findVendedoresDto.nome);
      }
      if (findVendedoresDto.unidade) {
        params = params.set('unidade', findVendedoresDto.unidade);
      }
    }

    return this.http.get<VendedorPaginatedResponse>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Vendedor> {
    return this.http.get<Vendedor>(`${this.apiUrl}/${id}`);
  }

  update(id: string, updateVendedorDto: UpdateVendedorDto): Observable<Vendedor> {
    return this.http.patch<Vendedor>(`${this.apiUrl}/${id}`, updateVendedorDto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  search(nome: string, limit: number = 20): Observable<Vendedor[]> {
    let params = new HttpParams()
      .set('nome', nome)
      .set('limit', limit.toString());
    
    return this.http.get<Vendedor[]>(`${this.apiUrl}/search`, { params });
  }
}

