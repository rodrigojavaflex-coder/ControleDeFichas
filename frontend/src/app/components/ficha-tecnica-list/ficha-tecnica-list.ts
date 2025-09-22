import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../services/ficha-tecnica.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { 
  FichaTecnica, 
  FindFichaTecnicaDto,
  FichaTecnicaPaginatedResponse
} from '../../models/ficha-tecnica.model';
import { Permission } from '../../models/user.model';

@Component({
  selector: 'app-ficha-tecnica-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    ConfirmationModalComponent
  ],
  templateUrl: './ficha-tecnica-list.html',
  styleUrl: './ficha-tecnica-list.css'
})
export class FichaTecnicaListComponent implements OnInit {
  private fichaTecnicaService = inject(FichaTecnicaService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Exportar Permission para uso no template
  Permission = Permission;

  // Signals para estado reativo
  fichasTecnicas = signal<FichaTecnica[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  
  // Paginação
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  
  // Filtros
  searchFilters: FindFichaTecnicaDto = {
    page: this.currentPage,
    limit: this.itemsPerPage
  };
  
  // Modal de confirmação
  showDeleteModal = false;
  fichaToDelete: FichaTecnica | null = null;

  ngOnInit() {
    this.loadFichasTecnicas();
  }

  /**
   * Carrega a lista de fichas técnicas
   */
  loadFichasTecnicas() {
    this.loading.set(true);
    this.error.set(null);
    
    this.fichaTecnicaService.findAll(this.searchFilters).subscribe({
      next: (response: FichaTecnicaPaginatedResponse) => {
        this.fichasTecnicas.set(response.data);
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.currentPage = response.meta.page;
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Erro ao carregar fichas técnicas:', error);
        this.error.set('Erro ao carregar fichas técnicas. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Aplica os filtros de pesquisa
   */
  applyFilters() {
    this.searchFilters.page = 1;
    this.currentPage = 1;
    this.loadFichasTecnicas();
  }

  /**
   * Limpa todos os filtros
   */
  clearFilters() {
    this.searchFilters = {
      page: 1,
      limit: this.itemsPerPage
    };
    this.currentPage = 1;
    this.loadFichasTecnicas();
  }

  /**
   * Navega para uma página específica
   */
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.searchFilters.page = page;
      this.currentPage = page;
      this.loadFichasTecnicas();
    }
  }

  /**
   * Navega para visualização de ficha técnica
   */
  viewFicha(ficha: FichaTecnica) {
    this.router.navigate(['/fichas-tecnicas/view', ficha.id]);
  }

  /**
   * Navega para edição de ficha técnica
   */
  editFicha(ficha: FichaTecnica) {
    this.router.navigate(['/fichas-tecnicas/edit', ficha.id]);
  }

  /**
   * Imprime ficha técnica
   */
  printFicha(ficha: FichaTecnica) {
    // Criar conteúdo HTML para impressão
    const printContent = this.generatePrintContent(ficha);
    
    // Abrir nova janela para impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Aguardar carregamento e imprimir
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  }

  /**
   * Gera conteúdo HTML para impressão
   */
  private generatePrintContent(ficha: FichaTecnica): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ficha Técnica - ${ficha.codigoFormulaCerta}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .section { margin-bottom: 25px; }
          .section-title { background: #f0f0f0; padding: 8px; font-weight: bold; border-left: 4px solid #007bff; margin-bottom: 10px; }
          .field { margin-bottom: 8px; }
          .field-label { font-weight: bold; display: inline-block; width: 200px; }
          .field-value { display: inline-block; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FICHA TÉCNICA</h1>
          <h2>${ficha.produto}</h2>
          <p><strong>Código:</strong> ${ficha.codigoFormulaCerta}</p>
        </div>

        <div class="section">
          <div class="section-title">📋 INFORMAÇÕES BÁSICAS</div>
          <div class="field"><span class="field-label">Produto:</span> <span class="field-value">${ficha.produto}</span></div>
          <div class="field"><span class="field-label">Peso Molecular:</span> <span class="field-value">${ficha.pesoMolecular || '-'}</span></div>
          <div class="field"><span class="field-label">Fórmula Molecular:</span> <span class="field-value">${ficha.formulaMolecular || '-'}</span></div>
          <div class="field"><span class="field-label">DCB:</span> <span class="field-value">${ficha.dcb || '-'}</span></div>
          <div class="field"><span class="field-label">Nome Científico:</span> <span class="field-value">${ficha.nomeCientifico || '-'}</span></div>
          <div class="field"><span class="field-label">Revisão:</span> <span class="field-value">${ficha.revisao || '-'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">🧪 TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10</div>
          <div class="field"><span class="field-label">Análise:</span> <span class="field-value">${ficha.analise || '-'}</span></div>
          <div class="field"><span class="field-label">Características Organolépticas:</span> <span class="field-value">${ficha.caracteristicasOrganolepticas || '-'}</span></div>
          <div class="field"><span class="field-label">Solubilidade:</span> <span class="field-value">${ficha.solubilidade || '-'}</span></div>
          <div class="field"><span class="field-label">Faixa de pH:</span> <span class="field-value">${ficha.faixaPh || '-'}</span></div>
          <div class="field"><span class="field-label">Faixa de Fusão:</span> <span class="field-value">${ficha.faixaFusao || '-'}</span></div>
          <div class="field"><span class="field-label">Peso:</span> <span class="field-value">${ficha.peso || '-'}</span></div>
          <div class="field"><span class="field-label">Volume:</span> <span class="field-value">${ficha.volume || '-'}</span></div>
          <div class="field"><span class="field-label">Densidade com Compactação:</span> <span class="field-value">${ficha.densidadeComCompactacao || '-'}</span></div>
          <div class="field"><span class="field-label">Avaliação do Laudo:</span> <span class="field-value">${ficha.avaliacaoDoLaudo || '-'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">📊 INFORMAÇÕES ADICIONAIS - ITEM 7.3.11</div>
          <div class="field"><span class="field-label">Cinzas:</span> <span class="field-value">${ficha.cinzas || '-'}</span></div>
          <div class="field"><span class="field-label">Perda por Secagem:</span> <span class="field-value">${ficha.perdaPorSecagem || '-'}</span></div>
          <div class="field"><span class="field-label">Infravermelho:</span> <span class="field-value">${ficha.infraVermelho || '-'}</span></div>
          <div class="field"><span class="field-label">Ultravioleta:</span> <span class="field-value">${ficha.ultraVioleta || '-'}</span></div>
          <div class="field"><span class="field-label">Teor:</span> <span class="field-value">${ficha.teor || '-'}</span></div>
          <div class="field"><span class="field-label">Conservação:</span> <span class="field-value">${ficha.conservacao || '-'}</span></div>
          <div class="field"><span class="field-label">Observação:</span> <span class="field-value">${ficha.observacao01 || '-'}</span></div>
          <div class="field"><span class="field-label">Amostragem:</span> <span class="field-value">${ficha.amostragem || '-'}</span></div>
          <div class="field"><span class="field-label">Referência Bibliográfica:</span> <span class="field-value">${ficha.referenciaBibliografica || '-'}</span></div>
          <div class="field"><span class="field-label">Data de Análise:</span> <span class="field-value">${this.formatDate(ficha.dataDeAnalise)}</span></div>
        </div>

        <div class="section" style="margin-top: 30px; text-align: center; font-size: 0.9em; color: #666;">
          <p>Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Abre modal de confirmação para exclusão
   */
  openDeleteModal(ficha: FichaTecnica) {
    this.fichaToDelete = ficha;
    this.showDeleteModal = true;
  }

  /**
   * Fecha modal de confirmação
   */
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.fichaToDelete = null;
  }

  /**
   * Confirma e executa a exclusão
   */
  confirmDelete() {
    if (!this.fichaToDelete) return;

    this.loading.set(true);
    
    this.fichaTecnicaService.remove(this.fichaToDelete.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadFichasTecnicas();
      },
      error: (error: any) => {
        console.error('Erro ao excluir ficha técnica:', error);
        this.error.set('Erro ao excluir ficha técnica. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  hasPermission(permission: Permission): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * Formata data para exibição
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }

  /**
   * Gera array de páginas para paginação
   */
  get pageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  /**
   * Verifica se há página anterior
   */
  get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  /**
   * Verifica se há próxima página
   */
  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }
}