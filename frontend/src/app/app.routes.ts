import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { UserListComponent } from './components/user-list/user-list';
import { UserFormComponent } from './components/user-form/user-form';
import { AuditLogsComponent } from './components/audit-logs/audit-logs';
import { FichaTecnicaListComponent } from './components/ficha-tecnica-list/ficha-tecnica-list';
import { FichaTecnicaFormComponent } from './components/ficha-tecnica-form/ficha-tecnica-form';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Rota de login (sem guard)
  {
    path: 'login',
    component: LoginComponent
  },
  
  // Rotas protegidas
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
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
  
  // Redirecionamento padrão
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  
  // Rota wildcard
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
