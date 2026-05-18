import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FolhaService } from '../../services/folha.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { FuncionarioFolha, FuncionarioPaginated } from '../../models/folha.model';
import { Permission, Unidade } from '../../models/usuario.model';

@Component({
  selector: 'app-folha-funcionarios-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './folha-funcionarios-page.html',
  styleUrls: ['./folha-pages.shared.css'],
})
export class FolhaFuncionariosPage implements OnInit {
  private folha = inject(FolhaService);
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private errors = inject(ErrorModalService);
  private router = inject(Router);

  Permission = Permission;
  Unidade = Unidade;

  unidadesDisponiveis: Unidade[] = Object.values(Unidade);
  unidadeFiltro: Unidade = Unidade.INHUMAS;
  nomeFiltro = '';
  dados: FuncionarioPaginated | null = null;
  pagina = 1;
  pageSize = 10;
  carregando = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Lista de funcionários',
      description:
        'Funcionários cadastrados na unidade selecionada. O cadastro já inclui a unidade da folha.',
    });
    const u = this.auth.getCurrentUser();
    if (u?.unidade) {
      this.unidadeFiltro = u.unidade;
    }
    this.carregarLista();
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_READ);
  }

  podeCriar(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_CREATE);
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_UPDATE);
  }

  podeExcluir(): boolean {
    return this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_DELETE);
  }

  /** Coluna Ações: edição e/ou exclusão conforme permissões. */
  mostrarColunaAcoes(): boolean {
    return this.podeEditar() || this.podeExcluir();
  }

  irNovo(): void {
    void this.router.navigate(['/folha/funcionarios/new']);
  }

  irEditar(f: FuncionarioFolha): void {
    void this.router.navigate(['/folha/funcionarios/edit', f.id]);
  }

  excluir(f: FuncionarioFolha): void {
    if (!this.podeExcluir()) return;
    if (
      !confirm(
        `Excluir o funcionário "${f.nome}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    this.folha.excluirFuncionario(f.id).subscribe({
      next: () => this.carregarLista(),
      error: (e: { error?: { message?: string } }) =>
        this.errors.show(
          e?.error?.message ?? 'Não foi possível excluir o funcionário.',
          'Folha',
        ),
    });
  }

  limparFiltros(): void {
    this.nomeFiltro = '';
    this.pagina = 1;
    const u = this.auth.getCurrentUser();
    if (u?.unidade) {
      this.unidadeFiltro = u.unidade;
    }
    this.carregarLista();
  }

  carregarLista(): void {
    if (!this.podeLer()) return;
    this.carregando = true;
    this.folha
      .listarFuncionarios(
        this.unidadeFiltro,
        this.pagina,
        this.pageSize,
        this.nomeFiltro || undefined,
      )
      .subscribe({
        next: (r) => {
          this.dados = r;
          this.carregando = false;
        },
        error: () => {
          this.carregando = false;
          this.errors.show('Erro ao carregar funcionários.', 'Folha');
        },
      });
  }

  /** Exibe datas da API (YYYY-MM-DD ou ISO) como dd/mm/aaaa. */
  formatarDataDdMmYyyy(raw?: string | null): string {
    if (raw == null || `${raw}` === '') return '—';
    const s = `${raw}`;
    const ymd = s.includes('T') ? s.split('T')[0] : s.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return '—';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

}
