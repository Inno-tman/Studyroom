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
  {
    path: 'timeline',
    loadComponent: () => import('./timeline/timeline.component').then(m => m.TimelineComponent),
    canActivate: [authGuard]
  },
  {
    path: 'people',
    loadComponent: () => import('./people/people.component').then(m => m.PeopleComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      {
        path: 'profile',
        loadComponent: () => import('./settings/profile-settings/profile-settings.component').then(m => m.ProfileSettingsComponent)
      },
      {
        path: 'account',
        loadComponent: () => import('./settings/account-settings/account-settings.component').then(m => m.AccountSettingsComponent)
      },
      {
        path: 'appearance',
        loadComponent: () => import('./settings/appearance-settings/appearance-settings.component').then(m => m.AppearanceSettingsComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./settings/notifications-settings/notifications-settings.component').then(m => m.NotificationsSettingsComponent)
      }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
