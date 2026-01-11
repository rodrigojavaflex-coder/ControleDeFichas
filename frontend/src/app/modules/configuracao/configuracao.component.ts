import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';
import { MigracaoService, MigracaoResult, MigracaoProgress, MigracaoCadastrosProgress } from '../../services/migracao.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-configuracao',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configuracao.component.html',
  styleUrls: ['./configuracao.component.css']
})
export class ConfiguracaoComponent implements OnInit, OnDestroy {
  private configuracaoService = inject(ConfiguracaoService);
  private migracaoService = inject(MigracaoService);
  private fb = inject(FormBuilder);
  private progressSubscription?: Subscription;
  private cadastrosProgressSubscription?: Subscription;

  configuracao: Configuracao | null = null;
  form: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  logoPreview: string | null = null;

  // Abas
  activeTab: 'geral' | 'migracao' = 'geral';

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
        if (config.logoRelatorio) {
          const backendUrl = environment.apiUrl.replace(/\/api$/, '');
          this.logoPreview = config.logoRelatorio.startsWith('http')
            ? config.logoRelatorio
            : `${backendUrl}${config.logoRelatorio}`;
        } else {
          this.logoPreview = null;
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
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
      if (config.logoRelatorio) {
        const backendUrl = environment.apiUrl.replace(/\/api$/, '');
        this.logoPreview = config.logoRelatorio.startsWith('http')
          ? config.logoRelatorio
          : `${backendUrl}${config.logoRelatorio}`;
      } else {
        this.logoPreview = null;
      }
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
