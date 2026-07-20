import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { MigracaoService, MigracaoResult, MigracaoProgress, MigracaoCadastrosProgress } from '../../services/migracao.service';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { SincronizacaoConfig, SincronizacaoResult, SincronizacaoProgress } from '../../models/sincronizacao.model';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { FechamentoCaixaService } from '../../services/fechamento-caixa.service';
import { CaixaSaldoInicialUnidade } from '../../models/fechamento-caixa.model';
import { ImportarCaixaErpModalComponent } from '../../components/importar-caixa-erp-modal/importar-caixa-erp-modal';
import { ImportarProducaoEtapasModalComponent } from '../../components/importar-producao-etapas-modal/importar-producao-etapas-modal';
import { ImportarOrcamentosModalComponent } from '../../components/importar-orcamentos-modal/importar-orcamentos-modal';
import { ImportarVincularCodigoFuncionarioModalComponent } from '../../components/importar-vincular-codigo-funcionario-modal/importar-vincular-codigo-funcionario-modal';
import { Permission, Unidade } from '../../models/usuario.model';

type SaldoCaixaFormItem = CaixaSaldoInicialUnidade & {
  saldoInicialDisplay: string;
};

@Component({
  selector: 'app-configuracao',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ImportarCaixaErpModalComponent, ImportarProducaoEtapasModalComponent, ImportarOrcamentosModalComponent, ImportarVincularCodigoFuncionarioModalComponent],
  templateUrl: './configuracao.component.html',
  styleUrls: ['./configuracao.component.css']
})
export class ConfiguracaoComponent implements OnInit, OnDestroy {
  private configuracaoService = inject(ConfiguracaoService);
  private migracaoService = inject(MigracaoService);
  private sincronizacaoService = inject(SincronizacaoService);
  private authService = inject(AuthService);
  private fechamentoCaixaService = inject(FechamentoCaixaService);
  private fb = inject(FormBuilder);

  @ViewChild('caixaErpModal') caixaErpModal?: ImportarCaixaErpModalComponent;
  @ViewChild('etapasModal') etapasModal?: ImportarProducaoEtapasModalComponent;
  @ViewChild('orcamentosModal') orcamentosModal?: ImportarOrcamentosModalComponent;
  @ViewChild('vinculoFuncModal') vinculoFuncModal?: ImportarVincularCodigoFuncionarioModalComponent;
  private progressSubscription?: Subscription;
  private cadastrosProgressSubscription?: Subscription;
  private sincronizacaoProgressSubscription?: Subscription;

  configuracao: Configuracao | null = null;
  form: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  logoPreview: string | null = null;

  // Abas
  activeTab: 'geral' | 'migracao' | 'sincronizacao' | 'importacao' | 'saldo-caixa' = 'geral';

  saldosCaixa: SaldoCaixaFormItem[] = [];
  saldoCaixaLoading = false;
  saldoCaixaSaving: string | null = null;
  saldoCaixaSuccess: string | null = null;
  saldoCaixaError: string | null = null;

  // Migração
  migrationLoading = false;
  importLoading = false;
  migrationResult: { message: string; success: boolean } | null = null;
  importResult: MigracaoResult | null = null;
  importProgress: MigracaoProgress | null = null;
  
  // Migração de Cadastros Completos
  cadastrosLoading = false;
  cadastrosResult: { clientesCriados: number; prescritoresCriados: number; erros: number } | null = null;
  cadastrosProgress: MigracaoCadastrosProgress | null = null;

  // Remover Campos Texto
  removerCamposTextoLoading = false;
  removerCamposTextoResult: { message: string; success: boolean } | null = null;

  // Sincronização
  sincronizacaoConfigs: SincronizacaoConfig[] = [];
  sincronizacaoLoading = false;
  sincronizacaoExecutando = false;
  sincronizacaoResultado: SincronizacaoResult[] | null = null;
  sincronizacaoProgress: SincronizacaoProgress | null = null;
  agentesDisponiveis = [
    { value: 'inhumas', label: 'Inhumas' },
    { value: 'uberaba', label: 'Uberaba' },
    { value: 'neropolis', label: 'Nerópolis' },
  ];
  editandoAgente: string | null = null;
  formSincronizacao: Record<string, {
    ativo: boolean;
    ultimaDataCliente: string;
    ultimaDataPrescritor: string;
    ultimaModificacaoOrcamento: string;
    painelContrato: string | number;
    painelRepresentantes: string;
    ultimaModificacaoProducaoEtapas: string;
    intervaloMinutos: number;
  }> = {};

