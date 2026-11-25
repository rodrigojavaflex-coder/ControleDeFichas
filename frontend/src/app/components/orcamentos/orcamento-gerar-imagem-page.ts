import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { OrcamentosService } from '../../services/orcamentos.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { Permission, Unidade, Usuario } from '../../models/usuario.model';
import {
  OrcamentoImagem,
  OrcamentoImagemFaixaTipo,
} from '../../models/orcamento-imagem.model';
import { extrairMensagemErroApi } from '../../utils/mensagem-erro-api.util';
import {
  carregarImagem,
  desenharOrcamentoImagem,
} from './orcamento-imagem-canvas';

@Component({
  selector: 'app-orcamento-gerar-imagem',
  standalone: true,
  templateUrl: './orcamento-gerar-imagem-page.html',
  styleUrl: './orcamento-gerar-imagem-page.css',
})
export class OrcamentoGerarImagemPage implements OnInit, OnDestroy {
  private pageContext = inject(PageContextService);
  private auth = inject(AuthService);
  private orcamentos = inject(OrcamentosService);
  private erros = inject(ErrorModalService);

  readonly unidades = Object.values(Unidade);
  readonly unidade = signal<Unidade | ''>('');
  readonly unidadeTravada = signal(false);
  readonly nrorc = signal('');
  readonly serieo = signal('');
  readonly diasValidade = signal('5');
  readonly podeAlterarFaixa = signal(false);
  readonly modalFaixas = signal(false);
  readonly gerando = signal(false);
  readonly gravandoFaixa = signal<OrcamentoImagemFaixaTipo | null>(null);
  readonly topoUrl = signal<string | null>(null);
  readonly rodapeUrl = signal<string | null>(null);
  readonly imagemUrl = signal<string | null>(null);

  private png: Blob | null = null;
  private cargaFaixa = 0;

  ngOnInit(): void {
    this.pageContext.setContext({
      title: 'Gerar imagem',
      description: 'Orçamento para enviar ao cliente',
    });
    const usuario = this.auth.getCurrentUser();
    this.podeAlterarFaixa.set(
      this.auth.hasPermission(Permission.ORCAMENTO_IMAGEM_UPDATE),
    );
    const escopo = unidadeDoUsuario(usuario);
    if (escopo) {
      this.unidade.set(escopo);
      this.unidadeTravada.set(true);
    }
    this.carregarFaixas();
  }

  ngOnDestroy(): void {
    this.pageContext.resetContext();
    this.revogar(this.topoUrl());
    this.revogar(this.rodapeUrl());
    this.revogar(this.imagemUrl());
  }

  definirUnidade(event: Event): void {
    if (this.unidadeTravada()) {
      return;
    }
    this.unidade.set((event.target as HTMLSelectElement).value as Unidade | '');
    this.limparImagem();
    this.carregarFaixas();
  }

  definirNrorc(event: Event): void {
    this.nrorc.set((event.target as HTMLInputElement).value);
  }

  definirSerieo(event: Event): void {
    this.serieo.set((event.target as HTMLInputElement).value);
  }

  definirDias(event: Event): void {
    this.diasValidade.set((event.target as HTMLInputElement).value);
  }

  abrirFaixas(): void {
    if (!this.podeAlterarFaixa()) {
      return;
    }
    this.modalFaixas.set(true);
  }

  fecharFaixas(): void {
    if (this.gravandoFaixa()) {
      return;
    }
    this.modalFaixas.set(false);
  }

  faixasProntas(): boolean {
    return !!this.topoUrl() && !!this.rodapeUrl();
  }

  avisoFaixas(): string {
    if (!this.unidade()) {
      return this.podeAlterarFaixa()
        ? 'Selecione a unidade para ver o topo e o rodapé.'
        : 'Selecione a unidade.';
    }
    const faltando: string[] = [];
    if (!this.topoUrl()) {
      faltando.push('topo');
    }
    if (!this.rodapeUrl()) {
      faltando.push('rodapé');
    }
    if (faltando.length === 0) {
      return '';
    }
    return `Falta o ${faltando.join(' e o ')} desta unidade.`;
  }

  enviar(event: Event): void {
    event.preventDefault();
    void this.gerar();
  }

  aoEnter(event: Event): void {
    event.preventDefault();
    void this.gerar();
  }

  async gerar(): Promise<void> {
    if (this.gerando()) {
      return;
    }
    const unidade = this.unidade();
    const nrorc = Number(this.nrorc());
    const dias = Number(this.diasValidade());
    if (!unidade) {
      this.erros.show('Informe a unidade.', 'Gerar imagem');
      return;
    }
    if (!Number.isInteger(nrorc) || nrorc < 1) {
      this.erros.show('Informe o número do orçamento.', 'Gerar imagem');
      return;
    }
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      this.erros.show('Informe os dias de validade, de 1 a 365.', 'Gerar imagem');
      return;
    }
    if (!this.faixasProntas()) {
      this.erros.show(this.avisoFaixas() || 'Configure o topo e o rodapé.', 'Gerar imagem');
      return;
    }

