import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TiposPendenciaService } from '../../services/tipos-pendencia.service';
import { TipoPendencia } from '../../models/tipo-pendencia.model';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-tipos-pendencia-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoricoAuditoriaComponent],
  templateUrl: './tipos-pendencia-page.html',
})
export class TiposPendenciaPage implements OnInit {
  private readonly tipos = inject(TiposPendenciaService);
  private readonly pageCtx = inject(PageContextService);
  private readonly errors = inject(ErrorModalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly unidades = Object.values(Unidade);
  lista: TipoPendencia[] = [];
  carregando = false;
  unidade = '';
  unidadeDisabled = false;
  excluirAlvo: TipoPendencia | null = null;
  excluindo = false;
  auditoriaAlvo: TipoPendencia | null = null;
  readonly rotulosAuditoria: Record<string, string> = {
    nome: 'Nome',
    descricao: 'Descrição',
    unidade: 'Unidade',
    responsavelId: 'Responsável',
    ativo: 'Ativo',
  };

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Tipos de Pendência',
      description: 'Classificação e responsável de referência, por unidade.',
    });
    this.initializeUnidadeFilter();
    this.carregar();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean; a: boolean } {
    return {
      r: this.auth.hasPermission(Permission.TIPOS_PENDENCIA_READ),
      c: this.auth.hasPermission(Permission.TIPOS_PENDENCIA_CREATE),
      u: this.auth.hasPermission(Permission.TIPOS_PENDENCIA_UPDATE),
      d: this.auth.hasPermission(Permission.TIPOS_PENDENCIA_DELETE),
      a: this.auth.hasPermission(Permission.TIPOS_PENDENCIA_AUDIT),
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
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência');
      },
    });
  }

  novo(): void {
    const queryParams = this.unidade ? { unidade: this.unidade } : undefined;
    void this.router.navigate(['/visita-medica/tipos-pendencia/new'], { queryParams });
  }

  editar(item: TipoPendencia): void {
    void this.router.navigate(['/visita-medica/tipos-pendencia/edit', item.id]);
  }

  alternarAtivo(item: TipoPendencia): void {
    if (!this.pode().u) return;
    this.tipos.atualizar(item.id, { ativo: !item.ativo }).subscribe({
      next: () => this.carregar(),
      error: (err) =>
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência'),
    });
  }

  abrirAuditoria(item: TipoPendencia): void {
    if (!this.pode().a) return;
    this.auditoriaAlvo = item;
  }

  fecharAuditoria(): void {
    this.auditoriaAlvo = null;
  }

  pedirExclusao(item: TipoPendencia): void {
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
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência');
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
