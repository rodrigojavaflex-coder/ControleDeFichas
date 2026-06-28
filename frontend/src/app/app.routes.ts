import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { UserListComponent } from './components/user-list/user-list';
import { UserFormComponent } from './components/user-form/user-form';
import { AuditoriaComponent } from './components/auditoria/auditoria';
import { authGuard } from './guards/auth.guard';
import { ConfiguracaoComponent } from './modules/configuracao/configuracao.component';
import { HomeComponent } from './components/home/home';
import { ChangePasswordComponent } from './components/change-password/change-password';
import { PerfilListComponent } from './components/perfil-list/perfil-list';
import { PerfilFormComponent } from './components/perfil-form/perfil-form';

export const routes: Routes = [
  {
    path: 'configuracao',
    component: ConfiguracaoComponent,
    canActivate: [authGuard],
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'users/new',
    component: UserFormComponent,
    canActivate: [authGuard],
  },
  {
    path: 'users/edit/:id',
    component: UserFormComponent,
    canActivate: [authGuard],
  },
  {
    path: 'users/:id/change-password',
    component: ChangePasswordComponent,
    canActivate: [authGuard],
  },
  {
    path: 'auditoria',
    component: AuditoriaComponent,
    canActivate: [authGuard],
  },
  {
    path: 'fichas-tecnicas',
    loadComponent: () =>
      import('./components/ficha-tecnica-list/ficha-tecnica-list').then(
        (m) => m.FichaTecnicaListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'fichas-tecnicas/new',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'fichas-tecnicas/edit/:id',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'fichas-tecnicas/view/:id',
    loadComponent: () =>
      import('./components/ficha-tecnica-form/ficha-tecnica-form').then(
        (m) => m.FichaTecnicaFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'certificados/new',
    loadComponent: () =>
      import('./components/certificado-form/certificado-form').then(
        (m) => m.CertificadoFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'certificados/edit/:id',
    loadComponent: () =>
      import('./components/certificado-form/certificado-form').then(
        (m) => m.CertificadoFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'vendas',
    loadComponent: () =>
      import('./components/vendas-list/vendas-list').then((m) => m.VendasListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'fechamento-vendas',
    loadComponent: () =>
      import('./components/fechamento-vendas-list/fechamento-vendas-list').then(
        (m) => m.FechamentoVendasListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'relatorios/baixas',
    loadComponent: () =>
      import('./components/baixas-list/baixas-list').then((m) => m.BaixasListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'relatorios/acompanhar-vendas',
    loadComponent: () =>
      import('./components/acompanhar-vendas/acompanhar-vendas').then(
        (m) => m.AcompanharVendasComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'relatorios/analise-valores',
    loadComponent: () =>
      import('./components/analise-valores-list/analise-valores-list').then(
        (m) => m.AnaliseValoresListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'perfil/new',
    component: PerfilFormComponent,
    canActivate: [authGuard],
  },
  {
    path: 'perfil/edit/:id',
    component: PerfilFormComponent,
    canActivate: [authGuard],
  },
  {
    path: 'perfil',
    component: PerfilListComponent,
    canActivate: [authGuard],
    pathMatch: 'full',
  },
  {
    path: 'clientes',
    loadComponent: () =>
      import('./components/clientes-list/clientes-list').then((m) => m.ClientesListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'clientes/new',
    loadComponent: () =>
      import('./components/cliente-form/cliente-form').then((m) => m.ClienteFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'clientes/edit/:id',
    loadComponent: () =>
      import('./components/cliente-form/cliente-form').then((m) => m.ClienteFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'vendedores',
    loadComponent: () =>
      import('./components/vendedores-list/vendedores-list').then((m) => m.VendedoresListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'vendedores/new',
    loadComponent: () =>
      import('./components/vendedor-form/vendedor-form').then((m) => m.VendedorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'vendedores/edit/:id',
    loadComponent: () =>
      import('./components/vendedor-form/vendedor-form').then((m) => m.VendedorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'prescritores',
    loadComponent: () =>
      import('./components/prescritores-list/prescritores-list').then(
        (m) => m.PrescritoresListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'prescritores/new',
    loadComponent: () =>
      import('./components/prescritor-form/prescritor-form').then((m) => m.PrescritorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'prescritores/edit/:id',
    loadComponent: () =>
      import('./components/prescritor-form/prescritor-form').then((m) => m.PrescritorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/funcionarios',
    loadComponent: () =>
      import('./components/folha/folha-funcionarios-page').then((m) => m.FolhaFuncionariosPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/funcionarios/new',
    loadComponent: () =>
      import('./components/folha/folha-funcionario-form').then((m) => m.FolhaFuncionarioFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/funcionarios/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-funcionario-form').then((m) => m.FolhaFuncionarioFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/cargos',
    loadComponent: () =>
      import('./components/folha/folha-cargos-page').then((m) => m.FolhaCargosPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/cargos/new',
    loadComponent: () =>
      import('./components/folha/folha-cargo-form').then((m) => m.FolhaCargoFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/cargos/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-cargo-form').then((m) => m.FolhaCargoFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/setores',
    loadComponent: () =>
      import('./components/folha/folha-setores-page').then((m) => m.FolhaSetoresPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/setores/new',
    loadComponent: () =>
      import('./components/folha/folha-setor-form').then((m) => m.FolhaSetorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/setores/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-setor-form').then((m) => m.FolhaSetorFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/verbas',
    loadComponent: () =>
      import('./components/folha/folha-verbas-page').then((m) => m.FolhaVerbasPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/verbas/new',
    loadComponent: () =>
      import('./components/folha/folha-verba-form').then((m) => m.FolhaVerbaFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/verbas/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-verba-form').then((m) => m.FolhaVerbaFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/tipos',
    loadComponent: () =>
      import('./components/folha/folha-tipos-page').then((m) => m.FolhaTiposPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/tipos/new',
    loadComponent: () =>
      import('./components/folha/folha-tipo-form').then((m) => m.FolhaTipoFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/tipos/edit/:id',
    loadComponent: () =>
      import('./components/folha/folha-tipo-form').then((m) => m.FolhaTipoFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'folha/lancamentos',
    loadComponent: () =>
      import('./components/folha/folha-lancamentos-page').then((m) => m.FolhaLancamentosPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/controle',
    loadComponent: () =>
      import('./components/folha/folha-fechamento-page').then((m) => m.FolhaFechamentoPage),
    canActivate: [authGuard],
  },
  {
    path: 'folha/atendimento-whatsapp',
    loadComponent: () =>
      import('./components/folha/folha-whatsapp-atendimento-page').then(
        (m) => m.FolhaWhatsappAtendimentoPage,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'orcamentos/dashboard',
    loadComponent: () =>
      import('./components/orcamentos/orcamentos-dashboard-page').then(
        (m) => m.OrcamentosDashboardPage,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'orcamentos',
    loadComponent: () =>
      import('./components/orcamentos/orcamentos-rejeitados-list').then(
        (m) => m.OrcamentosRejeitadosListComponent,
      ),
    canActivate: [authGuard],
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
    canActivate: [authGuard],
  },
  {
    path: 'orcamentos/motivos-rejeicao/new',
    loadComponent: () =>
      import('./components/orcamentos/orcamento-motivo-form').then(
        (m) => m.OrcamentoMotivoFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'orcamentos/motivos-rejeicao/edit/:id',
    loadComponent: () =>
      import('./components/orcamentos/orcamento-motivo-form').then(
        (m) => m.OrcamentoMotivoFormComponent,
      ),
    canActivate: [authGuard],
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