    this.gerando.set(true);
    this.limparImagem();
    const serieo = this.serieo().trim();
    this.orcamentos
      .gerarImagem({
        unidade,
        nrorc,
        diasValidade: dias,
        ...(serieo ? { serieo } : {}),
      })
      .subscribe({
        next: (dados) => {
          void this.montarPng(dados);
        },
        error: (err: unknown) => {
          this.gerando.set(false);
          void this.mostrarErro(err, 'Não foi possível gerar a imagem.');
        },
      });
  }

  async copiar(): Promise<void> {
    if (!this.png) {
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': this.png }),
      ]);
      this.erros.show(
        'Imagem copiada. Cole no WhatsApp ou no e-mail.',
        'Imagem do orçamento',
      );
    } catch {
      this.baixarPng();
      this.erros.show(
        'O navegador não permitiu copiar. A imagem foi baixada.',
        'Imagem do orçamento',
      );
    }
  }

  selecionarFaixa(tipo: OrcamentoImagemFaixaTipo, event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo || !this.podeAlterarFaixa()) {
      return;
    }
    const unidade = this.unidade();
    if (!unidade) {
      this.erros.show('Informe a unidade.', 'Imagens da unidade');
      return;
    }
    if (arquivo.type !== 'image/png' || !arquivo.name.toLowerCase().endsWith('.png')) {
      this.erros.show('Envie um arquivo PNG.', 'Imagens da unidade');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      this.erros.show('O PNG deve ter no máximo 5 MB.', 'Imagens da unidade');
      return;
    }

    this.gravandoFaixa.set(tipo);
    this.orcamentos.salvarFaixaImagem(unidade, tipo, arquivo).subscribe({
      next: () => {
        this.gravandoFaixa.set(null);
        this.limparImagem();
        this.carregarFaixas();
        this.erros.show(
          tipo === 'TOPO' ? 'Topo gravado.' : 'Rodapé gravado.',
          'Imagens da unidade',
        );
      },
      error: (err: unknown) => {
        this.gravandoFaixa.set(null);
        void this.mostrarErro(err, 'Não foi possível gravar a imagem.');
      },
    });
  }

  private carregarFaixas(): void {
    const unidade = this.unidade();
    const carga = ++this.cargaFaixa;
    this.trocarUrl(this.topoUrl, null);
    this.trocarUrl(this.rodapeUrl, null);
    if (!unidade) {
      return;
    }
    this.carregarUmaFaixa(unidade, 'TOPO', this.topoUrl, carga);
    this.carregarUmaFaixa(unidade, 'RODAPE', this.rodapeUrl, carga);
  }

  private carregarUmaFaixa(
    unidade: Unidade,
    tipo: OrcamentoImagemFaixaTipo,
    destino: { set: (valor: string | null) => void; (): string | null },
    carga: number,
  ): void {
    this.orcamentos.obterFaixaImagem(unidade, tipo).subscribe({
      next: (blob) => {
        if (carga !== this.cargaFaixa) {
          return;
        }
        this.trocarUrl(destino, URL.createObjectURL(blob));
      },
      error: () => {
        if (carga !== this.cargaFaixa) {
          return;
        }
        this.trocarUrl(destino, null);
      },
    });
  }

  private async montarPng(dados: OrcamentoImagem): Promise<void> {
    const topo = this.topoUrl();
    const rodape = this.rodapeUrl();
    if (!topo || !rodape) {
      this.gerando.set(false);
      this.erros.show(this.avisoFaixas(), 'Gerar imagem');
      return;
    }
    try {
      const [imgTopo, imgRodape] = await Promise.all([
        carregarImagem(topo),
        carregarImagem(rodape),
      ]);
      this.png = await desenharOrcamentoImagem(dados, imgTopo, imgRodape);
      this.trocarUrl(this.imagemUrl, URL.createObjectURL(this.png));
    } catch (error: unknown) {
      const mensagem =
        error instanceof Error ? error.message : 'Não foi possível montar a imagem.';
      this.erros.show(mensagem, 'Gerar imagem');
    } finally {
      this.gerando.set(false);
    }
  }

  private baixarPng(): void {
    if (!this.png || !this.imagemUrl()) {
      return;
    }
    const link = document.createElement('a');
    link.href = this.imagemUrl()!;
    const numero = this.nrorc().trim() || 'orcamento';
    link.download = `orcamento-${numero}.png`;
    link.click();
  }

  private limparImagem(): void {
    this.png = null;
    this.trocarUrl(this.imagemUrl, null);
  }

  private trocarUrl(
    destino: { set: (valor: string | null) => void; (): string | null },
    proxima: string | null,
  ): void {
    this.revogar(destino());
    destino.set(proxima);
  }

  private revogar(url: string | null): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private async mostrarErro(err: unknown, fallback: string): Promise<void> {
    let mensagem = extrairMensagemErroApi(err, fallback);
    if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
      try {
        const texto = await err.error.text();
        const json = JSON.parse(texto) as { message?: unknown };
        if (typeof json.message === 'string' && json.message.trim()) {
          mensagem = json.message;
        }
      } catch {
        mensagem = fallback;
      }
    }
    this.erros.show(mensagem, 'Gerar imagem');
  }
}

function unidadeDoUsuario(usuario: Usuario | null): Unidade | null {
  const cadastro = usuario?.unidade;
  if (cadastro && String(cadastro).trim()) {
    return cadastro;
  }
  const vendedor = usuario?.vendedor?.unidade;
  if (vendedor && String(vendedor).trim()) {
    return vendedor;
  }
  return null;
}
