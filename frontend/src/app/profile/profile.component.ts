import { Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { StatisticsService } from '../core/services/statistics.service';
import { UserStats } from '../shared/models/stats.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
    <div class="profile">
      <div class="page-header">
        <h1>Profile</h1>
      </div>

      <div class="profile-card">
        <div class="profile-avatar" [class.has-image]="auth.currentUser()?.avatarUrl">
          <img *ngIf="auth.currentUser()?.avatarUrl; else initial" [src]="auth.currentUser()?.avatarUrl" alt="avatar" />
          <ng-template #initial>{{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}</ng-template>
        </div>
        <div class="profile-info">
          <h2>{{ auth.currentUser()?.username }}</h2>
          <p>{{ auth.currentUser()?.email }}</p>
          <span class="role-badge">{{ auth.currentUser()?.role }}</span>
        </div>
      </div>

      <div class="edit-section">
        <h2>Edit Profile</h2>
        <form (ngSubmit)="save()" #profileForm="ngForm">
          <label>
            Username
            <input
              type="text"
              name="username"
              [(ngModel)]="username"
              required
              minlength="3"
              maxlength="50"
              #usernameField="ngModel"
            />
          </label>
          <div *ngIf="usernameField.invalid && usernameField.touched" class="form-error">
            Username must be at least 3 characters.
          </div>

          <label>
            Avatar URL
            <input
              type="text"
              name="avatarUrl"
              [(ngModel)]="avatarUrl"
              placeholder="https://example.com/avatar.jpg"
              #avatarField="ngModel"
            />
          </label>

          <div *ngIf="avatarUrl" class="avatar-preview">
            <img [src]="avatarUrl" alt="avatar preview" />
          </div>

          <div class="form-actions">
            <button type="submit" [disabled]="profileForm.invalid || saving" class="btn-primary">
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
            <button type="button" class="btn-secondary" (click)="resetForm()">Reset</button>
          </div>

          <div *ngIf="error" class="form-error">{{ error }}</div>
          <div *ngIf="success" class="form-success">{{ success }}</div>
        </form>
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

    .profile-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: white; overflow: hidden; flex-shrink: 0; }
    .profile-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .profile-info h2 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .profile-info p { font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }

    .role-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }

    .edit-section { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 32px; margin-bottom: 32px; }
    .edit-section h2 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 20px; }

    label { display: block; margin-bottom: 16px; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
    input {
      display: block; width: 100%; margin-top: 6px; padding: 10px 12px;
      background: var(--surface-alt, var(--background)); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: 14px;
    }
    input:focus { outline: none; border-color: var(--primary); }

    .avatar-preview { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; margin-bottom: 16px; }
    .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }

    .form-actions { display: flex; gap: 12px; }

    .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background: var(--surface-hover); color: var(--text-primary); border: 1px solid var(--border); padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-secondary:hover { opacity: 0.85; }

    .form-error { color: var(--error); font-size: 13px; margin-top: 8px; }
    .form-success { color: #10b981; font-size: 13px; margin-top: 8px; }

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

  username = '';
  avatarUrl = '';
  saving = false;
  error = '';
  success = '';

  async ngOnInit() {
    try {
      this.stats = await this.statsService.getStats().toPromise() || this.stats;
    } catch { }
    this.resetForm();
  }

  resetForm(): void {
    const user = this.auth.currentUser();
    this.username = user?.username ?? '';
    this.avatarUrl = user?.avatarUrl ?? '';
    this.error = '';
    this.success = '';
  }

  async save(): Promise<void> {
    this.error = '';
    this.success = '';
    this.saving = true;
    try {
      await this.auth.updateProfile({ username: this.username.trim(), avatarUrl: this.avatarUrl.trim() || undefined }).toPromise();
      this.success = 'Profile updated successfully.';
    } catch (err: any) {
      this.error = err?.error?.error || 'Failed to update profile. Please try again.';
    } finally {
      this.saving = false;
    }
  }
}