  constructor() {
    this.form = this.fb.group({
      nomeCliente: ['', Validators.required],
      logoRelatorio: [null],
      farmaceuticoResponsavel: [''],
      // Configurações de Auditoria
      auditarConsultas: [true],
      auditarLoginLogOff: [true],
      auditarCriacao: [true],
      auditarAlteracao: [true],
      auditarExclusao: [true],
      auditarSenhaAlterada: [true]
    });
  }

  ngOnInit() {
    this.loading = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => {
        this.configuracao = config;
        this.form.patchValue({
          nomeCliente: config.nomeCliente,
          farmaceuticoResponsavel: config.farmaceuticoResponsavel || '',
          // Configurações de Auditoria
          auditarConsultas: config.auditarConsultas ?? true,
          auditarLoginLogOff: config.auditarLoginLogOff ?? true,
          auditarCriacao: config.auditarCriacao ?? true,
          auditarAlteracao: config.auditarAlteracao ?? true,
          auditarExclusao: config.auditarExclusao ?? true,
          auditarSenhaAlterada: config.auditarSenhaAlterada ?? true
        });
        this.logoPreview = config.hasLogo
          ? `${environment.apiUrl}/configuracao/logo?t=${Date.now()}`
          : null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    // Carregar configurações de sincronização
    this.carregarSincronizacaoConfigs();
  }

  carregarSaldosCaixa(): void {
    this.saldoCaixaLoading = true;
    this.saldoCaixaError = null;
    this.fechamentoCaixaService.listarSaldosIniciais().subscribe({
      next: (items) => {
        this.saldosCaixa = items.map((item) => this.mapearSaldoCaixaFormItem(item));
        this.saldoCaixaLoading = false;
      },
      error: (err) => {
        this.saldoCaixaLoading = false;
        this.saldoCaixaError =
          err?.error?.message || 'Erro ao carregar saldos iniciais.';
      },
    });
  }

  salvarSaldoCaixa(item: SaldoCaixaFormItem): void {
    if (!item.dataSaldo) {
      this.saldoCaixaError = `Informe a data do saldo para ${item.unidade}.`;
      return;
    }

    this.saldoCaixaSaving = item.unidade;
    this.saldoCaixaSuccess = null;
    this.saldoCaixaError = null;
    this.fechamentoCaixaService
      .atualizarSaldoInicial(item.unidade, item.saldoInicial, item.dataSaldo)
      .subscribe({
        next: (saved) => {
          const idx = this.saldosCaixa.findIndex((s) => s.unidade === saved.unidade);
          if (idx >= 0) {
            this.saldosCaixa[idx] = this.mapearSaldoCaixaFormItem(saved);
          }
          this.saldoCaixaSaving = null;
          this.saldoCaixaSuccess = `Saldo de ${saved.unidade} atualizado.`;
        },
        error: (err) => {
          this.saldoCaixaSaving = null;
          this.saldoCaixaError =
            err?.error?.message || 'Erro ao salvar saldo inicial.';
        },
      });
  }

  onSaldoCaixaInput(item: SaldoCaixaFormItem, value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const numerico = digits === '' ? 0 : parseInt(digits, 10) / 100;
    item.saldoInicial = numerico;
    item.saldoInicialDisplay = this.formatSaldoCaixaDisplay(numerico);
  }

  onSaldoCaixaBlur(item: SaldoCaixaFormItem): void {
    item.saldoInicialDisplay = this.formatSaldoCaixaDisplay(item.saldoInicial);
  }

  onSaldoCaixaFocus(item: SaldoCaixaFormItem): void {
    if (item.saldoInicialDisplay === '0,00') {
      item.saldoInicialDisplay = '';
    }
  }

  private mapearSaldoCaixaFormItem(
    item: CaixaSaldoInicialUnidade,
  ): SaldoCaixaFormItem {
    return {
      ...item,
      dataSaldo: item.dataSaldo ?? '',
      saldoInicialDisplay: this.formatSaldoCaixaDisplay(item.saldoInicial),
    };
  }

  private formatSaldoCaixaDisplay(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  }

  onTabChange(tab: typeof this.activeTab): void {
    this.activeTab = tab;
    if (tab === 'saldo-caixa' && this.saldosCaixa.length === 0) {
      this.carregarSaldosCaixa();
    }
  }

  canImportarCaixaErp(): boolean {
    return this.authService.hasPermission(Permission.VENDA_FECHAR_CAIXA);
  }

  canAcessarAbaImportacao(): boolean {
    return this.authService.hasPermission(Permission.CONFIGURACAO_ACCESS);
  }

  canVincularCodigoFuncionario(): boolean {
    return (
      this.authService.hasPermission(Permission.PRODUCAO_CONFIG_READ) ||
      this.authService.hasPermission(Permission.CONFIGURACAO_ACCESS)
    );
  }

  onVinculoCodigoFuncionarioConcluido(atualizados: number): void {
    this.success = `${atualizados} funcionário(s) atualizado(s) com código ERP.`;
    this.error = null;
  }

  abrirModalVincularCodigoFuncionario(): void {
    this.vinculoFuncModal?.abrir();
  }

  abrirModalImportarCaixaErp(): void {
    this.caixaErpModal?.abrir({
      modoPeriodo: true,
      reimportacaoHistorica: true,
    });
  }

  onImportacaoCaixaConcluida(): void {
    this.success = 'Importação de caixa ERP concluída.';
    this.error = null;
  }

  abrirModalImportarProducaoEtapas(): void {
    this.etapasModal?.abrir();
  }

  onImportacaoEtapasConcluida(): void {
    this.success = 'Importação de etapas de produção concluída.';
    this.error = null;
  }

  abrirModalImportarOrcamentos(): void {
    this.orcamentosModal?.abrir();
  }

  onImportacaoOrcamentosConcluida(): void {
    this.success = 'Importação de orçamentos concluída.';
    this.error = null;
  }

  carregarSincronizacaoConfigs() {
    this.sincronizacaoLoading = true;
    this.sincronizacaoService.findAll().subscribe({
      next: (configs) => {
        // Normalizar as datas ao carregar para evitar problemas de timezone
        this.sincronizacaoConfigs = configs.map(config => ({
          ...config,
          ultimaDataCliente: config.ultimaDataCliente ? this.normalizarData(config.ultimaDataCliente) : undefined,
          ultimaDataPrescritor: config.ultimaDataPrescritor ? this.normalizarData(config.ultimaDataPrescritor) : undefined,
          ultimaModificacaoOrcamento: config.ultimaModificacaoOrcamento
            ? this.normalizarDateTime(config.ultimaModificacaoOrcamento)
            : undefined,
          ultimaModificacaoProducaoEtapas: config.ultimaModificacaoProducaoEtapas
            ? this.normalizarDateTime(config.ultimaModificacaoProducaoEtapas)
            : undefined,
        }));
        this.sincronizacaoLoading = false;
      },
      error: (err) => {
        this.error = 'Erro ao carregar configurações de sincronização: ' + (err?.error?.message || err?.message);
        this.sincronizacaoLoading = false;
      }
    });
  }

  criarOuAtualizarSincronizacao(config: SincronizacaoConfig | null, formData: any) {
    // Limpar mensagens anteriores
    this.error = null;
    this.success = null;

    if (config) {
      this.sincronizacaoService.update(config.id, formData).subscribe({
        next: () => {
          this.success = 'Configuração de sincronização atualizada com sucesso!';
          this.carregarSincronizacaoConfigs();
        },
        error: (err) => {
          this.error = 'Erro ao atualizar configuração: ' + (err?.error?.message || err?.message);
        }
      });
    } else {
      this.sincronizacaoService.create(formData).subscribe({
        next: () => {
          this.success = 'Configuração de sincronização criada com sucesso!';
          this.carregarSincronizacaoConfigs();
        },
        error: (err) => {
          this.error = 'Erro ao criar configuração: ' + (err?.error?.message || err?.message);
        }
      });
    }
  }


  executarSincronizacao() {
    this.sincronizacaoExecutando = true;
    this.sincronizacaoResultado = null;
    this.sincronizacaoProgress = null;
    this.error = null;
    this.success = null;

    this.startSincronizacaoProgressPolling();

    this.sincronizacaoService.executarSincronizacao().subscribe({
      next: (resultados) => {
        this.sincronizacaoExecutando = false;
        this.sincronizacaoResultado = resultados;
        const totalClientes = resultados.reduce((sum, r) => sum + r.clientesCriados, 0);
        const totalPrescritores = resultados.reduce((sum, r) => sum + r.prescritoresCriados, 0);
        const totalOrcamentos = resultados.reduce((sum, r) => sum + r.orcamentosProcessados, 0);
        const totalPainel = resultados.reduce((sum, r) => sum + r.painelProcessados, 0);
        const totalEtapas = resultados.reduce((sum, r) => sum + r.producaoEtapasProcessados, 0);
        this.success = `Sincronização concluída! ${totalClientes} clientes, ${totalPrescritores} prescritores, ${totalOrcamentos} orçamentos, ${totalPainel} painel e ${totalEtapas} etapas processados.`;
        this.carregarSincronizacaoConfigs();
        this.stopSincronizacaoProgressPolling(true);
      },
      error: (err) => {
        this.sincronizacaoExecutando = false;
        this.error = 'Erro ao executar sincronização: ' + (err?.error?.message || err?.message);
        this.stopSincronizacaoProgressPolling();
      }
    });
  }

  private startSincronizacaoProgressPolling(): void {
    this.stopSincronizacaoProgressPolling();

    this.sincronizacaoProgressSubscription = interval(500)
      .pipe(
        switchMap(() => this.sincronizacaoService.getProgresso()),
        takeWhile(() => this.sincronizacaoExecutando, true),
      )
      .subscribe({
        next: (progress) => {
          if (progress) {
            this.sincronizacaoProgress = progress;
          }
        },
        error: () => {
          // Ignorar erros de polling
        },
      });
  }

  private stopSincronizacaoProgressPolling(finalFetch = false): void {
    if (this.sincronizacaoProgressSubscription) {
      this.sincronizacaoProgressSubscription.unsubscribe();
      this.sincronizacaoProgressSubscription = undefined;
    }

    if (finalFetch) {
      this.sincronizacaoService.getProgresso().subscribe({
        next: (progress) => {
          if (progress) {
            this.sincronizacaoProgress = progress;
          }
        },
      });
    }
  }

  getSincronizacaoProgressPercent(): number {
    return this.sincronizacaoProgress?.percentual ?? 0;
  }

  getSincronizacaoSubProgressLabel(
    tipo: 'clientes' | 'prescritores' | 'orcamentos' | 'painel' | 'producao_etapas',
  ): string {
    if (!this.sincronizacaoProgress) return '';
    const map = {
      clientes: {
        atual: this.sincronizacaoProgress.clientesAtual,
        total: this.sincronizacaoProgress.clientesTotal,
        pct: this.sincronizacaoProgress.percentualClientes,
      },
      prescritores: {
        atual: this.sincronizacaoProgress.prescritoresAtual,
        total: this.sincronizacaoProgress.prescritoresTotal,
        pct: this.sincronizacaoProgress.percentualPrescritores,
      },
      orcamentos: {
        atual: this.sincronizacaoProgress.orcamentosAtual,
        total: this.sincronizacaoProgress.orcamentosTotal,
        pct: this.sincronizacaoProgress.percentualOrcamentos,
      },
      painel: {
        atual: this.sincronizacaoProgress.painelAtual,
        total: this.sincronizacaoProgress.painelTotal,
        pct: this.sincronizacaoProgress.percentualPainel,
      },
      producao_etapas: {
        atual: this.sincronizacaoProgress.producaoEtapasAtual,
        total: this.sincronizacaoProgress.producaoEtapasTotal,
        pct: this.sincronizacaoProgress.percentualProducaoEtapas,
      },
    };
    const item = map[tipo];
    if (item.total <= 0) {
      return '—';
    }
    return `${item.atual}/${item.total} (${item.pct}%)`;
  }

  getSincronizacaoSubProgressPercent(
    tipo: 'clientes' | 'prescritores' | 'orcamentos' | 'painel' | 'producao_etapas',
  ): number {
    if (!this.sincronizacaoProgress) return 0;
    switch (tipo) {
      case 'clientes':
        return this.sincronizacaoProgress.percentualClientes ?? 0;
      case 'prescritores':
        return this.sincronizacaoProgress.percentualPrescritores ?? 0;
      case 'orcamentos':
        return this.sincronizacaoProgress.percentualOrcamentos ?? 0;
      case 'painel':
        return this.sincronizacaoProgress.percentualPainel ?? 0;
      case 'producao_etapas':
        return this.sincronizacaoProgress.percentualProducaoEtapas ?? 0;
    }
  }

  isSincronizacaoEtapaAtiva(
    tipo: 'clientes' | 'prescritores' | 'orcamentos' | 'painel' | 'producao_etapas',
  ): boolean {
    if (!this.sincronizacaoProgress) return false;
    return this.sincronizacaoProgress.etapa === tipo;
  }

  getSincronizacaoEtapaTexto(): string {
    if (!this.sincronizacaoProgress) return '';
    const etapas: Record<string, string> = {
      iniciando: 'Iniciando',
      buscando: 'Buscando dados do agente',
      clientes: 'Sincronizando clientes',
      prescritores: 'Sincronizando prescritores',
      orcamentos: 'Sincronizando orçamentos',
      painel: 'Sincronizando painel',
      producao_etapas: 'Sincronizando etapas de produção',
      finalizando: 'Finalizando',
      concluido: 'Concluído',
    };
    const agente = this.sincronizacaoProgress.agenteAtual;
    const etapa = etapas[this.sincronizacaoProgress.etapa] || this.sincronizacaoProgress.etapa;
    return agente ? `${etapa} — ${agente}` : etapa;
  }

  getConfigPorAgente(agente: string): SincronizacaoConfig | null {
    return this.sincronizacaoConfigs.find(c => c.agente === agente) || null;
  }

  parseIntervalo(value: string | null | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  formatarData(data: string | null | undefined): string {
    if (!data) return '-';
    try {
      // Normalizar a data para garantir que pegamos apenas YYYY-MM-DD
      const dataNormalizada = this.normalizarData(data);
      const [ano, mes, dia] = dataNormalizada.split('-');
      if (ano && mes && dia) {
        return `${dia}/${mes}/${ano}`;
      }
      return data;
    } catch {
      return data;
    }
  }

  formatarDateTime(data: string | null | undefined): string {
    if (!data) return '-';
    try {
      const normalizada = this.normalizarDateTime(data);
      const [datePart, timePart] = normalizada.split('T');
      const [ano, mes, dia] = datePart.split('-');
      if (!timePart) {
        return this.formatarData(datePart);
      }
      const [hora, minuto] = timePart.split(':');
      return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    } catch {
      return data;
    }
  }

  /**
   * Normaliza datetime para YYYY-MM-DDTHH:mm (input datetime-local)
   */
  normalizarDateTime(data: string | null | undefined): string {
    if (!data) return '';

    const trimmed = data.trim();
    // ISO com Z/offset: converter para horário de Brasília (evita +3h na exibição)
    if (/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return this.isoDateTimeBrasilia(parsed).slice(0, 16);
      }
    }

    const semTimezone = trimmed.replace(/\.\d{3}Z?$/, '').replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(semTimezone)) {
      return semTimezone;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(semTimezone)) {
      return semTimezone.slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(semTimezone)) {
      return `${semTimezone}T00:00`;
    }

    const parsed = new Date(data);
    if (isNaN(parsed.getTime())) {
      return data;
    }
    return this.isoDateTimeBrasilia(parsed).slice(0, 16);
  }

