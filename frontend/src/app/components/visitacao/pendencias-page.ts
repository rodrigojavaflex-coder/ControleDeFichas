import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolicitacoesService } from '../../services/solicitacoes.service';
import {
  FiltroStatusSolicitacao,
  SolicitacaoGestao,
  SolicitacaoHistorico,
  StatusSolicitacao,
  rotuloStatusSolicitacao,
} from '../../models/solicitacao.model';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import { Permission, Unidade } from '../../models/usuario.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';

@Component({
  selector: 'app-pendencias-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pendencias-page.html',
  styleUrls: ['./pendencias-page.css'],
})
export class PendenciasPage implements OnInit, OnDestroy {
  private readonly api = inject(SolicitacoesService);
  private readonly pageCtx = inject(PageContextService);
  private readonly errors = inject(ErrorModalService);
  private readonly auth = inject(AuthService);

  readonly unidades = Object.values(Unidade);
  readonly rotuloStatus = rotuloStatusSolicitacao;

  lista: SolicitacaoGestao[] = [];
  carregando = false;
  status: FiltroStatusSolicitacao = 'todas';
  unidade = '';
  unidadeDisabled = false;
  busca = '';
  tratarAlvo: SolicitacaoGestao | null = null;
  descricao = '';
  tratando = false;
  sucesso = '';
  historicoAlvo: SolicitacaoGestao | null = null;
  historico: SolicitacaoHistorico[] = [];
  carregandoHistorico = false;
  private buscaTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Pendências',
      description: 'Solicitações da unidade do usuário. Resolver devolve ao visitador que registrou.',
    });
    this.initializeUnidadeFilter();
    this.carregar();
  }

  ngOnDestroy(): void {
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
  }

  podeVer(): boolean {
    return this.auth.hasPermission(Permission.PENDENCIAS_WEB_READ);
  }

  podeTratar(): boolean {
    return this.auth.hasPermission(Permission.PENDENCIAS_WEB_UPDATE);
  }

  podeResolver(item: SolicitacaoGestao): boolean {
    return item.status === 'ABERTA' || item.status === 'REABERTA';
  }

  podeReabrir(item: SolicitacaoGestao): boolean {
    return item.status === 'RESOLVIDA' || item.status === 'CONCLUIDA';
  }

  classeStatus(status: StatusSolicitacao): string {
    if (status === 'ABERTA') return 'aberta';
    if (status === 'RESOLVIDA') return 'resolvida';
    if (status === 'REABERTA') return 'reaberta';
    return 'concluida';
  }

  aoBuscar(): void {
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    this.buscaTimer = setTimeout(() => this.carregar(), 350);
  }

  carregar(): void {
    if (!this.podeVer()) return;
    this.carregando = true;
    this.api.listarGestao(this.status, this.busca, this.unidade).subscribe({
      next: (lista) => {
        this.lista = lista;
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.errors.show(extrairMensagemErroApi(err), 'Pendências');
      },
    });
  }

  medico(item: SolicitacaoGestao): string {
    if (!item.prescritorNome) return '—';
    const crm = item.crm?.trim();
    const uf = item.uf?.trim();
    if (crm && uf) return `${item.prescritorNome} · CRM ${crm}/${uf}`;
    if (crm) return `${item.prescritorNome} · CRM ${crm}`;
    return item.prescritorNome;
  }

  quando(iso: string): string {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data);
  }

  pedirTratamento(item: SolicitacaoGestao): void {
    if (!this.podeTratar()) return;
    this.descricao = '';
    this.tratarAlvo = item;
  }

  cancelarTratamento(): void {
    if (this.tratando) return;
    this.tratarAlvo = null;
    this.descricao = '';
  }

  confirmarTratamento(): void {
    if (!this.tratarAlvo || this.tratando) return;
    const descricao = this.descricao.trim();
    if (!descricao) return;
    const alvo = this.tratarAlvo;
    const proximo: 'RESOLVIDA' | 'REABERTA' = this.podeResolver(alvo)
      ? 'RESOLVIDA'
      : 'REABERTA';
    this.tratando = true;
    this.api.tratar(alvo.id, proximo, descricao).subscribe({
      next: () => {
        this.tratando = false;
        this.tratarAlvo = null;
        this.descricao = '';
        this.sucesso =
          proximo === 'RESOLVIDA'
            ? 'Pendência resolvida. Ela aparece no aplicativo de quem registrou para concluir.'
            : 'Pendência reaberta para novo tratamento.';
        this.carregar();
      },
      error: (err) => {
        this.tratando = false;
        this.errors.show(extrairMensagemErroApi(err), 'Pendências');
      },
    });
  }

  abrirHistorico(item: SolicitacaoGestao): void {
    this.historicoAlvo = item;
    this.historico = [];
    this.carregandoHistorico = true;
    this.api.historico(item.id).subscribe({
      next: (itens) => {
        this.historico = itens;
        this.carregandoHistorico = false;
      },
      error: (err) => {
        this.carregandoHistorico = false;
        this.historicoAlvo = null;
        this.errors.show(extrairMensagemErroApi(err), 'Pendências');
      },
    });
  }

  fecharHistorico(): void {
    this.historicoAlvo = null;
    this.historico = [];
  }

  fecharSucesso(): void {
    this.sucesso = '';
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser?.unidade?.trim()) {
      this.unidade = currentUser.unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeDisabled = false;
      this.unidade = '';
    }
  }
}
