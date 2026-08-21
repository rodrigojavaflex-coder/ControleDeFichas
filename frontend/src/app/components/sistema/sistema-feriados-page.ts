import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ProducaoConfigService } from '../../services/producao-config.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { ProducaoFeriadosPanel } from '../producao/producao-feriados-panel/producao-feriados-panel';

@Component({
  selector: 'app-sistema-feriados-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ProducaoFeriadosPanel],
  templateUrl: './sistema-feriados-page.html',
  styleUrls: [
    '../producao/producao-config-page.css',
    './sistema-feriados-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class SistemaFeriadosPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private producaoConfig = inject(ProducaoConfigService);

  Permission = Permission;
  Unidade = Unidade;
  unidades = Object.values(Unidade);

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  sabadoDiaUtil = false;
  salvandoSabado = false;
  private calendarioPronto = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Feriados',
      description:
        'Calendário de feriados por unidade e parâmetro de sábado útil.',
    });
    this.initializeUnidadeFilter();
    if (this.unidadeFiltro) {
      this.carregarCalendario();
    }
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.FERIADO_READ);
  }

  podeEditar(): boolean {
    return this.auth.hasPermission(Permission.FERIADO_UPDATE);
  }

  onUnidadeChange(): void {
    if (!this.unidadeFiltro) return;
    this.calendarioPronto = false;
    this.carregarCalendario();
  }

  onSabadoChange(): void {
    if (!this.calendarioPronto || !this.unidadeFiltro || !this.podeEditar()) {
      return;
    }
    this.salvandoSabado = true;
    this.producaoConfig
      .salvarCalendarioUnidade({
        unidade: this.unidadeFiltro,
        sabadoDiaUtil: this.sabadoDiaUtil,
      })
      .subscribe({
        next: (cfg) => {
          this.sabadoDiaUtil = cfg.sabadoDiaUtil;
          this.salvandoSabado = false;
        },
        error: (e) => {
          this.salvandoSabado = false;
          this.sabadoDiaUtil = !this.sabadoDiaUtil;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar parâmetro de sábado.',
            'Feriados',
          );
        },
      });
  }

  private initializeUnidadeFilter(): void {
    const u = this.auth.getCurrentUser();
    if (u?.unidade && String(u.unidade).trim() !== '') {
      this.unidadeFiltro = u.unidade as Unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeFiltro = '';
      this.unidadeDisabled = false;
    }
  }

  private carregarCalendario(): void {
    if (!this.unidadeFiltro) return;
    this.producaoConfig.obterCalendarioUnidade(this.unidadeFiltro).subscribe({
      next: (cfg) => {
        this.sabadoDiaUtil = cfg.sabadoDiaUtil;
        this.calendarioPronto = true;
      },
      error: (e) => {
        this.calendarioPronto = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar calendário da unidade.',
          'Feriados',
        );
      },
    });
  }
}
