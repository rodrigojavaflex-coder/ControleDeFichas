import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PrescritoresService } from '../../services/prescritores.service';
import { CreatePrescritorDto, UpdatePrescritorDto, Prescritor } from '../../models/prescritor.model';
import { Permission, Unidade } from '../../models/usuario.model';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { PF_CRM_OPCOES, PF_CRM_PADRAO } from '../../utils/pf-crm.util';

@Component({
  selector: 'app-prescritor-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './prescritor-form.html',
  styleUrls: ['./prescritor-form.css']
})
export class PrescritorFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private prescritoresService = inject(PrescritoresService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorModalService = inject(ErrorModalService);
  private pageContextService = inject(PageContextService);
  private authService = inject(AuthService);

  readonly pfCrmOpcoes = PF_CRM_OPCOES;
  readonly unidades = Object.values(Unidade);

  prescritorForm: FormGroup;
  isEditMode = false;
  prescritorId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;

  constructor() {
    this.prescritorForm = this.createForm();
  }

  ngOnInit(): void {
    this.checkEditMode();
    
    // Verificar permissões
    if (this.isEditMode) {
      if (!this.authService.hasPermission(Permission.PRESCRITOR_UPDATE)) {
        this.errorModalService.show('Você não possui permissão para editar prescritores', 'Acesso Negado');
        this.router.navigate(['/prescritores']);
        return;
      }
    } else {
      if (!this.authService.hasPermission(Permission.PRESCRITOR_CREATE)) {
        this.errorModalService.show('Você não possui permissão para criar prescritores', 'Acesso Negado');
        this.router.navigate(['/prescritores']);
        return;
      }
    }

    this.pageContextService.setContext({
      title: 'Cadastro de Prescritor',
      description: this.isEditMode ? 'Edite as informações do prescritor' : 'Cadastre um novo prescritor'
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      nome: ['', [Validators.required, Validators.maxLength(500)]],
      numeroCRM: [''],
      UFCRM: ['', [Validators.maxLength(2)]],
      pfcrm: [PF_CRM_PADRAO, [Validators.required, Validators.maxLength(3)]],
      unidade: [''],
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id) {
      this.isEditMode = true;
      this.prescritorId = id;
      this.loadPrescritor(id);
    } else {
      this.isEditMode = false;
      this.prescritorForm.get('numeroCRM')?.setValidators([Validators.required, Validators.min(1)]);
      this.prescritorForm.get('UFCRM')?.setValidators([
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(2),
      ]);
      this.prescritorForm.get('unidade')?.setValidators([Validators.required]);
      this.prescritorForm.patchValue({ unidade: this.unidadeDoUsuario() });
      this.prescritorForm.get('numeroCRM')?.updateValueAndValidity();
      this.prescritorForm.get('UFCRM')?.updateValueAndValidity();
      this.prescritorForm.get('unidade')?.updateValueAndValidity();
    }
  }

  private loadPrescritor(id: string): void {
    this.loading = true;
    this.error = null;

    this.prescritoresService.findOne(id).subscribe({
      next: (prescritor) => {
        this.prescritorForm.patchValue({
          nome: prescritor.nome,
          numeroCRM: prescritor.numeroCRM || '',
          UFCRM: prescritor.UFCRM || '',
          pfcrm: prescritor.pfcrm || PF_CRM_PADRAO,
          unidade: prescritor.unidade || '',
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar prescritor:', error);
        this.error = 'Erro ao carregar dados do prescritor';
        this.loading = false;
        this.errorModalService.show('Erro ao carregar dados do prescritor', 'Erro');
      }
    });
  }

  onSubmit(): void {
    if (this.prescritorForm.invalid || this.isSubmitting) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const formValue = { ...this.prescritorForm.value };

    if (this.isEditMode && this.prescritorId) {
      this.updatePrescritor(formValue);
    } else {
      this.createPrescritor(formValue);
    }
  }

  private createPrescritor(formValue: any): void {
    const createPrescritorDto: CreatePrescritorDto = {
      nome: formValue.nome,
      numeroCRM: parseInt(formValue.numeroCRM, 10),
      UFCRM: String(formValue.UFCRM).trim().toUpperCase(),
      pfcrm: formValue.pfcrm || PF_CRM_PADRAO,
      unidade: formValue.unidade,
    };

    this.prescritoresService.create(createPrescritorDto).subscribe({
      next: () => {
        this.router.navigate(['/prescritores']);
      },
      error: (error) => {
        console.error('Erro ao criar prescritor:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private updatePrescritor(formValue: any): void {
    const updatePrescritorDto: UpdatePrescritorDto = {
      nome: formValue.nome,
      numeroCRM: formValue.numeroCRM ? parseInt(formValue.numeroCRM) : undefined,
      UFCRM: formValue.UFCRM || undefined,
      pfcrm: formValue.pfcrm || PF_CRM_PADRAO,
      unidade: formValue.unidade || null,
    };

    this.prescritoresService.update(this.prescritorId!, updatePrescritorDto).subscribe({
      next: () => {
        this.router.navigate(['/prescritores']);
      },
      error: (error) => {
        console.error('Erro ao atualizar prescritor:', error);
        this.handleSubmitError(error);
      }
    });
  }

  private handleSubmitError(error: any): void {
    this.isSubmitting = false;
    const errorMessage = error?.error?.message || 'Erro ao salvar prescritor';
    this.error = errorMessage;
    this.errorModalService.show(errorMessage, 'Erro');
  }

  private markFormGroupTouched(): void {
    Object.keys(this.prescritorForm.controls).forEach(key => {
      const control = this.prescritorForm.get(key);
      control?.markAsTouched();
    });
  }

  private unidadeDoUsuario(): string {
    const u = this.authService.getCurrentUser()?.unidade?.trim() ?? '';
    return Object.values(Unidade).includes(u as Unidade) ? u : '';
  }

  onCancel(): void {
    this.router.navigate(['/prescritores']);
  }

  get nome() {
    return this.prescritorForm.get('nome');
  }

  get pfcrm() {
    return this.prescritorForm.get('pfcrm');
  }

  get numeroCRM() {
    return this.prescritorForm.get('numeroCRM');
  }

  get ufCrm() {
    return this.prescritorForm.get('UFCRM');
  }

  get unidade() {
    return this.prescritorForm.get('unidade');
  }

  getErrorMessage(fieldName: string): string {
    const control = this.prescritorForm.get(fieldName);
    if (control?.hasError('required')) {
      if (fieldName === 'numeroCRM') return 'Número do CRM é obrigatório';
      if (fieldName === 'UFCRM') return 'UF do CRM é obrigatória';
      if (fieldName === 'unidade') return 'Unidade é obrigatória';
      return 'Nome é obrigatório';
    }
    if (control?.hasError('min')) {
      return 'Número do CRM deve ser maior que zero';
    }
    if (control?.hasError('maxlength')) {
      return `Campo excede o tamanho máximo permitido`;
    }
    return 'Campo inválido';
  }
}

