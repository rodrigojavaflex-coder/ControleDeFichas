import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TiposVisitaService } from '../../services/tipos-visita.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-tipo-visita-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipo-visita-form.html',
  styleUrls: ['../folha/folha-entity-form.css'],
})
export class TipoVisitaForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tipos = inject(TiposVisitaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorModalService);
  private readonly pageCtx = inject(PageContextService);
  private readonly auth = inject(AuthService);

  readonly unidades = Object.values(Unidade);
  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    unidade: ['', [Validators.required]],
    ativo: [true],
  });

  isEditMode = false;
  tipoId?: string;
  loading = false;
  isSubmitting = false;
  salvo = false;
  unidadeDisabled = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.initializeUnidade();
    if (id) {
      this.isEditMode = true;
      this.tipoId = id;
      if (!this.auth.hasPermission(Permission.TIPOS_VISITA_UPDATE)) {
        this.negar('editar tipos de visita');
        return;
      }
      this.carregar(id);
    } else if (!this.auth.hasPermission(Permission.TIPOS_VISITA_CREATE)) {
      this.negar('incluir tipos de visita');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar tipo de visita' : 'Novo tipo de visita',
      description: 'Nome usado ao registrar a visita em campo, por unidade.',
    });
  }

  salvar(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body = {
      nome: raw.nome.trim().replace(/\s+/g, ' '),
      unidade: raw.unidade,
      ativo: raw.ativo,
    };
    this.isSubmitting = true;
    const req =
      this.isEditMode && this.tipoId
        ? this.tipos.atualizar(this.tipoId, { nome: body.nome, ativo: body.ativo })
        : this.tipos.criar(body);
    req.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.salvo = true;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de visita');
      },
    });
  }

  fecharSucesso(): void {
    void this.router.navigate(['/visita-medica/tipos-visita']);
  }

  cancelar(): void {
    void this.router.navigate(['/visita-medica/tipos-visita']);
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

  private carregar(id: string): void {
    this.loading = true;
    this.tipos.obter(id).subscribe({
      next: (tipo) => {
        this.form.patchValue({
          nome: tipo.nome,
          unidade: String(tipo.unidade),
          ativo: tipo.ativo,
        });
        this.form.controls.unidade.disable({ emitEvent: false });
        this.unidadeDisabled = true;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de visita');
        void this.router.navigate(['/visita-medica/tipos-visita']);
      },
    });
  }

  private negar(acao: string): void {
    this.errors.show(`Você não possui permissão para ${acao}.`, 'Acesso negado');
    void this.router.navigate(['/visita-medica/tipos-visita']);
  }
}
