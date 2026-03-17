import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'sites', loadComponent: () => import('./pages/sites-list/sites-list.component').then(m => m.SitesListComponent) },
      { path: 'sites/new', loadComponent: () => import('./pages/site-form/site-form.component').then(m => m.SiteFormComponent) },
      { path: 'sites/:id/result', loadComponent: () => import('./pages/result/result.component').then(m => m.ResultComponent) },
      { path: 'compare', loadComponent: () => import('./pages/compare/compare.component').then(m => m.CompareComponent) },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
