import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { OrcamentosService } from '../../services/orcamentos.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-orcamento-motivo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './orcamento-motivo-form.html',
  styleUrls: ['../folha/folha-entity-form.css', '../folha/folha-pages.shared.css'],
})
export class OrcamentoMotivoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private orcamentos = inject(OrcamentosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorModalService);
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);

  form: FormGroup;
  isEditMode = false;
  motivoId?: string;
  loading = false;
  isSubmitting = false;
  error: string | null = null;
  criadoEm = '';
  atualizadoEm = '';

  constructor() {
    this.form = this.fb.group({
      descricao: ['', [Validators.required, Validators.maxLength(200)]],
      ativo: [true],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.motivoId = id;
      if (!this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_READ)) {
        this.denied('visualizar motivos');
        return;
      }
      if (!this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_UPDATE)) {
        this.denied('editar motivos');
        return;
      }
      this.load(id);
    } else if (!this.auth.hasPermission(Permission.ORCAMENTO_MOTIVO_CREATE)) {
      this.denied('criar motivos');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar motivo de rejeição' : 'Novo motivo de rejeição',
      description: 'Motivos globais utilizados na classificação de orçamentos rejeitados.',
    });
  }

  private denied(msg: string): void {
    this.errors.show(`Você não possui permissão para ${msg}.`, 'Acesso negado');
    void this.router.navigate(['/orcamentos/motivos-rejeicao']);
  }

  private load(id: string): void {
    this.loading = true;
    this.orcamentos.getMotivo(id).subscribe({
      next: (m) => {
        this.criadoEm = m.criadoEm ?? '';
        this.atualizadoEm = m.atualizadoEm ?? '';
        this.form.patchValue({
          descricao: m.descricao,
          ativo: m.ativo,
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erro ao carregar motivo.';
        this.errors.show(this.error!, 'Erro');
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue() as { descricao: string; ativo: boolean };
    const body = {
      descricao: raw.descricao.trim(),
      ativo: raw.ativo !== false,
    };

    this.isSubmitting = true;
    if (this.isEditMode && this.motivoId) {
      this.orcamentos.patchMotivo(this.motivoId, body).subscribe({
        next: () => void this.router.navigate(['/orcamentos/motivos-rejeicao']),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.orcamentos.criarMotivo(body).subscribe({
      next: () => void this.router.navigate(['/orcamentos/motivos-rejeicao']),
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
    void this.router.navigate(['/orcamentos/motivos-rejeicao']);
  }
}
