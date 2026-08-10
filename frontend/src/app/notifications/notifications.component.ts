import { Component, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { NotificationService } from '../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe],
  template: `
    <div class="notifications-page">
      <div class="page-header page-header-row">
        <div>
          <h1>Notifications</h1>
          <p class="page-subtitle">Friend requests, invites, comments and messages.</p>
        </div>
        <button class="mark-all" *ngIf="service.items().length > 0" (click)="service.markAllRead()">
          Mark all as read
        </button>
      </div>

      <div *ngIf="service.loading()" class="loading">Loading…</div>

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
          <div class="notif-avatar" [class.has-image]="n.actorAvatarUrl">
            <img *ngIf="n.actorAvatarUrl; else actorInitial" [src]="n.actorAvatarUrl" alt="" />
            <ng-template #actorInitial>
              <span class="material-icons">{{ n.icon }}</span>
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
    .notifications-page { max-width: 760px; }

    .page-header-row {
      display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .page-subtitle { font-size: var(--font-14); color: var(--text-secondary); margin-top: 4px; }

    .mark-all {
      background: none; border: 1px solid var(--border); color: var(--text-secondary);
      padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: var(--font-13); font-weight: 600;
      transition: all 0.15s ease;
    }
    .mark-all:hover { border-color: var(--primary); color: var(--primary); }

    .empty {
      text-align: center; padding: 48px; color: var(--text-muted);
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .empty .material-icons { font-size: var(--font-40); }
    .loading { text-align: center; padding: 48px; color: var(--text-muted); }

    .notif-list { display: flex; flex-direction: column; gap: 8px; }

    .notif-row {
      display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      width: 100%; text-align: left; cursor: pointer; color: inherit;
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
}