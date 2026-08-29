import { Component, inject, OnInit } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { StatisticsService, GamificationProfile } from '../core/services/statistics.service';
import { UserService } from '../core/services/user.service';
import { TimelineComponent } from '../timeline/timeline.component';
import { UserStats } from '../shared/models/stats.model';

interface ProfileView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  schoolName?: string;
  location?: string;
  major?: string;
  birthDate?: string;
  interests?: string;
  bio?: string;
  role: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, RouterLink, TimelineComponent],
  template: `
    <div class="profile">
      <div class="page-header">
        <h1>{{ viewingOther ? (profile?.displayName + '’s Profile') : 'Profile' }}</h1>
        <a *ngIf="!viewingOther" routerLink="/settings/profile" class="btn-outline">
          <span class="material-icons">settings</span>
          Edit Profile
        </a>
      </div>

      <div class="profile-card" *ngIf="profile">
        <div class="avatar lg" [class.has-image]="profile?.avatarUrl">
          <img *ngIf="profile?.avatarUrl; else initial" [src]="profile?.avatarUrl" alt="avatar" />
          <ng-template #initial>{{ profile?.displayName?.charAt(0)?.toUpperCase() }}</ng-template>
        </div>
        <div class="profile-info">
          <h2>{{ profile?.displayName }}</h2>
          <p>{{ profile?.email }}</p>
          <p *ngIf="profile?.schoolName" class="school"><span class="material-icons school-icon">school</span> {{ profile?.schoolName }}</p>
          <p *ngIf="profile?.location" class="detail"><span class="material-icons">place</span> {{ profile?.location }}</p>
          <p *ngIf="profile?.major" class="detail"><span class="material-icons">work</span> {{ profile?.major }}</p>
          <p *ngIf="profile?.birthDate" class="detail"><span class="material-icons">cake</span> {{ age() }} years old</p>
          <p *ngIf="profile?.interests" class="interests">{{ interestsTags() }}</p>
          <p *ngIf="profile?.bio" class="bio">{{ profile?.bio }}</p>
          <span class="badge badge-accent">{{ profile?.role }}</span>
        </div>
      </div>

      <div class="stats-section">
        <h2>Study Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ formatDuration(stats.totalStudyMinutes) }}</span>
            <span class="stat-label">Total Time</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ stats.sessionsCompleted }}</span>
            <span class="stat-label">Sessions</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ stats.dailyStreak }}</span>
            <span class="stat-label">Day Streak</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ formatDuration(stats.weeklyStudyMinutes) }}</span>
            <span class="stat-label">This Week</span>
          </div>
        </div>
      </div>

      <div class="gamification-section" *ngIf="!viewingOther">
        <div class="gamification-card">
          <div class="gp-level">
            <div class="gp-level-ring">{{ gamification.level }}</div>
            <div class="gp-level-info">
              <span class="gp-level-title">Level {{ gamification.level }}</span>
              <span class="gp-level-sub">{{ gamification.totalXp }} total XP · {{ gamification.badgeCount }} badges</span>
            </div>
          </div>
          <div class="gp-progress">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="gamificationPercent"></div>
            </div>
            <div class="gp-progress-meta">
              <span>{{ gamification.xpIntoLevel }} / {{ gamification.xpForNextLevel }} XP</span>
              <span>{{ gamification.currentStreak }} day streak</span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-heatmap" *ngIf="heatmapDays.length > 0">
        <div class="hm-header">
          <span class="material-icons">calendar_month</span>
          <span class="hm-title">30-Day Study Activity</span>
          <span class="hm-count">{{ heatmapActiveDays }} active days</span>
        </div>
        <div class="hm-grid">
          <div class="hm-cell" *ngFor="let d of heatmapDays" [class.active]="d.minutes > 0" [class.today]="d.isToday"
            [title]="(d.date | date:'MMM d') + ': ' + formatDurationShort(d.minutes)">
            <div class="hm-fill" [style.opacity]="getHeatmapOpacity(d.minutes)"></div>
          </div>
        </div>
        <div class="hm-legend">
          <span>Less</span>
          <div class="hm-cell-sm"></div>
          <div class="hm-cell-sm lv1"></div>
          <div class="hm-cell-sm lv2"></div>
          <div class="hm-cell-sm lv3"></div>
          <div class="hm-cell-sm lv4"></div>
          <span>More</span>
        </div>
      </div>

      <div class="profile-recent" *ngIf="recentSessions.length > 0">
        <h2>Recent Sessions</h2>
        <div class="profile-recent-list">
          <div class="profile-recent-row" *ngFor="let s of recentSessions">
            <span class="material-icons pr-icon">play_circle</span>
            <div class="pr-info">
              <span class="pr-date">{{ s.date }}</span>
              <span class="pr-notes" *ngIf="s.notes">{{ s.notes }}</span>
            </div>
            <span class="pr-duration">{{ s.durationMinutes }}m</span>
          </div>
        </div>
      </div>

      <app-timeline *ngIf="profile && !profileNoPosts" (noPosts)="onNoPosts($event)" [userId]="profile.id" [userName]="profile?.displayName"></app-timeline>
    </div>
  `,
  styles: [`
    .profile { max-width: 800px; margin: 0 auto; }

    .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px; display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }

    .profile-info h2 { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .profile-info p { font-size: var(--font-14); color: var(--text-secondary); margin-bottom: 8px; }

    .school { display: flex; align-items: center; gap: 6px; }
    .school-icon { font-size: var(--font-16); color: var(--accent); }

    .detail { display: flex; align-items: center; gap: 6px; }
    .detail .material-icons { font-size: var(--font-16); color: var(--accent); }

    .interests { font-size: var(--font-14); color: var(--text-primary); font-weight: 500; }

    .profile-info .bio { font-size: var(--font-14); color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; }

    .stats-section { margin-top: 32px; }
    .stats-section h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 16px; }

    .gamification-section { margin-top: 20px; }
    .gamification-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
      padding: 18px 22px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
    }
    .gp-level { display: flex; align-items: center; gap: 12px; }
    .gp-level-ring {
      width: 54px; height: 54px; border-radius: 50%; flex-shrink: 0;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-20); font-weight: 800;
    }
    .gp-level-info { display: flex; flex-direction: column; }
    .gp-level-title { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); }
    .gp-level-sub { font-size: var(--font-12); color: var(--text-muted); }
    .gp-progress { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
    .gp-progress-meta { display: flex; justify-content: space-between; font-size: var(--font-12); color: var(--text-muted); }
    .progress-bar { width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 4px; transition: width 0.6s ease; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; }

    .stat-value { display: block; font-size: var(--font-28); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .profile-heatmap { margin-bottom: 24px; }
    .hm-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .hm-header .material-icons { font-size: var(--font-20); color: var(--primary); }
    .hm-title { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); }
    .hm-count { margin-left: auto; font-size: var(--font-12); font-weight: 600; color: var(--text-muted); }
    .hm-grid { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 8px; }
    .hm-cell { width: 14px; height: 14px; border-radius: 3px; background: var(--background); position: relative; }
    .hm-cell .hm-fill { position: absolute; inset: 0; border-radius: 3px; background: var(--primary); }
    .hm-cell.today { outline: 2px solid var(--primary); outline-offset: 1px; }
    .hm-legend { display: flex; align-items: center; gap: 3px; justify-content: flex-end; font-size: 10px; color: var(--text-muted); }
    .hm-cell-sm { width: 10px; height: 10px; border-radius: 2px; background: var(--background); }
    .hm-cell-sm.lv1 { background: color-mix(in srgb, var(--primary) 25%, transparent); }
    .hm-cell-sm.lv2 { background: color-mix(in srgb, var(--primary) 50%, transparent); }
    .hm-cell-sm.lv3 { background: color-mix(in srgb, var(--primary) 75%, transparent); }
    .hm-cell-sm.lv4 { background: var(--primary); }

    .profile-recent { margin-bottom: 24px; }
    .profile-recent h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
    .profile-recent-list { display: flex; flex-direction: column; gap: 4px; }
    .profile-recent-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: background 0.15s; }
    .profile-recent-row:hover { background: var(--background); }
    .pr-icon { font-size: var(--font-18); color: var(--success); }
    .pr-info { flex: 1; min-width: 0; }
    .pr-date { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .pr-notes { display: block; font-size: var(--font-12); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pr-duration { font-size: var(--font-13); font-weight: 700; color: var(--primary); flex-shrink: 0; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .profile-card { flex-direction: column; text-align: center; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private statsService = inject(StatisticsService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  profile: ProfileView | null = null;
  stats: UserStats = { totalStudyMinutes: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  recentSessions: any[] = [];
  heatmapDays: { date: string; minutes: number; isToday: boolean }[] = [];
  gamification: GamificationProfile = {
    totalXp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 100,
    currentStreak: 0, badgeCount: 0, thisWeekMinutes: 0, recentEvents: []
  };
  viewingOther = false;
  loading = true;
  profileNoPosts = false;

  onNoPosts(empty: boolean): void {
    this.profileNoPosts = empty;
  }

  get gamificationPercent(): number {
    if (!this.gamification || this.gamification.xpForNextLevel <= 0) return 0;
    return Math.min(100, Math.round(this.gamification.xpIntoLevel / this.gamification.xpForNextLevel * 100));
  }

  formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}h ${pad(m)}m`;
  }

  displayName(): string {
    return this.profile?.displayName ?? '';
  }

  age(): number | null {
    const birthDate = this.profile?.birthDate;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (birth.getMonth() > today.getMonth() || (birth.getMonth() === today.getMonth() && birth.getDate() > today.getDate())) {
      age--;
    }
    return age;
  }

  interestsTags(): string {
    const interests = this.profile?.interests;
    if (!interests) return '';
    return interests.split(/[,;]/).map(t => t.trim()).filter(Boolean).join(' · ');
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const me = this.auth.currentUser();
    try {
      if (id && id !== me?.id) {
        this.viewingOther = true;
        const user = await this.userService.getById(id).toPromise();
        if (!user) return;
        this.profile = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          schoolName: user.schoolName,
          location: user.location,
          major: user.major,
          interests: user.interests,
          bio: user.bio,
          role: user.role
        };
        this.stats = user.stats || this.stats;
      } else {
        if (me) {
          this.profile = {
            id: me.id,
            username: me.username,
            displayName: this.selfDisplayName(me),
            avatarUrl: me.avatarUrl,
            email: me.email,
            schoolName: me.schoolName,
            location: me.location,
            major: me.major,
            birthDate: me.birthDate,
            interests: me.interests,
            bio: me.bio,
            role: me.role
          };
        }
        this.stats = await this.statsService.getStats().toPromise() || this.stats;
        this.recentSessions = await this.statsService.getRecentSessions(5).toPromise() || [];
        const trendData = await this.statsService.getDailyTrend(30).toPromise() || [];
        this.buildHeatmap(trendData);
        const gami = await this.statsService.getGamification().toPromise();
        if (gami) this.gamification = gami;
      }
    } catch { } finally {
      this.loading = false;
    }
  }

  get heatmapActiveDays(): number {
    return this.heatmapDays.filter(d => d.minutes > 0).length;
  }

  getHeatmapOpacity(minutes: number): number {
    if (minutes <= 0) return 0;
    if (minutes < 30) return 0.25;
    if (minutes < 60) return 0.5;
    if (minutes < 120) return 0.75;
    return 1;
  }

  private buildHeatmap(trendData: any[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const byDate: Record<string, number> = {};
    trendData.forEach((d: any) => { byDate[d.date] = d.minutes; });
    const days: { date: string; minutes: number; isToday: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, minutes: byDate[key] || 0, isToday: key === todayStr });
    }
    this.heatmapDays = days;
  }

  formatDurationShort(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  private selfDisplayName(me: any): string {
    if (me?.firstName || me?.lastName) {
      return [me.firstName, me.lastName].filter(Boolean).join(' ');
    }
    return me?.username ?? '';
  }
}