  private isoDateTimeBrasilia(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '00';

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  }

  /**
   * Converte datetime-local para formato enviado ao backend
   */
  dateTimeParaBackend(data: string | null | undefined): string | undefined {
    if (!data) return undefined;
    const normalizada = this.normalizarDateTime(data);
    if (!normalizada) return undefined;
    return normalizada.length === 16 ? `${normalizada}:00` : normalizada;
  }

  /**
   * Normaliza uma data para o formato YYYY-MM-DD, removendo informações de timezone
   */
  normalizarData(data: string | null | undefined): string {
    if (!data) return '';
    try {
      // Se a data já está no formato YYYY-MM-DD, retorna direto
      if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return data;
      }
      // Se tem timezone ou hora, extrai apenas a parte da data
      const dataObj = new Date(data);
      if (isNaN(dataObj.getTime())) {
        return data; // Se não conseguir parsear, retorna original
      }
      // Usa UTC para evitar problemas de timezone
      const ano = dataObj.getUTCFullYear();
      const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(dataObj.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    } catch {
      return data;
    }
  }

  iniciarEdicao(agente: string, config: SincronizacaoConfig | null) {
    const painel = this.parsePainelParaFormulario(config?.painelContratoRepresentantes);
    this.editandoAgente = agente;
    this.formSincronizacao[agente] = {
      ativo: config?.ativo ?? false,
      ultimaDataCliente: this.normalizarData(config?.ultimaDataCliente) || '',
      ultimaDataPrescritor: this.normalizarData(config?.ultimaDataPrescritor) || '',
      ultimaModificacaoOrcamento: this.normalizarDateTime(config?.ultimaModificacaoOrcamento) || '',
      painelContrato: painel.contrato,
      painelRepresentantes: painel.representantes,
      ultimaModificacaoProducaoEtapas: this.normalizarDateTime(config?.ultimaModificacaoProducaoEtapas) || '',
      intervaloMinutos: config?.intervaloMinutos || 60,
    };
  }

