import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Prescritor,
  CreatePrescritorDto,
  UpdatePrescritorDto,
  FindPrescritoresDto,
  PrescritorPaginatedResponse
} from '../models/prescritor.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PrescritoresService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/prescritores`;

  create(createPrescritorDto: CreatePrescritorDto): Observable<Prescritor> {
    return this.http.post<Prescritor>(this.apiUrl, createPrescritorDto);
  }

  findAll(findPrescritoresDto?: FindPrescritoresDto): Observable<PrescritorPaginatedResponse> {
    let params = new HttpParams();
    
    if (findPrescritoresDto) {
      if (findPrescritoresDto.page) {
        params = params.set('page', findPrescritoresDto.page.toString());
      }
      if (findPrescritoresDto.limit) {
        params = params.set('limit', findPrescritoresDto.limit.toString());
      }
      if (findPrescritoresDto.nome) {
        params = params.set('nome', findPrescritoresDto.nome);
      }
      if (findPrescritoresDto.numeroCRM) {
        params = params.set('numeroCRM', findPrescritoresDto.numeroCRM.toString());
      }
    }

    return this.http.get<PrescritorPaginatedResponse>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Prescritor> {
    return this.http.get<Prescritor>(`${this.apiUrl}/${id}`);
  }

  update(id: string, updatePrescritorDto: UpdatePrescritorDto): Observable<Prescritor> {
    return this.http.patch<Prescritor>(`${this.apiUrl}/${id}`, updatePrescritorDto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  search(nome: string, limit: number = 20): Observable<Prescritor[]> {
    let params = new HttpParams()
      .set('nome', nome)
      .set('limit', limit.toString());
    
    return this.http.get<Prescritor[]>(`${this.apiUrl}/search`, { params });
  }
}

