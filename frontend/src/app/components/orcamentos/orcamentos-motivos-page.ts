import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrcamentosService } from '../../services/orcamentos.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { OrcamentoMotivoRejeicao } from '../../models/orcamento.model';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-orcamentos-motivos-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orcamentos-motivos-page.html',
})
export class OrcamentosMotivosPage implements OnInit {
  private orcamentos = inject(OrcamentosService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);
  private router = inject(Router);

  Permission = Permission;
  lista: OrcamentoMotivoRejeicao[] = [];
  carregando = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Motivos de rejeição',
      description: 'Cadastro global de motivos para orçamentos rejeitados.',
    });
    this.reload();
  }

  pode(): { r: boolean; c: boolean; u: boolean; d: boolean } {
    return {
      r: this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_READ),
      c: this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_CREATE),
      u: this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_UPDATE),
      d: this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_DELETE),
    };
  }

  irNovo(): void {
    void this.router.navigate(['/orcamentos/motivos-rejeicao/new']);
  }

  irEditar(m: OrcamentoMotivoRejeicao): void {
    void this.router.navigate(['/orcamentos/motivos-rejeicao/edit', m.id]);
  }

  reload(): void {
    if (!this.pode().r) return;
    this.carregando = true;
    this.orcamentos.listarMotivos().subscribe({
      next: (d) => {
        this.lista = d;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.errors.show('Erro ao carregar motivos de rejeição.', 'Orçamentos');
      },
    });
  }

  alternarAtivo(m: OrcamentoMotivoRejeicao): void {
    if (!this.pode().u) return;
    this.orcamentos.patchMotivo(m.id, { ativo: !m.ativo }).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.errors.show(e?.error?.message ?? 'Erro.', 'Motivos de rejeição'),
    });
  }

  excluir(m: OrcamentoMotivoRejeicao): void {
    if (!this.pode().d) return;
    if (!confirm(`Excluir motivo "${m.descricao}"?`)) return;
    this.orcamentos.deleteMotivo(m.id).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.errors.show(e?.error?.message ?? 'Erro.', 'Motivos de rejeição'),
    });
  }

  formatData(iso: string): string {
    return iso?.includes('T') ? iso.split('T')[0] : (iso ?? '—').slice(0, 10);
  }
}
