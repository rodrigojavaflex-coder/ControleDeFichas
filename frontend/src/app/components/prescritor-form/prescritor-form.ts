import { Component, HostListener, OnInit, inject } from '@angular/core';
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
  readonly ufs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO',
  ];
  readonly unidades = Object.values(Unidade);

  get unidadesVisiveis(): Unidade[] {
    const vinculo = this.unidadeDoUsuario();
    if (!vinculo) return this.unidades;
    return this.unidades.filter((u) => u === vinculo);
  }

  prescritorForm: FormGroup;
  isEditMode = false;
  prescritorId?: string;
  loading = false;
  error: string | null = null;
  isSubmitting = false;
  unidadeTravada = false;
  comboAberto: 'uf' | 'profissao' | null = null;

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
      dataNascimento: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
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
      this.travarUnidadeSeVinculado();
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
        const vinculo = this.unidadeDoUsuario();
        if (vinculo && prescritor.unidade !== vinculo) {
          this.loading = false;
          this.errorModalService.show(
            'Você só pode consultar e alterar prescritores da sua unidade.',
            'Acesso Negado',
          );
          this.router.navigate(['/prescritores']);
          return;
        }
        this.prescritorForm.patchValue({
          nome: prescritor.nome,
          numeroCRM: prescritor.numeroCRM || '',
          UFCRM: prescritor.UFCRM || '',
          pfcrm: prescritor.pfcrm || PF_CRM_PADRAO,
          unidade: prescritor.unidade || '',
          dataNascimento: this.dataParaInput(prescritor.dataNascimento),
        });
        this.travarUnidadeSeVinculado();
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

    const formValue = { ...this.prescritorForm.getRawValue() };

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
      unidade: this.unidadeDoUsuario() || formValue.unidade,
      dataNascimento: formValue.dataNascimento || null,
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
      unidade: this.unidadeDoUsuario() || formValue.unidade || null,
      dataNascimento: formValue.dataNascimento || null,
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

  private travarUnidadeSeVinculado(): void {
    const vinculo = this.unidadeDoUsuario();
    this.unidadeTravada = !!vinculo;
    if (!vinculo) return;
    this.prescritorForm.patchValue({ unidade: vinculo });
    this.prescritorForm.get('unidade')?.disable({ emitEvent: false });
  }

  private unidadeDoUsuario(): string {
    const u = this.authService.getCurrentUser()?.unidade?.trim() ?? '';
    return Object.values(Unidade).includes(u as Unidade) ? u : '';
  }

  private dataParaInput(valor: string | null | undefined): string {
    if (!valor) return '';
    const match = String(valor).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  onCancel(): void {
    this.router.navigate(['/prescritores']);
  }

  get nome() {
    return this.prescritorForm.get('nome');
  }

  get dataNascimento() {
    return this.prescritorForm.get('dataNascimento');
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

  @HostListener('document:click')
  fecharCombo(): void {
    this.comboAberto = null;
  }

  @HostListener('document:keydown.escape')
  fecharComboPorTecla(): void {
    this.comboAberto = null;
  }

  alternarCombo(qual: 'uf' | 'profissao', event: Event): void {
    event.stopPropagation();
    const controle = qual === 'uf' ? this.ufCrm : this.pfcrm;
    if (controle?.disabled) return;
    this.comboAberto = this.comboAberto === qual ? null : qual;
    if (!this.comboAberto) return;
    setTimeout(() => this.posicionarOpcaoAtiva());
  }

  escolherUf(uf: string, event: Event): void {
    event.stopPropagation();
    this.ufCrm?.setValue(uf);
    this.ufCrm?.markAsTouched();
    this.comboAberto = null;
  }

  escolherProfissao(codigo: string, event: Event): void {
    event.stopPropagation();
    this.pfcrm?.setValue(codigo);
    this.pfcrm?.markAsTouched();
    this.comboAberto = null;
  }

  rotuloUf(): string {
    return String(this.ufCrm?.value ?? '').trim();
  }

  rotuloProfissao(): string {
    const codigo = String(this.pfcrm?.value ?? '');
    const opcao = this.pfCrmOpcoes.find((op) => op.codigo === codigo);
    return opcao ? `${opcao.codigo} — ${opcao.label}` : codigo;
  }

  ufsDoCombo(): string[] {
    const atual = this.rotuloUf();
    if (atual && !this.ufs.includes(atual)) return [atual, ...this.ufs];
    return [...this.ufs];
  }

  private posicionarOpcaoAtiva(): void {
    const lista = document.querySelector('.combo.aberto .combo-lista');
    const ativa = lista?.querySelector('.ativo');
    if (!(lista instanceof HTMLElement) || !(ativa instanceof HTMLElement)) return;
    lista.scrollTop = Math.max(0, ativa.offsetTop - lista.clientHeight / 2);
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
    if (control?.hasError('pattern') && fieldName === 'dataNascimento') {
      return 'Use uma data válida';
    }
    if (control?.hasError('maxlength')) {
      return `Campo excede o tamanho máximo permitido`;
    }
    return 'Campo inválido';
  }
}