  cancelarEdicao(agente: string) {
    this.editandoAgente = null;
    delete this.formSincronizacao[agente];
  }

  salvarSincronizacao(agente: string, config: SincronizacaoConfig | null) {
    const formData = this.formSincronizacao[agente];
    if (!formData) return;

    const painelContratoRepresentantes = this.buildPainelContratoRepresentantes(
      formData.painelContrato,
      formData.painelRepresentantes,
    );
    if (painelContratoRepresentantes === false) {
      this.error =
        'Painel: informe a filial e ao menos um representante (ex.: filial 9999, representantes 1,2).';
      this.success = null;
      return;
    }

    const dto = {
      agente: agente,
      ativo: formData.ativo,
      // Normalizar as datas antes de enviar para garantir formato YYYY-MM-DD
      ultimaDataCliente: this.normalizarData(formData.ultimaDataCliente) || undefined,
      ultimaDataPrescritor: this.normalizarData(formData.ultimaDataPrescritor) || undefined,
      ultimaModificacaoOrcamento: formData.ultimaModificacaoOrcamento
        ? this.dateTimeParaBackend(formData.ultimaModificacaoOrcamento)
        : null,
      painelContratoRepresentantes,
      ultimaModificacaoProducaoEtapas: formData.ultimaModificacaoProducaoEtapas
        ? this.dateTimeParaBackend(formData.ultimaModificacaoProducaoEtapas)
        : null,
      intervaloMinutos: formData.intervaloMinutos,
    };

    this.criarOuAtualizarSincronizacao(config, dto);
    this.cancelarEdicao(agente);
  }

