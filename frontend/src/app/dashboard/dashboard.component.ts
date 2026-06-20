import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { RoomService } from '../core/services/room.service';
import { StatisticsService } from '../core/services/statistics.service';
import { Room } from '../shared/models/room.model';
import { UserStats } from '../shared/models/stats.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, DatePipe, LoadingComponent],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1>Dashboard</h1>
      </div>

      <div class="welcome-card">
        <h2>Welcome back, {{ auth.currentUser()?.username }}!</h2>
        <p>Let's continue learning together.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">📚</span>
          <div class="stat-info">
            <span class="stat-value">{{ stats.totalStudyHours }}</span>
            <span class="stat-label">Study Hours</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <div class="stat-info">
            <span class="stat-value">{{ stats.sessionsCompleted }}</span>
            <span class="stat-label">Sessions</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <div class="stat-info">
            <span class="stat-value">{{ stats.dailyStreak }}</span>
            <span class="stat-label">Day Streak</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📊</span>
          <div class="stat-info">
            <span class="stat-value">{{ stats.weeklyStudyMinutes }}m</span>
            <span class="stat-label">This Week</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>My Rooms</h2>
          <a routerLink="/rooms/create" class="btn-outline">+ Create Room</a>
        </div>

        <app-loading [loading]="loading" />

        <div class="room-grid" *ngIf="!loading">
          <div class="room-card" *ngFor="let room of myRooms" (click)="navigateToRoom(room.id)">
            <div class="room-card-header">
              <h3>{{ room.name }}</h3>
              <span class="subject-badge">{{ room.subject || 'General' }}</span>
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
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>All Rooms</h2>
          <a routerLink="/rooms" class="btn-outline">View All</a>
        </div>

        <div class="room-grid" *ngIf="!loading">
          <div class="room-card" *ngFor="let room of allRooms.slice(0, 4)" (click)="navigateToRoom(room.id)">
            <div class="room-card-header">
              <h3>{{ room.name }}</h3>
              <span class="subject-badge">{{ room.subject || 'General' }}</span>
            </div>
            <p class="room-desc">{{ room.description || 'No description' }}</p>
            <div class="room-meta">
              <span>{{ room.memberCount }} members</span>
              <span>{{ room.createdAt | date:'mediumDate' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; }
    .welcome-card { background: linear-gradient(135deg, var(--primary), var(--accent)); border-radius: 16px; padding: 32px; margin-bottom: 32px; }
    .welcome-card h2 { font-size: 22px; font-weight: 700; color: white; margin-bottom: 4px; }
    .welcome-card p { color: rgba(255,255,255,0.8); font-size: 14px; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }

    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; }

    .stat-icon { font-size: 32px; }
    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--text-primary); }
    .stat-label { font-size: 12px; color: var(--text-muted); }

    .section { margin-bottom: 32px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .section-header h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); }

    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

    .room-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.15s; }
    .room-card:hover { border-color: var(--primary); }
    .room-card.empty { cursor: default; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .room-card.empty:hover { border-color: var(--border); }
    .room-card.empty p { color: var(--text-muted); }

    .room-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .room-card-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }

    .subject-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }

    .room-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .room-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }

    .btn-outline { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all 0.15s; }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private roomService = inject(RoomService);
  private statsService = inject(StatisticsService);

  myRooms: Room[] = [];
  allRooms: Room[] = [];
  stats: UserStats = { totalStudyHours: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  loading = true;

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
    window.location.href = `/rooms/${id}`;
  }
}
