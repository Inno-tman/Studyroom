import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { StatisticsService } from '../core/services/statistics.service';
import { LoadingComponent } from '../shared/components/loading/loading.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, DatePipe, LoadingComponent],
  template: `
    <div class="analytics">
      <div class="analytics-header">
        <h1>Study Analytics</h1>
        <div class="export-btns">
          <button class="btn-export" (click)="exportData('csv')">
            <span class="material-icons">download</span> CSV
          </button>
          <button class="btn-export" (click)="exportData('json')">
            <span class="material-icons">code</span> JSON
          </button>
        </div>
      </div>
      <app-loading [loading]="loading" />

      <div class="overview-grid" *ngIf="!loading && overview">
        <div class="ov-card">
          <span class="material-icons ov-icon">schedule</span>
          <span class="ov-value">{{ formatDuration(overview.totalMinutes) }}</span>
          <span class="ov-label">Total Study Time</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">check_circle</span>
          <span class="ov-value">{{ overview.totalSessions }}</span>
          <span class="ov-label">Total Sessions</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">timer</span>
          <span class="ov-value">{{ formatDuration(overview.avgSessionMinutes) }}</span>
          <span class="ov-label">Avg Session</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">local_fire_department</span>
          <span class="ov-value">{{ overview.currentStreak }}d</span>
          <span class="ov-label">Current Streak</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">military_tech</span>
          <span class="ov-value">{{ overview.longestStreak }}d</span>
          <span class="ov-label">Longest Streak</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">wb_sunny</span>
          <span class="ov-value">{{ overview.favoriteTimeOfDay }}</span>
          <span class="ov-label">Peak Time</span>
        </div>
        <div class="ov-card" [class.positive]="overview.weekOverWeekChange > 0" [class.negative]="overview.weekOverWeekChange < 0">
          <span class="material-icons ov-icon">{{ overview.weekOverWeekChange >= 0 ? 'trending_up' : 'trending_down' }}</span>
          <span class="ov-value">{{ overview.weekOverWeekChange > 0 ? '+' : '' }}{{ overview.weekOverWeekChange | number:'1.0-1' }}%</span>
          <span class="ov-label">Week over Week</span>
        </div>
        <div class="ov-card">
          <span class="material-icons ov-icon">date_range</span>
          <span class="ov-value">{{ overview.activeDaysThisWeek }}/7</span>
          <span class="ov-label">Active Days This Week</span>
        </div>
      </div>

      <!-- Room breakdown -->
      <div class="section" *ngIf="roomBreakdown.length > 0">
        <h2>Time by Room</h2>
        <div class="bar-chart">
          <div class="bar-row" *ngFor="let r of roomBreakdown">
            <div class="bar-label">
              <span class="bar-name">{{ r.roomName }}</span>
              <span class="bar-subject" *ngIf="r.subject">{{ r.subject }}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="r.percentage"></div>
            </div>
            <div class="bar-value">{{ formatDuration(r.totalMinutes) }} ({{ r.percentage | number:'1.0-0' }}%)</div>
          </div>
        </div>
      </div>

      <!-- Daily trend -->
      <div class="section" *ngIf="dailyTrend.length > 0">
        <h2>Daily Trend (Last 30 Days)</h2>
        <div class="trend-chart">
          <div class="trend-bar" *ngFor="let d of dailyTrend" [title]="(d.date | date:'MMM d') + ': ' + formatDuration(d.minutes)">
            <div class="trend-fill" [style.height.%]="getTrendHeight(d.minutes)"></div>
            <span class="trend-label">{{ d.date | date:'d' }}</span>
          </div>
        </div>
      </div>

      <!-- Hourly distribution -->
      <div class="section" *ngIf="hourlyDist.length > 0">
        <h2>Study by Hour of Day</h2>
        <div class="hourly-chart">
          <div class="hour-col" *ngFor="let h of hourlyDist" [title]="h.hour + ':00 — ' + formatDuration(h.minutes)">
            <div class="hour-fill" [style.height.%]="getHourHeight(h.minutes)"></div>
            <span class="hour-label" *ngIf="h.hour % 3 === 0">{{ h.hour }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics { max-width: 1000px; margin: 0 auto; padding: 24px 0; }
    .analytics-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    h1 { font-size: var(--font-24); font-weight: 700; color: var(--text-primary); margin: 0; }
    .export-btns { display: flex; gap: 8px; }
    .btn-export {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-export:hover { border-color: var(--primary); color: var(--primary); }
    .btn-export .material-icons { font-size: 16px; }
    h2 { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }

    .overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .ov-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
    }
    .ov-icon { font-size: 22px; color: var(--primary); }
    .ov-value { font-size: var(--font-20); font-weight: 700; color: var(--text-primary); }
    .ov-label { font-size: var(--font-11); color: var(--text-muted); }
    .ov-card.positive .ov-icon, .ov-card.positive .ov-value { color: var(--success); }
    .ov-card.negative .ov-icon, .ov-card.negative .ov-value { color: var(--error); }

    /* Bar chart */
    .bar-chart { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-label { width: 160px; flex-shrink: 0; text-align: right; }
    .bar-name { display: block; font-size: var(--font-13); font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-subject { font-size: var(--font-11); color: var(--text-muted); }
    .bar-track { flex: 1; height: 10px; background: var(--background); border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 5px; transition: width 0.6s ease; }
    .bar-value { width: 100px; font-size: var(--font-12); font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }

    /* Trend chart */
    .trend-chart { display: flex; align-items: flex-end; gap: 2px; height: 120px; padding-top: 8px; }
    .trend-bar {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
      height: 100%; cursor: default;
    }
    .trend-fill {
      width: 100%; background: var(--primary); border-radius: 2px 2px 0 0; min-height: 2px;
      transition: height 0.3s ease; opacity: 0.8;
    }
    .trend-bar:hover .trend-fill { opacity: 1; }
    .trend-label { font-size: 9px; color: var(--text-muted); margin-top: 4px; }

    /* Hourly chart */
    .hourly-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; }
    .hour-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .hour-fill { width: 100%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 2px; opacity: 0.7; transition: height 0.3s ease; }
    .hour-col:hover .hour-fill { opacity: 1; }
    .hour-label { font-size: 9px; color: var(--text-muted); margin-top: 4px; }

    @media (max-width: 768px) {
      .overview-grid { grid-template-columns: repeat(2, 1fr); }
      .bar-label { width: 100px; }
    }
  `]
})
export class AnalyticsComponent implements OnInit {
  private statsService = inject(StatisticsService);

