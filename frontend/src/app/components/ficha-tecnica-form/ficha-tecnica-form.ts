import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../services/ficha-tecnica.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { 
  FichaTecnica, 
  CreateFichaTecnicaDto, 
  UpdateFichaTecnicaDto 
} from '../../models/ficha-tecnica.model';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-ficha-tecnica-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './ficha-tecnica-form.html',
  styleUrls: ['./ficha-tecnica-form.css']
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
  isEditMode = false;
  fichaId: string | null = null;
  currentFicha: FichaTecnica | null = null;

  // Modal de erro
  showErrorModal = false;
  errorModalMessage = '';

  constructor() {
    this.fichaForm = this.createForm();
  }

  // Ajusta data compensando timezone local e formata para YYYY-MM-DD
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  ngOnInit() {
    //console.log('PASSO 1: Componente do formulário iniciado (ngOnInit)');
    this.route.params.subscribe(params => {
      //console.log('PASSO 2: Parâmetros da rota recebidos:', params);
      if (params['id']) {
        this.isEditMode = true;
        this.fichaId = params['id'];
        //console.log('PASSO 3: Modo de edição. ID da ficha:', this.fichaId);
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
      codigoFormulaCerta: ['', [Validators.required, Validators.maxLength(300)]],
      produto: ['', [Validators.required, Validators.maxLength(400)]],
      pesoMolecular: ['', Validators.maxLength(400)],
      formulaMolecular: ['', Validators.maxLength(400)],
      dcb: ['', Validators.maxLength(400)],
      nomeCientifico: ['', Validators.maxLength(400)],
      revisao: ['', Validators.maxLength(400)],
      caracteristicasOrganolepticas: ['', Validators.maxLength(400)],
      solubilidade: ['', Validators.maxLength(400)],
      faixaPh: ['', Validators.maxLength(400)],
      faixaFusao: ['', Validators.maxLength(400)],
      peso: ['', Validators.maxLength(400)],
      volume: ['', Validators.maxLength(400)],
      densidadeComCompactacao: ['', Validators.maxLength(400)],
      determinacaoMateriaisEstranhos: ['', Validators.maxLength(400)],
      pesquisasDeContaminacaoMicrobiologica: ['', Validators.maxLength(400)],
      umidade: ['', Validators.maxLength(400)],
      caracteresMicroscopicos: ['', Validators.maxLength(400)],
      avaliacaoDoLaudo: ['', Validators.maxLength(400)],
      cinzas: ['', Validators.maxLength(400)],
      perdaPorSecagem: ['', Validators.maxLength(400)],
      infraVermelho: ['', Validators.maxLength(400)],
      ultraVioleta: ['', Validators.maxLength(400)],
      teor: ['', Validators.maxLength(400)],
      conservacao: ['', Validators.maxLength(400)],
      observacao01: ['', Validators.maxLength(400)],
      amostragem: [''],
      referenciaBibliografica: ['', Validators.maxLength(400)],
      dataDeAnalise: ['', Validators.required]
    });
  }

  /**
   * Carrega uma ficha técnica para edição
   */
  private loadFichaTecnica() {
    if (!this.fichaId) return;

     //console.log('PASSO 4: Carregando dados da ficha...');
    this.loading = true;
    this.fichaTecnicaService.findOne(this.fichaId).subscribe({
      next: (ficha) => {
        //console.log('PASSO 5: SUCESSO! Dados recebidos da API:', ficha);
        this.currentFicha = ficha;
        this.patchFormWithFicha(ficha);
        this.loading = false;
      },
      error: (err) => {
        console.error('ERRO: Falha ao buscar dados da ficha!', err);
        this.errorModalMessage = 'Falha ao carregar a ficha técnica. Verifique o console para mais detalhes.';
        this.showErrorModal = true;
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
      codigoFormulaCerta: ficha.codigoFormulaCerta, // Adicionado para garantir que o campo seja preenchido
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
      // Ajusta data de análise para exibir corretamente no input
      dataDeAnalise: ficha.dataDeAnalise ? this.formatDate(ficha.dataDeAnalise) : ''
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

    this.fichaTecnicaService.create(data).subscribe({
      next: () => {
        this.router.navigate(['/fichas-tecnicas']);
      },
      error: (error) => {
        console.error('Erro ao criar ficha técnica:', error);
        // Extrai mensagem específica do backend ou usa mensagem genérica
        const backendMessage = error?.error?.message;
        if (backendMessage && backendMessage.includes('duplicada')) {
          // Para erros de unicidade, mostra mensagem mais clara no modal
          const codigoMatch = backendMessage.match(/código fórmula certa = "([^"]+)"/);
          const codigo = codigoMatch ? codigoMatch[1] : 'informado';
          this.errorModalMessage = `Já existe uma ficha técnica para o código Fórmula Certa ${codigo}.`;
        } else {
          this.errorModalMessage = backendMessage || 'Erro ao criar ficha técnica. Verifique os dados e tente novamente.';
        }
        this.showErrorModal = true;
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

    this.fichaTecnicaService.update(this.fichaId, data).subscribe({
      next: () => {
        this.router.navigate(['/fichas-tecnicas']);
      },
      error: (error) => {
        console.error('Erro ao atualizar ficha técnica:', error);
        // Extrai mensagem específica do backend ou usa mensagem genérica
        const backendMessage = error?.error?.message;
        if (backendMessage && backendMessage.includes('duplicada')) {
          // Para erros de unicidade, mostra mensagem mais clara no modal
          const codigoMatch = backendMessage.match(/código fórmula certa = "([^"]+)"/);
          const codigo = codigoMatch ? codigoMatch[1] : 'informado';
          this.errorModalMessage = `Já existe uma ficha técnica para o código Fórmula Certa ${codigo}.`;
        } else {
          this.errorModalMessage = backendMessage || 'Erro ao atualizar ficha técnica. Verifique os dados e tente novamente.';
        }
        this.showErrorModal = true;
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
   * Fecha o modal de erro
   */
  closeErrorModal() {
    this.showErrorModal = false;
    this.errorModalMessage = '';
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