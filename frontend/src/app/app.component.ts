import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ProfileReminderComponent } from './shared/components/profile-reminder/profile-reminder.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ProfileReminderComponent],
  template: `
    <div class="app-container">
      <app-sidebar [hidden]="sidebarHidden()" (toggle)="toggleSidebar()" />
      <div class="main-wrapper" [class.sidebar-hidden]="sidebarHidden()">
        <button class="menu-btn" [class.nav-open]="!sidebarHidden()" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <span class="material-icons">{{ sidebarHidden() ? 'menu' : 'chevron_left' }}</span>
        </button>
        <app-profile-reminder />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .menu-btn {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 110;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: left 0.25s ease;
    }

    .menu-btn.nav-open {
      left: calc(var(--sidebar-width) + 12px);
    }

    .menu-btn:hover { background: var(--surface-hover); }
  `]
})
export class AppComponent {
  sidebarHidden = signal(this.isMobile());

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  toggleSidebar(): void {
    this.sidebarHidden.update(h => !h);
  }
}
