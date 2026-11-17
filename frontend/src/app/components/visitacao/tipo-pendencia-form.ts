import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TiposPendenciaService } from '../../services/tipos-pendencia.service';
import { ResponsavelTipoPendencia } from '../../models/tipo-pendencia.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-tipo-pendencia-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipo-pendencia-form.html',
  styleUrls: ['../folha/folha-entity-form.css'],
})
export class TipoPendenciaForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tipos = inject(TiposPendenciaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorModalService);
  private readonly pageCtx = inject(PageContextService);
  private readonly auth = inject(AuthService);

  readonly unidades = Object.values(Unidade);
  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    descricao: ['', [Validators.required, Validators.maxLength(2000)]],
    unidade: ['', [Validators.required]],
    responsavelId: ['', [Validators.required]],
    ativo: [true],
  });

  responsaveis: ResponsavelTipoPendencia[] = [];
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
      if (!this.auth.hasPermission(Permission.TIPOS_PENDENCIA_UPDATE)) {
        this.negar('editar tipos de pendência');
        return;
      }
    } else if (!this.auth.hasPermission(Permission.TIPOS_PENDENCIA_CREATE)) {
      this.negar('incluir tipos de pendência');
      return;
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar tipo de pendência' : 'Novo tipo de pendência',
      description: 'Nome, descrição, unidade e responsável de referência do tipo.',
    });
    this.carregarResponsaveis(id);
  }

  salvar(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const body = {
      nome: raw.nome.trim().replace(/\s+/g, ' '),
      descricao: raw.descricao.trim().replace(/\s+/g, ' '),
      unidade: raw.unidade,
      responsavelId: raw.responsavelId,
      ativo: raw.ativo,
    };
    this.isSubmitting = true;
    const req =
      this.isEditMode && this.tipoId
        ? this.tipos.atualizar(this.tipoId, {
            nome: body.nome,
            descricao: body.descricao,
            responsavelId: body.responsavelId,
            ativo: body.ativo,
          })
        : this.tipos.criar(body);
    req.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.salvo = true;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência');
      },
    });
  }

  fecharSucesso(): void {
    void this.router.navigate(['/visita-medica/tipos-pendencia']);
  }

  cancelar(): void {
    void this.router.navigate(['/visita-medica/tipos-pendencia']);
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

  private carregarResponsaveis(id: string | null): void {
    this.loading = true;
    this.tipos.listarResponsaveis().subscribe({
      next: (lista) => {
        this.responsaveis = lista;
        if (id) {
          this.carregar(id);
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        this.loading = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência');
        void this.router.navigate(['/visita-medica/tipos-pendencia']);
      },
    });
  }

  private carregar(id: string): void {
    this.tipos.obter(id).subscribe({
      next: (tipo) => {
        this.form.patchValue({
          nome: tipo.nome,
          descricao: tipo.descricao,
          unidade: String(tipo.unidade),
          responsavelId: tipo.responsavelId,
          ativo: tipo.ativo,
        });
        this.form.controls.unidade.disable({ emitEvent: false });
        this.unidadeDisabled = true;
        if (
          tipo.responsavelId &&
          !this.responsaveis.some((item) => item.id === tipo.responsavelId)
        ) {
          this.responsaveis = [
            {
              id: tipo.responsavelId,
              nome: tipo.responsavelNome || 'Responsável inativo',
            },
            ...this.responsaveis,
          ];
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errors.show(extrairMensagemErroApi(err), 'Tipos de pendência');
        void this.router.navigate(['/visita-medica/tipos-pendencia']);
      },
    });
  }

  private negar(acao: string): void {
    this.errors.show(`Você não possui permissão para ${acao}.`, 'Acesso negado');
    void this.router.navigate(['/visita-medica/tipos-pendencia']);
  }
}
