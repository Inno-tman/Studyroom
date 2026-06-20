import { Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { StatisticsService } from '../core/services/statistics.service';
import { UserStats } from '../shared/models/stats.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="profile">
      <div class="page-header">
        <h1>Profile</h1>
      </div>

      <div class="profile-card">
        <div class="profile-avatar">
          {{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}
        </div>
        <div class="profile-info">
          <h2>{{ auth.currentUser()?.username }}</h2>
          <p>{{ auth.currentUser()?.email }}</p>
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

    .profile-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: white; }

    .profile-info h2 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .profile-info p { font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }

    .role-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }

    .stats-section h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; }

    .stat-value { display: block; font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

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

  async ngOnInit() {
    try {
      this.stats = await this.statsService.getStats().toPromise() || this.stats;
    } catch { }
  }
}
