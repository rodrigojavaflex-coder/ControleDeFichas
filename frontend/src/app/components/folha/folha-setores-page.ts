import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FolhaService } from '../../services/folha.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { FolhaCadastroSimples } from '../../models/folha.model';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-folha-setores-page',
  standalone: true,
  imports: [CommonModule, HistoricoAuditoriaComponent],
  templateUrl: './folha-setores-page.html',
})
export class FolhaSetoresPage implements OnInit {
  private folha = inject(FolhaService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  Permission = Permission;

  lista: FolhaCadastroSimples[] = [];
  carregando = false;

  showAuditModal = false;
  selectedForAudit: FolhaCadastroSimples | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Setores da folha',
      description: 'Cadastro de setores utilizados no vínculo com funcionários.',
    });
    this.reload();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean; a: boolean } {
    return {
      r: this.auth.hasPermission(Permission.FOLHA_SETOR_READ),
      c: this.auth.hasPermission(Permission.FOLHA_SETOR_CREATE),
      u: this.auth.hasPermission(Permission.FOLHA_SETOR_UPDATE),
      d: this.auth.hasPermission(Permission.FOLHA_SETOR_DELETE),
      a: this.auth.hasPermission(Permission.FOLHA_SETOR_AUDIT),
    };
  }

  irNovo(): void {
    void this.router.navigate(['/folha/setores/new']);
  }

  irEditar(v: FolhaCadastroSimples): void {
    void this.router.navigate(['/folha/setores/edit', v.id]);
  }

  reload(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.folha.listarSetores().subscribe({
      next: (data) => {
        this.lista = data;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.errors.show('Erro ao carregar setores.', 'Folha');
      },
    });
  }

  alternarAtivo(v: FolhaCadastroSimples): void {
    if (!this.pode().u) return;
    this.folha.patchSetor(v.id, { ativo: !v.ativo }).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.errors.show(e?.error?.message ?? 'Erro ao atualizar.', 'Setor'),
    });
  }

  excluir(v: FolhaCadastroSimples): void {
    if (!this.pode().d) return;
    if (!confirm(`Excluir setor "${v.descricao}"?`)) return;
    this.folha.deleteSetor(v.id).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.errors.show(
          e?.error?.message ?? 'Não foi possível excluir.',
          'Setor',
        ),
    });
  }

  formatData(iso: string): string {
    return iso?.includes('T') ? iso.split('T')[0] : (iso ?? '—').slice(0, 10);
  }

  abrirAuditoria(row: FolhaCadastroSimples): void {
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
      ativo: 'Ativo',
    };
  }
}
