import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FolhaService } from '../../services/folha.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { FolhaTipo } from '../../models/folha.model';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-folha-tipos-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folha-tipos-page.html',
})
export class FolhaTiposPage implements OnInit {
  private folha = inject(FolhaService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  Permission = Permission;
  lista: FolhaTipo[] = [];
  carregando = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Tipo de Folha',
      description: 'Tipos parametrizados. Novo cadastro abre formulário próprio.',
    });
    this.reload();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean } {
    return {
      r: this.auth.hasPermission(Permission.FOLHA_TIPO_READ),
      c: this.auth.hasPermission(Permission.FOLHA_TIPO_CREATE),
      u: this.auth.hasPermission(Permission.FOLHA_TIPO_UPDATE),
      d: this.auth.hasPermission(Permission.FOLHA_TIPO_DELETE),
    };
  }

  irNovo(): void {
    void this.router.navigate(['/folha/tipos/new']);
  }

  irEditar(t: FolhaTipo): void {
    void this.router.navigate(['/folha/tipos/edit', t.id]);
  }

  reload(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.folha.listarTipos().subscribe({
      next: (d) => {
        this.lista = d;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.errors.show('Erro ao carregar tipos de folha.', 'Folha');
      },
    });
  }

  alternarAtivo(t: FolhaTipo): void {
    if (!this.pode().u) return;
    this.folha.patchTipo(t.id, { ativo: !t.ativo }).subscribe({
      next: () => this.reload(),
      error: (e) => this.errors.show(e?.error?.message ?? 'Erro.', 'Tipo de Folha'),
    });
  }

  excluir(t: FolhaTipo): void {
    if (!this.pode().d) return;
    if (!confirm(`Excluir tipo de folha "${t.descricao}"?`)) return;
    this.folha.deleteTipo(t.id).subscribe({
      next: () => this.reload(),
      error: (e) => this.errors.show(e?.error?.message ?? 'Erro.', 'Tipo de Folha'),
    });
  }

  formatData(iso: string): string {
    return iso?.includes('T') ? iso.split('T')[0] : (iso ?? '—').slice(0, 10);
  }
}
