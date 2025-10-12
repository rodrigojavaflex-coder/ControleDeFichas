import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { LaudoService } from '../../services/laudo.service';
import { FormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../services/ficha-tecnica.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { 
  FichaTecnica, 
  FindFichaTecnicaDto,
  FichaTecnicaPaginatedResponse
} from '../../models/ficha-tecnica.model';
import { Permission } from '../../models/usuario.model';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, filter } from 'rxjs';
import { CertificadoService, Certificado } from '../../services/certificado.service';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-ficha-tecnica-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    ConfirmationModalComponent,
    HistoricoAuditoriaComponent
  ],
  templateUrl: './ficha-tecnica-list.html',
  styleUrls: ['./ficha-tecnica-list.css']
})
export class FichaTecnicaListComponent implements OnInit, OnDestroy {
  /**
   * Imprime o certificado após buscar a ficha completa
   */
  printCertificado(certificado: Certificado) {
    const fichaId = certificado.fichaTecnica?.id;
    if (!fichaId) {
      alert('Ficha técnica não vinculada ao certificado.');
      return;
    }
    this.fichaTecnicaService.findOne(fichaId).subscribe({
      next: (ficha: FichaTecnica) => {
        const printContent = this.generateCertificadoPrintContent(certificado, ficha);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.focus();
          // Removido o fechamento automático para não travar a edição
          setTimeout(() => {
            printWindow.print();
          }, 100);
        }
      },
      error: () => alert('Erro ao buscar ficha técnica para impressão.')
    });
  }

  /**
   * Carrega laudos para um certificado específico
   */
  private loadLaudos(certificadoId: string): void {
    // Marcar carregamento
    this.loadingLaudos.update(set => new Set(set).add(certificadoId));
    this.laudoService.getLaudos(certificadoId).subscribe({
      next: (laudos) => {
        // Atualizar sinal de laudos
        this.laudosPorCertificado.update(map => {
          const newMap = new Map(map);
          newMap.set(certificadoId, laudos);
          return newMap;
        });
        // Remover do set de carregamento
        this.loadingLaudos.update(set => {
          const newSet = new Set(set);
          newSet.delete(certificadoId);
          return newSet;
        });
      },
      error: (error) => {
        console.error('Erro ao carregar laudos:', error);
        this.loadingLaudos.update(set => {
          const newSet = new Set(set);
          newSet.delete(certificadoId);
          return newSet;
        });
      }
    });
  }

  /**
   * Abre um laudo em nova aba
   */
  public openLaudo(certificadoId: string, laudoId: string): void {
    this.laudoService.downloadLaudo(certificadoId, laudoId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: (error) => console.error('Erro ao abrir laudo:', error)
    });
  }

  /**
   * Remove um laudo do certificado
   */
  public removeLaudo(certificadoId: string, laudoId: string): void {
    this.laudoService.remove(certificadoId, laudoId).subscribe({
      next: () => this.loadLaudos(certificadoId),
      error: (error) => console.error('Erro ao remover laudo:', error)
    });
  }
  /**
   * Seleciona e faz upload de um arquivo de laudo
   */
  public onLaudoFileSelected(certificadoId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    // Validar tipo PDF
    if (file.type !== 'application/pdf') {
      alert('Somente arquivos PDF são permitidos.');
      input.value = '';
      return;
    }
    // Validar tamanho (100KB)
    if (file.size > 100 * 1024) {
      alert('O arquivo deve ter no máximo 100KB.');
      input.value = '';
      return;
    }
    // Upload automático
    this.laudoService.uploadLaudo(certificadoId, file).subscribe({
      next: () => {
        input.value = '';
        this.loadLaudos(certificadoId);
      },
      error: (err) => {
        console.error('Erro ao enviar laudo:', err);
        alert('Erro ao enviar laudo.');
      }
    });
  }

  /**
   * Gera conteúdo HTML para impressão do certificado com dados da ficha
   */
  generateCertificadoPrintContent(certificado: Certificado, ficha: FichaTecnica): string {
    // Preparar logo e informações do usuário para rodapé
    let logoHtml = '';
    if (this.configuracao?.logoRelatorio) {
      const backendUrl = environment.apiUrl.replace(/\/api$/, '');
      const logoUrl = this.configuracao.logoRelatorio.startsWith('/uploads')
        ? backendUrl + this.configuracao.logoRelatorio
        : this.configuracao.logoRelatorio;
      logoHtml = `<img src="${logoUrl}" alt="Logo" style="height:40px;"/>`;
    }
    const userName = this.authService.getCurrentUser()?.nome || 'Usuário';
    const printedAt = new Date().toLocaleString();

    // Cabeçalho do Certificado (compacto)
    const headerHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 0.8em; margin-bottom: 20px;">
        <div><strong>Número Certificado:</strong> ${certificado.numeroDoCertificado || '-'}</div>
        <div><strong>Produto:</strong> ${ficha.produto}</div>
        <div><strong>Lote:</strong> ${certificado.loteDoCertificado}</div>
        <div><strong>Fornecedor:</strong> ${certificado.fornecedor}</div>
        <div><strong>Número Pedido:</strong> ${certificado.numeroDoPedido}</div>
        <div><strong>Quantidade:</strong> ${certificado.quantidade}</div>
        <div><strong>Data Certificado:</strong> ${certificado.dataCertificado}</div>
        <div><strong>Data Fabricação:</strong> ${certificado.dataDeFabricacao}</div>
        <div><strong>Data Validade:</strong> ${certificado.dataDeValidade}</div>
      </div>
    `;

    // Definição de campos para comparação baseado no tipo da ficha
    const fieldsConfig: Array<{label: string, fichaKey: keyof FichaTecnica, certKey: keyof Certificado}> =
      ficha.tipoDaFicha === 'FITOTERÁPICO'
        ? [
            {label: 'Características Organolépticas', fichaKey: 'caracteristicasOrganolepticas', certKey: 'caracteristicasOrganolepticas'},
            {label: 'Solubilidade', fichaKey: 'solubilidade', certKey: 'solubilidade'},
            {label: 'Faixa pH', fichaKey: 'faixaPh', certKey: 'faixaPh'},
            {label: 'Faixa Fusão', fichaKey: 'faixaFusao', certKey: 'faixaFusao'},
            {label: 'Peso', fichaKey: 'peso', certKey: 'peso'},
            {label: 'Volume', fichaKey: 'volume', certKey: 'volume'},
            {label: 'Densidade sem Compactação', fichaKey: 'densidadeComCompactacao', certKey: 'densidadeSemCompactacao'},
            {label: 'Determinação de Materiais Estranhos', fichaKey: 'determinacaoMateriaisEstranhos', certKey: 'determinacaoMateriaisEstranhos'},
            {label: 'Pesquisas de Contaminação Microbiológica', fichaKey: 'pesquisasDeContaminacaoMicrobiologica', certKey: 'pesquisasDeContaminacaoMicrobiologica'},
            {label: 'Umidade', fichaKey: 'umidade', certKey: 'umidade'},
            {label: 'Cinzas', fichaKey: 'cinzas', certKey: 'cinzas'},
            {label: 'Caracteres Microscópicos', fichaKey: 'caracteresMicroscopicos', certKey: 'caracteresMicroscopicos'},
            {label: 'Infravermelho', fichaKey: 'infraVermelho', certKey: 'infraVermelho'},
            {label: 'Ultravioleta', fichaKey: 'ultraVioleta', certKey: 'ultraVioleta'},
            {label: 'Teor', fichaKey: 'teor', certKey: 'teor'},
            {label: 'Conservação', fichaKey: 'conservacao', certKey: 'conservacao'},
          ]
        : [ // MATÉRIA PRIMA
            {label: 'Características Organolépticas', fichaKey: 'caracteristicasOrganolepticas', certKey: 'caracteristicasOrganolepticas'},
            {label: 'Solubilidade', fichaKey: 'solubilidade', certKey: 'solubilidade'},
            {label: 'Faixa pH', fichaKey: 'faixaPh', certKey: 'faixaPh'},
            {label: 'Faixa Fusão', fichaKey: 'faixaFusao', certKey: 'faixaFusao'},
            {label: 'Peso', fichaKey: 'peso', certKey: 'peso'},
            {label: 'Volume', fichaKey: 'volume', certKey: 'volume'},
            {label: 'Densidade sem Compactação', fichaKey: 'densidadeComCompactacao', certKey: 'densidadeSemCompactacao'},
            {label: 'Perda por Secagem', fichaKey: 'perdaPorSecagem', certKey: 'perdaPorSecagem'},
            {label: 'Infravermelho', fichaKey: 'infraVermelho', certKey: 'infraVermelho'},
            {label: 'Ultravioleta', fichaKey: 'ultraVioleta', certKey: 'ultraVioleta'},
            {label: 'Teor', fichaKey: 'teor', certKey: 'teor'},
            {label: 'Conservação', fichaKey: 'conservacao', certKey: 'conservacao'},
          ];

    const rowsHtml = fieldsConfig.map(f => `
      <tr>
        <td>${f.label}</td>
        <td>${(ficha[f.fichaKey] as string) || '-'}</td>
        <td>${(certificado[f.certKey] as string) || '-'}</td>
      </tr>
    `).join('');

    // Monta HTML final

    // Monta HTML final
    return `<!DOCTYPE html>
<html>
<head>
  <title>Certificado ${certificado.numeroDoCertificado} - ${ficha.produto}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 15px; font-size: 0.67em; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; }
    th { background: #f4f4f4; }
    .footer-print { font-size: 0.7em; color: #444; margin-top: 20px; text-align: center; }
    /* Cabeçalho com logo */
    .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .logo-box { flex: 0 0 auto; margin-right: 20px; }
    .header-content { flex: 1 1 auto; text-align: center; }
    .header-title { margin: 0; font-size: 2.08em; font-weight: bold; }
    .header-row { display: flex; gap: 24px; margin-top: 6px; font-size: 1em; justify-content: center; }
    .header-row span { font-weight: bold; }
    .footer-print-logo { max-height: 40px; display: block; margin: 0 auto 8px; }
    @media print {
      @page {
        size: auto;
        margin: 15mm 10mm 40px 10mm;
      }
      body { margin: 10px; }
      .footer-print {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        padding: 5px;
        border-top: 1px solid #ccc;
      }
    }
  </style>
</head>
<body>
  <!-- Cabeçalho do relatório com logo -->
  <div class="header">
    <div class="logo-box">${logoHtml}</div>
    <div class="header-content">
      <h1 class="header-title">Certificado de Análise Físico Química</h1>
      <div class="header-row">
        ${ficha.codigoFormulaCerta ? `<div>${ficha.codigoFormulaCerta}</div>` : ''}
        ${ficha.produto ? `<div>${ficha.produto}</div>` : ''}
      </div>
    </div>
  </div>
  ${headerHtml}
  <h2 style="text-align: center; font-size: 1.5em;">Testes Realizados</h2>
  <table>
    <thead>
      <tr><th style="width: 20%;">Análise</th><th style="width: 40%;">Especificação</th><th style="width: 40%;">Resultado</th></tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div style="margin-top: 20px;">
    <p><strong>Avaliação do Laudo:</strong> ${certificado.avaliacaoDoLaudo || '-'}</p>
    <p><strong>Referência Bibliográfica:</strong> ${ficha.referenciaBibliografica || '-'}</p>
    <p><strong>Observação:</strong> ${certificado.observacao01 || '-'}</p>
  </div>
  <div style="display: flex; justify-content: space-between; margin-top: 40px;">
    <div style="width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 10px;">Assinatura do Analista</div>
    <div style="width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 10px;">Validação do Responsável Técnico</div>
  </div>
  <div class="footer-print">
    <div>Documento gerado em ${printedAt} Impresso por: ${userName}</div>
  </div>
</body>
</html>`;
  }
  private fichaTecnicaService = inject(FichaTecnicaService);
  private route = inject(ActivatedRoute);
  private certificadoService = inject(CertificadoService);
  public authService = inject(AuthService);
  private router = inject(Router);

  // Exportar Permission para uso no template
  Permission = Permission;

  // Subject para debounce da pesquisa
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

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
  // Mensagem exibida no modal de confirmação (pode ser sobrescrita com erro específico)
  deleteMessage = 'Tem certeza de que deseja excluir esta ficha técnica? Esta ação não pode ser desfeita.';

  // Modal de auditoria
  showAuditModal = false;
  selectedFichaForAudit: FichaTecnica | null = null;

  // Controle de expansão e certificados
  expandedFichas = new Set<string>();
  certificadosPorFicha = signal<Map<string, Certificado[]>>(new Map());
  loadingCertificados = signal<Set<string>>(new Set());
  // Laudos por certificado
  laudosPorCertificado = signal<Map<string, any[]>>(new Map());
  loadingLaudos = signal<Set<string>>(new Set());
  private fichaToExpand: string | null = null;

  // Controle de dropdowns
  dropdownsAbertos = signal<Set<string>>(new Set());
  // Controle de dropdowns de certificados
  certDropdownsAbertos = signal<Set<string>>(new Set());

  private configuracaoService = inject(ConfiguracaoService);
  configuracao: Configuracao | null = null;
  private laudoService = inject(LaudoService);

  // Modal de confirmação para exclusão de certificado
  showDeleteCertModal = false;
  certificadoToDelete: Certificado | null = null;
  deleteCertMessageCert = '';

  // Modal de confirmação para exclusão de laudo
  showDeleteLaudoModal = false;
  laudoToDelete: { certificadoId: string; laudoId: string; nomeArquivo: string } | null = null;
  deleteLaudoMessage = '';

  // Modal de auditoria de certificado
  showCertAuditModal = false;
  selectedCertForAudit: Certificado | null = null;

  ngOnInit() {
    // Capturar possível ficha para expandir via query param
    this.route.queryParams.subscribe(params => {
      // Expansão de ficha, se informada
      if (params['fichaTecnicaId']) {
        this.fichaToExpand = params['fichaTecnicaId'];
      }
      // Aplicar filtros vindos da URL, se existirem
      if (params['tipoDaFicha']) this.searchFilters.tipoDaFicha = params['tipoDaFicha'];
      if (params['produto']) this.searchFilters.produto = params['produto'];
      if (params['codigoFormulaCerta']) this.searchFilters.codigoFormulaCerta = params['codigoFormulaCerta'];
      if (params['dataInicialAnalise']) this.searchFilters.dataInicialAnalise = params['dataInicialAnalise'];
      if (params['dataFinalAnalise']) this.searchFilters.dataFinalAnalise = params['dataFinalAnalise'];
      if (params['page']) {
        this.searchFilters.page = +params['page'];
        this.currentPage = +params['page'];
      }
      // Carregar lista com filtros aplicados
      this.loadFichasTecnicas();
    });

    // Recarregar dados quando voltar para a rota (após edição)
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        filter((event: NavigationEnd) => event.url.startsWith('/fichas-tecnicas') && !event.url.includes('/edit') && !event.url.includes('/new')),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Recarregar dados quando voltar para a lista
        this.loadFichasTecnicas();
      });
    
    // Configurar debounce para pesquisa por produto
    this.searchSubject
      .pipe(
        debounceTime(500), // Aguarda 500ms após parar de digitar
        distinctUntilChanged(), // Só executa se o valor mudou
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.applyFilters();
      });
    
    // Buscar configuração para o logo do relatório
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => {
        this.configuracao = config;
      },
      error: () => {
        this.configuracao = null;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
        // Expandir ficha técnica especificada, se houver
        if (this.fichaToExpand) {
          this.toggleExpand(this.fichaToExpand);
          this.fichaToExpand = null;
        }
      },
      error: (error: any) => {
        console.error('Erro ao carregar fichas técnicas:', error);
        this.error.set('Erro ao carregar fichas técnicas. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Aplica os filtros de pesquisa e atualiza URL
   */
  applyFilters() {
    this.searchFilters.page = 1;
    this.currentPage = 1;
    // Atualizar query params com filtros
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.searchFilters,
      queryParamsHandling: 'merge'
    });
    this.loadFichasTecnicas();
  }

  /**
   * Pesquisa por produto com debounce
   */
  onProductSearch() {
    this.searchSubject.next(this.searchFilters.produto || '');
  }

  /**
   * Limpa todos os filtros e atualiza URL
   */
  clearFilters() {
    this.searchFilters = {
      page: 1,
      limit: this.itemsPerPage
    };
    this.currentPage = 1;
    // Remover filtros da URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
    this.loadFichasTecnicas();
  }

  /**
   * Navega para uma página específica e atualiza URL
   */
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.searchFilters.page = page;
      this.currentPage = page;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page },
        queryParamsHandling: 'merge'
      });
      this.loadFichasTecnicas();
    }
  }

  /**
   * Navega para visualização de ficha técnica
   */

  // Visualiza o relatório em tela maximizada, sem opção de impressão
  viewFicha(ficha: FichaTecnica) {
    const reportHtml = this.generatePrintContentWithUser(ficha, { hidePrint: true });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
      win.focus();
      win.moveTo(0, 0);
      win.resizeTo(screen.availWidth, screen.availHeight);
    }
  }

  /**
   * Navega para edição de ficha técnica
   */
  editFicha(ficha: FichaTecnica) {
    // Navega para edição mantendo filtros atualizados e marcando ficha para expansão
    this.router.navigate(
      ['/fichas-tecnicas/edit', ficha.id],
      { 
        queryParams: { ...this.searchFilters, fichaTecnicaId: ficha.id },
        queryParamsHandling: 'merge'
      }
    );
  }

  /**
   * Navega para criação de novo certificado (mantendo filtros)
   */
  novoCertificado(ficha: FichaTecnica) {
    // Passa filtros atuais para preservar estado ao voltar
    this.router.navigate(
      ['/certificados/new'],
      { queryParams: { fichaTecnicaId: ficha.id, ...this.searchFilters } }
    );
  }

  /**
   * Visualiza certificado
   */
  viewCertificado(certificado: Certificado) {
    // TODO: Implementar visualização de certificado
    console.log('Visualizar certificado:', certificado);
  }

  /**
   * Edita certificado (mantendo filtros)
   */
  editCertificado(certificado: Certificado) {
    // Passa filtros atuais e fichaId para retorno
    const fichaId = certificado.fichaTecnica?.id;
    this.router.navigate(
      ['/certificados/edit', certificado.id],
      { queryParams: { fichaTecnicaId: fichaId, ...this.searchFilters } }
    );
  }

  /**
   * Exclui certificado
   */
  deleteCertificado(certificado: Certificado) {
    // Executa exclusão após confirmação
    this.certificadoService.delete(certificado.id).subscribe({
      next: () => {
        this.certificadosPorFicha.update(map => {
          const newMap = new Map(map);
          const fichaId = certificado.fichaTecnica?.id;
          if (fichaId && newMap.has(fichaId)) {
            const list = newMap.get(fichaId) || [];
            newMap.set(fichaId, list.filter(c => c.id !== certificado.id));
          }
          return newMap;
        });
        this.closeDeleteCertModal();
      },
      error: (err) => {
        console.error('Erro ao excluir certificado:', err);
        alert('Erro ao excluir certificado. Tente novamente.');
      }
    });
  }

  // Abre modal para confirmação de exclusão do certificado
  openDeleteCertModal(certificado: Certificado) {
    this.certificadoToDelete = certificado;
    this.deleteCertMessageCert = `Deseja realmente excluir o certificado ${certificado.numeroDoCertificado}?`;
    this.showDeleteCertModal = true;
  }
  
  // Fecha modal de exclusão de certificado sem ação
  closeDeleteCertModal() {
    this.showDeleteCertModal = false;
    this.certificadoToDelete = null;
  }
  
  // Confirma exclusão de certificado via modal
  confirmDeleteCertificado() {
    if (this.certificadoToDelete) {
      this.deleteCertificado(this.certificadoToDelete);
    }
  }

  // Abre modal de confirmação para exclusão de laudo
  confirmRemoveLaudo(certificadoId: string, laudoId: string, nomeArquivo: string) {
    this.laudoToDelete = { certificadoId, laudoId, nomeArquivo };
    this.deleteLaudoMessage = `Deseja excluir o laudo "${nomeArquivo}"?`;
    this.showDeleteLaudoModal = true;
  }

  // Fecha modal de exclusão de laudo sem ação
  closeDeleteLaudoModal() {
    this.showDeleteLaudoModal = false;
    this.laudoToDelete = null;
  }

  // Confirma exclusão de laudo via modal
  confirmDeleteLaudo() {
    if (this.laudoToDelete) {
      this.laudoService.remove(this.laudoToDelete.certificadoId, this.laudoToDelete.laudoId).subscribe({
        next: () => {
          this.loadLaudos(this.laudoToDelete!.certificadoId);
          this.closeDeleteLaudoModal();
        },
        error: (error) => {
          console.error('Erro ao remover laudo:', error);
          this.closeDeleteLaudoModal();
        }
      });
    }
  }

  /**
   * Formata texto convertendo quebras de linha para HTML
   */
  private formatTextForHtml(text: string | null | undefined): string {
    if (!text) return '-';
    return text.replace(/\n/g, '<br>');
  }

  /**
   * Imprime ficha técnica
   */
  printFicha(ficha: FichaTecnica) {
  // Criar conteúdo HTML para impressão com nome do usuário
  const printContent = this.generatePrintContentWithUser(ficha);
    
    // Abrir nova aba para impressão
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Aguardar carregamento e imprimir (sem fechar automaticamente)
      setTimeout(() => {
        printWindow.print();
      }, 100);
    }
  }
  /**
   * Abrir modal de histórico de auditoria de certificado
   */
  public openCertAuditHistory(cert: Certificado) {
    this.selectedCertForAudit = cert;
    this.showCertAuditModal = true;
  }

  /**
   * Fechar modal de auditoria de certificado
   */
  public closeCertAuditModal() {
    this.showCertAuditModal = false;
    this.selectedCertForAudit = null;
  }

  /**
   * Gera conteúdo HTML para impressão
   */


  /**
   * Gera o conteúdo de impressão com nome do usuário
   */
  public generatePrintContentWithUser(ficha: FichaTecnica, opts?: { hidePrint?: boolean }): string {
    let logoHtml = '';
    if (this.configuracao?.logoRelatorio) {
      const backendUrl = environment.apiUrl.replace(/\/api$/, '');
      const logoUrl = this.configuracao.logoRelatorio.startsWith('/uploads')
        ? backendUrl + this.configuracao.logoRelatorio
        : this.configuracao.logoRelatorio;
      logoHtml = `<img src="${logoUrl}" alt="Logo" style="max-height: 80px; max-width: 120px; display: block;" />`;
    }
    const user = this.authService.getCurrentUser();
    const userName = user?.nome || 'Usuário';
    const dataAnalise = this.formatDate(ficha.dataDeAnalise);

    // Garante que o <body> começa diretamente pelo header, sem nada antes
    // Define nome do relatório para impressão/salvar
    const hidePrint = opts?.hidePrint;
    const tipo = ficha.tipoDaFicha ? ficha.tipoDaFicha.toLowerCase().replace('é', 'e').replace('á', 'a') : 'ficha';
    const tipoNome = tipo === 'fitoterapico' ? 'fitoterapico' : 'materia-prima';
    const codigo = ficha.codigoFormulaCerta || '';
    const nomeRelatorio = `ficha-tecnica-${tipoNome}${codigo ? '-' + codigo : ''}`;
    return `<!DOCTYPE html>
      <html>
      <head>
        <title>${nomeRelatorio}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 15px; line-height: 1.3; font-size: 0.67em; }
          .header { display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .logo-box { flex: 0 0 auto; margin-right: 20px; }
          .header-content { flex: 1 1 auto; text-align: center; }
          .header-title { margin: 0; font-size: 1.6em; font-weight: bold; }
          .header-row { display: flex; gap: 24px; margin-top: 6px; font-size: 1em; justify-content: center; }
          .header-row span { font-weight: bold; }
          .section { margin-bottom: 18px; }
          .section-title { background: #f0f0f0; padding: 6px; font-weight: bold; border-left: 4px solid #007bff; margin-bottom: 8px; font-size: 0.95em; }
          .field { margin-bottom: 5px; }
          .field-label { font-weight: bold; display: inline-block; width: 180px; font-size: 0.9em; }
          .field-value { display: inline-block; font-size: 0.9em; }
          .footer-print { font-size: 0.9em; color: #444; margin-top: 25px; text-align: center; ${hidePrint ? 'display:none;' : ''} }
          ${hidePrint ? '' : `@media print {
            @page {
              size: auto;
              margin: 15mm 10mm 40px 10mm;
            }
            body { margin: 10px; }
            .section { margin-bottom: 15px; }
            .field { margin-bottom: 4px; }
          }`}
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">${logoHtml}</div>
          <div class="header-content">
            <h1 class="header-title">FICHA TÉCNICA${ficha.tipoDaFicha ? ' - ' + (ficha.tipoDaFicha === 'FITOTERÁPICO' ? 'FITOTERÁPICO' : 'MATÉRIA PRIMA') : ''}</h1>
            <div class="header-row">
              ${ficha.codigoFormulaCerta ? `<div>${ficha.codigoFormulaCerta}</div>` : ''}
              ${ficha.produto ? `<div>${ficha.produto}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">INFORMAÇÕES BÁSICAS</div>
          <div class="field"><span class="field-label">Produto:</span> <span class="field-value">${ficha.produto}</span></div>
          <div class="field"><span class="field-label">Peso Molecular:</span> <span class="field-value">${ficha.pesoMolecular || '-'}</span></div>
          <div class="field"><span class="field-label">Fórmula Molecular:</span> <span class="field-value">${ficha.formulaMolecular || '-'}</span></div>
          <div class="field"><span class="field-label">DCB:</span> <span class="field-value">${ficha.dcb || '-'}</span></div>
          <div class="field"><span class="field-label">Nome Científico:</span> <span class="field-value">${ficha.nomeCientifico || '-'}</span></div>
          <div class="field"><span class="field-label">Revisão:</span> <span class="field-value">${ficha.revisao || '-'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10</div>
          <div class="field"><span class="field-label">Características Organolépticas:</span> <span class="field-value">${this.formatTextForHtml(ficha.caracteristicasOrganolepticas)}</span></div>
          <div class="field"><span class="field-label">Solubilidade:</span> <span class="field-value">${ficha.solubilidade ? ficha.solubilidade.replace(/\n/g, '<br>') : '-'}</span></div>
          <div class="field"><span class="field-label">Faixa de pH:</span> <span class="field-value">${ficha.faixaPh || '-'}</span></div>
          <div class="field"><span class="field-label">Faixa de Fusão:</span> <span class="field-value">${ficha.faixaFusao || '-'}</span></div>
          <div class="field"><span class="field-label">Peso:</span> <span class="field-value">${ficha.peso || '-'}</span></div>
          <div class="field"><span class="field-label">Volume:</span> <span class="field-value">${ficha.volume || '-'}</span></div>
          <div class="field"><span class="field-label">Densidade sem Compactação:</span> <span class="field-value">${ficha.densidadeComCompactacao || '-'}</span></div>
          ${ficha.tipoDaFicha === 'FITOTERÁPICO' ? `
            <div class="field"><span class="field-label">Determinação de Materiais Estranhos:</span> <span class="field-value">${ficha.determinacaoMateriaisEstranhos ? ficha.determinacaoMateriaisEstranhos.replace(/\n/g, '<br>') : '-'}</span></div>
            <div class="field"><span class="field-label">Pesquisas de Contaminação Microbiológica:</span> <span class="field-value">${ficha.pesquisasDeContaminacaoMicrobiologica ? ficha.pesquisasDeContaminacaoMicrobiologica.replace(/\n/g, '<br>') : '-'}</span></div>
            <div class="field"><span class="field-label">Umidade:</span> <span class="field-value">${ficha.umidade || '-'}</span></div>
            <div class="field"><span class="field-label">Cinzas:</span> <span class="field-value">${ficha.cinzas || '-'}</span></div>
            <div class="field"><span class="field-label">Caracteres Microscópicos:</span> <span class="field-value">${ficha.caracteresMicroscopicos ? ficha.caracteresMicroscopicos.replace(/\n/g, '<br>') : '-'}</span></div>
          ` : ''}
          <div class="field"><span class="field-label">Avaliação do Laudo:</span> <span class="field-value">${ficha.avaliacaoDoLaudo ? ficha.avaliacaoDoLaudo.replace(/\n/g, '<br>') : '-'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">INFORMAÇÕES ADICIONAIS - ITEM 7.3.11</div>
          ${ficha.tipoDaFicha !== 'FITOTERÁPICO' ? `
            <div class="field"><span class="field-label">Cinzas:</span> <span class="field-value">${ficha.cinzas || '-'}</span></div>
            <div class="field"><span class="field-label">Perda por Secagem:</span> <span class="field-value">${ficha.perdaPorSecagem || '-'}</span></div>
          ` : ''}
          <div class="field"><span class="field-label">Infravermelho:</span> <span class="field-value">${ficha.infraVermelho ? ficha.infraVermelho.replace(/\n/g, '<br>') : '-'}</span></div>
          <div class="field"><span class="field-label">Ultravioleta:</span> <span class="field-value">${ficha.ultraVioleta ? ficha.ultraVioleta.replace(/\n/g, '<br>') : '-'}</span></div>
          <div class="field"><span class="field-label">Teor:</span> <span class="field-value">${ficha.teor ? ficha.teor.replace(/\n/g, '<br>') : '-'}</span></div>
          <div class="field"><span class="field-label">Conservação:</span> <span class="field-value">${ficha.conservacao ? ficha.conservacao.replace(/\n/g, '<br>') : '-'}</span></div>
          <div class="field"><span class="field-label">Observação:</span> <span class="field-value">${this.formatTextForHtml(ficha.observacao01)}</span></div>
          <div class="field"><span class="field-label">Amostragem:</span> <span class="field-value">${this.formatTextForHtml(ficha.amostragem)}</span></div>
          <div class="field"><span class="field-label">Referência Bibliográfica:</span> <span class="field-value">${this.formatTextForHtml(ficha.referenciaBibliografica)}</span></div>
          <div class="field"><span class="field-label">Data de Análise:</span> <span class="field-value">${dataAnalise}</span></div>
        </div>
        <div style="height: 50px;"></div>
        <hr style="margin: 0 auto 8px auto; border: none; border-top: 1.5px solid #888; width: 60%;" />
        <div style="text-align: center; font-size: 1em; margin-bottom: 2px;">
          ${this.configuracao?.farmaceuticoResponsavel || ''}
        </div>
        <div style="text-align: center; font-size: 0.9em; color: #444;">
          Farmacêutico Responsável
        </div>
        <div class="footer-print">
          Documento gerado em ${new Date().toLocaleString('pt-BR')}  Impresso por: ${userName}
        </div>
        <style>
          @media print {
            .footer-print {
              position: fixed;
              bottom: 0;
              left: 0;
              width: 100vw;
              font-size: 0.72em !important;
              color: #444;
              text-align: center;
              z-index: 1000;
            }
          }
        </style>
      </body>
      </html>`;
  }


  /**
   * Abre modal de confirmação para exclusão
   */
  public openDeleteModal(ficha: FichaTecnica) {
    this.fichaToDelete = ficha;
  this.deleteMessage = 'Tem certeza de que deseja excluir esta ficha técnica? Esta ação não pode ser desfeita.';
  this.showDeleteModal = true;
  }

  /**
   * Fecha modal de confirmação
   */
  public closeDeleteModal() {
    this.showDeleteModal = false;
    this.fichaToDelete = null;
  }

  /**
   * Abrir modal de histórico de auditoria
   */
  public openAuditHistory(ficha: FichaTecnica) {
    this.selectedFichaForAudit = ficha;
    this.showAuditModal = true;
  }

  /**
   * Fechar modal de auditoria
   */
  public closeAuditModal() {
    this.showAuditModal = false;
    this.selectedFichaForAudit = null;
  }

  /**
   * Confirma e executa a exclusão
   */
  public confirmDelete() {
    if (!this.fichaToDelete) return;
    this.loading.set(true);
    this.fichaTecnicaService.remove(this.fichaToDelete.id).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadFichasTecnicas();
      },
      error: (error: any) => {
        console.error('Erro ao excluir ficha técnica:', error);
        // Exibir erro específico no modal
        const msg = error?.error?.message || error.message || 'Erro ao excluir ficha técnica.';
        this.deleteMessage = msg;
        this.loading.set(false);
        // Manter modal aberto para visualização do erro
        this.showDeleteModal = true;
      }
    });
  }

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  public hasPermission(permission: Permission): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * Formata data para exibição
   */
  public formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    // Interpreta string 'YYYY-MM-DD' como data local, evitando UTC
    const parts = dateString.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('pt-BR');
  }

  /**
   * Gera array de páginas para paginação
   */
  public get pageNumbers(): number[] {
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
  public get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  /**
   * Verifica se há próxima página
   */
  public get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }

  // Controle de expansão e certificados
  toggleExpand(fichaId: string) {
    if (this.expandedFichas.has(fichaId)) {
      this.expandedFichas.delete(fichaId);
      this.closeDropdown(fichaId); // Fecha o dropdown ao fechar o card
    } else {
      this.expandedFichas.add(fichaId);
      this.loadCertificados(fichaId);
    }
  }

  isExpanded(fichaId: string): boolean {
    return this.expandedFichas.has(fichaId);
  }

  // Controle de dropdowns
  toggleDropdown(fichaId: string) {
    this.dropdownsAbertos.update(set => {
      const newSet = new Set(set);
      if (newSet.has(fichaId)) {
        newSet.delete(fichaId);
      } else {
        newSet.add(fichaId);
      }
      return newSet;
    });
  }

  isDropdownOpen(fichaId: string): boolean {
    return this.dropdownsAbertos().has(fichaId);
  }

  // Métodos para dropdowns de certificado
  toggleCertDropdown(certId: string) {
    this.certDropdownsAbertos.update(set => {
      const newSet = new Set(set);
      if (newSet.has(certId)) newSet.delete(certId);
      else newSet.add(certId);
      return newSet;
    });
  }

  isCertDropdownOpen(certId: string): boolean {
    return this.certDropdownsAbertos().has(certId);
  }

  closeCertDropdown(certId: string) {
    this.certDropdownsAbertos.update(set => {
      const newSet = new Set(set);
      newSet.delete(certId);
      return newSet;
    });
  }

  closeDropdown(fichaId: string) {
    this.dropdownsAbertos.update(set => {
      const newSet = new Set(set);
      newSet.delete(fichaId);
      return newSet;
    });
  }

  private loadCertificados(fichaId: string) {
    if (this.certificadosPorFicha().has(fichaId)) {
      return; // Já carregados
    }

    this.loadingCertificados.update(set => new Set(set).add(fichaId));

    this.certificadoService.findByFichaTecnica(fichaId).subscribe({
      next: (certificados) => {
        this.certificadosPorFicha.update(map => {
          const newMap = new Map(map);
          newMap.set(fichaId, certificados);
          return newMap;
        });
        this.loadingCertificados.update(set => {
          const newSet = new Set(set);
          newSet.delete(fichaId);
          return newSet;
        });
        // Carregar laudos para cada certificado
        certificados.forEach(certificado => {
          this.loadLaudos(certificado.id);
        });
      },
      error: (error) => {
        console.error('Erro ao carregar certificados:', error);
        this.loadingCertificados.update(set => {
          const newSet = new Set(set);
          newSet.delete(fichaId);
          return newSet;
        });
      }
    });
  }

  getCertificados(fichaId: string): Certificado[] {
    return this.certificadosPorFicha().get(fichaId) || [];
  }

  isLoadingCertificados(fichaId: string): boolean {
    return this.loadingCertificados().has(fichaId);
  }
  /**
   * Verifica se laudos estão sendo carregados para um certificado
   */
  public isLoadingLaudos(certificadoId: string): boolean {
    return this.loadingLaudos().has(certificadoId);
  }
  /**
   * Retorna laudos carregados para um certificado
   */
  public getLaudos(certificadoId: string): any[] {
    return this.laudosPorCertificado().get(certificadoId) || [];
  }
}