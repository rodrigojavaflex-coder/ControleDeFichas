import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CertificadoService, Certificado, CreateCertificadoDto } from '../../services/certificado.service';
import { FichaTecnicaService } from '../../services/ficha-tecnica.service';
import { AuthService } from '../../services/auth.service';
import { FichaTecnica } from '../../models/ficha-tecnica.model';
import { Permission } from '../../models/usuario.model';
import { LaudoService } from '../../services/laudo.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-certificado-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './certificado-form.html',
  styleUrls: ['./certificado-form.css']
})
export class CertificadoFormComponent implements OnInit {
  @ViewChild('laudoFile') laudoFileInput!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private certificadoService = inject(CertificadoService);
  private fichaTecnicaService = inject(FichaTecnicaService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private laudoService = inject(LaudoService);

  // Exportar Permission para uso no template
  Permission = Permission;

  certificadoForm: FormGroup;
  loading = false;
  error: string | null = null;
  isEditMode = false;
  certificadoId: string | null = null;
  currentCertificado: Certificado | null = null;

  // Dados da ficha técnica relacionada
  fichaTecnicaId: string | null = null;
  fichaTecnica: FichaTecnica | null = null;

  // Upload de arquivo
  selectedFile: File | null = null;
  uploadedLaudos: any[] = [];

  // Modal de erro
  showErrorModal = false;
  errorModalTitle = 'Erro';
  errorModalMessage = '';
  errorModalConfirmText = 'OK';

  constructor() {
    this.certificadoForm = this.createForm();
  }

  // Formata Date para string 'YYYY-MM-DD' considerando timezone local
  private formatDate(date: Date | string): string {
    // Interpreta string ISO como data local sem deslocamento de timezone
    const dateIso = date instanceof Date ? date.toISOString() : date;
    const [year, month, day] = dateIso.split('T')[0].split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.certificadoId = params['id'];
        this.loadCertificado();
      }
    });

    // Verificar se há fichaTecnicaId nos query params
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['fichaTecnicaId']) {
        this.fichaTecnicaId = queryParams['fichaTecnicaId'];
        this.loadFichaTecnica();
        // Preencher o campo fichaTecnicaId no formulário
        this.certificadoForm.patchValue({
          fichaTecnicaId: this.fichaTecnicaId
        });
      }
    });

    // Após carregar certificado, listar laudos
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.certificadoId = params['id'];
        this.loadLaudos();
      }
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      loteDoCertificado: ['', [Validators.required, Validators.maxLength(50)]],
      numeroDoCertificado: ['', [Validators.required, Validators.maxLength(50)]],
      fornecedor: ['', [Validators.required, Validators.maxLength(200)]],
      dataCertificado: ['', Validators.required],
      quantidade: ['', [Validators.required, Validators.maxLength(50)]],
      dataDeFabricacao: ['', Validators.required],
      dataDeValidade: ['', Validators.required],
      numeroDoPedido: ['', [Validators.required, Validators.maxLength(50)]],
      pesoMolecular: ['', Validators.maxLength(400)],
      formulaMolecular: ['', Validators.maxLength(400)],
      dcb: ['', Validators.maxLength(400)],
      nomeCientifico: ['', Validators.maxLength(400)],
      caracteristicasOrganolepticas: ['', Validators.maxLength(400)],
      solubilidade: ['', Validators.maxLength(400)],
      faixaPh: ['', Validators.maxLength(400)],
      faixaFusao: ['', Validators.maxLength(400)],
      peso: ['', Validators.maxLength(400)],
      volume: ['', Validators.maxLength(400)],
      densidadeSemCompactacao: ['', Validators.maxLength(400)],
      avaliacaoDoLaudo: ['', Validators.maxLength(400)],
      cinzas: ['', Validators.maxLength(400)],
      perdaPorSecagem: ['', Validators.maxLength(400)],
      infraVermelho: ['', Validators.maxLength(400)],
      ultraVioleta: ['', Validators.maxLength(400)],
      teor: ['', Validators.maxLength(400)],
      conservacao: ['', Validators.maxLength(400)],
      observacao01: ['', Validators.maxLength(400)],
      determinacaoMateriaisEstranhos: ['', Validators.maxLength(400)],
      pesquisasDeContaminacaoMicrobiologica: ['', Validators.maxLength(400)],
      umidade: ['', Validators.maxLength(400)],
      caracteresMicroscopicos: ['', Validators.maxLength(400)],
      fichaTecnicaId: ['', Validators.required]
    });
  }

  // Getters para facilitar acesso aos controles no template
  get numeroDoCertificado() { return this.certificadoForm.get('numeroDoCertificado'); }
  get loteDoCertificado() { return this.certificadoForm.get('loteDoCertificado'); }
  get fornecedor() { return this.certificadoForm.get('fornecedor'); }
  get dataCertificado() { return this.certificadoForm.get('dataCertificado'); }
  get quantidade() { return this.certificadoForm.get('quantidade'); }
  get dataDeFabricacao() { return this.certificadoForm.get('dataDeFabricacao'); }
  get dataDeValidade() { return this.certificadoForm.get('dataDeValidade'); }
  get numeroDoPedido() { return this.certificadoForm.get('numeroDoPedido'); }
  get fichaTecnicaIdControl() { return this.certificadoForm.get('fichaTecnicaId'); }

  // Métodos para verificar se campo tem erro
  hasError(controlName: string): boolean {
    const control = this.certificadoForm.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  getError(controlName: string): string {
    const control = this.certificadoForm.get(controlName);
    if (control && control.errors) {
      if (control.errors['required']) {
        const fieldLabels: { [key: string]: string } = {
          'numeroDoCertificado': 'Número do certificado',
          'loteDoCertificado': 'Lote do certificado',
          'fornecedor': 'Fornecedor',
          'dataCertificado': 'Data do certificado',
          'quantidade': 'Quantidade',
          'dataDeFabricacao': 'Data de fabricação',
          'dataDeValidade': 'Data de validade',
          'numeroDoPedido': 'Número do pedido',
          'fichaTecnicaId': 'Ficha técnica'
        };
        const label = fieldLabels[controlName] || controlName;
        return `${label} é obrigatório`;
      }
    }
    return '';
  }

  private loadCertificado() {
    if (!this.certificadoId) return;

    this.loading = true;
    this.error = null;

    this.certificadoService.findOne(this.certificadoId).subscribe({
      next: (certificado) => {
        this.currentCertificado = certificado;
        // Ajusta campos de data para evitar deslocamento de um dia
        const dataCert = certificado.dataCertificado;
        const dataFab = certificado.dataDeFabricacao;
        const dataVal = certificado.dataDeValidade;
        // Popula form e mapeia densidade
        this.certificadoForm.patchValue({
          ...certificado,
          dataCertificado: dataCert ? this.formatDate(dataCert) : '',
          dataDeFabricacao: dataFab ? this.formatDate(dataFab) : '',
          dataDeValidade: dataVal ? this.formatDate(dataVal) : '',          
        });
        // Garantir que fichaTecnicaId seja populado no form
        const fichaId = certificado.fichaTecnica?.id || null;
        this.fichaTecnicaId = fichaId;
        this.certificadoForm.patchValue({ fichaTecnicaId: fichaId });
        this.loadFichaTecnica();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar certificado:', error);
        this.error = 'Erro ao carregar certificado. Tente novamente.';
        this.loading = false;
      }
    });
  }

  private loadFichaTecnica() {
    if (!this.fichaTecnicaId) return;

    this.fichaTecnicaService.findOne(this.fichaTecnicaId).subscribe({
      next: (ficha) => {
        this.fichaTecnica = ficha;
      },
      error: (error) => {
        console.error('Erro ao carregar ficha técnica:', error);
      }
    });
  }

  private loadLaudos(): void {
    if (!this.certificadoId) return;
    this.laudoService.getLaudos(this.certificadoId).subscribe(laudos => {
      this.uploadedLaudos = laudos;
      this.cdr.markForCheck();
    });
  }


  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      this.error = null;
      return;
    }
    const file = input.files[0];
    // Limpar erro anterior
    this.error = null;
    // Validar tipo (PDF)
    if (file.type !== 'application/pdf') {
      this.errorModalMessage = 'Somente arquivos PDF são permitidos.';
      this.showErrorModal = true;
      this.selectedFile = null;
      this.cdr.detectChanges();
      return;
    }
    // Validar tamanho (max 100KB)
    if (file.size > 100 * 1024) {
      this.errorModalMessage = 'O arquivo deve ter no máximo 100KB.';
      this.showErrorModal = true;
      this.selectedFile = null;
      this.cdr.detectChanges();
      return;
    }
  this.selectedFile = file;
  this.error = null;
  // Upload automático após seleção
  this.uploadLaudo();
  }

  uploadLaudo(): void {
    if (!this.certificadoId || !this.selectedFile) return;
    this.laudoService.uploadLaudo(this.certificadoId, this.selectedFile).subscribe({
      next: () => {
        // Limpa seleção de arquivo e valor do input
        this.selectedFile = null;
        this.loadLaudos();
        if (this.laudoFileInput) {
          this.laudoFileInput.nativeElement.value = '';
        }
      },
      error: (error) => {
        console.error('Erro ao salvar laudo:', error);
        const apiMessage = error?.error?.message || error.message || 'Erro desconhecido ao salvar laudo';
        this.errorModalMessage = apiMessage;
        this.showErrorModal = true;
        console.log('Mostrando modal de erro:', this.errorModalMessage);
        this.cdr.detectChanges();
      }
     });
   }

  laudoDownloadUrl(laudoId: string): string {
    return `/api/certificados/${this.certificadoId}/laudos/${laudoId}/download`;
  }

  /** Abre o PDF do laudo usando HttpClient para enviar token */
  openLaudo(laudoId: string): void {
    if (!this.certificadoId) return;
    this.laudoService.downloadLaudo(this.certificadoId, laudoId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        // Abrir em nova aba
        window.open(url);
      },
      error: (err) => {
        console.error('Erro ao baixar laudo:', err);
      },
    });
  }

  onSubmit() {
    if (this.certificadoForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formData = this.certificadoForm.value;
    // Mapear campo renomeado para backend
    const payload: CreateCertificadoDto = {
      ...formData
    };

    if (this.isEditMode && this.certificadoId) {
      this.updateCertificado(payload);
    } else {
      this.createCertificado(payload);
    }
  }

  private createCertificado(formData: CreateCertificadoDto) {
    this.certificadoService.create(formData).subscribe({
      next: (certificado) => {
        // Atualizar certificadoId para upload
        this.certificadoId = certificado.id;
        // Se há arquivo para upload, fazer upload após criação
        if (this.selectedFile) {
          this.uploadLaudo();
        } else {
          // Navegar de volta e expandir os certificados da ficha associada
          this.router.navigate(['/fichas-tecnicas'], { queryParams: { fichaTecnicaId: certificado.fichaTecnica?.id } });
        }
      },
      error: (error) => {
        console.error('Erro ao criar certificado:', error);
        // Exibir mensagem detalhada da API, se disponível
        const apiMessage = error?.error?.message || error.message;
        this.error = apiMessage || 'Erro ao criar certificado. Tente novamente.';
        this.loading = false;
      }
    });
  }

  private updateCertificado(formData: Partial<CreateCertificadoDto>) {
    if (!this.certificadoId) return;

    this.certificadoService.update(this.certificadoId, formData).subscribe({
      next: (certificado) => {
        // Se há arquivo para upload, fazer upload após atualização
        if (this.selectedFile) {
          this.uploadLaudo();
        } else {
          // Navegar de volta e expandir os certificados da ficha associada
          this.router.navigate(['/fichas-tecnicas'], { queryParams: { fichaTecnicaId: certificado.fichaTecnica?.id } });
        }
      },
      error: (error) => {
        console.error('Erro ao atualizar certificado:', error);
        this.error = 'Erro ao atualizar certificado. Tente novamente.';
        this.loading = false;
      }
    });
  }


  private markFormGroupTouched() {
    const controlKeys = Object.keys(this.certificadoForm.controls);
    
    controlKeys.forEach(key => {
      const control = this.certificadoForm.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markNestedFormGroupTouched(control);
        }
      }
    });
    // Forçar detecção de mudanças para atualizar a UI
    this.cdr.detectChanges();
  }

  private markNestedFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markNestedFormGroupTouched(control);
        }
      }
    });
  }

  onCancel() {
    this.router.navigate(['/fichas-tecnicas']);
  }

  hasPermission(permission: Permission): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * Remove um laudo existente e atualiza a lista
   */
  removeLaudo(laudoId: string): void {
    if (!this.certificadoId) return;
    if (!confirm('Confirma a remoção deste laudo?')) return;
    this.laudoService.remove(this.certificadoId, laudoId).subscribe({
      next: () => this.loadLaudos(),
      error: err => console.error('Erro ao remover laudo:', err)
    });
  }

  closeErrorModal(): void {
    console.log('Fechando modal de erro');
    this.showErrorModal = false;
    this.errorModalMessage = '';
  }
}