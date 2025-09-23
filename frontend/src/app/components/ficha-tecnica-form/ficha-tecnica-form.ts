import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../services/ficha-tecnica.service';
import { AuthService } from '../../services/auth.service';
import { 
  FichaTecnica, 
  CreateFichaTecnicaDto, 
  UpdateFichaTecnicaDto 
} from '../../models/ficha-tecnica.model';
import { Permission } from '../../models/user.model';

@Component({
  selector: 'app-ficha-tecnica-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ficha-tecnica-form.html',
  styleUrl: './ficha-tecnica-form.css'
})
export class FichaTecnicaFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fichaTecnicaService = inject(FichaTecnicaService);
  private authService = inject(AuthService);

  // Exportar Permission para uso no template
  Permission = Permission;

  fichaForm: FormGroup;
  loading = false;
  error: string | null = null;
  isEditMode = false;
  fichaId: string | null = null;
  currentFicha: FichaTecnica | null = null;

  constructor() {
    this.fichaForm = this.createForm();
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.fichaId = params['id'];
        this.loadFichaTecnica();
      }
    });
  }

  /**
   * Cria o formulário reativo
   */
  private createForm(): FormGroup {
    return this.fb.group({
      tipoDaFicha: ['', Validators.required],
      codigoFormulaCerta: ['', [Validators.required, Validators.maxLength(100)]],
      produto: ['', [Validators.required, Validators.maxLength(255)]],
      pesoMolecular: ['', Validators.maxLength(100)],
      formulaMolecular: ['', Validators.maxLength(100)],
      dcb: ['', Validators.maxLength(100)],
      nomeCientifico: ['', Validators.maxLength(255)],
      revisao: ['', Validators.maxLength(50)],
      caracteristicasOrganolepticas: [''],
      solubilidade: [''],
      faixaPh: ['', Validators.maxLength(50)],
      faixaFusao: ['', Validators.maxLength(50)],
      peso: ['', Validators.maxLength(50)],
      volume: ['', Validators.maxLength(50)],
  densidadeComCompactacao: ['', Validators.maxLength(50)],
  determinacaoMateriaisEstranhos: ['', Validators.maxLength(200)],
  pesquisasDeContaminacaoMicrobiologica: ['', Validators.maxLength(200)],
  umidade: ['', Validators.maxLength(200)],
  caracteresMicroscopicos: ['', Validators.maxLength(200)],
  avaliacaoDoLaudo: [''],
      cinzas: ['', Validators.maxLength(50)],
      perdaPorSecagem: ['', Validators.maxLength(50)],
      infraVermelho: [''],
      ultraVioleta: [''],
      teor: ['', Validators.maxLength(50)],
      conservacao: [''],
      observacao01: [''],
      amostragem: [''],
      referenciaBibliografica: [''],
      dataDeAnalise: ['', Validators.required]
    });
  }

  /**
   * Carrega uma ficha técnica para edição
   */
  private loadFichaTecnica() {
    if (!this.fichaId) return;

    this.loading = true;
    this.fichaTecnicaService.findOne(this.fichaId).subscribe({
      next: (ficha) => {
        this.currentFicha = ficha;
        this.patchFormWithFicha(ficha);
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar ficha técnica:', error);
        this.error = 'Erro ao carregar ficha técnica. Tente novamente.';
        this.loading = false;
      }
    });
  }

  /**
   * Preenche o formulário com os dados da ficha técnica
   */
  private patchFormWithFicha(ficha: FichaTecnica) {
    this.fichaForm.patchValue({
      tipoDaFicha: ficha.tipoDaFicha,
      produto: ficha.produto,
      pesoMolecular: ficha.pesoMolecular,
      formulaMolecular: ficha.formulaMolecular,
      dcb: ficha.dcb,
      nomeCientifico: ficha.nomeCientifico,
      revisao: ficha.revisao,
      caracteristicasOrganolepticas: ficha.caracteristicasOrganolepticas,
      solubilidade: ficha.solubilidade,
      faixaPh: ficha.faixaPh,
      faixaFusao: ficha.faixaFusao,
      peso: ficha.peso,
      volume: ficha.volume,
      densidadeComCompactacao: ficha.densidadeComCompactacao,
      avaliacaoDoLaudo: ficha.avaliacaoDoLaudo,
      cinzas: ficha.cinzas,
      perdaPorSecagem: ficha.perdaPorSecagem,
      infraVermelho: ficha.infraVermelho,
      ultraVioleta: ficha.ultraVioleta,
      teor: ficha.teor,
      conservacao: ficha.conservacao,
      observacao01: ficha.observacao01,
      amostragem: ficha.amostragem,
      referenciaBibliografica: ficha.referenciaBibliografica,
      dataDeAnalise: ficha.dataDeAnalise
    });
  }

  /**
   * Submete o formulário
   */
  onSubmit() {
    if (this.fichaForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formData = this.fichaForm.value;
    
    if (this.isEditMode && this.fichaId) {
      this.updateFichaTecnica(formData);
    } else {
      this.createFichaTecnica(formData);
    }
  }

  /**
   * Cria uma nova ficha técnica
   */
  private createFichaTecnica(data: CreateFichaTecnicaDto) {
    this.loading = true;
    this.error = null;

    this.fichaTecnicaService.create(data).subscribe({
      next: () => {
        this.router.navigate(['/fichas-tecnicas']);
      },
      error: (error) => {
        console.error('Erro ao criar ficha técnica:', error);
        this.error = 'Erro ao criar ficha técnica. Verifique os dados e tente novamente.';
        this.loading = false;
      }
    });
  }

  /**
   * Atualiza uma ficha técnica existente
   */
  private updateFichaTecnica(data: UpdateFichaTecnicaDto) {
    if (!this.fichaId) return;

    this.loading = true;
    this.error = null;

    this.fichaTecnicaService.update(this.fichaId, data).subscribe({
      next: () => {
        this.router.navigate(['/fichas-tecnicas']);
      },
      error: (error) => {
        console.error('Erro ao atualizar ficha técnica:', error);
        this.error = 'Erro ao atualizar ficha técnica. Verifique os dados e tente novamente.';
        this.loading = false;
      }
    });
  }

  /**
   * Marca todos os campos do formulário como tocados para mostrar validações
   */
  private markFormGroupTouched() {
    Object.keys(this.fichaForm.controls).forEach(key => {
      const control = this.fichaForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Verifica se um campo tem erro
   */
  hasError(fieldName: string): boolean {
    const field = this.fichaForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  /**
   * Obtém a mensagem de erro de um campo
   */
  getError(fieldName: string): string {
    const field = this.fichaForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return `${this.getFieldLabel(fieldName)} é obrigatório`;
    if (field.errors['maxlength']) return `${this.getFieldLabel(fieldName)} excede o tamanho máximo`;
    
    return 'Campo inválido';
  }

  /**
   * Obtém o rótulo de um campo
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      produto: 'Produto',
      pesoMolecular: 'Peso Molecular',
      formulaMolecular: 'Fórmula Molecular',
      dcb: 'DCB',
      nomeCientifico: 'Nome Científico',
      revisao: 'Revisão',
      caracteristicasOrganolepticas: 'Características Organolépticas',
      solubilidade: 'Solubilidade',
      faixaPh: 'Faixa de pH',
      faixaFusao: 'Faixa de Fusão',
      dataDeAnalise: 'Data de Análise'
    };
    
    return labels[fieldName] || fieldName;
  }

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  hasPermission(permission: Permission): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * Cancela a operação e volta à listagem
   */
  cancel() {
    this.router.navigate(['/fichas-tecnicas']);
  }
}