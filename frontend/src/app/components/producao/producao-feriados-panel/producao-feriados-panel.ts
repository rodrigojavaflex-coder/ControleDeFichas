import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProducaoConfigService } from '../../../services/producao-config.service';
import { ErrorModalService } from '../../../services/error-modal.service';
import { AuthService } from '../../../services/auth.service';
import { Permission, Unidade } from '../../../models/usuario.model';
import { ProducaoFeriadoItem } from '../../../models/producao-jornada-feriado.model';
import { ConfirmationModalComponent } from '../../confirmation-modal/confirmation-modal';
import { MESES_PT, nomeMesPt } from '../../folha/folha-meses';

@Component({
  selector: 'app-producao-feriados-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './producao-feriados-panel.html',
  styleUrls: ['./producao-feriados-panel.css'],
})
export class ProducaoFeriadosPanel implements OnChanges {
  private producaoConfig = inject(ProducaoConfigService);
  private errors = inject(ErrorModalService);
  private auth = inject(AuthService);

  @Input({ required: true }) unidade!: Unidade;

  readonly MESES_PT = MESES_PT;

  anoLista = new Date().getFullYear();
  /** `null` = todo o ano; 1–12 = mês específico */
  mesLista: number | null = null;
  anoImportacao = new Date().getFullYear();
  anosDisponiveis: number[] = [];

  feriados: ProducaoFeriadoItem[] = [];
  carregando = false;
  importando = false;
  salvandoManual = false;

  modalImportAberto = false;
  modalIncluirAberto = false;

  modalExcluirVisivel = false;
  feriadoParaExcluir: ProducaoFeriadoItem | null = null;
  excluindoFeriado = false;

  readonly tituloModalExcluir = 'Confirmação de Exclusão';

