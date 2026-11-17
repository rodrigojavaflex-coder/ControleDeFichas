import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { permissionGuard } from './guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
  },
  {
    path: 'visitas',
    loadComponent: () =>
      import('./pages/visitas/carteira.page').then((m) => m.CarteiraVisitasPage),
    canActivate: [authGuard],
  },
  {
    path: 'visitas/agenda',
    loadComponent: () =>
      import('./pages/visitas/agenda.page').then((m) => m.AgendaVisitasPage),
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['visitas-agenda:read'] },
  },
  {
    path: 'visitas/agenda/agendar',
    loadComponent: () =>
      import('./pages/visitas/agenda-agendar.page').then(
        (m) => m.AgendaAgendarPage,
      ),
    canActivate: [authGuard, permissionGuard],
    data: {
      permissions: ['visitas-agenda:create', 'visitas-agenda:update'],
    },
  },
  {
    path: 'visitas/agenda/consultar',
    loadComponent: () =>
      import('./pages/visitas/agenda-consultar.page').then(
        (m) => m.AgendaConsultarPage,
      ),
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['visitas-agenda:read'] },
  },
  {
    path: 'visitas/trocar/:id',
    loadComponent: () =>
      import('./pages/visitas/trocar.page').then((m) => m.TrocarMedicoPage),
    canActivate: [authGuard],
  },
  {
    path: 'visitas/:id',
    loadComponent: () =>
      import('./pages/visitas/visita.page').then((m) => m.VisitaPage),
    canActivate: [authGuard],
  },
  {
    path: 'pendencias',
    loadComponent: () =>
      import('./pages/visitas/pendencia.page').then((m) => m.PendenciaPage),
    canActivate: [authGuard, permissionGuard],
    data: { permissions: ['pendencias:read', 'pendencias:create'] },
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
    canActivate: [authGuard],
  },
  {
    path: 'configuracoes',
    loadComponent: () =>
      import('./pages/configuracoes/configuracoes.page').then((m) => m.ConfiguracoesPage),
    canActivate: [authGuard],
  },
  {
    path: 'alterar-senha',
    loadComponent: () =>
      import('./pages/alterar-senha/alterar-senha.page').then((m) => m.AlterarSenhaPage),
    canActivate: [authGuard],
  },
  {
    path: 'sobre',
    loadComponent: () => import('./pages/sobre/sobre.page').then((m) => m.SobrePage),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
