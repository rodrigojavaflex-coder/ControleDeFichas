import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { UserListComponent } from './components/user-list/user-list';
import { UserFormComponent } from './components/user-form/user-form';
import { AuditoriaComponent } from './components/auditoria/auditoria';
import { authGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';
import { ConfiguracaoComponent } from './modules/configuracao/configuracao.component';
import { HomeComponent } from './components/home/home';
import { ChangePasswordComponent } from './components/change-password/change-password';
import { PerfilListComponent } from './components/perfil-list/perfil-list';
import { PerfilFormComponent } from './components/perfil-form/perfil-form';
import { Permission } from './models/usuario.model';

const PERMS = {
  auditoria: [Permission.AUDIT_VIEW, Permission.AUDIT_MANAGE],
  users: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
  ],
  perfil: [
    Permission.PROFILE_CREATE,
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.PROFILE_DELETE,
  ],
  configuracao: [Permission.CONFIGURACAO_ACCESS],
  fichas: [
    Permission.FICHA_TECNICA_CREATE,
    Permission.FICHA_TECNICA_READ,
    Permission.FICHA_TECNICA_UPDATE,
    Permission.FICHA_TECNICA_DELETE,
  ],
  certificados: [
    Permission.CERTIFICADO_CREATE,
    Permission.CERTIFICADO_READ,
    Permission.CERTIFICADO_UPDATE,
    Permission.CERTIFICADO_DELETE,
  ],
  vendas: [
    Permission.VENDA_CREATE,
    Permission.VENDA_READ,
    Permission.VENDA_UPDATE,
    Permission.VENDA_DELETE,
  ],
  fechamentoVendas: [Permission.VENDA_ACESSAR_FECHAMENTO],
  fechamentoCaixa: [Permission.VENDA_FECHAR_CAIXA],
  baixas: [Permission.VENDA_BAIXAR],
  acompanharVendas: [Permission.VENDA_ACOMPANHAR],
  analiseValores: [Permission.VENDA_ANALISE_VALORES],
  clientes: [
    Permission.CLIENTE_CREATE,
    Permission.CLIENTE_READ,
    Permission.CLIENTE_UPDATE,
    Permission.CLIENTE_DELETE,
  ],
  vendedores: [
    Permission.VENDEDOR_CREATE,
    Permission.VENDEDOR_READ,
    Permission.VENDEDOR_UPDATE,
    Permission.VENDEDOR_DELETE,
  ],
  prescritores: [
    Permission.PRESCRITOR_CREATE,
    Permission.PRESCRITOR_READ,
    Permission.PRESCRITOR_UPDATE,
    Permission.PRESCRITOR_DELETE,
  ],
  folhaFuncionarios: [
    Permission.FOLHA_FUNCIONARIO_CREATE,
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_FUNCIONARIO_UPDATE,
    Permission.FOLHA_FUNCIONARIO_DELETE,
  ],
  folhaCargos: [
    Permission.FOLHA_CARGO_CREATE,
    Permission.FOLHA_CARGO_READ,
    Permission.FOLHA_CARGO_UPDATE,
    Permission.FOLHA_CARGO_DELETE,
  ],
  folhaSetores: [
    Permission.FOLHA_SETOR_CREATE,
    Permission.FOLHA_SETOR_READ,
    Permission.FOLHA_SETOR_UPDATE,
    Permission.FOLHA_SETOR_DELETE,
  ],
  folhaVerbas: [
    Permission.FOLHA_VERBA_CREATE,
    Permission.FOLHA_VERBA_READ,
    Permission.FOLHA_VERBA_UPDATE,
    Permission.FOLHA_VERBA_DELETE,
  ],
  folhaTipos: [
    Permission.FOLHA_TIPO_CREATE,
    Permission.FOLHA_TIPO_READ,
    Permission.FOLHA_TIPO_UPDATE,
    Permission.FOLHA_TIPO_DELETE,
  ],
  folhaLancamentos: [
    Permission.FOLHA_LANCAMENTO_CREATE,
    Permission.FOLHA_LANCAMENTO_READ,
    Permission.FOLHA_LANCAMENTO_UPDATE,
    Permission.FOLHA_LANCAMENTO_DELETE,
  ],
  folhaControle: [
    Permission.FOLHA_FECHAMENTO_READ,
    Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
    Permission.FOLHA_FECHAMENTO_FECHAR,
    Permission.FOLHA_FECHAMENTO_REABRIR,
  ],
  folhaWhatsapp: [Permission.FOLHA_WHATSAPP_READ],
  orcamentosDashboard: [Permission.ORCAMENTO_DASHBOARD_READ],
  orcamentos: [
    Permission.ORCAMENTO_REJEITADO_READ,
    Permission.ORCAMENTO_APROVADO_READ,
  ],
  orcamentosMotivos: [
    Permission.ORCAMENTO_MOTIVO_CREATE,
    Permission.ORCAMENTO_MOTIVO_READ,
    Permission.ORCAMENTO_MOTIVO_UPDATE,
    Permission.ORCAMENTO_MOTIVO_DELETE,
  ],
} as const;

