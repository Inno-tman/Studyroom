import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.hidden]="hidden">
      <div class="sidebar-header">
        <span class="logo-icon material-icons">menu_book</span>
        <span class="logo-text">StudyRoom</span>
        <button class="collapse-btn" (click)="toggle.emit()" title="Hide sidebar" aria-label="Hide sidebar">
          <span class="material-icons">chevron_left</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <span class="material-icons">dashboard</span>
          <span>Dashboard</span>
        </a>
        <a routerLink="/rooms" routerLinkActive="active" class="nav-item">
          <span class="material-icons">meeting_room</span>
          <span>Rooms</span>
        </a>
        <a routerLink="/timeline" routerLinkActive="active" class="nav-item">
          <span class="material-icons">article</span>
          <span>Timeline</span>
        </a>
        <a routerLink="/people" routerLinkActive="active" class="nav-item">
          <span class="material-icons">people</span>
          <span>People</span>
        </a>
        <a routerLink="/notifications" routerLinkActive="active" class="nav-item">
          <span class="material-icons">notifications</span>
          <span>Notifications</span>
          <span *ngIf="notificationService.unreadCount() > 0" class="badge">{{ notificationService.unreadCount() }}</span>
        </a>
        <a routerLink="/invitations" routerLinkActive="active" class="nav-item">
          <span class="material-icons">mark_email_unread</span>
          <span>Invitations</span>
        </a>
        <a routerLink="/messages" routerLinkActive="active" class="nav-item">
          <span class="material-icons">chat</span>
          <span>Messages</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="nav-item">
          <span class="material-icons">person</span>
          <span>Profile</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="nav-item">
          <span class="material-icons">settings</span>
          <span>Settings</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar" [class.has-image]="auth.currentUser()?.avatarUrl">
            <img *ngIf="auth.currentUser()?.avatarUrl; else sidebarInitial" [src]="auth.currentUser()?.avatarUrl" alt="" />
            <ng-template #sidebarInitial>{{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}</ng-template>
          </div>
          <div class="user-details">
            <span class="username">{{ auth.currentUser()?.username }}</span>
            <span class="role">{{ auth.currentUser()?.role }}</span>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()">
          <span class="material-icons">logout</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 100;
      transition: transform 0.25s ease;
    }

    .sidebar.hidden {
      transform: translateX(-100%);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 12px;
      border-bottom: 1px solid var(--border);
    }

    .logo-icon { font-size: var(--font-24); color: var(--accent); }
    .logo-text { font-size: var(--font-18); font-weight: 700; color: var(--text-primary); }

    .collapse-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      transition: color 0.15s;
    }

    .collapse-btn:hover { color: var(--text-primary); }

    .sidebar-nav {
      flex: 1;
      padding: 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .nav-item:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: var(--primary);
      color: white;
    }

    .badge {
      margin-left: auto;
      background: var(--accent);
      color: white;
      font-size: var(--font-11);
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .sidebar-footer {
      padding: 10px 8px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar {
      width: 36px;
      height: 36px;
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
    }

    .avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .username { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .role { font-size: var(--font-11); color: var(--text-muted); text-transform: capitalize; }

    .logout-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      transition: color 0.15s;
    }

    .logout-btn:hover { color: var(--error); }

    @media (max-width: 768px) {
      .sidebar {
        width: 240px;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.3);
      }
    }
  `]
})
export class SidebarComponent {
  auth = inject(AuthService);
  notificationService = inject(NotificationService);
  @Input() hidden = false;
  @Output() toggle = new EventEmitter<void>();
}
