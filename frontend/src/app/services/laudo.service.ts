import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LaudoService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  uploadLaudo(certificadoId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`/api/certificados/${certificadoId}/laudos`, formData);
  }

  getLaudos(certificadoId: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/certificados/${certificadoId}/laudos`);
  }

  /**
   * Download do arquivo PDF do laudo como Blob
   */
  downloadLaudo(certificadoId: string, laudoId: string): Observable<Blob> {
    const token = this.authService.getAccessToken();
    const headers = token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : undefined;
    return this.http.get(
      `/api/certificados/${certificadoId}/laudos/${laudoId}/download`,
      { headers, responseType: 'blob' }
    );
  }

  /** Remove um laudo */
  remove(certificadoId: string, laudoId: string): Observable<void> {
    const token = this.authService.getAccessToken();
    const headers = token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : undefined;
    return this.http.delete<void>(
      `/api/certificados/${certificadoId}/laudos/${laudoId}`,
      { headers }
    );
  }
}