/** Guards padrão: autenticado + permissão da rota (`data.permissions`). */
const guarded = [authGuard, permissionGuard];

export const routes: Routes = [
  {
    path: 'configuracao',
    component: ConfiguracaoComponent,
    canActivate: guarded,
    data: { permissions: [...PERMS.configuracao] },
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: guarded,
    data: { permissions: [...PERMS.users] },
  },
  {
    path: 'users/new',
    component: UserFormComponent,
    canActivate: guarded,
    data: { permissions: [Permission.USER_CREATE] },
  },
  {
    path: 'users/edit/:id',
    component: UserFormComponent,
    canActivate: guarded,
    data: { permissions: [Permission.USER_UPDATE] },
  },
  {
    path: 'users/:id/change-password',
    component: ChangePasswordComponent,
    canActivate: guarded,
    data: { permissions: [Permission.USER_UPDATE] },
  },
  {
    path: 'auditoria',
    component: AuditoriaComponent,
    canActivate: guarded,
    data: { permissions: [...PERMS.auditoria] },
  },
  {
    path: 'fichas-tecnicas',
    loadComponent: () =>
      import('./components/ficha-tecnica-list/ficha-tecnica-list').then(
        (m) => m.FichaTecnicaListComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.fichas] },
  },
  {
    path: 'fichas-tecnicas/new',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.FICHA_TECNICA_CREATE] },
  },
  {
    path: 'fichas-tecnicas/edit/:id',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.FICHA_TECNICA_UPDATE] },
  },
  {
    path: 'fichas-tecnicas/view/:id',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.FICHA_TECNICA_READ] },
  },
  {
    path: 'certificados/new',
    loadComponent: () =>
      import('./components/certificado-form/certificado-form').then(
        (m) => m.CertificadoFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.CERTIFICADO_CREATE] },
  },
  {
    path: 'certificados/edit/:id',
    loadComponent: () =>
      import('./components/certificado-form/certificado-form').then(
        (m) => m.CertificadoFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.CERTIFICADO_UPDATE] },
  },
  {
    path: 'vendas',
    loadComponent: () =>
      import('./components/vendas-list/vendas-list').then((m) => m.VendasListComponent),
    canActivate: guarded,
    data: { permissions: [...PERMS.vendas] },
  },
  {
    path: 'fechamento-vendas',
    loadComponent: () =>
      import('./components/fechamento-vendas-list/fechamento-vendas-list').then(
        (m) => m.FechamentoVendasListComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.fechamentoVendas] },
  },
  {
    path: 'relatorios/fechamento-caixa',
    loadComponent: () =>
      import('./components/fechamento-caixa-page/fechamento-caixa-page').then(
        (m) => m.FechamentoCaixaPageComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.fechamentoCaixa] },
  },
  {
    path: 'relatorios/baixas',
    loadComponent: () =>
      import('./components/baixas-list/baixas-list').then((m) => m.BaixasListComponent),
    canActivate: guarded,
    data: { permissions: [...PERMS.baixas] },
  },
  {
    path: 'relatorios/acompanhar-vendas',
    loadComponent: () =>
      import('./components/acompanhar-vendas/acompanhar-vendas').then(
        (m) => m.AcompanharVendasComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.acompanharVendas] },
  },
  {
    path: 'relatorios/analise-valores',
    loadComponent: () =>
      import('./components/analise-valores-list/analise-valores-list').then(
        (m) => m.AnaliseValoresListComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.analiseValores] },
  },
  {
    path: 'perfil/new',
    component: PerfilFormComponent,
    canActivate: guarded,
    data: { permissions: [Permission.PROFILE_CREATE] },
  },
  {
    path: 'perfil/edit/:id',
    component: PerfilFormComponent,
    canActivate: guarded,
    data: { permissions: [Permission.PROFILE_UPDATE] },
  },
  {
    path: 'perfil',
    component: PerfilListComponent,
    canActivate: guarded,
    data: { permissions: [...PERMS.perfil] },
    pathMatch: 'full',
  },
  {
    path: 'clientes',
    loadComponent: () =>
      import('./components/clientes-list/clientes-list').then((m) => m.ClientesListComponent),
    canActivate: guarded,
    data: { permissions: [...PERMS.clientes] },
  },
  {
    path: 'clientes/new',
    loadComponent: () =>
      import('./components/cliente-form/cliente-form').then((m) => m.ClienteFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.CLIENTE_CREATE] },
  },
  {
    path: 'clientes/edit/:id',
    loadComponent: () =>
      import('./components/cliente-form/cliente-form').then((m) => m.ClienteFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.CLIENTE_UPDATE] },
  },
  {
    path: 'vendedores',
    loadComponent: () =>
      import('./components/vendedores-list/vendedores-list').then((m) => m.VendedoresListComponent),
    canActivate: guarded,
    data: { permissions: [...PERMS.vendedores] },
  },
  {
    path: 'vendedores/new',
    loadComponent: () =>
      import('./components/vendedor-form/vendedor-form').then((m) => m.VendedorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.VENDEDOR_CREATE] },
  },
  {
    path: 'vendedores/edit/:id',
    loadComponent: () =>
      import('./components/vendedor-form/vendedor-form').then((m) => m.VendedorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.VENDEDOR_UPDATE] },
  },
  {
    path: 'prescritores',
    loadComponent: () =>
      import('./components/prescritores-list/prescritores-list').then(
        (m) => m.PrescritoresListComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.prescritores] },
  },
  {
    path: 'prescritores/new',
    loadComponent: () =>
      import('./components/prescritor-form/prescritor-form').then((m) => m.PrescritorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.PRESCRITOR_CREATE] },
  },
  {
    path: 'prescritores/edit/:id',
    loadComponent: () =>
      import('./components/prescritor-form/prescritor-form').then((m) => m.PrescritorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.PRESCRITOR_UPDATE] },
  },
  {
    path: 'folha/funcionarios',
    loadComponent: () =>
      import('./components/folha/folha-funcionarios-page').then((m) => m.FolhaFuncionariosPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaFuncionarios] },
  },
  {
    path: 'folha/funcionarios/new',
    loadComponent: () =>
      import('./components/folha/folha-funcionario-form').then((m) => m.FolhaFuncionarioFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_FUNCIONARIO_CREATE] },
  },
  {
    path: 'folha/funcionarios/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-funcionario-form').then((m) => m.FolhaFuncionarioFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_FUNCIONARIO_UPDATE] },
  },
  {
    path: 'folha/cargos',
    loadComponent: () =>
      import('./components/folha/folha-cargos-page').then((m) => m.FolhaCargosPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaCargos] },
  },
  {
    path: 'folha/cargos/new',
    loadComponent: () =>
      import('./components/folha/folha-cargo-form').then((m) => m.FolhaCargoFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_CARGO_CREATE] },
  },
  {
    path: 'folha/cargos/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-cargo-form').then((m) => m.FolhaCargoFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_CARGO_UPDATE] },
  },
  {
    path: 'folha/setores',
    loadComponent: () =>
      import('./components/folha/folha-setores-page').then((m) => m.FolhaSetoresPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaSetores] },
  },
  {
    path: 'folha/setores/new',
    loadComponent: () =>
      import('./components/folha/folha-setor-form').then((m) => m.FolhaSetorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_SETOR_CREATE] },
  },
  {
    path: 'folha/setores/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-setor-form').then((m) => m.FolhaSetorFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_SETOR_UPDATE] },
  },
  {
    path: 'folha/verbas',
    loadComponent: () =>
      import('./components/folha/folha-verbas-page').then((m) => m.FolhaVerbasPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaVerbas] },
  },
  {
    path: 'folha/verbas/new',
    loadComponent: () =>
      import('./components/folha/folha-verba-form').then((m) => m.FolhaVerbaFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_VERBA_CREATE] },
  },
  {
    path: 'folha/verbas/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-verba-form').then((m) => m.FolhaVerbaFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_VERBA_UPDATE] },
  },
  {
    path: 'folha/tipos',
    loadComponent: () =>
      import('./components/folha/folha-tipos-page').then((m) => m.FolhaTiposPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaTipos] },
  },
  {
    path: 'folha/tipos/new',
    loadComponent: () =>
      import('./components/folha/folha-tipo-form').then((m) => m.FolhaTipoFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_TIPO_CREATE] },
  },
  {
    path: 'folha/tipos/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-tipo-form').then((m) => m.FolhaTipoFormComponent),
    canActivate: guarded,
    data: { permissions: [Permission.FOLHA_TIPO_UPDATE] },
  },
  {
    path: 'folha/lancamentos',
    loadComponent: () =>
      import('./components/folha/folha-lancamentos-page').then((m) => m.FolhaLancamentosPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaLancamentos] },
  },
  {
    path: 'folha/controle',
    loadComponent: () =>
      import('./components/folha/folha-fechamento-page').then((m) => m.FolhaFechamentoPage),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaControle] },
  },
  {
    path: 'folha/atendimento-whatsapp',
    loadComponent: () =>
      import('./components/folha/folha-whatsapp-atendimento-page').then(
        (m) => m.FolhaWhatsappAtendimentoPage,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.folhaWhatsapp] },
  },
  {
    path: 'orcamentos/dashboard',
    loadComponent: () =>
      import('./components/orcamentos/orcamentos-dashboard-page').then(
        (m) => m.OrcamentosDashboardPage,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.orcamentosDashboard] },
  },
  {
    path: 'orcamentos',
    loadComponent: () =>
      import('./components/orcamentos/orcamentos-rejeitados-list').then(
        (m) => m.OrcamentosRejeitadosListComponent,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.orcamentos] },
  },
  {
    path: 'orcamentos/rejeitados',
    redirectTo: 'orcamentos',
    pathMatch: 'full',
  },
  {
    path: 'orcamentos/motivos-rejeicao',
    loadComponent: () =>
      import('./components/orcamentos/orcamentos-motivos-page').then(
        (m) => m.OrcamentosMotivosPage,
      ),
    canActivate: guarded,
    data: { permissions: [...PERMS.orcamentosMotivos] },
  },
  {
    path: 'orcamentos/motivos-rejeicao/new',
    loadComponent: () =>
      import('./components/orcamentos/orcamento-motivo-form').then(
        (m) => m.OrcamentoMotivoFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.ORCAMENTO_MOTIVO_CREATE] },
  },
  {
    path: 'orcamentos/motivos-rejeicao/edit/:id',
    loadComponent: () =>
      import('./components/orcamentos/orcamento-motivo-form').then(
        (m) => m.OrcamentoMotivoFormComponent,
      ),
    canActivate: guarded,
    data: { permissions: [Permission.ORCAMENTO_MOTIVO_UPDATE] },
  },
  {
    path: 'folha/fechamento',
    redirectTo: 'folha/controle',
    pathMatch: 'full',
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
