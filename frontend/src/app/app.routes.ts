import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { UserListComponent } from './components/user-list/user-list';
import { UserFormComponent } from './components/user-form/user-form';
import { AuditLogsComponent } from './components/audit-logs/audit-logs';
import { FichaTecnicaListComponent } from './components/ficha-tecnica-list/ficha-tecnica-list';
import { FichaTecnicaFormComponent } from './components/ficha-tecnica-form/ficha-tecnica-form';
import { authGuard } from './guards/auth.guard';
import { ConfiguracaoComponent } from './modules/configuracao/configuracao.component';
import { HomeComponent } from './components/home/home';

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
    path: 'audit',
    component: AuditLogsComponent,
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
