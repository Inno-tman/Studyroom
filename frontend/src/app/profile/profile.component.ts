import { Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { StatisticsService } from '../core/services/statistics.service';
import { UserService } from '../core/services/user.service';
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
  imports: [NgIf, RouterLink],
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
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  profile: ProfileView | null = null;
  stats: UserStats = { totalStudyMinutes: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  viewingOther = false;
  loading = true;

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
      }
    } catch { } finally {
      this.loading = false;
    }
  }

  private selfDisplayName(me: any): string {
    if (me?.firstName || me?.lastName) {
      return [me.firstName, me.lastName].filter(Boolean).join(' ');
    }
    return me?.username ?? '';
  }
}
