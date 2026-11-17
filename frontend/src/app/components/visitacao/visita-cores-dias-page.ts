import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VisitaCoresDiasService } from '../../services/visita-cores-dias.service';
import { VisitaCorDia } from '../../models/visita-cor-dia.model';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-visita-cores-dias-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoricoAuditoriaComponent],
  templateUrl: './visita-cores-dias-page.html',
  styleUrls: ['./visita-cores-dias-page.css'],
})
export class VisitaCoresDiasPage implements OnInit {
  private readonly cores = inject(VisitaCoresDiasService);
  private readonly pageCtx = inject(PageContextService);
  private readonly errors = inject(ErrorModalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly unidades = Object.values(Unidade);
  lista: VisitaCorDia[] = [];
  carregando = false;
  unidade = '';
  unidadeDisabled = false;
  excluirAlvo: VisitaCorDia | null = null;
  excluindo = false;
  auditoriaAlvo: VisitaCorDia | null = null;
  readonly rotulosAuditoria: Record<string, string> = {
    diasAcimaDe: 'Mais de (dias)',
    cor: 'Cor',
    unidade: 'Unidade',
    ativo: 'Ativo',
  };

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Cores dos dias',
      description:
        'Define a cor do rótulo de dias da visita no aplicativo, por unidade. Vale a faixa de maior número quando mais de uma se aplica.',
    });
    this.initializeUnidadeFilter();
    this.carregar();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean; a: boolean } {
    return {
      r: this.auth.hasPermission(Permission.VISITA_COR_DIAS_READ),
      c: this.auth.hasPermission(Permission.VISITA_COR_DIAS_CREATE),
      u: this.auth.hasPermission(Permission.VISITA_COR_DIAS_UPDATE),
      d: this.auth.hasPermission(Permission.VISITA_COR_DIAS_DELETE),
      a: this.auth.hasPermission(Permission.VISITA_COR_DIAS_AUDIT),
    };
  }

  temAcoes(): boolean {
    const p = this.pode();
    return p.u || p.d || p.a;
  }

  carregar(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.cores.listar(this.unidade).subscribe({
      next: (lista) => {
        this.lista = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.errors.show(extrairMensagemErroApi(err), 'Cores dos dias');
      },
    });
  }

  novo(): void {
    const queryParams = this.unidade ? { unidade: this.unidade } : undefined;
    void this.router.navigate(['/visita-medica/cores-dias/new'], { queryParams });
  }

  editar(item: VisitaCorDia): void {
    void this.router.navigate(['/visita-medica/cores-dias/edit', item.id]);
  }

  alternarAtivo(item: VisitaCorDia): void {
    if (!this.pode().u) return;
    this.cores.atualizar(item.id, { ativo: !item.ativo }).subscribe({
      next: () => this.carregar(),
      error: (err) =>
        this.errors.show(extrairMensagemErroApi(err), 'Cores dos dias'),
    });
  }

  abrirAuditoria(item: VisitaCorDia): void {
    if (!this.pode().a) return;
    this.auditoriaAlvo = item;
  }

  fecharAuditoria(): void {
    this.auditoriaAlvo = null;
  }

  pedirExclusao(item: VisitaCorDia): void {
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
    this.cores.excluir(this.excluirAlvo.id).subscribe({
      next: () => {
        this.excluindo = false;
        this.excluirAlvo = null;
        this.carregar();
      },
      error: (err) => {
        this.excluindo = false;
        this.errors.show(extrairMensagemErroApi(err), 'Cores dos dias');
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
