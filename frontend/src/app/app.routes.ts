import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'rooms',
    loadComponent: () => import('./rooms/room-list/room-list.component').then(m => m.RoomListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'rooms/create',
    loadComponent: () => import('./rooms/room-create/room-create.component').then(m => m.RoomCreateComponent),
    canActivate: [authGuard]
  },
  {
    path: 'rooms/:id',
    loadComponent: () => import('./rooms/room-detail/room-detail.component').then(m => m.RoomDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/dashboard' }
];
