import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { VisitaCoresDiasService } from '../../services/visita-cores-dias.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-visita-cor-dia-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './visita-cor-dia-form.html',
  styleUrls: ['../folha/folha-entity-form.css', './visita-cor-dia-form.css'],
})
export class VisitaCorDiaForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cores = inject(VisitaCoresDiasService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorModalService);
  private readonly pageCtx = inject(PageContextService);
  private readonly auth = inject(AuthService);

  readonly unidades = Object.values(Unidade);
  readonly form = this.fb.nonNullable.group({
    unidade: ['', [Validators.required]],
    diasAcimaDe: [5, [Validators.required, Validators.min(0), Validators.max(3650)]],
    cor: ['#F5C518', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    ativo: [true],
  });

  isEditMode = false;
  faixaId?: string;
  loading = false;
  isSubmitting = false;
  salvo = false;
  unidadeDisabled = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!id;
    this.faixaId = id ?? undefined;
    this.initializeUnidade();
    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar cor dos dias' : 'Nova cor dos dias',
      description: 'Faixa usada no histórico de visitas do aplicativo, por unidade.',
    });
    if (id) {
      this.loading = true;
      this.cores.obter(id).subscribe({
        next: (faixa) => {
          this.form.patchValue({
            unidade: String(faixa.unidade),
            diasAcimaDe: faixa.diasAcimaDe,
            cor: faixa.cor,
            ativo: faixa.ativo,
          });
          this.form.controls.unidade.disable({ emitEvent: false });
          this.unidadeDisabled = true;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.errors.show(extrairMensagemErroApi(err), 'Cores dos dias');
          void this.router.navigate(['/visita-medica/cores-dias']);
        },
      });
    }
  }

  aoCor(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value.toUpperCase();
    this.form.controls.cor.setValue(valor);
  }

  salvar(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    const raw = this.form.getRawValue();
    const body = {
      unidade: raw.unidade,
      diasAcimaDe: Number(raw.diasAcimaDe),
      cor: raw.cor.toUpperCase(),
      ativo: raw.ativo,
    };
    const pedido =
      this.isEditMode && this.faixaId
        ? this.cores.atualizar(this.faixaId, {
            diasAcimaDe: body.diasAcimaDe,
            cor: body.cor,
            ativo: body.ativo,
          })
        : this.cores.criar(body);
    pedido.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.salvo = true;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.show(extrairMensagemErroApi(err), 'Cores dos dias');
      },
    });
  }

  cancelar(): void {
    void this.router.navigate(['/visita-medica/cores-dias']);
  }

  fecharSucesso(): void {
    this.salvo = false;
    void this.router.navigate(['/visita-medica/cores-dias']);
  }

  private initializeUnidade(): void {
    const currentUser = this.auth.getCurrentUser();
    const queryUnidade = this.route.snapshot.queryParamMap.get('unidade') ?? '';
    if (currentUser?.unidade?.trim()) {
      this.form.controls.unidade.setValue(currentUser.unidade);
      this.unidadeDisabled = true;
      this.form.controls.unidade.disable({ emitEvent: false });
    } else if (queryUnidade) {
      this.form.controls.unidade.setValue(queryUnidade);
    }
  }
}
