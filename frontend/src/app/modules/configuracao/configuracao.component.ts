import { Component, OnInit, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Configuracao } from '../../models/configuracao.model';

@Component({
  selector: 'app-configuracao',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configuracao.component.html',
  styleUrls: ['./configuracao.component.css']
})
export class ConfiguracaoComponent implements OnInit {
  private configuracaoService = inject(ConfiguracaoService);
  private fb = inject(FormBuilder);

  configuracao: Configuracao | null = null;
  form: FormGroup;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  logoPreview: string | null = null;

  constructor() {
    this.form = this.fb.group({
      nomeCliente: ['', Validators.required],
      logoRelatorio: [null],
      farmaceuticoResponsavel: ['']
    });
  }

  ngOnInit() {
    this.loading = true;
    this.configuracaoService.getConfiguracao().subscribe({
      next: (config) => {
        this.configuracao = config;
        this.form.patchValue({
          nomeCliente: config.nomeCliente,
          farmaceuticoResponsavel: config.farmaceuticoResponsavel || ''
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
}
