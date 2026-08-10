import { Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { StatisticsService } from '../core/services/statistics.service';
import { UserStats } from '../shared/models/stats.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, RouterLink],
  template: `
    <div class="profile">
      <div class="page-header">
        <h1>Profile</h1>
        <a routerLink="/settings/profile" class="edit-btn">
          <span class="material-icons">settings</span>
          Edit Profile
        </a>
      </div>

      <div class="profile-card">
        <div class="profile-avatar" [class.has-image]="auth.currentUser()?.avatarUrl">
          <img *ngIf="auth.currentUser()?.avatarUrl; else initial" [src]="auth.currentUser()?.avatarUrl" alt="avatar" />
          <ng-template #initial>{{ displayName()?.charAt(0)?.toUpperCase() }}</ng-template>
        </div>
        <div class="profile-info">
          <h2>{{ displayName() }}</h2>
          <p>{{ auth.currentUser()?.email }}</p>
          <p *ngIf="auth.currentUser()?.schoolName" class="school"><span class="material-icons school-icon">school</span> {{ auth.currentUser()?.schoolName }}</p>
          <p *ngIf="auth.currentUser()?.location" class="detail"><span class="material-icons">place</span> {{ auth.currentUser()?.location }}</p>
          <p *ngIf="auth.currentUser()?.major" class="detail"><span class="material-icons">work</span> {{ auth.currentUser()?.major }}</p>
          <p *ngIf="auth.currentUser()?.birthDate" class="detail"><span class="material-icons">cake</span> {{ age() }} years old</p>
          <p *ngIf="auth.currentUser()?.interests" class="interests">{{ interestsTags() }}</p>
          <p *ngIf="auth.currentUser()?.bio" class="bio">{{ auth.currentUser()?.bio }}</p>
          <span class="role-badge">{{ auth.currentUser()?.role }}</span>
        </div>
      </div>

      <div class="stats-section">
        <h2>Study Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ stats.totalStudyHours }}</span>
            <span class="stat-label">Total Hours</span>
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
            <span class="stat-value">{{ stats.weeklyStudyMinutes }}m</span>
            <span class="stat-label">This Week</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile { max-width: 800px; }

    .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px; display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }

    .profile-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: var(--font-28); font-weight: 700; color: white; overflow: hidden; flex-shrink: 0; }
    .profile-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .profile-info h2 { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .profile-info p { font-size: var(--font-14); color: var(--text-secondary); margin-bottom: 8px; }

    .school { display: flex; align-items: center; gap: 6px; }
    .school-icon { font-size: var(--font-16); color: var(--accent); }

    .detail { display: flex; align-items: center; gap: 6px; }
    .detail .material-icons { font-size: var(--font-16); color: var(--accent); }

    .interests { font-size: var(--font-14); color: var(--text-primary); font-weight: 500; }

    .profile-info .bio { font-size: var(--font-14); color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; }

    .role-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 10px; border-radius: 6px; font-size: var(--font-12); font-weight: 600; }

    .edit-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--primary);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: var(--font-14);
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s;
    }

    .edit-btn:hover { opacity: 0.85; }
    .edit-btn .material-icons { font-size: var(--font-18); }

    .stats-section { margin-top: 32px; }
    .stats-section h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin-bottom: 16px; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; }

    .stat-value { display: block; font-size: var(--font-28); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .profile-card { flex-direction: column; text-align: center; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private statsService = inject(StatisticsService);

  stats: UserStats = { totalStudyHours: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };

  displayName(): string {
    const user = this.auth.currentUser();
    if (user?.firstName || user?.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(' ');
    }
    return user?.username ?? '';
  }

  async ngOnInit() {
    try {
      this.stats = await this.statsService.getStats().toPromise() || this.stats;
    } catch { }
  }
}
