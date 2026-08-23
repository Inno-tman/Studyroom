import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { SignalRService } from '../../../core/services/signalr.service';
import { AuthService } from '../../../core/services/auth.service';

interface PresenceUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  roomIds: string[];
}

@Component({
  selector: 'app-presence-dock',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  template: `
    <div class="presence-dock" *ngIf="showDock()">
      <div class="dock-header" (click)="toggleExpanded()">
        <span class="material-icons dock-pulse">pulse</span>
        <span class="dock-title">{{ users().length }} studying now</span>
        <span class="material-icons dock-chev">{{ expanded() ? 'expand_more' : 'expand_less' }}</span>
      </div>

      <div class="dock-body" *ngIf="expanded()">
        <div
          *ngFor="let u of users()"
          class="presence-row"
          (click)="visit(u)"
          [title]="u.username + (u.roomIds[0] ? ' · ' + u.roomIds[0] : '')"
        >
          <a class="avatar" [class.has-image]="u.avatarUrl" routerLink="/profile/{{u.userId}}" (click)="$event.stopPropagation()">
            <img *ngIf="u.avatarUrl; else initial" [src]="u.avatarUrl" alt="" />
            <ng-template #initial>{{ u.username.charAt(0).toUpperCase() }}</ng-template>
            <span class="ava-dot"></span>
          </a>
          <span class="presence-name">{{ u.username }}</span>
          <span class="material-icons presence-join">call</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .presence-dock {
      position: fixed; left: 16px; bottom: 16px; z-index: 90;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; box-shadow: 0 10px 34px rgba(0,0,0,0.2);
      min-width: 200px; max-width: 260px; overflow: hidden;
    }
    .dock-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; cursor: pointer; user-select: none;
      border-bottom: 1px solid var(--border);
    }
    .dock-pulse { color: var(--success); font-size: var(--font-16); }
    .dock-title { flex: 1; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .dock-chev { color: var(--text-muted); font-size: var(--font-18); }
    .dock-body { display: flex; flex-direction: column; max-height: 260px; overflow-y: auto; padding: 6px; }
    .presence-row {
      display: flex; align-items: center; gap: 10px;
      background: none; border: none; border-radius: 8px; padding: 8px;
      cursor: pointer; text-align: left; font-family: inherit; color: inherit; width: 100%;
    }
    .presence-row:hover { background: var(--surface-hover); }
    .avatar { position: relative; flex-shrink: 0; }
    .ava-dot {
      position: absolute; bottom: 0; right: 0; width: 10px; height: 10px;
      border-radius: 50%; background: var(--success); border: 2px solid var(--surface);
    }
    .presence-name { flex: 1; font-size: var(--font-13); color: var(--text-primary); }
    .presence-join { color: var(--accent); font-size: var(--font-18); opacity: 0.8; }

    @media (max-width: 768px) {
      .presence-dock { min-width: 170px; }
    }
  `]
})
export class PresenceDockComponent implements OnInit, OnDestroy {
  private signalR = inject(SignalRService);
  private auth = inject(AuthService);
  private router = inject(Router);

  users = signal<PresenceUser[]>([]);
  expanded = signal(true);
  private timer: any;

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 20000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async refresh(): Promise<void> {
    try {
      if (!this.signalR.connectionActive()) return;
      const list = await this.signalR.getPresence();
      const me = this.auth.currentUser()?.id;
      this.users.set((list || []).filter(u => u.userId !== me) as PresenceUser[]);
    } catch { }
  }

  visit(u: PresenceUser): void {
    if (u.roomIds && u.roomIds.length > 0) {
      this.router.navigate(['/rooms', u.roomIds[0]]);
      this.expanded.set(false);
    }
  }

  toggleExpanded(): void {
    this.expanded.update(e => !e);
  }

  showDock(): boolean {
    return this.users().length > 0 && !this.isMessagesPage();
  }

  private isMessagesPage(): boolean {
    return this.router.url.startsWith('/messages');
  }
}