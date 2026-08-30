import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CalendarConnection {
  id: string;
  provider: string;
  calendarName: string;
  autoSync: boolean;
  connectedAt: string;
}

@Component({
  selector: 'app-calendar-settings',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe],
  template: `
    <div class="calendar-settings">
      <h2>Calendar Integration</h2>
      <p class="desc">Sync your focus sessions to Google Calendar or Outlook automatically.</p>

      <div class="connections" *ngIf="connections.length > 0">
        <div class="conn-card" *ngFor="let c of connections">
          <div class="conn-icon">
            <span class="material-icons">{{ c.provider === 'google' ? 'event' : 'calendar_today' }}</span>
          </div>
          <div class="conn-info">
            <span class="conn-name">{{ c.calendarName || (c.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar') }}</span>
            <span class="conn-date">Connected {{ c.connectedAt | date:'mediumDate' }}</span>
          </div>
          <label class="sync-toggle">
            <input type="checkbox" [checked]="c.autoSync" (change)="toggleAutoSync(c)" />
            <span class="toggle-label">Auto-sync</span>
          </label>
          <button class="btn-disconnect" (click)="disconnect(c)" title="Disconnect">
            <span class="material-icons">link_off</span>
          </button>
        </div>
      </div>

      <div class="connect-btns" *ngIf="connections.length < 2">
        <button class="btn-connect google" (click)="connectGoogle()" *ngIf="!isConnected('google')">
          <span class="material-icons">event</span>
          Connect Google Calendar
        </button>
        <button class="btn-connect microsoft" (click)="connectMicrosoft()" *ngIf="!isConnected('microsoft')">
          <span class="material-icons">calendar_today</span>
          Connect Outlook Calendar
        </button>
      </div>

      <div class="no-connections" *ngIf="connections.length === 0 && !loading">
        <span class="material-icons">calendar_month</span>
        <p>No calendars connected yet.</p>
      </div>

      <div class="manual-sync" *ngIf="connections.length > 0">
        <button class="btn-sync" (click)="manualSync()" [disabled]="syncing">
          <span class="material-icons">{{ syncing ? 'sync' : 'add_task' }}</span>
          {{ syncing ? 'Syncing...' : 'Sync Last Session Now' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .calendar-settings { padding: 0; }
    h2 { font-size: var(--font-18); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .desc { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 20px; }

    .connections { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .conn-card {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      background: var(--background); border: 1px solid var(--border); border-radius: 10px;
    }
    .conn-icon {
      width: 40px; height: 40px; border-radius: 10px; background: color-mix(in srgb, var(--primary) 10%, transparent);
      display: flex; align-items: center; justify-content: center;
    }
    .conn-icon .material-icons { font-size: 20px; color: var(--primary); }
    .conn-info { flex: 1; }
    .conn-name { display: block; font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .conn-date { font-size: var(--font-12); color: var(--text-muted); }

    .sync-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .sync-toggle input { accent-color: var(--primary); }
    .toggle-label { font-size: var(--font-12); font-weight: 600; color: var(--text-secondary); }

    .btn-disconnect {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
      background: transparent; color: var(--text-muted); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-disconnect:hover { border-color: var(--error); color: var(--error); }
    .btn-disconnect .material-icons { font-size: 16px; }

    .connect-btns { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .btn-connect {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
      border-radius: 10px; font-size: var(--font-13); font-weight: 600;
      cursor: pointer; transition: all 0.15s; border: 1px solid var(--border);
    }
    .btn-connect.google { background: #4285f4; color: white; border-color: #4285f4; }
    .btn-connect.google:hover { background: #3367d6; }
    .btn-connect.microsoft { background: #0078d4; color: white; border-color: #0078d4; }
    .btn-connect.microsoft:hover { background: #005a9e; }
    .btn-connect .material-icons { font-size: 18px; }

    .no-connections { text-align: center; padding: 32px; color: var(--text-muted); }
    .no-connections .material-icons { font-size: 40px; margin-bottom: 8px; display: block; }
    .no-connections p { font-size: var(--font-13); }

    .manual-sync { margin-top: 12px; }
    .btn-sync {
      display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      color: var(--text-secondary); font-size: var(--font-13); font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-sync:hover { border-color: var(--primary); color: var(--primary); }
    .btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-sync .material-icons { font-size: 18px; }
  `]
})
export class CalendarSettingsComponent implements OnInit {
  private http = inject(HttpClient);

  connections: CalendarConnection[] = [];
  loading = true;
  syncing = false;

  ngOnInit() {
    this.loadConnections();
  }

  isConnected(provider: string): boolean {
    return this.connections.some(c => c.provider === provider);
  }

  async loadConnections() {
    this.loading = true;
    try {
      this.connections = await this.http.get<CalendarConnection[]>(`${environment.apiUrl}/calendar/connections`).toPromise() || [];
    } catch { } finally {
      this.loading = false;
    }
  }

  connectGoogle() {
    const redirectUri = `${window.location.origin}/settings/calendar`;
    this.http.get<{ url: string }>(`${environment.apiUrl}/calendar/google/auth-url`, { params: { redirectUri } }).subscribe({
      next: res => window.location.href = res.url,
      error: () => {}
    });
  }

  connectMicrosoft() {
    const redirectUri = `${window.location.origin}/settings/calendar`;
    this.http.get<{ url: string }>(`${environment.apiUrl}/calendar/microsoft/auth-url`, { params: { redirectUri } }).subscribe({
      next: res => window.location.href = res.url,
      error: () => {}
    });
  }

  toggleAutoSync(conn: CalendarConnection) {
    this.http.post(`${environment.apiUrl}/calendar/auto-sync`, {
      connectionId: conn.id,
      enabled: !conn.autoSync
    }).subscribe({
      next: () => conn.autoSync = !conn.autoSync
    });
  }

  disconnect(conn: CalendarConnection) {
    if (!confirm(`Disconnect ${conn.calendarName || conn.provider}?`)) return;
    this.http.post(`${environment.apiUrl}/calendar/disconnect/${conn.id}`, {}).subscribe({
      next: () => this.connections = this.connections.filter(c => c.id !== conn.id)
    });
  }

  manualSync() {
    this.syncing = true;
    const now = new Date();
    const end = new Date(now.getTime() + 25 * 60000);
    this.http.post(`${environment.apiUrl}/calendar/sync`, {
      title: 'Focus Session',
      start: now.toISOString(),
      end: end.toISOString(),
      description: 'Manual sync from ResVibe'
    }).subscribe({
      next: () => { this.syncing = false; alert('Synced!'); },
      error: () => { this.syncing = false; alert('Sync failed'); }
    });
  }
}
