import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="logo-icon">📚</span>
        <span class="logo-text">StudyRoom</span>
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
        <a routerLink="/profile" routerLinkActive="active" class="nav-item">
          <span class="material-icons">person</span>
          <span>Profile</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar">{{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
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
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      border-bottom: 1px solid var(--border);
    }

    .logo-icon { font-size: 24px; }
    .logo-text { font-size: 18px; font-weight: 700; color: var(--text-primary); }

    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
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

    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      font-size: 14px;
      color: white;
    }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .username { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .role { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }

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
        display: none;
      }
    }
  `]
})
export class SidebarComponent {
  auth = inject(AuthService);
}
