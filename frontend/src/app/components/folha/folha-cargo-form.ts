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
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-folha-cargo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './folha-cargo-form.html',
  styleUrls: ['./folha-entity-form.css', './folha-pages.shared.css'],
})
export class FolhaCargoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private folha = inject(FolhaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorModalService);
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);

  form: FormGroup;
  isEditMode = false;
  registroId?: string;
  loading = false;
  isSubmitting = false;
  error: string | null = null;
  criadoEm = '';
  atualizadoEm = '';

  constructor() {
    this.form = this.fb.group({
      descricao: ['', [Validators.required, Validators.maxLength(120)]],
      ativo: [true],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.registroId = id;
      if (!this.auth.hasPermission(Permission.FOLHA_CARGO_READ)) {
        this.erroRedirect('visualizar cargos');
        return;
      }
      if (!this.auth.hasPermission(Permission.FOLHA_CARGO_UPDATE)) {
        this.erroRedirect('editar cargos');
        return;
      }
      this.load(id);
    } else if (!this.auth.hasPermission(Permission.FOLHA_CARGO_CREATE)) {
      this.erroRedirect('criar cargos');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar cargo' : 'Novo cargo',
      description: 'Descrição do cargo vinculada ao cadastro de funcionários da folha.',
    });
  }

  private erroRedirect(acao: string): void {
    this.errors.show(`Você não possui permissão para ${acao}.`, 'Acesso negado');
    void this.router.navigate(['/folha/cargos']);
  }

  get descricaoCtrl() {
    return this.form.get('descricao');
  }

  private load(id: string): void {
    this.loading = true;
    this.folha.getCargo(id).subscribe({
      next: (v) => {
        this.criadoEm = v.criadoEm ?? '';
        this.atualizadoEm = v.atualizadoEm ?? '';
        this.form.patchValue({
          descricao: v.descricao,
          ativo: v.ativo,
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erro ao carregar cargo.';
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
      ativo: boolean;
    };
    const body = {
      descricao: raw.descricao.trim(),
      ativo: raw.ativo !== false,
    };

    this.isSubmitting = true;
    if (this.isEditMode && this.registroId) {
      this.folha.patchCargo(this.registroId, body).subscribe({
        next: () => void this.router.navigate(['/folha/cargos']),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.folha.criarCargo(body).subscribe({
      next: () => void this.router.navigate(['/folha/cargos']),
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
    void this.router.navigate(['/folha/cargos']);
  }

  formatMeta(iso: string): string {
    if (!iso) return '—';
    return iso.includes('T') ? iso.replace('T', ' ').slice(0, 19) : iso;
  }
}
