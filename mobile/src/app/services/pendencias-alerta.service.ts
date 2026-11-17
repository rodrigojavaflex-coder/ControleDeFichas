import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AppAlertasResumo {
  pendenciasAbertas: number;
  pendenciasAConcluir: number;
  agendamentosProximos: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PendenciasAlertaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly totalSubject = new BehaviorSubject<number>(0);
  private readonly resumoSubject = new BehaviorSubject<AppAlertasResumo>({
    pendenciasAbertas: 0,
    pendenciasAConcluir: 0,
    agendamentosProximos: 0,
    total: 0,
  });

  readonly total$ = this.totalSubject.asObservable();
  readonly resumo$ = this.resumoSubject.asObservable();

  get total(): number {
    return this.totalSubject.value;
  }

  get resumo(): AppAlertasResumo {
    return this.resumoSubject.value;
  }

  constructor() {
    this.auth.isAuthenticated$.subscribe((ok) => {
      if (!ok) {
        this.aplicar(this.vazio());
        return;
      }
      if (this.podeConsultar()) {
        void this.atualizar();
      } else {
        this.aplicar(this.vazio());
      }
    });
  }

  podeConsultar(): boolean {
    return this.auth.hasAnyPermission([
      'pendencias:read',
      'pendencias:create',
      'visitas-agenda:read',
    ]);
  }

  async atualizar(): Promise<number> {
    if (!this.auth.isAuthenticated() || !this.podeConsultar()) {
      this.aplicar(this.vazio());
      return 0;
    }
    try {
      const resp = await firstValueFrom(this.contar());
      this.aplicar({
        pendenciasAbertas: Number(resp.pendenciasAbertas ?? 0),
        pendenciasAConcluir: Number(resp.pendenciasAConcluir ?? 0),
        agendamentosProximos: Number(resp.agendamentosProximos ?? 0),
        total: Number(resp.total ?? 0),
      });
      return this.totalSubject.value;
    } catch {
      return this.totalSubject.value;
    }
  }

  private aplicar(resumo: AppAlertasResumo): void {
    this.resumoSubject.next(resumo);
    this.totalSubject.next(resumo.total);
  }

  private vazio(): AppAlertasResumo {
    return {
      pendenciasAbertas: 0,
      pendenciasAConcluir: 0,
      agendamentosProximos: 0,
      total: 0,
    };
  }

  private contar(): Observable<AppAlertasResumo> {
    return this.http.get<AppAlertasResumo>(`${this.apiVisitas()}/agenda/alertas`);
  }

  private apiVisitas(): string {
    const nativo = Capacitor.getPlatform() !== 'web';
    const base = nativo
      ? environment.apiUrlNative || environment.apiUrl
      : environment.apiUrl;
    return `${base}/visitas`;
  }
}
