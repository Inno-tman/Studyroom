import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AssistantService } from '../../../core/services/assistant.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="navbar-left">
        <a routerLink="/dashboard" class="logo-link">
          <span class="logo-icon material-icons">menu_book</span>
          <span class="logo-text">StudyRoom</span>
        </a>
      </div>

      <div class="navbar-nav">
        <a routerLink="/dashboard" routerLinkActive="active" #rlaDashboard="routerLinkActive" class="nav-item"
           [class.active]="rlaDashboard.isActive || isDashboardActive">
          <span class="material-icons">dashboard</span>
          <span class="nav-label">Dashboard</span>
        </a>
        <a routerLink="/rooms" routerLinkActive="active" class="nav-item">
          <span class="material-icons">meeting_room</span>
          <span class="nav-label">Rooms</span>
        </a>
        <a routerLink="/timeline" routerLinkActive="active" class="nav-item">
          <span class="material-icons">article</span>
          <span class="nav-label">Timeline</span>
        </a>
        <a routerLink="/people" routerLinkActive="active" class="nav-item">
          <span class="material-icons">people</span>
          <span class="nav-label">People</span>
        </a>
      </div>

      <div class="navbar-right">
        <a routerLink="/notifications" class="nav-pill" title="Notifications">
          <span class="material-icons">notifications</span>
          <span *ngIf="notificationService.unreadCount() > 0" class="pill-badge">{{ notificationService.unreadCount() }}</span>
        </a>
        <a routerLink="/messages" class="nav-pill" title="Messages">
          <span class="material-icons">chat</span>
          <span *ngIf="notificationService.messageUnreadCount() > 0" class="pill-badge">{{ notificationService.messageUnreadCount() }}</span>
        </a>
        <a routerLink="/invitations" class="nav-pill" title="Invitations">
          <span class="material-icons">mark_email_unread</span>
        </a>

        <div class="nav-divider"></div>

        <button class="assistant-btn" (click)="assistant.toggle()" title="AI Assistant" aria-label="Open AI Assistant">
          <span class="material-icons">smart_toy</span>
        </button>
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
      height: calc(var(--navbar-height) + env(safe-area-inset-top));
      padding: env(safe-area-inset-top) 20px 0;
      background: var(--secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 200;
      box-sizing: border-box;
    }

    /* ── Left: Brand ─────────────────────────────────────── */
    .navbar-left { flex-shrink: 0; }

    .logo-link {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .logo-icon { font-size: 22px; color: var(--accent); }
    .logo-text {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
    }

    /* ── Center: Primary nav ─────────────────────────────── */
    .navbar-nav {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .nav-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 6px 16px;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }
    .nav-item.active {
      color: var(--primary);
    }
    .nav-item .material-icons { font-size: 21px; }
    .nav-label { font-size: 11px; font-weight: 600; line-height: 1; }

    .nav-item.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary);
    }

    /* ── Right: Pills + Tools ────────────────────────────── */
    .navbar-right {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .nav-pill {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .nav-pill:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }
    .nav-pill .material-icons { font-size: 20px; }

    .pill-badge {
      position: absolute;
      top: 3px;
      right: 3px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--error);
      color: white;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .nav-divider {
      width: 1px;
      height: 24px;
      background: var(--border);
      margin: 0 6px;
      flex-shrink: 0;
    }

    .assistant-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--accent);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s;
    }
    .assistant-btn:hover {
      background: rgba(56, 189, 248, 0.1);
      border-color: var(--accent);
    }
    .assistant-btn .material-icons { font-size: 18px; }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      color: white;
      overflow: hidden;
      flex-shrink: 0;
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .avatar:hover {
      transform: scale(1.08);
      box-shadow: 0 0 0 2px var(--primary);
    }
    .avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .logout-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error);
    }
    .logout-btn .material-icons { font-size: 18px; }

    /* ── Mobile ──────────────────────────────────────────── */
    @media (max-width: 768px) {
      .navbar { padding: env(safe-area-inset-top) 12px 0; gap: 8px; }
      .logo-text { display: none; }
      .nav-label { display: none; }
      .nav-item { padding: 8px 10px; }
      .nav-divider { margin: 0 2px; }
      .logout-btn { display: none; }
    }
  `]
})
export class NavbarComponent {
  auth = inject(AuthService);
  notificationService = inject(NotificationService);
  assistant = inject(AssistantService);

  get isDashboardActive(): boolean {
    return false;
  }
}
