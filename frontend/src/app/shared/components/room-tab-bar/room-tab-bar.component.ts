import { Component, inject, OnDestroy } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { RoomTabBarService, RoomTabBarState } from '../../../core/services/room-tab-bar.service';

@Component({
  selector: 'app-room-tab-bar',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <nav class="room-tab-bar" *ngIf="state">
      <button
        *ngFor="let tab of state.tabs"
        class="tab-item"
        [class.active]="state.activeTab === tab.id"
        (click)="select(tab.id)"
      >
        <span class="material-icons">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span *ngIf="tab.id === 'chat' && (state.unreadCount ?? 0) > 0" class="tab-item-badge">{{ state.unreadCount }}</span>
        <span *ngIf="tab.id === 'meet' && (state.upcomingMeetingsCount ?? 0) > 0" class="tab-item-badge">{{ state.upcomingMeetingsCount }}</span>
      </button>
    </nav>
  `,
  styles: [`
    .room-tab-bar {
      position: relative;
      display: flex;
      align-items: stretch;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom);
      min-height: 54px;
      flex: none;
    }
    .tab-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 6px 0 7px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      transition: color 0.15s;
      position: relative;
      -webkit-tap-highlight-color: transparent;
    }
    .tab-item .material-icons { font-size: 18px; }
    .tab-item.active { color: var(--accent); }
    .tab-label { font-size: 9px; line-height: 1; font-weight: 600; }
    .tab-item-badge {
      position: absolute;
      top: 4px;
      left: 50%;
      transform: translateX(6px);
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      background: var(--error);
      color: white;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      box-sizing: border-box;
    }
  `]
})
export class RoomTabBarComponent implements OnDestroy {
  private service = inject(RoomTabBarService);
  private sub?: Subscription;
  state: RoomTabBarState | null = null;

  constructor() {
    this.sub = this.service.state$.subscribe(s => {
      this.state = s && s.isMobile && s.isMember ? s : null;
    });
  }

  select(id: string): void {
    this.service.selectTab(id);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
