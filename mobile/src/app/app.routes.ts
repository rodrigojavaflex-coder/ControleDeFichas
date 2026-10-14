import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

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
