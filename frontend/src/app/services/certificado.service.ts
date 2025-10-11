import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Certificado {
  id: string;
  loteDoCertificado: string;
  numeroDoCertificado: string;
  fornecedor: string;
  dataCertificado: string;
  quantidade: string;
  dataDeFabricacao: string;
  dataDeValidade: string;
  numeroDoPedido: string;
  pesoMolecular: string;
  formulaMolecular: string;
  dcb: string;
  nomeCientifico: string;
  caracteristicasOrganolepticas: string;
  solubilidade: string;
  faixaPh: string;
  faixaFusao: string;
  peso: string;
  volume: string;
  densidadeSemCompactacao: string;
  avaliacaoDoLaudo: string;
  cinzas: string;
  perdaPorSecagem: string;
  infraVermelho: string;
  ultraVioleta: string;
  teor: string;
  conservacao: string;
  observacao01: string;
  determinacaoMateriaisEstranhos: string;
  pesquisasDeContaminacaoMicrobiologica: string;
  umidade: string;
  caracteresMicroscopicos: string;
  laudoDoCertificado?: string;
  laudoPdf?: any;
  criadoEm: string;
  atualizadoEm: string;
  fichaTecnica?: {
    id: string;
    produto: string;
    codigoFormulaCerta: string;
  };
}

export interface CreateCertificadoDto {
  loteDoCertificado: string;
  numeroDoCertificado: string;
  fornecedor: string;
  dataCertificado: string;
  quantidade: string;
  dataDeFabricacao: string;
  dataDeValidade: string;
  numeroDoPedido: string;
  pesoMolecular: string;
  formulaMolecular: string;
  dcb: string;
  nomeCientifico: string;
  caracteristicasOrganolepticas: string;
  solubilidade: string;
  faixaPh: string;
  faixaFusao: string;
  peso: string;
  volume: string;
  densidadeSemCompactacao: string;
  avaliacaoDoLaudo: string;
  cinzas: string;
  perdaPorSecagem: string;
  infraVermelho: string;
  ultraVioleta: string;
  teor: string;
  conservacao: string;
  observacao01: string;
  determinacaoMateriaisEstranhos: string;
  pesquisasDeContaminacaoMicrobiologica: string;
  umidade: string;
  caracteresMicroscopicos: string;
  fichaTecnicaId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CertificadoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/certificados`;

  // Signals para estado
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() { }

  /**
   * Busca todos os certificados
   */
  findAll(): Observable<Certificado[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<Certificado[]>(this.apiUrl).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao buscar certificados');
        }
      })
    );
  }

  /**
   * Busca certificado por ID
   */
  findOne(id: string): Observable<Certificado> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<Certificado>(`${this.apiUrl}/${id}`).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao buscar certificado');
        }
      })
    );
  }

  /**
   * Cria novo certificado
   */
  create(certificado: CreateCertificadoDto): Observable<Certificado> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<Certificado>(this.apiUrl, certificado).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao criar certificado');
        }
      })
    );
  }

  /**
   * Atualiza certificado
   */
  update(id: string, certificado: Partial<CreateCertificadoDto>): Observable<Certificado> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.patch<Certificado>(`${this.apiUrl}/${id}`, certificado).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao atualizar certificado');
        }
      })
    );
  }

  /**
   * Remove certificado
   */
  delete(id: string): Observable<void> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao excluir certificado');
        }
      })
    );
  }

  /**
   * Busca certificados por ficha técnica
   */
  findByFichaTecnica(fichaTecnicaId: string): Observable<Certificado[]> {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams().set('fichaTecnicaId', fichaTecnicaId);

    return this.http.get<Certificado[]>(`${this.apiUrl}/by-ficha/${fichaTecnicaId}`).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao buscar certificados da ficha');
        }
      })
    );
  }

  /**
   * Upload de laudo em PDF
   */
  uploadLaudoPdf(id: string, file: File): Observable<Certificado> {
    this.loading.set(true);
    this.error.set(null);

    const formData = new FormData();
    formData.append('laudoPdf', file);

    return this.http.post<Certificado>(`${this.apiUrl}/${id}/upload-laudo-pdf`, formData).pipe(
      tap({
        next: () => this.loading.set(false),
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Erro ao fazer upload do laudo');
        }
      })
    );
  }

  /**
   * Download do laudo em PDF
   */
  downloadLaudoPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/laudo-pdf`, {
      responseType: 'blob'
    });
  }
}