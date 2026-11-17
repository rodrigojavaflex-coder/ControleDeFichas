import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TiposVisitaService } from '../../services/tipos-visita.service';
import { TipoVisita } from '../../models/tipo-visita.model';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-tipos-visita-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoricoAuditoriaComponent],
  templateUrl: './tipos-visita-page.html',
})
export class TiposVisitaPage implements OnInit {
  private readonly tipos = inject(TiposVisitaService);
  private readonly pageCtx = inject(PageContextService);
  private readonly errors = inject(ErrorModalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly unidades = Object.values(Unidade);
  lista: TipoVisita[] = [];
  carregando = false;
  unidade = '';
  unidadeDisabled = false;
  excluirAlvo: TipoVisita | null = null;
  excluindo = false;
  auditoriaAlvo: TipoVisita | null = null;
  readonly rotulosAuditoria: Record<string, string> = {
    nome: 'Nome',
    unidade: 'Unidade',
    ativo: 'Ativo',
  };

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Tipos de Visita',
      description: 'Classificação do objetivo de cada visita em campo, por unidade.',
    });
    this.initializeUnidadeFilter();
    this.carregar();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean; a: boolean } {
    return {
      r: this.auth.hasPermission(Permission.TIPOS_VISITA_READ),
      c: this.auth.hasPermission(Permission.TIPOS_VISITA_CREATE),
      u: this.auth.hasPermission(Permission.TIPOS_VISITA_UPDATE),
      d: this.auth.hasPermission(Permission.TIPOS_VISITA_DELETE),
      a: this.auth.hasPermission(Permission.TIPOS_VISITA_AUDIT),
    };
  }

  temAcoes(): boolean {
    const p = this.pode();
    return p.u || p.d || p.a;
  }

  carregar(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.tipos.listar(false, this.unidade).subscribe({
      next: (lista) => {
        this.lista = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de visita');
      },
    });
  }

  novo(): void {
    const queryParams = this.unidade ? { unidade: this.unidade } : undefined;
    void this.router.navigate(['/visita-medica/tipos-visita/new'], { queryParams });
  }

  editar(item: TipoVisita): void {
    void this.router.navigate(['/visita-medica/tipos-visita/edit', item.id]);
  }

  alternarAtivo(item: TipoVisita): void {
    if (!this.pode().u) return;
    this.tipos.atualizar(item.id, { ativo: !item.ativo }).subscribe({
      next: () => this.carregar(),
      error: (err) =>
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de visita'),
    });
  }

  abrirAuditoria(item: TipoVisita): void {
    if (!this.pode().a) return;
    this.auditoriaAlvo = item;
  }

  fecharAuditoria(): void {
    this.auditoriaAlvo = null;
  }

  pedirExclusao(item: TipoVisita): void {
    if (!this.pode().d) return;
    this.excluirAlvo = item;
  }

  cancelarExclusao(): void {
    if (this.excluindo) return;
    this.excluirAlvo = null;
  }

  confirmarExclusao(): void {
    if (!this.excluirAlvo || this.excluindo) return;
    this.excluindo = true;
    this.tipos.excluir(this.excluirAlvo.id).subscribe({
      next: () => {
        this.excluindo = false;
        this.excluirAlvo = null;
        this.carregar();
      },
      error: (err) => {
        this.excluindo = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de visita');
      },
    });
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.unidade?.trim()) {
      this.unidade = currentUser.unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeDisabled = false;
      this.unidade = '';
    }
  }
}
