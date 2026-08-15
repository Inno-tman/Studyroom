import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="navbar-left">
        <span class="logo-icon material-icons">menu_book</span>
        <span class="logo-text">StudyRoom</span>
      </div>

      <div class="navbar-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" title="Dashboard">
          <span class="material-icons">dashboard</span>
        </a>
        <a routerLink="/rooms" routerLinkActive="active" class="nav-item" title="Rooms">
          <span class="material-icons">meeting_room</span>
        </a>
        <a routerLink="/timeline" routerLinkActive="active" class="nav-item" title="Timeline">
          <span class="material-icons">article</span>
        </a>
        <a routerLink="/people" routerLinkActive="active" class="nav-item" title="People">
          <span class="material-icons">people</span>
        </a>
        <a routerLink="/notifications" routerLinkActive="active" class="nav-item" title="Notifications">
          <span class="material-icons">notifications</span>
          <span *ngIf="notificationService.unreadCount() > 0" class="badge">{{ notificationService.unreadCount() }}</span>
        </a>
        <a routerLink="/invitations" routerLinkActive="active" class="nav-item" title="Invitations">
          <span class="material-icons">mark_email_unread</span>
        </a>
        <a routerLink="/messages" routerLinkActive="active" class="nav-item" title="Messages">
          <span class="material-icons">chat</span>
          <span *ngIf="notificationService.messageUnreadCount() > 0" class="badge">{{ notificationService.messageUnreadCount() }}</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="nav-item" title="Profile">
          <span class="material-icons">person</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="nav-item" title="Settings">
          <span class="material-icons">settings</span>
        </a>
      </div>

      <div class="navbar-right">
        <a routerLink="/profile" class="avatar" [class.has-image]="auth.currentUser()?.avatarUrl" title="Profile">
          <img *ngIf="auth.currentUser()?.avatarUrl; else navbarInitial" [src]="auth.currentUser()?.avatarUrl" alt="" />
          <ng-template #navbarInitial>{{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}</ng-template>
        </a>
        <button class="logout-btn" (click)="auth.logout()" title="Log out">
          <span class="material-icons">logout</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--navbar-height);
      background: var(--secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      z-index: 200;
    }

    .navbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .logo-icon { font-size: var(--font-24); color: var(--accent); }
    .logo-text { font-size: var(--font-17); font-weight: 700; color: var(--text-primary); }

    .navbar-nav {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 0;
      overflow-x: auto;
    }
    .navbar-nav::-webkit-scrollbar { display: none; }

    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      color: var(--text-secondary);
      text-decoration: none;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }

    .nav-item:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: var(--primary);
      color: white;
    }

    .nav-item .material-icons { font-size: var(--font-22); }

    .badge {
      position: absolute;
      top: 3px;
      right: 3px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      font-size: var(--font-10);
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .navbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--font-14);
      color: white;
      overflow: hidden;
      flex-shrink: 0;
      text-decoration: none;
      transition: transform 0.15s;
    }

    .avatar:hover { transform: scale(1.05); }
    .avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .logout-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }

    .logout-btn:hover { background: var(--surface-hover); color: var(--error); }
    .logout-btn .material-icons { font-size: var(--font-20); }

    @media (max-width: 768px) {
      .navbar { padding: 0 10px; gap: 8px; }
      .logo-text { display: none; }
      .navbar-nav { justify-content: flex-start; }
    }
  `]
})
export class NavbarComponent {
  auth = inject(AuthService);
  notificationService = inject(NotificationService);
}