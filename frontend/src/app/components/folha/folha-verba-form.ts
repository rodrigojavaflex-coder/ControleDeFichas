import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FolhaService } from '../../services/folha.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { FolhaMovimentoTipo } from '../../models/folha.model';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-folha-verba-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './folha-verba-form.html',
  styleUrls: ['./folha-entity-form.css'],
})
export class FolhaVerbaFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private folha = inject(FolhaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorModalService);
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);

  form: FormGroup;
  isEditMode = false;
  verbaId?: string;
  loading = false;
  isSubmitting = false;
  error: string | null = null;
  criadoEm = '';
  atualizadoEm = '';

  TiposMov = FolhaMovimentoTipo;

  constructor() {
    this.form = this.fb.group({
      descricao: ['', [Validators.required, Validators.maxLength(200)]],
      tipoMovimento: [FolhaMovimentoTipo.RECEITA, Validators.required],
      ativo: [true],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.verbaId = id;
      if (!this.auth.hasPermission(Permission.FOLHA_VERBA_READ)) {
        this.erroRedirect('visualizar eventos');
        return;
      }
      if (!this.auth.hasPermission(Permission.FOLHA_VERBA_UPDATE)) {
        this.erroRedirect('editar eventos');
        return;
      }
      this.load(id);
    } else if (!this.auth.hasPermission(Permission.FOLHA_VERBA_CREATE)) {
      this.erroRedirect('criar eventos');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar evento' : 'Novo evento',
      description:
        'Eventos de receita ou despesa usados nos lançamentos.',
    });
  }

  private erroRedirect(acao: string): void {
    this.errors.show(`Você não possui permissão para ${acao}.`, 'Acesso negado');
    void this.router.navigate(['/folha/verbas']);
  }

  get descricaoCtrl() {
    return this.form.get('descricao');
  }

  private load(id: string): void {
    this.loading = true;
    this.folha.getVerba(id).subscribe({
      next: (v) => {
        this.criadoEm = v.criadoEm ?? '';
        this.atualizadoEm = v.atualizadoEm ?? '';
        this.form.patchValue({
          descricao: v.descricao,
          tipoMovimento: v.tipoMovimento,
          ativo: v.ativo,
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erro ao carregar evento.';
        this.errors.show(this.error!, 'Erro');
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue() as {
      descricao: string;
      tipoMovimento: FolhaMovimentoTipo;
      ativo: boolean;
    };
    const body = {
      descricao: raw.descricao.trim(),
      tipoMovimento: raw.tipoMovimento,
      ativo: raw.ativo !== false,
    };

    this.isSubmitting = true;
    if (this.isEditMode && this.verbaId) {
      this.folha.patchVerba(this.verbaId, body).subscribe({
        next: () => void this.router.navigate(['/folha/verbas']),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.folha.criarVerba(body).subscribe({
      next: () => void this.router.navigate(['/folha/verbas']),
      error: (e) => this.fail(e),
    });
  }

  private fail(e: { error?: { message?: string } }): void {
    this.isSubmitting = false;
    const msg = e?.error?.message ?? 'Erro ao salvar.';
    this.error = msg;
    this.errors.show(msg, 'Erro');
  }

  onCancel(): void {
    void this.router.navigate(['/folha/verbas']);
  }

  formatMeta(iso: string): string {
    if (!iso) return '—';
    return iso.includes('T') ? iso.replace('T', ' ').slice(0, 19) : iso;
  }
}
