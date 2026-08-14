import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ProfileReminderComponent } from './shared/components/profile-reminder/profile-reminder.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { PresenceDockComponent } from './shared/components/presence-dock/presence-dock.component';
import { CallOverlayComponent } from './shared/components/call-overlay/call-overlay.component';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ProfileReminderComponent, CommandPaletteComponent, PresenceDockComponent, CallOverlayComponent, NgIf],
  template: `
    <div class="app-container">
      <app-sidebar [hidden]="sidebarHidden()" (toggle)="toggleSidebar()" />
      <div class="main-wrapper" [class.sidebar-hidden]="sidebarHidden()">
        <button class="menu-btn" *ngIf="sidebarHidden()" (click)="toggleSidebar()" aria-label="Open navigation">
          <span class="material-icons">menu</span>
        </button>
        <app-profile-reminder />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
      <app-command-palette />
      <app-presence-dock />
      <app-call-overlay />
    </div>
  `,
  styles: [`
    .menu-btn {
      position: fixed;
      top: 12px;
      right: 12px;
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
    }

    .menu-btn:hover { background: var(--surface-hover); }
  `]
})
export class AppComponent {
  private notificationService = inject(NotificationService);
  sidebarHidden = signal(this.isMobile());

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  toggleSidebar(): void {
    this.sidebarHidden.update(h => !h);
  }
}
