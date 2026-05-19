import { Component, OnInit, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { FolhaService } from '../../services/folha.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import {
  FuncionarioFolha,
  FolhaCadastroSimples,
  FolhaVerba,
  FolhaMovimentoTipo,
  TipoChavePixFolha,
} from '../../models/folha.model';
import { Permission, Unidade } from '../../models/usuario.model';

interface FolhaFuncFormValue {
  nome: string;
  cpf: string;
  telefone: string;
  endereco: string;
  email: string;
  dataNascimento: string;
  unidade: Unidade;
  cargoId: string | null;
  setorId: string | null;
  dataAdmissao: string;
  dataDemissao: string;
  ativo: boolean;
  tipoPix: TipoChavePixFolha | null;
  chavePix: string;
}import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-folha-funcionario-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ConfirmationModalComponent,
  ],
  templateUrl: './folha-funcionario-form.html',
  styleUrls: ['./folha-entity-form.css', './folha-pages.shared.css'],
})
export class FolhaFuncionarioFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private folha = inject(FolhaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errors = inject(ErrorModalService);
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);

  form: FormGroup;
  isEditMode = false;
  funcionarioId?: string;
  loading = false;
  isSubmitting = false;
  error: string | null = null;
  entidade: FuncionarioFolha | null = null;

  Unidade = Unidade;
  unidades = Object.values(Unidade);
  unidadeDisabled = false;
  cargosCatalogo: FolhaCadastroSimples[] = [];
  setoresCatalogo: FolhaCadastroSimples[] = [];
  /** Verbas ativas disponíveis para eventos fixos. */
  verbasCatalogo: FolhaVerba[] = [];
  /** Linhas persistidas após confirmar o modal (incluir/editar). */
  linhasEventoFixo: {
    idRow: string;
    folhaVerbaId: string;
    quantidadeTexto: string;
    valorTexto: string;
  }[] = [];
  private idLinhaEvtSeq = 0;

  /** Modal de inclusão/edição de um evento fixo. */
  modalEvtFixoAberto = false;
  /** `null` = novo; índice em `linhasEventoFixo` = edição. */
  modalEvtFixoEdicaoIndice: number | null = null;
  modalEvtFixoDraft: {
    folhaVerbaId: string;
    quantidadeTexto: string;
    valorTexto: string;
  } = {
    folhaVerbaId: '',
    quantidadeTexto: '1',
    valorTexto: '',
  };

  showConfirmRemoverEvtFixo = false;
  indiceRemocaoEvtFixo: number | null = null;

  TipoChavePixFolha = TipoChavePixFolha;
  FolhaMovimentoTipo = FolhaMovimentoTipo;
  tipoPixSelect: { value: TipoChavePixFolha; label: string }[] = [
    { value: TipoChavePixFolha.CPF, label: 'CPF' },
    { value: TipoChavePixFolha.TELEFONE, label: 'Telefone' },
    { value: TipoChavePixFolha.EMAIL, label: 'E-mail' },
    { value: TipoChavePixFolha.CHAVE_ALEATORIA, label: 'Chave aleatória' },
  ];

  constructor() {
    this.form = this.fb.group(
      {
        nome: ['', [Validators.required, Validators.maxLength(200)]],
        telefone: ['', [Validators.maxLength(40)]],
        endereco: ['', [Validators.maxLength(500)]],
        email: ['', [Validators.email, Validators.maxLength(254)]],
        dataNascimento: ['', [Validators.required]],
        unidade: ['', [Validators.required]],
        cargoId: [null as string | null],
        setorId: [null as string | null],
        dataAdmissao: ['', [Validators.required]],
        dataDemissao: [''],
        ativo: [true],
        cpf: ['', [Validators.maxLength(14)]],
        tipoPix: [null as TipoChavePixFolha | null],
        chavePix: [
          '',
          [
            Validators.maxLength(200),
            (c: AbstractControl): ValidationErrors | null =>
              this.chavePixFormato(c),
          ],
        ],
      },
      {
        validators: [
          (g: AbstractControl): ValidationErrors | null =>
            this.pixParValidator(g),
        ],
      },
    );
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.applyUnidadeFromUsuario();

    this.form.get('tipoPix')?.valueChanges.subscribe(() => {
      this.form.get('chavePix')?.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity({ emitEvent: false });
    });
    this.form.get('chavePix')?.valueChanges.subscribe(() => {
      this.form.updateValueAndValidity({ emitEvent: false });
    });

    if (id) {
      this.isEditMode = true;
      this.funcionarioId = id;
      if (!this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_READ)) {
        this.errors.show(
          'Você não possui permissão para visualizar o cadastro.',
          'Acesso negado',
        );
        void this.router.navigate(['/folha/funcionarios']);
        return;
      }
      if (!this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_UPDATE)) {
        this.errors.show(
          'Você não possui permissão para editar funcionários.',
          'Acesso negado',
        );
        void this.router.navigate(['/folha/funcionarios']);
        return;
      }
      this.carregarOpcoesCatalogo(() => this.loadFuncionario(id));
    } else {
      if (!this.auth.hasPermission(Permission.FOLHA_FUNCIONARIO_CREATE)) {
        this.errors.show(
          'Você não possui permissão para criar funcionários.',
          'Acesso negado',
        );
        void this.router.navigate(['/folha/funcionarios']);
        return;
      }
      this.carregarOpcoesCatalogo();
    }

    this.pageCtx.setContext({
      title: this.isEditMode ? 'Editar funcionário' : 'Novo funcionário',
      description: this.isEditMode
        ? 'Dados pessoais e dados da folha no mesmo cadastro.'
        : 'Informe primeiro os dados pessoais e os dados utilizados na folha.',
    });
  }

  get nomeCtrl() {
    return this.form.get('nome');
  }

  get unidadeCtrl() {
    return this.form.get('unidade');
  }

  private applyUnidadeFromUsuario(): void {
    const u = this.auth.getCurrentUser();
    if (u?.unidade && String(u.unidade).trim() !== '') {
      this.unidadeDisabled = true;
      this.form.patchValue({ unidade: u.unidade as Unidade });
      this.form.get('unidade')?.disable();
    } else {
      this.unidadeDisabled = false;
      this.form.get('unidade')?.enable();
    }
  }

  get emailCtrl() {
    return this.form.get('email');
  }

  get dataNascimentoCtrl() {
    return this.form.get('dataNascimento');
  }

  get dataAdmissaoCtrl() {
    return this.form.get('dataAdmissao');
  }

  get tipoPixCtrl() {
    return this.form.get('tipoPix');
  }

  get chavePixCtrl() {
    return this.form.get('chavePix');
  }

  private novaLinhaEventoFixoId(): string {
    this.idLinhaEvtSeq += 1;
    return `evt-fix-${this.idLinhaEvtSeq}`;
  }

  /** Cadastro novo: sem linhas até o usuário incluir via modal (RN-013). */
  inicializarLinhasEventoFixoParaNovo(): void {
    this.linhasEventoFixo = [];
  }

  verbasParaEventoFixo(): FolhaVerba[] {
    return this.verbasCatalogo.filter((v) => v.ativo);
  }

  /** Select do modal: ativas + verba já escolhida (ex.: inativa vinda da API). */
  verbasOpcoesModalEventoFixo(): FolhaVerba[] {
    const base = this.verbasParaEventoFixo();
    const vid = String(this.modalEvtFixoDraft.folhaVerbaId ?? '').trim();
    if (!vid) return base;
    if (base.some((v) => v.id === vid)) return base;
    const extra = this.verbasCatalogo.find((v) => v.id === vid);
    return extra ? [...base, extra] : base;
  }

  tituloModalEventoFixo(): string {
    return this.modalEvtFixoEdicaoIndice !== null
      ? 'Editar evento fixo'
      : 'Incluir evento fixo';
  }

  get modalEvtFixoSalvarDesabilitado(): boolean {
    return this.loading || this.isSubmitting;
  }

  /** Resumo da verba escolhida no modal (igual inclusão na tela de lançamentos). */
  get descricaoVerbaModalEvtFixoSelecionada(): string {
    const id = String(this.modalEvtFixoDraft.folhaVerbaId ?? '').trim();
    if (!id) return '';
    const vb = this.verbasCatalogo.find((v) => v.id === id);
    return vb?.descricao?.trim() ?? '';
  }

  get tipoMovimentoModalEvtFixoSelecionado(): FolhaMovimentoTipo | null {
    const id = String(this.modalEvtFixoDraft.folhaVerbaId ?? '').trim();
    if (!id) return null;
    const vb = this.verbasCatalogo.find((v) => v.id === id);
    return vb?.tipoMovimento ?? null;
  }

  get mensagemConfirmRemoverEvtFixo(): string {
    if (this.indiceRemocaoEvtFixo === null) {
      return 'Deseja remover este evento fixo da lista?';
    }
    const row = this.linhasEventoFixo[this.indiceRemocaoEvtFixo];
    if (!row) return 'Deseja remover este evento fixo da lista?';
    const nome = this.descricaoVerbaEvtFixoRow(row);
    return `Deseja remover o evento fixo «${nome}» desta lista? A alteração vale ao salvar o funcionário.`;
  }

  abrirModalNovoEventoFixo(): void {
    if (this.loading || this.isSubmitting) return;
    this.modalEvtFixoEdicaoIndice = null;
    this.modalEvtFixoDraft = {
      folhaVerbaId: '',
      quantidadeTexto: '1',
      valorTexto: '',
    };
    this.modalEvtFixoAberto = true;
  }

  abrirModalEditarEventoFixo(i: number): void {
    if (this.loading || this.isSubmitting) return;
    const row = this.linhasEventoFixo[i];
    if (!row) return;
    this.modalEvtFixoEdicaoIndice = i;
    this.modalEvtFixoDraft = {
      folhaVerbaId: row.folhaVerbaId,
      quantidadeTexto: row.quantidadeTexto,
      valorTexto: row.valorTexto,
    };
    this.modalEvtFixoAberto = true;
  }

  fecharModalEventoFixo(): void {
    this.modalEvtFixoAberto = false;
    this.modalEvtFixoEdicaoIndice = null;
  }

  onModalEvtFixoValorBlur(): void {
    const raw = String(this.modalEvtFixoDraft.valorTexto ?? '').trim();
    if (!raw) {
      this.modalEvtFixoDraft.valorTexto = '';
      return;
    }
    const n = this.parseValorMonetario(raw);
    if (n !== null && !Number.isNaN(n)) {
      this.modalEvtFixoDraft.valorTexto = this.formatMoedaPtBr(n);
    }
  }

  confirmarModalEventoFixo(): void {
    const vid = String(this.modalEvtFixoDraft.folhaVerbaId ?? '').trim();
    if (!vid) {
      this.errors.show('Escolha um evento para incluir.', 'Eventos fixos');
      return;
    }
    const q = this.parseQuantidadeEvtTxt(this.modalEvtFixoDraft.quantidadeTexto);
    if (q === null || q < 0.0001) {
      this.errors.show(
        'Informe referência / quantidade maior que zero.',
        'Eventos fixos',
      );
      return;
    }
    const vRaw = String(this.modalEvtFixoDraft.valorTexto ?? '').trim();
    if (!vRaw) {
      this.errors.show('Informe o valor.', 'Eventos fixos');
      return;
    }
    const valor = this.parseValorMonetario(vRaw);
    if (valor === null || Number.isNaN(valor)) {
      this.errors.show('Valor inválido.', 'Eventos fixos');
      return;
    }
    const vb = this.verbasCatalogo.find((x) => x.id === vid);
    if (!vb?.ativo) {
      this.errors.show(
        'Use apenas eventos ativos nos eventos fixos.',
        'Eventos fixos',
      );
      return;
    }
    const idxEdicao = this.modalEvtFixoEdicaoIndice;
    const duplicado = this.linhasEventoFixo.some(
      (r, idx) =>
        String(r.folhaVerbaId ?? '').trim() === vid &&
        (idxEdicao === null || idx !== idxEdicao),
    );
    if (duplicado) {
      this.errors.show(
        'Não repita o mesmo evento nas linhas de eventos fixos.',
        'Eventos fixos',
      );
      return;
    }

    const linhaSalva = {
      idRow:
        idxEdicao !== null
          ? this.linhasEventoFixo[idxEdicao]!.idRow
          : this.novaLinhaEventoFixoId(),
      folhaVerbaId: vid,
      quantidadeTexto: this.formatQuantidadeEvtApi(String(q)),
      valorTexto: this.formatMoedaPtBr(valor),
    };

    if (idxEdicao !== null) {
      const next = [...this.linhasEventoFixo];
      next[idxEdicao] = linhaSalva;
      this.linhasEventoFixo = next;
    } else {
      this.linhasEventoFixo = [...this.linhasEventoFixo, linhaSalva];
    }
    this.fecharModalEventoFixo();
  }

  descricaoVerbaEvtFixoRow(row: {
    folhaVerbaId: string;
  }): string {
    const id = String(row.folhaVerbaId ?? '').trim();
    if (!id) return '—';
    const v = this.verbasCatalogo.find((x) => x.id === id);
    if (!v) return '—';
    const tipo =
      v.tipoMovimento === FolhaMovimentoTipo.RECEITA ? 'Receita' : 'Despesa';
    return `${v.descricao} (${tipo})`;
  }

  formatQuantidadeEvtApi(q?: string | null): string {
    const n = Number.parseFloat(String(q ?? '1').replace(',', '.'));
    const x = Number.isFinite(n) ? n : 1;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(x);
  }

  aplicarLinhasEventoFixosDaApi(rows: FuncionarioFolha['eventosFixos']): void {
    if (!rows?.length) {
      this.linhasEventoFixo = [];
      return;
    }
    this.linhasEventoFixo = rows.map((e) => ({
      idRow: this.novaLinhaEventoFixoId(),
      folhaVerbaId: e.folhaVerba?.id ?? '',
      quantidadeTexto: this.formatQuantidadeEvtApi(e.quantidade),
      valorTexto:
        e.valor != null && `${e.valor}` !== ''
          ? this.formatMoedaPtBr(Number(e.valor))
          : '',
    }));
  }

  solicitarRemoverLinhaEventoFixo(i: number): void {
    if (this.loading || this.isSubmitting) return;
    this.indiceRemocaoEvtFixo = i;
    this.showConfirmRemoverEvtFixo = true;
  }

  fecharConfirmRemoverEvtFixo(): void {
    this.showConfirmRemoverEvtFixo = false;
    this.indiceRemocaoEvtFixo = null;
  }

  confirmarRemoverEvtFixo(): void {
    if (this.indiceRemocaoEvtFixo === null) {
      this.fecharConfirmRemoverEvtFixo();
      return;
    }
    const idx = this.indiceRemocaoEvtFixo;
    this.fecharConfirmRemoverEvtFixo();
    this.executarRemoverLinhaEventoFixo(idx);
  }

  private executarRemoverLinhaEventoFixo(i: number): void {
    const next = this.linhasEventoFixo.slice();
    next.splice(i, 1);
    this.linhasEventoFixo = next;
  }

  trackByLinhaEvt(_idx: number, row: { idRow: string }): string {
    return row.idRow;
  }

  parseQuantidadeEvtTxt(raw: string): number | null {
    let t = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (!t) return null;
    if (t.includes(',') && /\.\d{3}/.test(t)) {
      t = t.replace(/\./g, '').replace(',', '.');
    }
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }

  private validarMontarPayloadEventosFixos(): { ok: true; items: { folhaVerbaId: string; quantidade?: number; valor: number }[] } | { ok: false; msg: string } {
    for (const row of this.linhasEventoFixo) {
      const vid = String(row.folhaVerbaId ?? '').trim();
      const valT = String(row.valorTexto ?? '').trim();
      if (!vid && valT !== '') {
        return {
          ok: false,
          msg: 'Selecione o evento em cada linha que tiver valor preenchido, ou limpe o valor.',
        };
      }
    }

    const montado: { folhaVerbaId: string; quantidade?: number; valor: number }[] = [];
    const verbEscolhidos: string[] = [];
    for (const row of this.linhasEventoFixo) {
      const vid = String(row.folhaVerbaId ?? '').trim();
      if (!vid) {
        continue;
      }
      if (verbEscolhidos.includes(vid)) {
        return {
          ok: false,
          msg: 'Não repita o mesmo evento nas linhas de eventos fixos.',
        };
      }
      verbEscolhidos.push(vid);
      const q = this.parseQuantidadeEvtTxt(row.quantidadeTexto);
      if (q === null || q < 0.0001) {
        return {
          ok: false,
          msg: 'Informe referência / quantidade maior que zero para cada evento fixo.',
        };
      }
      const vRaw = String(row.valorTexto ?? '').trim();
      if (!vRaw) {
        return { ok: false, msg: 'Informe o valor de cada evento fixo.' };
      }
      const valor = this.parseValorMonetario(vRaw);
      if (valor === null || Number.isNaN(valor)) {
        return { ok: false, msg: 'Valor inválido em evento fixo.' };
      }
      const vb = this.verbasCatalogo.find((x) => x.id === vid);
      if (!vb?.ativo) {
        return {
          ok: false,
          msg: 'Use apenas eventos ativos nos eventos fixos.',
        };
      }
      montado.push({
        folhaVerbaId: vid,
        quantidade: q,
        valor,
      });
    }
    return { ok: true, items: montado };
  }

  /** Tipo e chave Pix: ambos vazios ou ambos preenchidos (coerência). */
  private pixParValidator(group: AbstractControl): ValidationErrors | null {
    const tipo = group.get('tipoPix')?.value as TipoChavePixFolha | null;
    const chave = String(group.get('chavePix')?.value ?? '').trim();
    const temTipo = tipo != null;
    const temChave = chave.length > 0;
    if (temTipo === temChave) {
      return null;
    }
    return { pixPar: true };
  }

  private chavePixFormato(control: AbstractControl): ValidationErrors | null {
    const v = String(control.value ?? '').trim();
    if (!v) {
      return null;
    }
    const tipo = control.parent?.get('tipoPix')
      ?.value as TipoChavePixFolha | null;
    if (!tipo) {
      return null;
    }
    return this.mensagemChavePixInvalida(tipo, v)
      ? { pixFormato: true }
      : null;
  }

  /** Retorna mensagem se inválido; null se válido. */
  private mensagemChavePixInvalida(
    tipo: TipoChavePixFolha,
    chave: string,
  ): string | null {
    const c = chave.trim();
    switch (tipo) {
      case TipoChavePixFolha.CPF: {
        const d = c.replace(/\D/g, '');
        return d.length === 11
          ? null
          : 'CPF da chave Pix deve ter 11 dígitos.';
      }
      case TipoChavePixFolha.TELEFONE: {
        const d = c.replace(/\D/g, '');
        return d.length >= 10 && d.length <= 13
          ? null
          : 'Telefone da chave Pix deve ter entre 10 e 13 dígitos.';
      }
      case TipoChavePixFolha.EMAIL: {
        const ok =
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
            c,
          );
        return ok ? null : 'Informe um e-mail válido para a chave Pix.';
      }
      case TipoChavePixFolha.CHAVE_ALEATORIA: {
        const hex = c.replace(/-/g, '');
        const ok =
          hex.length === 32 && /^[0-9a-f]+$/i.test(hex);
        return ok
          ? null
          : 'Chave aleatória: use 32 caracteres hexadecimais (UUID com ou sem hífens).';
      }
      default:
        return 'Tipo de chave Pix inválido.';
    }
  }

  mensagemErroPixPar(): string | null {
    if (!this.form.touched && !this.form.dirty) {
      return null;
    }
    if (!this.form.hasError('pixPar')) {
      return null;
    }
    const tipo = this.tipoPixCtrl?.value;
    const chave = String(this.chavePixCtrl?.value ?? '').trim();
    if (tipo != null && !chave) {
      return 'Informe a chave Pix ou limpe o tipo.';
    }
    if (tipo == null && chave) {
      return 'Informe o tipo do Pix ou limpe a chave.';
    }
    return null;
  }

  mensagemErroChavePix(): string | null {
    const ctrl = this.chavePixCtrl;
    if (!ctrl?.touched && !ctrl?.dirty) {
      return null;
    }
    if (ctrl?.hasError('pixFormato')) {
      const tipo = this.tipoPixCtrl?.value as TipoChavePixFolha;
      const raw = String(ctrl?.value ?? '');
      return this.mensagemChavePixInvalida(tipo, raw);
    }
    return null;
  }

  private patchDateField(v?: string | null): string {
    if (v == null || v === '') return '';
    return String(v).split('T')[0];
  }

  /** Converte entrada com R$, espaços e formato pt-BR (milhar) para número ou null se vazio. */
  parseValorMonetario(raw: string): number | null {
    const s = String(raw ?? '')
      .replace(/\s/g, '')
      .replace(/^R\$/i, '')
      .trim();
    if (!s) return null;
    const normalized = s.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  formatMoedaPtBr(n: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  private carregarOpcoesCatalogo(andThen?: () => void): void {
    this.loading = true;
    forkJoin({
      cargos: this.folha.listarCargos(),
      setores: this.folha.listarSetores(),
      verbas: this.folha.listarVerbas(),
    }).subscribe({
      next: ({ cargos, setores, verbas }) => {
        this.cargosCatalogo = cargos;
        this.setoresCatalogo = setores;
        this.verbasCatalogo = verbas ?? [];
        if (andThen) {
          andThen();
        } else {
          this.inicializarLinhasEventoFixoParaNovo();
          this.loading = false;
        }
      },
      error: () => {
        this.loading = false;
        this.errors.show(
          'Não foi possível carregar listas auxiliares (cargos, setores ou eventos).',
          'Folha',
        );
        void this.router.navigate(['/folha/funcionarios']);
      },
    });
  }

  private loadFuncionario(id: string): void {
    this.loading = true;
    this.error = null;
    this.folha.getFuncionario(id).subscribe({
      next: (f) => {
        this.entidade = f;
        const tipo =
          f.tipoPix &&
          Object.values(TipoChavePixFolha).includes(f.tipoPix as TipoChavePixFolha)
            ? f.tipoPix
            : null;
        this.form.patchValue({
          nome: f.nome,
          unidade: f.unidade,
          cpf: f.cpf ?? '',
          telefone: f.telefone ?? '',
          endereco: f.endereco ?? '',
          email: f.email ?? '',
          dataNascimento: this.patchDateField(f.dataNascimento),
          dataAdmissao: this.patchDateField(f.dataAdmissao),
          dataDemissao: this.patchDateField(f.dataDemissao),
          cargoId: f.cargo?.id ?? f.cargoId ?? null,
          setorId: f.setor?.id ?? f.setorId ?? null,
          ativo: f.ativo ?? true,
          tipoPix: tipo,
          chavePix: f.chavePix ?? '',
        });
        this.aplicarLinhasEventoFixosDaApi(f.eventosFixos);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Erro ao carregar funcionário.';
        this.errors.show(this.error!, 'Erro');
      },
    });
  }

  private buildPayloadRaw(): Record<string, unknown> {
    const v = this.form.getRawValue() as unknown as FolhaFuncFormValue;
    const payload: Record<string, unknown> = {
      nome: v.nome.trim(),
      unidade: v.unidade,
      ativo: v.ativo !== false,
      dataNascimento: (v.dataNascimento || '').trim(),
      dataAdmissao: (v.dataAdmissao || '').trim(),
    };
    const tipo = v.tipoPix;
    const chave = (v.chavePix || '').trim();
    if (tipo != null && chave) {
      payload['tipoPix'] = tipo;
      payload['chavePix'] = chave;
    } else {
      payload['tipoPix'] = null;
      payload['chavePix'] = null;
    }
    const cpf = v.cpf.trim();
    if (cpf) payload['cpf'] = cpf;

    const tel = v.telefone?.trim?.() ?? '';
    if (tel) payload['telefone'] = tel;

    const end = v.endereco?.trim?.() ?? '';
    if (end) payload['endereco'] = end;

    const em = v.email?.trim?.() ?? '';
    if (em) payload['email'] = em;

    const dd = (v.dataDemissao || '').trim();
    if (dd) payload['dataDemissao'] = dd;
    const cid = v.cargoId != null ? String(v.cargoId).trim() : '';
    payload['cargoId'] = cid || null;

    const sid = v.setorId != null ? String(v.setorId).trim() : '';
    payload['setorId'] = sid || null;

    return payload;
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) {
      if (this.form.invalid) this.form.markAllAsTouched();
      return;
    }

    const evRes = this.validarMontarPayloadEventosFixos();
    if (!evRes.ok) {
      this.errors.show(evRes.msg, 'Eventos fixos');
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    const body = this.buildPayloadRaw();
    body['eventosFixos'] = evRes.items;
    if (this.isEditMode && this.funcionarioId) {
      this.folha.patchFuncionario(this.funcionarioId, body).subscribe({
        next: () => {
          void this.router.navigate(['/folha/funcionarios']);
        },
        error: (e: { error?: { message?: string } }) => this.handleSaveErr(e),
      });
      return;
    }
    this.folha.criarFuncionario(body as { unidade: Unidade }).subscribe({
      next: () => void this.router.navigate(['/folha/funcionarios']),
      error: (e: { error?: { message?: string } }) => this.handleSaveErr(e),
    });
  }

  private handleSaveErr(e: { error?: { message?: string } }): void {
    this.isSubmitting = false;
    const msg = e?.error?.message ?? 'Erro ao salvar.';
    this.error = msg;
    this.errors.show(msg, 'Erro');
  }

  onCancel(): void {
    void this.router.navigate(['/folha/funcionarios']);
  }
}