  formatarPainelContrato(value?: string | null): string {
    const contrato = this.parsePainelParaFormulario(value).contrato;
    return contrato || '-';
  }

  formatarPainelRepresentantes(value?: string | null): string {
    const representantes = this.parsePainelParaFormulario(value).representantes;
    return representantes || '-';
  }

  private parsePainelParaFormulario(
    value?: string | null,
  ): { contrato: string; representantes: string } {
    if (!value?.trim()) {
      return { contrato: '', representantes: '' };
    }

    const match = value.trim().match(/^(\d+)\s+([\d,\s]+)$/);
    if (!match) {
      return { contrato: '', representantes: '' };
    }

    return {
      contrato: match[1],
      representantes: match[2]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .join(','),
    };
  }

  private buildPainelContratoRepresentantes(
    contrato: string | number | null | undefined,
    representantes: string | number | null | undefined,
  ): string | null | false {
    const contratoLimpo = String(contrato ?? '').trim();
    const representantesTexto = String(representantes ?? '').trim();
    const representantesLimpos = representantesTexto
      .split(',')
      .map((item) => item.trim())
      .filter((item) => /^\d+$/.test(item));

    if (!contratoLimpo && representantesLimpos.length === 0) {
      return null;
    }

    if (!contratoLimpo || representantesLimpos.length === 0) {
      return false;
    }

    return `${contratoLimpo} ${representantesLimpos.join(',')}`;
  }

  onLogoChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.form.patchValue({ logoRelatorio: file });
      const reader = new FileReader();
      reader.onload = e => this.logoPreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    this.error = null;
    this.success = null;
    if (this.form.invalid) {
      this.error = 'Formulário inválido. Preencha todos os campos obrigatórios.';
      return;
    }
    this.loading = true;
    const formData = new FormData();
    formData.append('nomeCliente', this.form.value.nomeCliente);
    if (this.form.value.logoRelatorio instanceof File) {
      formData.append('logoRelatorio', this.form.value.logoRelatorio);
    }
    if (this.form.value.farmaceuticoResponsavel) {
      formData.append('farmaceuticoResponsavel', this.form.value.farmaceuticoResponsavel);
    }
    // Configurações de Auditoria
    formData.append('auditarConsultas', this.form.value.auditarConsultas.toString());
    formData.append('auditarLoginLogOff', this.form.value.auditarLoginLogOff.toString());
    formData.append('auditarCriacao', this.form.value.auditarCriacao.toString());
    formData.append('auditarAlteracao', this.form.value.auditarAlteracao.toString());
    formData.append('auditarExclusao', this.form.value.auditarExclusao.toString());
    formData.append('auditarSenhaAlterada', this.form.value.auditarSenhaAlterada.toString());
    const handleError = (err: any) => {
      this.loading = false;
      this.success = null;
      this.error = 'Erro ao salvar configuração: ' + (err?.error?.message || err?.message || err?.statusText || 'Erro desconhecido');
    };
    const handleSuccess = (config: Configuracao) => {
      this.configuracao = config;
      this.logoPreview = config.hasLogo
        ? `${environment.apiUrl}/configuracao/logo?t=${Date.now()}`
        : null;
      this.loading = false;
      this.error = null;
      this.success = 'Configuração salva com sucesso!';
    };
    if (this.configuracao) {
      this.configuracaoService.updateConfiguracao(this.configuracao.id, formData).subscribe({
        next: handleSuccess,
        error: handleError
      });
    } else {
      this.configuracaoService.createConfiguracao(formData).subscribe({
        next: handleSuccess,
        error: handleError
      });
    }
  }

  executarMigration() {
    this.migrationLoading = true;
    this.migrationResult = null;
    this.error = null;
    this.success = null;
    
    this.migracaoService.executarMigration().subscribe({
      next: (result) => {
        this.migrationLoading = false;
        this.migrationResult = result;
        this.success = result.message;
      },
      error: (err) => {
        this.migrationLoading = false;
        this.error = 'Erro ao executar migration: ' + (err?.error?.message || err?.message);
      }
    });
  }

  importarDados() {
    this.importLoading = true;
    this.importResult = null;
    this.importProgress = null;
    this.error = null;
    this.success = null;
    
    // Iniciar importação
    this.migracaoService.importarDados().subscribe({
      next: (result) => {
        this.importLoading = false;
        this.importResult = result;
        this.importProgress = null;
        this.success = `Importação concluída! ${result.vendasAtualizadas} vendas atualizadas, ${result.clientesCriados} clientes criados, ${result.vendedoresCriados} vendedores criados, ${result.prescritoresCriados} prescritores criados.`;
        this.stopProgressPolling();
      },
      error: (err) => {
        this.importLoading = false;
        this.importProgress = null;
        this.error = 'Erro ao importar dados: ' + (err?.error?.message || err?.message);
        this.stopProgressPolling();
      }
    });

    // Iniciar polling do progresso
    this.startProgressPolling();
  }

  private startProgressPolling() {
    this.stopProgressPolling();
    
    this.progressSubscription = interval(500) // Polling a cada 500ms
      .pipe(
        switchMap(() => this.migracaoService.getProgresso()),
        takeWhile((progress) => {
          // Continuar enquanto estiver rodando e importLoading for true
          return this.importLoading && (!progress || progress.status === 'running');
        }, true) // inclusive: true para emitir o último valor
      )
      .subscribe({
        next: (progress) => {
          if (progress) {
            this.importProgress = progress;
            
            // Se concluído ou erro, parar polling
            if (progress.status === 'completed' || progress.status === 'error') {
              this.stopProgressPolling();
            }
          }
        },
        error: () => {
          // Ignorar erros de polling
        }
      });
  }

  private stopProgressPolling() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = undefined;
    }
  }

  ngOnDestroy() {
    this.stopProgressPolling();
    this.stopCadastrosProgressPolling();
    this.stopSincronizacaoProgressPolling();
  }

  getProgressPercent(): number {
    if (!this.importProgress || this.importProgress.totalVendas === 0) {
      return 0;
    }
    return Math.round((this.importProgress.vendasProcessadas / this.importProgress.totalVendas) * 100);
  }

  importarTodosCadastros() {
    this.cadastrosLoading = true;
    this.cadastrosResult = null;
    this.cadastrosProgress = null;
    this.error = null;
    this.success = null;
    
    // Iniciar importação
    this.migracaoService.importarTodosCadastros().subscribe({
      next: (result) => {
        this.cadastrosLoading = false;
        this.cadastrosResult = result;
        this.cadastrosProgress = null;
        this.success = `Migração de cadastros concluída! ${result.clientesCriados} clientes criados, ${result.prescritoresCriados} prescritores criados.`;
        this.stopCadastrosProgressPolling();
      },
      error: (err) => {
        this.cadastrosLoading = false;
        this.cadastrosProgress = null;
        this.error = 'Erro ao importar cadastros: ' + (err?.error?.message || err?.message);
        this.stopCadastrosProgressPolling();
      }
    });

    // Iniciar polling do progresso
    this.startCadastrosProgressPolling();
  }

  private startCadastrosProgressPolling() {
    this.stopCadastrosProgressPolling();
    
    this.cadastrosProgressSubscription = interval(500)
      .pipe(
        switchMap(() => this.migracaoService.getCadastrosProgresso()),
        takeWhile((progress) => {
          return this.cadastrosLoading && (!progress || progress.status === 'running');
        }, true)
      )
      .subscribe({
        next: (progress) => {
          if (progress) {
            this.cadastrosProgress = progress;
            
            if (progress.status === 'completed' || progress.status === 'error') {
              this.stopCadastrosProgressPolling();
            }
          }
        },
        error: () => {
          // Ignorar erros de polling
        }
      });
  }

  private stopCadastrosProgressPolling() {
    if (this.cadastrosProgressSubscription) {
      this.cadastrosProgressSubscription.unsubscribe();
      this.cadastrosProgressSubscription = undefined;
    }
  }

  getCadastrosProgressPercent(): number {
    if (!this.cadastrosProgress) {
      return 0;
    }
    
    const total = this.cadastrosProgress.totalClientes + 
                  this.cadastrosProgress.totalPrescritores;
    
    if (total === 0) {
      return 0;
    }
    
    const processados = this.cadastrosProgress.clientesProcessados + 
                        this.cadastrosProgress.prescritoresProcessados;
    
    return Math.round((processados / total) * 100);
  }

  getEtapaTexto(): string {
    if (!this.cadastrosProgress) {
      return '';
    }
    
    const etapas: Record<string, string> = {
      'clientes': 'Migrando Clientes',
      'prescritores': 'Migrando Prescritores',
      'concluido': 'Concluído'
    };
    
    return etapas[this.cadastrosProgress.etapa] || '';
  }

  removerCamposTexto() {
    // Confirmação dupla para operação irreversível
    const confirmar = confirm(
      '⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!\n\n' +
      'Você fez backup do banco de dados?\n\n' +
      'Esta migration irá:\n' +
      '1. Verificar se todas as vendas têm relacionamentos válidos\n' +
      '2. Remover permanentemente os campos texto (cliente, vendedor, prescritor) da tabela vendas\n\n' +
      'Execute apenas após validar que todos os dados foram migrados corretamente.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmar) {
      return;
    }

    // Segunda confirmação
    const confirmarFinal = confirm(
      '⚠️ ÚLTIMA CONFIRMAÇÃO!\n\n' +
      'Você tem CERTEZA ABSOLUTA que:\n' +
      '✓ Fez backup do banco\n' +
      '✓ Validou que todas as vendas têm clienteId e vendedorId válidos\n' +
      '✓ Executou e validou a migração de dados (passo 2)\n\n' +
      'Esta operação NÃO PODE SER REVERTIDA sem restaurar o backup!\n\n' +
      'Continuar mesmo assim?'
    );

    if (!confirmarFinal) {
      return;
    }

    this.removerCamposTextoLoading = true;
    this.removerCamposTextoResult = null;
    this.error = null;
    this.success = null;

    this.migracaoService.removerCamposTexto().subscribe({
      next: (result) => {
        this.removerCamposTextoLoading = false;
        this.removerCamposTextoResult = result;
        this.success = result.message;
      },
      error: (err) => {
        this.removerCamposTextoLoading = false;
        this.error = 'Erro ao remover campos texto: ' + (err?.error?.message || err?.message);
      }
    });
  }
}
