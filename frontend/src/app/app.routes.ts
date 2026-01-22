import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { UserListComponent } from './components/user-list/user-list';
import { UserFormComponent } from './components/user-form/user-form';
import { AuditoriaComponent } from './components/auditoria/auditoria';
import { FichaTecnicaListComponent } from './components/ficha-tecnica-list/ficha-tecnica-list';
import { FichaTecnicaFormComponent } from './components/ficha-tecnica-form/ficha-tecnica-form';
import { authGuard } from './guards/auth.guard';
import { ConfiguracaoComponent } from './modules/configuracao/configuracao.component';
import { HomeComponent } from './components/home/home';
import { ChangePasswordComponent } from './components/change-password/change-password';
import { PerfilListComponent } from './components/perfil-list/perfil-list';
import { PerfilFormComponent } from './components/perfil-form/perfil-form';
import { CertificadoFormComponent } from './components/certificado-form/certificado-form';
import { VendasListComponent } from './components/vendas-list/vendas-list';
import { BaixasListComponent } from './components/baixas-list/baixas-list';
import { AcompanharVendasComponent } from './components/acompanhar-vendas/acompanhar-vendas';
import { FechamentoVendasListComponent } from './components/fechamento-vendas-list/fechamento-vendas-list';
import { ClientesListComponent } from './components/clientes-list/clientes-list';
import { ClienteFormComponent } from './components/cliente-form/cliente-form';
import { VendedoresListComponent } from './components/vendedores-list/vendedores-list';
import { VendedorFormComponent } from './components/vendedor-form/vendedor-form';
import { PrescritoresListComponent } from './components/prescritores-list/prescritores-list';
import { PrescritorFormComponent } from './components/prescritor-form/prescritor-form';

export const routes: Routes = [
  // Rota de configuração
  {
    path: 'configuracao',
    component: ConfiguracaoComponent,
    canActivate: [authGuard]
  },
  // Rota de login (sem guard)
  {
    path: 'login',
    component: LoginComponent
  },
  
  // Rotas protegidas
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'users/new',
    component: UserFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'users/edit/:id',
    component: UserFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'users/:id/change-password',
    component: ChangePasswordComponent,
    canActivate: [authGuard]
  },
  {
    path: 'auditoria',
    component: AuditoriaComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fichas-tecnicas',
    component: FichaTecnicaListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fichas-tecnicas/new',
    component: FichaTecnicaFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fichas-tecnicas/edit/:id',
    component: FichaTecnicaFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fichas-tecnicas/view/:id',
    component: FichaTecnicaFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'certificados/new',
    component: CertificadoFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'certificados/edit/:id',
    component: CertificadoFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'vendas',
    component: VendasListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'fechamento-vendas',
    component: FechamentoVendasListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'relatorios/baixas',
    component: BaixasListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'relatorios/acompanhar-vendas',
    component: AcompanharVendasComponent,
    canActivate: [authGuard]
  },
  // Rotas de perfil: paths específicos antes da rota geral para evitar conflitos de prefixo
  {
    path: 'perfil/new',
    component: PerfilFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'perfil/edit/:id',
    component: PerfilFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'perfil',
    component: PerfilListComponent,
    canActivate: [authGuard],
    pathMatch: 'full'
  },
  // Rotas de Clientes
  {
    path: 'clientes',
    component: ClientesListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'clientes/new',
    component: ClienteFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'clientes/edit/:id',
    component: ClienteFormComponent,
    canActivate: [authGuard]
  },
  // Rotas de Vendedores
  {
    path: 'vendedores',
    component: VendedoresListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'vendedores/new',
    component: VendedorFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'vendedores/edit/:id',
    component: VendedorFormComponent,
    canActivate: [authGuard]
  },
  // Rotas de Prescritores
  {
    path: 'prescritores',
    component: PrescritoresListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'prescritores/new',
    component: PrescritorFormComponent,
    canActivate: [authGuard]
  },
  {
    path: 'prescritores/edit/:id',
    component: PrescritorFormComponent,
    canActivate: [authGuard]
  },
  
  // Home padrão
  {
    path: '',
    component: HomeComponent,
    canActivate: [authGuard]
  },
  // Rota wildcard
  {
    path: '**',
    redirectTo: ''
  }
];