  loading = true;
  overview: any = null;
  roomBreakdown: any[] = [];
  dailyTrend: any[] = [];
  hourlyDist: any[] = [];

  private maxTrend = 1;
  private maxHour = 1;

  formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getTrendHeight(minutes: number): number {
    return this.maxTrend > 0 ? (minutes / this.maxTrend) * 100 : 0;
  }

  getHourHeight(minutes: number): number {
    return this.maxHour > 0 ? (minutes / this.maxHour) * 100 : 0;
  }

  async ngOnInit() {
    try {
      const [overview, rooms, trend, hourly] = await Promise.all([
        this.statsService.getAnalyticsOverview().toPromise(),
        this.statsService.getRoomBreakdown().toPromise(),
        this.statsService.getDailyTrend(30).toPromise(),
        this.statsService.getHourlyDistribution().toPromise()
      ]);
      this.overview = overview;
      this.roomBreakdown = rooms || [];
      this.dailyTrend = trend || [];
      this.hourlyDist = hourly || [];

      this.maxTrend = Math.max(1, ...this.dailyTrend.map(d => d.minutes));
      this.maxHour = Math.max(1, ...this.hourlyDist.map(h => h.minutes));
    } catch { } finally {
      this.loading = false;
    }
  }

  exportData(format: string) {
    const token = localStorage.getItem('studyroom_token');
    fetch(`${environment.apiUrl}/analytics/export?format=${format}&days=90`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `study-sessions.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}
