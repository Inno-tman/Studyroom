import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe, NgClass } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { RoomService } from '../core/services/room.service';
import { StatisticsService } from '../core/services/statistics.service';
import { Room } from '../shared/models/room.model';
import { UserStats } from '../shared/models/stats.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, DatePipe, LoadingComponent],
  template: `
    <div class="dashboard">
      <!-- ── Hero header card ─────────────────────────────────── -->
      <div class="hero-card">
        <div class="hero-top">
          <div class="hero-greeting">
            <h1>Good to see you, {{ auth.currentUser()?.username }}!</h1>
            <p>Let's keep the momentum going together.</p>
          </div>
          <a routerLink="/rooms/create" class="hero-create">
            <span class="material-icons">add_box</span> Create Room
          </a>
        </div>
        <div class="hero-badges">
          <span class="hero-badge">
            <span class="material-icons">local_fire_department</span>
            {{ stats.dailyStreak }} day streak
          </span>
          <span class="hero-badge">
            <span class="material-icons">schedule</span>
            {{ stats.totalStudyHours }}h studied
          </span>
          <span class="hero-badge">
            <span class="material-icons">group</span>
            {{ myRooms.length }} rooms
          </span>
        </div>
      </div>

      <!-- ── Proactive band ───────────────────────────────────── -->
      <div class="stats-strip">
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.totalStudyHours }}h</span>
          <span class="stat-label">Study Hours</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.sessionsCompleted }}</span>
          <span class="stat-label">Sessions</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.dailyStreak }}</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.weeklyStudyMinutes }}m</span>
          <span class="stat-label">This Week</span>
        </div>
      </div>

      <!-- ── Segmented sections ───────────────────────────────── -->
      <div class="section">
        <div class="section-tabs">
          <button
            class="section-tab"
            [class.active]="tab === 'mine'"
            (click)="tab = 'mine'"
          >
            My Rooms
            <span class="section-tab-badge">{{ myRooms.length }}</span>
          </button>
          <button
            class="section-tab"
            [class.active]="tab === 'all'"
            (click)="tab = 'all'"
          >
            Discover
            <span class="section-tab-badge">{{ allRooms.length }}</span>
          </button>
        </div>

        <app-loading [loading]="loading" />

        <div class="room-grid" *ngIf="!loading">
          <ng-container *ngIf="tab === 'mine'">
            <div class="room-card" *ngFor="let room of myRooms" (click)="navigateToRoom(room.id)">
              <div class="room-card-header">
                <h3>{{ room.name }}</h3>
                <span class="badge badge-accent">{{ room.subject || 'General' }}</span>
              </div>
              <p class="room-desc">{{ room.description || 'No description' }}</p>
              <div class="room-meta">
                <span>{{ room.memberCount }} members</span>
                <span>{{ room.createdAt | date:'mediumDate' }}</span>
              </div>
            </div>
            <div class="room-card empty" *ngIf="myRooms.length === 0">
              <p>You haven't joined any rooms yet.</p>
              <a routerLink="/rooms" class="btn-outline">Browse Rooms</a>
            </div>
          </ng-container>

          <ng-container *ngIf="tab === 'all'">
            <div class="room-card" *ngFor="let room of allRooms.slice(0, 4)" (click)="navigateToRoom(room.id)">
              <div class="room-card-header">
                <h3>{{ room.name }}</h3>
                <span class="badge badge-accent">{{ room.subject || 'General' }}</span>
              </div>
              <p class="room-desc">{{ room.description || 'No description' }}</p>
              <div class="room-meta">
                <span>{{ room.memberCount }} members</span>
                <span>{{ room.createdAt | date:'mediumDate' }}</span>
              </div>
            </div>
            <div class="room-card empty" *ngIf="allRooms.length === 0">
              <p>No rooms found yet.</p>
              <a routerLink="/rooms/create" class="btn-outline">Create the first one</a>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; }

    /* Hero header card */
    .hero-card {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 16px; padding: 28px; margin-bottom: 16px;
      color: white; display: flex; flex-direction: column; gap: 20px;
    }
    .hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .hero-greeting h1 { font-size: var(--font-24); font-weight: 700; margin-bottom: 6px; }
    .hero-greeting p { color: rgba(255,255,255,0.82); font-size: var(--font-14); }
    .hero-create {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
      color: white; padding: 10px 16px; border-radius: 10px; font-weight: 600;
      font-size: var(--font-13); text-decoration: none; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .hero-create:hover { background: rgba(255,255,255,0.28); }
    .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.16); border-radius: 8px;
      padding: 6px 10px; font-size: var(--font-12); font-weight: 600;
    }
    .hero-badge .material-icons { font-size: var(--font-16); }

    /* Proactive live strip */
    .stats-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;
    }
    .stats-strip-item {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .stat-value { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); }

    /* Segmented tabs */
    .section { margin-bottom: 32px; }
    .section-tabs {
      display: inline-flex; gap: 4px; padding: 4px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px;
    }
    .section-tab {
      display: inline-flex; align-items: center; gap: 8px;
      border: none; background: transparent; color: var(--text-secondary);
      font-size: var(--font-13); font-weight: 600; padding: 8px 16px;
      border-radius: 7px; cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .section-tab.active { background: var(--primary); color: white; }
    .section-tab-badge {
      background: rgba(0,0,0,0.12); border-radius: 999px; padding: 1px 7px;
      font-size: var(--font-11);
    }
    .section-tab.active .section-tab-badge { background: rgba(255,255,255,0.22); }

    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

    .room-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.15s; }
    .room-card:hover { border-color: var(--primary); }
    .room-card.empty { cursor: default; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .room-card.empty:hover { border-color: var(--border); }
    .room-card.empty p { color: var(--text-muted); }

    .room-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .room-card-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); flex: 1; }

    .room-desc { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .room-meta { display: flex; justify-content: space-between; font-size: var(--font-12); color: var(--text-muted); }

    @media (max-width: 768px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .hero-top { flex-direction: column; }
      .stat-value { font-size: var(--font-18); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private roomService = inject(RoomService);
  private statsService = inject(StatisticsService);
  private router = inject(Router);

  myRooms: Room[] = [];
  allRooms: Room[] = [];
  stats: UserStats = { totalStudyHours: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  loading = true;
  tab: 'mine' | 'all' = 'mine';

  async ngOnInit() {
    try {
      const [myRooms, allRooms, stats] = await Promise.all([
        this.roomService.getMyRooms().toPromise(),
        this.roomService.getAll().toPromise(),
        this.statsService.getStats().toPromise()
      ]);
      this.myRooms = myRooms || [];
      this.allRooms = allRooms || [];
      this.stats = stats || this.stats;
    } catch { } finally {
      this.loading = false;
    }
  }

  navigateToRoom(id: string) {
    this.router.navigate(['/rooms', id]);
  }
}