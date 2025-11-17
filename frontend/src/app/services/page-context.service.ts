import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PageContext {
  title: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PageContextService {
  private readonly defaultContext: PageContext = {
    title: 'Sistema de controle e Gestão Farmacêutica'
  };

  private readonly _context$ = new BehaviorSubject<PageContext>(this.defaultContext);

  get context$(): Observable<PageContext> {
    return this._context$.asObservable();
  }

  setContext(context: PageContext): void {
    this._context$.next({
      title: context.title,
      description: context.description
    });
  }

  resetContext(): void {
    this._context$.next({ ...this.defaultContext });
  }
}
