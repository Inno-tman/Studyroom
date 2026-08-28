import { Component, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../core/services/notification.service';
import { LoadingComponent } from '../shared/components/loading/loading.component';
import { HeroCardComponent } from '../shared/components/hero-card/hero-card.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, RouterLink, LoadingComponent, HeroCardComponent],
  template: `
    <div class="notifications-page">
      <app-hero-card title="Notifications" subtitle="Friend requests, invites, comments and messages." [badges]="heroBadges">
        <ng-container heroActions>
          <button class="hero-btn" *ngIf="service.items().length > 0" (click)="service.markAllRead()">
            <span class="material-icons">done_all</span> Mark all as read
          </button>
        </ng-container>
      </app-hero-card>

      <app-loading [loading]="service.loading()" />

      <div *ngIf="!service.loading() && service.items().length === 0" class="empty">
        <span class="material-icons">notifications_off</span>
        <p>You're all caught up. No notifications yet.</p>
      </div>

      <div class="notif-list">
        <button
          class="notif-row"
          [class.unread]="!n.isRead"
          *ngFor="let n of service.items()"
          (click)="service.open(n)"
        >
          <div class="notif-avatar" [class.has-image]="n.actorAvatarUrl && !n.icon" [routerLink]="n.actorId ? ['/profile', n.actorId] : null" [style.cursor]="n.actorId ? 'pointer' : 'default'">
            <img *ngIf="n.actorAvatarUrl; else actorInitial" [src]="n.actorAvatarUrl" alt="" />
            <ng-template #actorInitial>
              <span class="material-icons">{{ n.icon || 'notifications' }}</span>
            </ng-template>
          </div>
          <div class="notif-body">
            <span class="notif-title">{{ n.title }}</span>
            <span class="notif-text">{{ n.body }}</span>
            <span class="notif-time">{{ n.createdAt | date: 'medium' }}</span>
          </div>
          <span class="notif-dot" *ngIf="!n.isRead"></span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .notifications-page { max-width: 760px; margin: 0 auto; }

    .page-header-row {
      display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .empty .material-icons { font-size: var(--font-40); }

    .notif-list { display: flex; flex-direction: column; gap: 8px; }

    .notif-row {
      display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      width: 100%; text-align: left; cursor: pointer; color: inherit; font-family: inherit;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .notif-row:hover { border-color: var(--primary); background: var(--surface-hover); }
    .notif-row.unread { border-left: 3px solid var(--primary); }

    .notif-avatar {
      width: 42px; height: 42px; border-radius: 50%; background: rgba(56, 189, 248, 0.12);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
    }
    .notif-avatar .material-icons { color: var(--accent); font-size: var(--font-22); }
    .notif-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .notif-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }

    .notif-title { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .notif-text { font-size: var(--font-13); color: var(--text-secondary); line-height: 1.4; }
    .notif-time { font-size: var(--font-11); color: var(--text-muted); margin-top: 4px; }

    .notif-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--primary);
      flex-shrink: 0; margin-top: 6px;
    }
  `]
})
export class NotificationsComponent {
  service = inject(NotificationService);

  get heroBadges() {
    const unread = this.service.items().filter(n => !n.isRead).length;
    const badges = [{ icon: 'notifications', text: `${this.service.items().length} total` }];
    if (unread > 0) badges.push({ icon: 'mark_email_unread', text: `${unread} unread` });
    return badges;
  }
}