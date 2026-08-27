import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { RoomService } from '../core/services/room.service';
import { StatisticsService, Milestone, TodayProgress, Recommendation } from '../core/services/statistics.service';
import { SignalRService } from '../core/services/signalr.service';
import { Room } from '../shared/models/room.model';
import { UserStats } from '../shared/models/stats.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, DatePipe, DecimalPipe, LoadingComponent],
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
          <button class="hero-quick" (click)="quickStudy()" *ngIf="myRooms.length > 0" title="Jump into a random room">
            <span class="material-icons">bolt</span> Quick Study
          </button>
        </div>
        <div class="hero-badges">
          <span class="hero-badge">
            <span class="material-icons">local_fire_department</span>
            {{ stats.dailyStreak }} day streak
          </span>
          <span class="hero-badge">
            <span class="material-icons">schedule</span>
            {{ formatDuration(stats.totalStudyMinutes) }} studied
          </span>
          <span class="hero-badge">
            <span class="material-icons">group</span>
            {{ myRooms.length }} rooms
          </span>
        </div>
      </div>

      <!-- ── Daily goal progress ────────────────────────────── -->
      <div class="daily-goal" *ngIf="todayProgress">
        <div class="daily-goal-header">
          <span class="material-icons">flag</span>
          <span class="daily-goal-title">Today's Goal</span>
          <span class="daily-goal-amount">{{ formatDurationShort(todayProgress.studiedMinutes) }} / {{ formatDurationShort(todayProgress.dailyGoalMinutes) }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="dailyGoalPercent"></div>
        </div>
        <div class="daily-goal-hint" *ngIf="dailyGoalPercent < 100">
          {{ dailyGoalPercent | number:'1.0-0' }}% complete — keep going!
        </div>
        <div class="daily-goal-hint done" *ngIf="dailyGoalPercent >= 100">
          <span class="material-icons">celebration</span> Goal reached! Great work today.
        </div>
      </div>

      <!-- ── Recent milestones ───────────────────────────────── -->
      <div class="milestones" *ngIf="milestones.length > 0">
        <div class="milestones-header">
          <span class="material-icons">emoji_events</span>
          <span class="milestones-title">Recent Achievements</span>
        </div>
        <div class="milestones-grid">
          <div class="milestone-card" *ngFor="let m of milestones.slice(0, 6)">
            <span class="material-icons milestone-icon">{{ m.icon }}</span>
            <div class="milestone-info">
              <span class="milestone-name">{{ m.title }}</span>
              <span class="milestone-desc">{{ m.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Smart recommendations ──────────────────────────────── -->
      <div class="recommendations" *ngIf="recommendations.length > 0">
        <div class="recs-header">
          <span class="material-icons">auto_awesome</span>
          <span class="recs-title">Smart Suggestions</span>
        </div>
        <div class="recs-grid">
          <div class="rec-card" *ngFor="let r of recommendations">
            <span class="material-icons rec-icon">{{ r.icon }}</span>
            <div class="rec-info">
              <span class="rec-name">{{ r.title }}</span>
              <span class="rec-desc">{{ r.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Proactive band ───────────────────────────────────── -->
        <div class="stats-strip">
        <div class="stats-strip-item">
          <span class="stat-value">{{ formatDuration(stats.totalStudyMinutes) }}</span>
          <span class="stat-label">Study Time</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">
            {{ stats.sessionsCompleted }}
            <span class="unverified-warn" *ngIf="stats.unverifiedSessions" title="{{ stats.unverifiedSessions }} sessions flagged as unverified">
              <span class="material-icons">warning</span>
            </span>
          </span>
          <span class="stat-label">Sessions</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.dailyStreak }}</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ formatDuration(stats.weeklyStudyMinutes) }}</span>
          <span class="stat-label">Last 7 Days</span>
        </div>
      </div>

      <!-- ── Recent Sessions ──────────────────────────────────── -->
      <div class="recent-sessions" *ngIf="recentSessions.length > 0">
        <div class="recent-header">
          <span class="material-icons">history</span>
          <span class="recent-title">Recent Sessions</span>
          <a routerLink="/analytics" class="recent-link">View All →</a>
        </div>
        <div class="recent-list">
          <div class="recent-row" *ngFor="let s of recentSessions">
            <span class="material-icons recent-icon">play_circle</span>
            <div class="recent-info">
              <span class="recent-date">{{ s.date }}</span>
              <span class="recent-notes" *ngIf="s.notes">{{ s.notes }}</span>
            </div>
            <span class="recent-duration">{{ formatDurationShort(s.durationMinutes) }}</span>
          </div>
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
    .dashboard { max-width: 1200px; margin: 0 auto; }

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

    /* Daily goal progress */
    .daily-goal {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 20px; margin-bottom: 16px;
    }
    .daily-goal-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    }
    .daily-goal-header .material-icons { color: var(--primary); font-size: 20px; }
    .daily-goal-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .daily-goal-amount { margin-left: auto; font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); }
    .progress-bar { width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 4px; transition: width 0.6s ease; }
    .daily-goal-hint { font-size: var(--font-12); color: var(--text-muted); }
    .daily-goal-hint.done { color: var(--success); display: flex; align-items: center; gap: 4px; }
    .daily-goal-hint.done .material-icons { font-size: var(--font-16); }

    /* Milestones */
    .milestones { margin-bottom: 20px; }
    .milestones-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .milestones-header .material-icons { color: #f59e0b; font-size: 20px; }
    .milestones-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .milestones-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
    .milestone-card {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    }
    .milestone-icon { font-size: 24px; color: #f59e0b; }
    .milestone-info { flex: 1; min-width: 0; }
    .milestone-name { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .milestone-desc { font-size: var(--font-11); color: var(--text-muted); }

    /* Recommendations */
    .recommendations { margin-bottom: 20px; }
    .recs-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .recs-header .material-icons { color: var(--accent); font-size: 20px; }
    .recs-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .recs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
    .rec-card {
      display: flex; align-items: flex-start; gap: 10px; padding: 12px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      transition: border-color 0.15s;
    }
    .rec-card:hover { border-color: var(--accent); }
    .rec-icon { font-size: 22px; color: var(--accent); margin-top: 2px; }
    .rec-info { flex: 1; min-width: 0; }
    .rec-name { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
    .rec-desc { font-size: var(--font-12); color: var(--text-secondary); line-height: 1.4; }

    /* Proactive live strip */
    .stats-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;
    }
    .stats-strip-item {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .stat-value { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); }
    .unverified-warn .material-icons { font-size: var(--font-16); color: #f59e0b; }

    /* Hero quick study button */
    .hero-create { margin-right: 0; }
    .hero-top { flex-wrap: wrap; }
    .hero-quick {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
      color: white; padding: 10px 16px; border-radius: 10px; font-weight: 600;
      font-size: var(--font-13); display: inline-flex; align-items: center; gap: 6px;
      cursor: pointer; transition: background 0.15s;
    }
    .hero-quick:hover { background: rgba(255,255,255,0.28); }

    /* Recent sessions */
    .recent-sessions {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 20px; margin-bottom: 16px;
    }
    .recent-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .recent-header .material-icons { font-size: var(--font-20); color: var(--primary); }
    .recent-title { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); }
    .recent-link { margin-left: auto; font-size: var(--font-12); font-weight: 600; color: var(--primary); text-decoration: none; }
    .recent-link:hover { text-decoration: underline; }
    .recent-list { display: flex; flex-direction: column; gap: 4px; }
    .recent-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; transition: background 0.15s; }
    .recent-row:hover { background: var(--background); }
    .recent-icon { font-size: var(--font-18); color: var(--success); }
    .recent-info { flex: 1; min-width: 0; }
    .recent-date { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .recent-notes { display: block; font-size: var(--font-12); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .recent-duration { font-size: var(--font-13); font-weight: 700; color: var(--primary); flex-shrink: 0; }

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
  private signalR = inject(SignalRService);
  private router = inject(Router);

  myRooms: Room[] = [];
  allRooms: Room[] = [];
  recentSessions: any[] = [];
  stats: UserStats = { totalStudyMinutes: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  todayProgress: TodayProgress | null = null;
  milestones: Milestone[] = [];
  recommendations: Recommendation[] = [];

  get dailyGoalPercent(): number {
    if (!this.todayProgress || this.todayProgress.dailyGoalMinutes <= 0) return 0;
    return Math.min(100, Math.round(this.todayProgress.studiedMinutes / this.todayProgress.dailyGoalMinutes * 100));
  }

  formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}h ${pad(m)}m`;
  }

  formatDurationShort(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  loading = true;
  tab: 'mine' | 'all' = 'mine';

  async ngOnInit() {
    try {
      const [myRooms, allRooms, stats, todayProgress, milestones, recommendations, recentSessions] = await Promise.all([
        this.roomService.getMyRooms().toPromise(),
        this.roomService.getAll().toPromise(),
        this.statsService.getStats().toPromise(),
        this.statsService.getTodayProgress().toPromise(),
        this.statsService.getMilestones().toPromise(),
        this.statsService.getRecommendations().toPromise(),
        this.statsService.getRecentSessions(10).toPromise()
      ]);
      this.myRooms = myRooms || [];
      this.allRooms = allRooms || [];
      this.stats = stats || this.stats;
      this.todayProgress = todayProgress || null;
      this.milestones = milestones || [];
      this.recommendations = recommendations || [];
      this.recentSessions = recentSessions || [];
    } catch { } finally {
      this.loading = false;
    }

    // Keep the streak / study totals fresh when a focus session completes.
    this.signalR.timerCompleted$.subscribe(async () => {
      try {
        const [refreshed, progress, ms, recs, recent] = await Promise.all([
          this.statsService.getStats().toPromise(),
          this.statsService.getTodayProgress().toPromise(),
          this.statsService.getMilestones().toPromise(),
          this.statsService.getRecommendations().toPromise(),
          this.statsService.getRecentSessions(10).toPromise()
        ]);
        if (refreshed) this.stats = refreshed;
        if (progress) this.todayProgress = progress;
        if (ms) this.milestones = ms;
        if (recs) this.recommendations = recs;
        if (recent) this.recentSessions = recent;
      } catch { }
    });
  }

  quickStudy() {
    if (this.myRooms.length === 0) return;
    const room = this.myRooms[Math.floor(Math.random() * this.myRooms.length)];
    this.router.navigate(['/rooms', room.id]);
  }

  navigateToRoom(id: string) {
    this.router.navigate(['/rooms', id]);
  }
}