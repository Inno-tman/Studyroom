import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { RoomService } from '../core/services/room.service';
import { StatisticsService, Milestone, TodayProgress, Recommendation, GamificationProfile } from '../core/services/statistics.service';
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
          <span class="hero-badge level-badge" *ngIf="gamification.level > 1">
            <span class="material-icons">workspace_premium</span>
            Level {{ gamification.level }}
          </span>
        </div>
      </div>

      <!-- ── Tab bar ─────────────────────────────────────────── -->
      <div class="tab-bar">
        <button *ngFor="let t of tabs" class="tab-btn" [class.active]="activeTab === t.id" (click)="activeTab = t.id">
          <span class="material-icons">{{ t.icon }}</span>
          {{ t.label }}
        </button>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           TAB: Overview — Daily goal + Stats strip
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="activeTab === 'overview'" class="tab-pane">
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

        <div class="xp-card">
          <div class="xp-left">
            <div class="xp-level-ring">
              <span>{{ gamification.level }}</span>
            </div>
            <div class="xp-info">
              <span class="xp-title">Level {{ gamification.level }}</span>
              <span class="xp-sub">{{ gamification.totalXp }} total XP</span>
            </div>
          </div>
          <div class="xp-progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="gamificationPercent"></div>
            </div>
            <div class="xp-meta">
              <span>{{ gamification.badgeCount }} badges earned</span>
              <span>{{ gamification.xpIntoLevel }} / {{ gamification.xpForNextLevel }} XP to level {{ gamification.level + 1 }}</span>
            </div>
          </div>
          <a routerLink="/people?view=leaderboard" class="xp-link">
            <span class="material-icons">leaderboard</span>
            Friends
          </a>
        </div>

        <div class="tools-row">
          <a routerLink="/flashcards" class="tool-card">
            <span class="material-icons tool-icon">style</span>
            <div class="tool-info">
              <span class="tool-name">Flashcards</span>
              <span class="tool-desc">Study decks + AI-generated cards</span>
            </div>
            <span class="material-icons tool-arrow">chevron_right</span>
          </a>
          <a routerLink="/games" class="tool-card">
            <span class="material-icons tool-icon">sports_esports</span>
            <div class="tool-info">
              <span class="tool-name">Educational Games</span>
              <span class="tool-desc">Quiz, memory, math challenges</span>
            </div>
            <span class="material-icons tool-arrow">chevron_right</span>
          </a>
        </div>

        <div class="recommendations" *ngIf="recommendations.length > 0">
          <div class="recs-card">
            <div class="recs-header">
              <span class="material-icons">auto_awesome</span>
              <span class="recs-title">Smart Suggestions</span>
            </div>
            <div class="recs-grid">
              <div class="rec-card" *ngFor="let r of recommendations">
                <div class="rec-icon-wrap" [ngClass]="getRecColor(r.icon)">
                  <span class="material-icons rec-icon">{{ r.icon }}</span>
                </div>
                <div class="rec-info">
                  <span class="rec-name">{{ r.title }}</span>
                  <span class="rec-desc">{{ r.description }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           TAB: My Rooms — room cards
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="activeTab === 'rooms'" class="tab-pane">
        <div class="section">
          <div class="section-tabs">
            <button class="section-tab" [class.active]="roomTab === 'mine'" (click)="roomTab = 'mine'">
              My Rooms
              <span class="section-tab-badge">{{ myRooms.length }}</span>
            </button>
            <button class="section-tab" [class.active]="roomTab === 'all'" (click)="roomTab = 'all'">
              Discover
              <span class="section-tab-badge">{{ allRooms.length }}</span>
            </button>
          </div>

          <app-loading [loading]="loading" />

          <div class="room-grid" *ngIf="!loading">
            <ng-container *ngIf="roomTab === 'mine'">
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

            <ng-container *ngIf="roomTab === 'all'">
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

      <!-- ═══════════════════════════════════════════════════════
           TAB: Progress — Streak + Milestones + Recent sessions
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="activeTab === 'progress'" class="tab-pane">
        <div class="streak-calendar" *ngIf="streakDays.length > 0">
          <div class="streak-header">
            <span class="material-icons">calendar_month</span>
            <span class="streak-title">Study Streak</span>
            <span class="streak-count">{{ activeDaysCount }} / 30 active days</span>
          </div>
          <div class="streak-grid">
            <div class="streak-cell" *ngFor="let d of streakDays" [class.active]="d.minutes > 0" [class.today]="d.isToday"
              [title]="(d.date | date:'MMM d') + ': ' + formatDurationShort(d.minutes)">
              <div class="streak-fill" [style.opacity]="getStreakOpacity(d.minutes)"></div>
            </div>
          </div>
          <div class="streak-legend">
            <span>Less</span>
            <div class="streak-cell-sm"></div>
            <div class="streak-cell-sm s1"></div>
            <div class="streak-cell-sm s2"></div>
            <div class="streak-cell-sm s3"></div>
            <div class="streak-cell-sm s4"></div>
            <span>More</span>
          </div>
        </div>

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

        <div class="recent-sessions collapsible" *ngIf="recentSessions.length > 0">
          <div class="recent-header clickable" (click)="sessionsExpanded = !sessionsExpanded">
            <span class="material-icons">history</span>
            <span class="recent-title">Recent Sessions</span>
            <span class="material-icons collapse-chevron" [class.open]="sessionsExpanded">expand_more</span>
            <a routerLink="/analytics" class="recent-link" (click)="$event.stopPropagation()">View All →</a>
          </div>
          <div class="collapse-body" [class.open]="sessionsExpanded">
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
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           TAB: Activity — Feed + Smart suggestions
           ═══════════════════════════════════════════════════════ -->
      <div *ngIf="activeTab === 'activity'" class="tab-pane">
        <div class="activity-feed collapsible" *ngIf="activityFeed.length > 0">
          <div class="af-header clickable" (click)="activityExpanded = !activityExpanded">
            <span class="material-icons">update</span>
            <span class="af-title">Recent Activity</span>
            <span class="material-icons collapse-chevron" [class.open]="activityExpanded">expand_more</span>
          </div>
          <div class="collapse-body" [class.open]="activityExpanded">
            <div class="af-list">
              <div class="af-row" *ngFor="let a of activityFeed">
                <span class="material-icons af-icon">{{ a.icon || 'circle' }}</span>
                <div class="af-info">
                  <span class="af-text">{{ a.text }}</span>
                  <span class="af-date">{{ a.date | date:'MMM d, h:mm a' }}</span>
                </div>
              </div>
            </div>
          </div>
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
    .hero-create { margin-right: 0; }
    .hero-top { flex-wrap: wrap; }
    .hero-quick {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
      color: white; padding: 10px 16px; border-radius: 10px; font-weight: 600;
      font-size: var(--font-13); display: inline-flex; align-items: center; gap: 6px;
      cursor: pointer; transition: background 0.15s;
    }
    .hero-quick:hover { background: rgba(255,255,255,0.28); }

    /* ── Tab bar (matches room detail style) ──────────────── */
    .tab-bar {
      display: flex; gap: 4px; margin-bottom: 20px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 6px; overflow-x: auto;
    }
    .tab-bar::-webkit-scrollbar { display: none; }
    .tab-btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 12px; background: none; border: none; border-radius: 8px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s;
    }
    .tab-btn:hover { background: var(--background); color: var(--text-primary); }
    .tab-btn.active { background: var(--primary); color: white; }
    .tab-btn .material-icons { font-size: var(--font-18); }

    /* Tab pane wrapper */
    .tab-pane { animation: fadeIn 0.15s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    /* ── Collapsible sections ─────────────────────────────── */
    .collapsible .clickable { cursor: pointer; user-select: none; }
    .collapsible .clickable:hover { opacity: 0.85; }
    .collapse-chevron {
      font-size: var(--font-20) !important; color: var(--text-muted);
      transition: transform 0.2s ease; margin-left: 4px;
    }
    .collapse-chevron.open { transform: rotate(180deg); }
    .collapse-body {
      max-height: 0; overflow: hidden; transition: max-height 0.25s ease;
    }
    .collapse-body.open { max-height: 2000px; }

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

    /* Stats strip */
    .stats-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    }
    .stats-strip-item {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .stat-value { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); }
    .unverified-warn .material-icons { font-size: var(--font-16); color: #f59e0b; }

    /* Level & XP */
    .xp-card {
      margin-top: 16px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 18px;
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .xp-left { display: flex; align-items: center; gap: 12px; }
    .xp-level-ring {
      width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-18); font-weight: 700;
    }
    .xp-info { display: flex; flex-direction: column; }
    .xp-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .xp-sub { font-size: var(--font-12); color: var(--text-muted); }
    .xp-progress-wrap { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
    .xp-meta { display: flex; justify-content: space-between; font-size: var(--font-12); color: var(--text-muted); flex-wrap: wrap; gap: 4px; }
    .xp-link {
      display: flex; align-items: center; gap: 6px; padding: 8px 12px;
      border: 1px solid var(--border); border-radius: 10px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      text-decoration: none; flex-shrink: 0; transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .xp-link:hover { background: var(--surface-hover); color: var(--accent); border-color: var(--accent); }
    .xp-link .material-icons { font-size: 18px; }

    /* Study tools */
    .tools-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 16px; }
    .tool-card {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      text-decoration: none; transition: border-color 0.15s, transform 0.15s;
    }
    .tool-card:hover { border-color: var(--accent); transform: translateY(-1px); }
    .tool-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent); display: flex; align-items: center; justify-content: center;
    }
    .tool-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tool-name { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .tool-desc { font-size: var(--font-12); color: var(--text-muted); }
    .tool-arrow { color: var(--text-muted); font-size: 20px; }

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
    .recommendations { margin-top: 16px; margin-bottom: 20px; }
    .recs-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 20px;
    }
    .recs-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
    }
    .recs-header .material-icons { color: var(--accent); font-size: 20px; }
    .recs-title { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .recs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .rec-card {
      display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .rec-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(56,189,248,0.08); }
    .rec-icon-wrap {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .rec-icon-wrap .rec-icon { font-size: 20px; }
    .rec-icon-wrap.blue { background: rgba(37,99,235,0.12); color: var(--primary); }
    .rec-icon-wrap.green { background: rgba(34,197,94,0.12); color: var(--success); }
    .rec-icon-wrap.orange { background: rgba(245,158,11,0.12); color: var(--warning); }
    .rec-icon-wrap.red { background: rgba(239,68,68,0.12); color: var(--error); }
    .rec-icon-wrap.accent { background: rgba(56,189,248,0.12); color: var(--accent); }
    .rec-icon-wrap.purple { background: rgba(168,85,247,0.12); color: #A855F7; }
    .rec-info { flex: 1; min-width: 0; }
    .rec-name { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
    .rec-desc { font-size: var(--font-12); color: var(--text-secondary); line-height: 1.45; }

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

    /* Streak calendar */
    .streak-calendar {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 20px; margin-bottom: 16px;
    }
    .streak-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .streak-header .material-icons { font-size: var(--font-20); color: var(--primary); }
    .streak-title { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); }
    .streak-count { margin-left: auto; font-size: var(--font-12); font-weight: 600; color: var(--text-muted); }
    .streak-grid { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 8px; }
    .streak-cell { width: 14px; height: 14px; border-radius: 3px; background: var(--background); position: relative; cursor: default; }
    .streak-cell .streak-fill { position: absolute; inset: 0; border-radius: 3px; background: var(--primary); }
    .streak-cell.active .streak-fill { background: var(--primary); }
    .streak-cell.today { outline: 2px solid var(--primary); outline-offset: 1px; }
    .streak-legend { display: flex; align-items: center; gap: 3px; justify-content: flex-end; font-size: 10px; color: var(--text-muted); }
    .streak-cell-sm { width: 10px; height: 10px; border-radius: 2px; background: var(--background); }
    .streak-cell-sm.s1 { background: color-mix(in srgb, var(--primary) 25%, transparent); }
    .streak-cell-sm.s2 { background: color-mix(in srgb, var(--primary) 50%, transparent); }
    .streak-cell-sm.s3 { background: color-mix(in srgb, var(--primary) 75%, transparent); }
    .streak-cell-sm.s4 { background: var(--primary); }

    /* Activity feed */
    .activity-feed {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 20px; margin-bottom: 16px;
    }
    .af-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .af-header .material-icons { font-size: var(--font-20); color: var(--primary); }
    .af-title { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); }
    .af-list { display: flex; flex-direction: column; gap: 4px; }
    .af-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; transition: background 0.15s; }
    .af-row:hover { background: var(--background); }
    .af-icon { font-size: var(--font-18); color: var(--success); }
    .af-info { flex: 1; min-width: 0; }
    .af-text { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .af-date { display: block; font-size: var(--font-11); color: var(--text-muted); }

    /* Room section tabs (inside My Rooms tab) */
    .section { }
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
      .tab-btn { padding: 8px 10px; font-size: var(--font-12); }
      .tab-btn .material-icons { font-size: var(--font-16); }
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
  streakDays: { date: string; minutes: number; isToday: boolean }[] = [];
  activityFeed: any[] = [];
  stats: UserStats = { totalStudyMinutes: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  todayProgress: TodayProgress | null = null;
  milestones: Milestone[] = [];
  recommendations: Recommendation[] = [];
  gamification: GamificationProfile = {
    totalXp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 100,
    currentStreak: 0, badgeCount: 0, thisWeekMinutes: 0, recentEvents: []
  };

  activeTab = 'overview';
  roomTab: 'mine' | 'all' = 'mine';
  loading = true;
  sessionsExpanded = true;
  activityExpanded = true;

  tabs = [
    { id: 'overview', icon: 'dashboard', label: 'Overview' },
    { id: 'rooms',    icon: 'meeting_room', label: 'My Rooms' },
    { id: 'progress', icon: 'trending_up', label: 'Progress' },
    { id: 'activity', icon: 'update',      label: 'Activity' },
  ];

  get dailyGoalPercent(): number {
    if (!this.todayProgress || this.todayProgress.dailyGoalMinutes <= 0) return 0;
    return Math.min(100, Math.round(this.todayProgress.studiedMinutes / this.todayProgress.dailyGoalMinutes * 100));
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

  formatDurationShort(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  async ngOnInit() {
    try {
      const [myRooms, allRooms, stats, todayProgress, milestones, recommendations, recentSessions, trendData, activity, gamification] = await Promise.all([
        this.roomService.getMyRooms().toPromise(),
        this.roomService.getAll().toPromise(),
        this.statsService.getStats().toPromise(),
        this.statsService.getTodayProgress().toPromise(),
        this.statsService.getMilestones().toPromise(),
        this.statsService.getRecommendations().toPromise(),
        this.statsService.getRecentSessions(10).toPromise(),
        this.statsService.getDailyTrend(30).toPromise(),
        this.statsService.getActivityFeed(15).toPromise(),
        this.statsService.getGamification().toPromise()
      ]);
      this.myRooms = myRooms || [];
      this.allRooms = allRooms || [];
      this.stats = stats || this.stats;
      this.todayProgress = todayProgress || null;
      this.milestones = milestones || [];
      this.recommendations = recommendations || [];
      this.recentSessions = recentSessions || [];
      this.buildStreakDays(trendData || []);
      this.activityFeed = activity || [];
      if (gamification) this.gamification = gamification;
    } catch { } finally {
      this.loading = false;
    }

    this.signalR.timerCompleted$.subscribe(async () => {
      try {
        const [refreshed, progress, ms, recs, recent, gami] = await Promise.all([
          this.statsService.getStats().toPromise(),
          this.statsService.getTodayProgress().toPromise(),
          this.statsService.getMilestones().toPromise(),
          this.statsService.getRecommendations().toPromise(),
          this.statsService.getRecentSessions(10).toPromise(),
          this.statsService.getGamification().toPromise()
        ]);
        if (refreshed) this.stats = refreshed;
        if (progress) this.todayProgress = progress;
        if (ms) this.milestones = ms;
        if (recs) this.recommendations = recs;
        if (recent) this.recentSessions = recent;
        if (gami) this.gamification = gami;
      } catch { }
    });
  }

  quickStudy() {
    if (this.myRooms.length === 0) return;
    const room = this.myRooms[Math.floor(Math.random() * this.myRooms.length)];
    this.router.navigate(['/rooms', room.id]);
  }

  get activeDaysCount(): number {
    return this.streakDays.filter(d => d.minutes > 0).length;
  }

  getStreakOpacity(minutes: number): number {
    if (minutes <= 0) return 0;
    if (minutes < 30) return 0.25;
    if (minutes < 60) return 0.5;
    if (minutes < 120) return 0.75;
    return 1;
  }

  private buildStreakDays(trendData: any[]) {
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
    this.streakDays = days;
  }

  navigateToRoom(id: string) {
    this.router.navigate(['/rooms', id]);
  }

  getRecColor(icon: string): string {
    if (['trending_down', 'warning', 'error_outline'].includes(icon)) return 'red';
    if (['trending_up', 'check_circle', 'celebration'].includes(icon)) return 'green';
    if (['schedule', 'timer', 'event'].includes(icon)) return 'orange';
    if (['lightbulb', 'auto_awesome', 'psychology'].includes(icon)) return 'accent';
    if (['emoji_events', 'star', 'military_tech'].includes(icon)) return 'purple';
    return 'blue';
  }
}
