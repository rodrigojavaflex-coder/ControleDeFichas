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
  selector: 'app-folha-tipo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './folha-tipo-form.html',
  styleUrls: ['./folha-entity-form.css', './folha-pages.shared.css'],
})
export class FolhaTipoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private folha = inject(FolhaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorModalService);
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);

  form: FormGroup;
  isEditMode = false;
  tipoId?: string;
  loading = false;
  isSubmitting = false;
  error: string | null = null;
  criadoEm = '';
  atualizadoEm = '';

  constructor() {
    this.form = this.fb.group({
      descricao: ['', [Validators.required, Validators.maxLength(120)]],
      ordenacao: [0, [Validators.required, Validators.min(0)]],
      ativo: [true],
      folhaMensal: [false],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.tipoId = id;
      if (!this.auth.hasPermission(Permission.FOLHA_TIPO_READ)) {
        this.denied('visualizar tipos de folha');
        return;
      }
      if (!this.auth.hasPermission(Permission.FOLHA_TIPO_UPDATE)) {
        this.denied('editar tipos de folha');
        return;
      }
      this.load(id);
    } else if (!this.auth.hasPermission(Permission.FOLHA_TIPO_CREATE)) {
      this.denied('criar tipos de folha');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar tipo de folha' : 'Novo tipo de folha',
      description:
        'Ex.: Mensal, Férias, 13º, Rescisão — ordem usada nos filtros onde aplicável.',
    });
  }

  private denied(msg: string): void {
    this.errors.show(`Você não possui permissão para ${msg}.`, 'Acesso negado');
    void this.router.navigate(['/folha/tipos']);
  }

  get descricaoCtrl() {
    return this.form.get('descricao');
  }

  private load(id: string): void {
    this.loading = true;
    this.folha.getTipo(id).subscribe({
      next: (t) => {
        this.criadoEm = t.criadoEm ?? '';
        this.atualizadoEm = t.atualizadoEm ?? '';
        this.form.patchValue({
          descricao: t.descricao,
          ordenacao: t.ordenacao ?? 0,
          ativo: t.ativo,
          folhaMensal: t.folhaMensal ?? false,
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erro ao carregar tipo.';
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
      ordenacao: number;
      ativo: boolean;
      folhaMensal: boolean;
    };
    const body = {
      descricao: raw.descricao.trim(),
      ordenacao: Number(raw.ordenacao),
      ativo: raw.ativo !== false,
      folhaMensal: raw.folhaMensal === true,
    };

    this.isSubmitting = true;
    if (this.isEditMode && this.tipoId) {
      this.folha.patchTipo(this.tipoId, body).subscribe({
        next: () => void this.router.navigate(['/folha/tipos']),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.folha.criarTipo(body).subscribe({
      next: () => void this.router.navigate(['/folha/tipos']),
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
    void this.router.navigate(['/folha/tipos']);
  }

  formatMeta(iso: string): string {
    if (!iso) return '—';
    return iso.includes('T') ? iso.replace('T', ' ').slice(0, 19) : iso;
  }
}
