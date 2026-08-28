import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeroCardComponent } from '../shared/components/hero-card/hero-card.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeroCardComponent],
  template: `
    <div class="settings-page">
      <app-hero-card title="Settings" subtitle="Manage your profile, notifications, appearance and study preferences."></app-hero-card>

      <div class="settings-layout">
        <nav class="settings-nav">
          <a routerLink="profile" routerLinkActive="active" class="settings-item">
            <span class="material-icons">person</span>
            <span>Profile</span>
          </a>
          <a routerLink="account" routerLinkActive="active" class="settings-item">
            <span class="material-icons">manage_accounts</span>
            <span>Account</span>
          </a>
          <a routerLink="appearance" routerLinkActive="active" class="settings-item">
            <span class="material-icons">palette</span>
            <span>Appearance</span>
          </a>
          <a routerLink="notifications" routerLinkActive="active" class="settings-item">
            <span class="material-icons">notifications</span>
            <span>Notifications</span>
          </a>
          <a routerLink="study" routerLinkActive="active" class="settings-item">
            <span class="material-icons">school</span>
            <span>Study</span>
          </a>
          <a routerLink="calendar" routerLinkActive="active" class="settings-item">
            <span class="material-icons">calendar_month</span>
            <span>Calendar</span>
          </a>
        </nav>

        <div class="settings-content">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 1000px; margin: 0 auto; }

    .settings-layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }

    .settings-nav {
      flex-shrink: 0;
      width: 220px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .settings-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      font-size: var(--font-14);
      transition: all 0.15s ease;
    }

    .settings-item .material-icons { font-size: var(--font-20); }

    .settings-item:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .settings-item.active {
      background: var(--primary);
      color: white;
    }

    .settings-content {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 768px) {
      .settings-layout { flex-direction: column; }
      .settings-nav {
        width: 100%;
        flex-direction: row;
        overflow-x: auto;
      }
      .settings-item { white-space: nowrap; }
    }
  `]
})
export class SettingsComponent {}
