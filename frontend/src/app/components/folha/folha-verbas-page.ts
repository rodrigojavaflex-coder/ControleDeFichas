import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FolhaService } from '../../services/folha.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { FolhaMovimentoTipo, FolhaVerba } from '../../models/folha.model';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-folha-verbas-page',
  standalone: true,
  imports: [CommonModule, HistoricoAuditoriaComponent],
  templateUrl: './folha-verbas-page.html',
  styleUrls: ['./folha-pages.shared.css'],
})
export class FolhaVerbasPage implements OnInit {
  private folha = inject(FolhaService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  Permission = Permission;
  TiposMov = FolhaMovimentoTipo;

  lista: FolhaVerba[] = [];
  carregando = false;

  showAuditModal = false;
  selectedForAudit: FolhaVerba | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Eventos',
      description: 'Cadastro de eventos de receita e despesa. Novo registro abre formulário próprio.',
    });
    this.reload();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean; a: boolean } {
    return {
      r: this.auth.hasPermission(Permission.FOLHA_VERBA_READ),
      c: this.auth.hasPermission(Permission.FOLHA_VERBA_CREATE),
      u: this.auth.hasPermission(Permission.FOLHA_VERBA_UPDATE),
      d: this.auth.hasPermission(Permission.FOLHA_VERBA_DELETE),
      a: this.auth.hasPermission(Permission.FOLHA_VERBA_AUDIT),
    };
  }

  irNova(): void {
    void this.router.navigate(['/folha/verbas/new']);
  }

  irEditar(v: FolhaVerba): void {
    void this.router.navigate(['/folha/verbas/edit', v.id]);
  }

  reload(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.folha.listarVerbas().subscribe({
      next: (data) => {
        this.lista = data;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.errors.show('Erro ao carregar eventos.', 'Folha');
      },
    });
  }

  alternarAtivo(v: FolhaVerba): void {
    if (!this.pode().u) return;
    this.folha.patchVerba(v.id, { ativo: !v.ativo }).subscribe({
      next: () => this.reload(),
      error: (e) => this.errors.show(e?.error?.message ?? 'Erro ao atualizar.', 'Evento'),
    });
  }

  excluir(v: FolhaVerba): void {
    if (!this.pode().d) return;
    if (!confirm(`Excluir evento "${v.descricao}"?`)) return;
    this.folha.deleteVerba(v.id).subscribe({
      next: () => this.reload(),
      error: (e) => this.errors.show(e?.error?.message ?? 'Não foi possível excluir.', 'Evento'),
    });
  }

  formatData(iso: string): string {
    return iso?.includes('T') ? iso.split('T')[0] : (iso ?? '—').slice(0, 10);
  }

  abrirAuditoria(row: FolhaVerba): void {
    if (!this.pode().a) return;
    this.selectedForAudit = row;
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
    this.selectedForAudit = null;
  }

  auditFieldLabels(): Record<string, string> {
    return {
      descricao: 'Descrição',
      tipoMovimento: 'Tipo de movimento',
      ativo: 'Ativo',
    };
  }
}