  novaData = '';
  novaDescricao = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['unidade'] && this.unidade) {
      this.anosDisponiveis = this.gerarAnosSelect();
      this.carregarLista();
    }
  }

  podeIncluir(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_FERIADO_UPDATE);
  }

  podeImportar(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_FERIADO_IMPORT);
  }

  podeRemover(): boolean {
    return this.auth.hasPermission(Permission.PRODUCAO_FERIADO_DELETE);
  }

  private gerarAnosSelect(): number[] {
    const atual = new Date().getFullYear();
    const anos: number[] = [];
    for (let a = atual - 2; a <= atual + 5; a += 1) {
      anos.push(a);
    }
    return anos;
  }

  private garantirAnoNasOpcoes(ano: number): void {
    if (!this.anosDisponiveis.includes(ano)) {
      this.anosDisponiveis = [...this.anosDisponiveis, ano].sort((a, b) => a - b);
    }
  }

  labelPeriodoLista(): string {
    if (this.mesLista == null) {
      return String(this.anoLista);
    }
    return `${nomeMesPt(this.mesLista)}/${this.anoLista}`;
  }

  carregarLista(): void {
    this.carregando = true;
    const mes =
      this.mesLista != null && this.mesLista >= 1 && this.mesLista <= 12
        ? this.mesLista
        : undefined;
    this.producaoConfig.listarFeriados(this.unidade, this.anoLista, mes).subscribe({
      next: (res) => {
        this.feriados = res.feriados;
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.errors.show(err);
      },
    });
  }

  onPeriodoChange(): void {
    this.garantirAnoNasOpcoes(this.anoLista);
    this.carregarLista();
  }

  navegarPeriodoAnterior(): void {
    if (this.carregando) {
      return;
    }
    if (this.mesLista == null) {
      this.anoLista -= 1;
      this.garantirAnoNasOpcoes(this.anoLista);
      this.carregarLista();
      return;
    }
    this.navegarMes(-1);
  }

  navegarPeriodoProximo(): void {
    if (this.carregando) {
      return;
    }
    if (this.mesLista == null) {
      this.anoLista += 1;
      this.garantirAnoNasOpcoes(this.anoLista);
      this.carregarLista();
      return;
    }
    this.navegarMes(1);
  }

  private navegarMes(delta: number): void {
    let mes = (this.mesLista ?? 1) + delta;
    let ano = this.anoLista;

    if (mes < 1) {
      mes = 12;
      ano -= 1;
    } else if (mes > 12) {
      mes = 1;
      ano += 1;
    }

    this.mesLista = mes;
    this.anoLista = ano;
    this.garantirAnoNasOpcoes(ano);
    this.carregarLista();
  }

  private sincronizarPeriodoComData(dataIso: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      return;
    }
    const anoData = Number(dataIso.slice(0, 4));
    const mesData = Number(dataIso.slice(5, 7));
    this.anoLista = anoData;
    this.garantirAnoNasOpcoes(anoData);
    if (this.mesLista != null) {
      this.mesLista = mesData;
    }
  }

  formatarData(data: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return data;
    }
    const [y, m, d] = data.split('-');
    return `${d}/${m}/${y}`;
  }

  labelOrigem(origem?: string): string {
    if (origem === 'nacional') {
      return 'Nacional';
    }
    return 'Manual';
  }

  abrirModalImport(): void {
    this.anoImportacao = this.anoLista;
    this.modalImportAberto = true;
  }

  fecharModalImport(): void {
    if (this.importando) {
      return;
    }
    this.modalImportAberto = false;
  }

  confirmarImportacao(): void {
    if (!this.podeImportar()) {
      return;
    }
    this.importando = true;
    this.producaoConfig
      .importarFeriadosNacionais({
        unidade: this.unidade,
        ano: this.anoImportacao,
      })
      .subscribe({
        next: () => {
          this.importando = false;
          this.modalImportAberto = false;
          this.anoLista = this.anoImportacao;
          this.carregarLista();
        },
        error: (err) => {
          this.importando = false;
          this.errors.show(err);
        },
      });
  }

  abrirModalIncluir(): void {
    this.novaData = '';
    this.novaDescricao = '';
    this.modalIncluirAberto = true;
  }

  fecharModalIncluir(): void {
    if (this.salvandoManual) {
      return;
    }
    this.modalIncluirAberto = false;
  }

  confirmarIncluir(): void {
    if (!this.podeIncluir() || !this.novaData?.trim()) {
      return;
    }
    const dataIso = this.novaData.trim();
    this.salvandoManual = true;
    this.producaoConfig
      .incluirFeriado({
        unidade: this.unidade,
        data: dataIso,
        descricao: this.novaDescricao?.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.salvandoManual = false;
          this.modalIncluirAberto = false;
          this.sincronizarPeriodoComData(dataIso);
          this.carregarLista();
        },
        error: (err) => {
          this.salvandoManual = false;
          this.errors.show(err);
        },
      });
  }

  mensagemModalExcluir(): string {
    if (!this.feriadoParaExcluir) {
      return 'Tem certeza que deseja excluir este feriado?';
    }
    const data = this.formatarData(this.feriadoParaExcluir.data);
    const desc = this.feriadoParaExcluir.descricao?.trim();
    if (desc) {
      return `Tem certeza que deseja excluir o feriado ${data} — ${desc}?`;
    }
    return `Tem certeza que deseja excluir o feriado ${data}?`;
  }

  abrirConfirmacaoExcluir(item: ProducaoFeriadoItem): void {
    if (!this.podeRemover()) {
      return;
    }
    this.feriadoParaExcluir = item;
    this.modalExcluirVisivel = true;
  }

  cancelarExclusaoFeriado(): void {
    if (this.excluindoFeriado) {
      return;
    }
    this.modalExcluirVisivel = false;
    this.feriadoParaExcluir = null;
  }

  confirmarExclusaoFeriado(): void {
    if (!this.podeRemover() || !this.feriadoParaExcluir || this.excluindoFeriado) {
      return;
    }
    const item = this.feriadoParaExcluir;
    this.excluindoFeriado = true;
    this.producaoConfig
      .removerFeriado({ unidade: this.unidade, data: item.data })
      .subscribe({
        next: () => {
          this.excluindoFeriado = false;
          this.modalExcluirVisivel = false;
          this.feriadoParaExcluir = null;
          this.carregarLista();
        },
        error: (err) => {
          this.excluindoFeriado = false;
          this.errors.show(err);
        },
      });
  }
}
