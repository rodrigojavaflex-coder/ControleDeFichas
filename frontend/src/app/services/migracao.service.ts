import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MigracaoResult {
  totalVendas: number;
  clientesCriados: number;
  vendedoresCriados: number;
  prescritoresCriados: number;
  vendasAtualizadas: number;
  erros: Array<{ vendaId: string; protocolo: string; motivo: string }>;
}

export interface MigracaoProgress {
  totalVendas: number;
  vendasProcessadas: number;
  clientesCriados: number;
  vendedoresCriados: number;
  prescritoresCriados: number;
  vendasAtualizadas: number;
  erros: number;
  status: 'running' | 'completed' | 'error';
  message?: string;
}

export interface MigracaoCadastrosProgress {
  totalClientes: number;
  clientesProcessados: number;
  clientesCriados: number;
  totalPrescritores: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  erros: number;
  status: 'running' | 'completed' | 'error';
  message?: string;
  etapa: 'clientes' | 'prescritores' | 'concluido';
}

@Injectable({ providedIn: 'root' })
export class MigracaoService {
  private readonly apiUrl = `${environment.apiUrl}/migracao`;

  constructor(private http: HttpClient) {}

  executarMigration(): Observable<{ message: string; success: boolean }> {
    return this.http.post<{ message: string; success: boolean }>(`${this.apiUrl}/executar-migration`, {});
  }

  importarDados(): Observable<MigracaoResult> {
    return this.http.post<MigracaoResult>(`${this.apiUrl}/vendas-relacoes`, {});
  }

  getProgresso(): Observable<MigracaoProgress | null> {
    return this.http.get<MigracaoProgress | null>(`${this.apiUrl}/progresso`);
  }

  importarTodosCadastros(): Observable<{
    clientesCriados: number;
    prescritoresCriados: number;
    erros: number;
  }> {
    return this.http.post<{
      clientesCriados: number;
      prescritoresCriados: number;
      erros: number;
    }>(`${this.apiUrl}/cadastros-completos`, {});
  }

  getCadastrosProgresso(): Observable<MigracaoCadastrosProgress | null> {
    return this.http.get<MigracaoCadastrosProgress | null>(`${this.apiUrl}/cadastros-progresso`);
  }

  removerCamposTexto(): Observable<{ message: string; success: boolean }> {
    return this.http.post<{ message: string; success: boolean }>(`${this.apiUrl}/remover-campos-texto`, {});
  }
}

