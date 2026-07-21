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
  selector: 'app-folha-setor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './folha-setor-form.html',
  styleUrls: ['./folha-entity-form.css'],
})
export class FolhaSetorFormComponent implements OnInit {
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
      if (!this.auth.hasPermission(Permission.FOLHA_SETOR_READ)) {
        this.erroRedirect('visualizar setores');
        return;
      }
      if (!this.auth.hasPermission(Permission.FOLHA_SETOR_UPDATE)) {
        this.erroRedirect('editar setores');
        return;
      }
      this.load(id);
    } else if (!this.auth.hasPermission(Permission.FOLHA_SETOR_CREATE)) {
      this.erroRedirect('criar setores');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar setor' : 'Novo setor',
      description: 'Descrição do setor vinculada ao cadastro de funcionários da folha.',
    });
  }

  private erroRedirect(acao: string): void {
    this.errors.show(`Você não possui permissão para ${acao}.`, 'Acesso negado');
    void this.router.navigate(['/folha/setores']);
  }

  get descricaoCtrl() {
    return this.form.get('descricao');
  }

  private load(id: string): void {
    this.loading = true;
    this.folha.getSetor(id).subscribe({
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
        this.error = 'Erro ao carregar setor.';
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
      this.folha.patchSetor(this.registroId, body).subscribe({
        next: () => void this.router.navigate(['/folha/setores']),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.folha.criarSetor(body).subscribe({
      next: () => void this.router.navigate(['/folha/setores']),
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
    void this.router.navigate(['/folha/setores']);
  }

  formatMeta(iso: string): string {
    if (!iso) return '—';
    return iso.includes('T') ? iso.replace('T', ' ').slice(0, 19) : iso;
  }
}
