import { Component, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { RoomService } from '../core/services/room.service';
import { StatisticsService } from '../core/services/statistics.service';
import { YoutubeService, YoutubeSearchResult } from '../core/services/youtube.service';
import { Room } from '../shared/models/room.model';
import { UserStats } from '../shared/models/stats.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, DatePipe, LoadingComponent, FormsModule],
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
        </div>
        <div class="hero-badges">
          <span class="hero-badge">
            <span class="material-icons">local_fire_department</span>
            {{ stats.dailyStreak }} day streak
          </span>
          <span class="hero-badge">
            <span class="material-icons">schedule</span>
            {{ stats.totalStudyHours }}h studied
          </span>
          <span class="hero-badge">
            <span class="material-icons">group</span>
            {{ myRooms.length }} rooms
          </span>
        </div>
      </div>

      <!-- ── Proactive band ───────────────────────────────────── -->
      <div class="stats-strip">
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.totalStudyHours }}h</span>
          <span class="stat-label">Study Hours</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.sessionsCompleted }}</span>
          <span class="stat-label">Sessions</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.dailyStreak }}</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stats-strip-item">
          <span class="stat-value">{{ stats.weeklyStudyMinutes }}m</span>
          <span class="stat-label">This Week</span>
        </div>
      </div>

      <!-- ── Study player (YouTube) ──────────────────────────── -->
      <div class="player-card">
        <div class="player-head">
          <div class="player-title">
            <span class="material-icons">play_circle</span>
            <div>
              <h2>Study Player</h2>
              <p>Search YouTube for lo-fi, focus music or tutorials — play it right here while you study.</p>
            </div>
          </div>
          <button class="player-close" *ngIf="youtubeEmbed" (click)="closeVideo()" aria-label="Back to search">
            <span class="material-icons">close</span>
          </button>
        </div>

        <ng-container *ngIf="!youtubeEmbed">
          <div class="player-input">
            <input
              [(ngModel)]="ytQuery"
              (keyup.enter)="searchYoutube()"
              placeholder="Search YouTube — songs, lo-fi, tutorials…"
            />
            <button class="player-play" [disabled]="!ytQuery.trim() || ytLoading" (click)="searchYoutube()">
              <span class="material-icons">{{ ytLoading ? 'hourglass_top' : 'search' }}</span>
              Search
            </button>
          </div>

          <div class="yt-hint" *ngIf="!ytConfigured && !ytLoading && ytResults.length === 0">
            YouTube search needs a free API key. Set the <code>YOUTUBE_API_KEY</code> environment variable on the server, then search will work.
          </div>
          <div class="yt-error" *ngIf="ytError">{{ ytError }}</div>

          <div class="yt-results" *ngIf="ytResults.length > 0">
            <button class="yt-result" *ngFor="let r of ytResults" (click)="playYoutube(r.id)">
              <img *ngIf="r.thumbnail; else noThumb" [src]="r.thumbnail" alt="" loading="lazy" />
              <ng-template #noThumb><span class="yt-no-thumb material-icons">play_circle</span></ng-template>
              <div class="yt-result-info">
                <span class="yt-result-title">{{ r.title }}</span>
                <span class="yt-result-channel">{{ r.channel }}</span>
              </div>
            </button>
          </div>

          <div class="player-link-row">
            <span>…or paste a YouTube link directly:</span>
            <div class="player-input player-link">
              <input
                [(ngModel)]="youtubeUrl"
                (keyup.enter)="loadVideo()"
                placeholder="https://youtube.com/watch?v=…"
              />
              <button class="player-play" [disabled]="!youtubeUrl.trim()" (click)="loadVideo()">
                <span class="material-icons">play_arrow</span> Play
              </button>
            </div>
          </div>
        </ng-container>

        <div class="player-frame" *ngIf="youtubeEmbed">
          <div class="yt-player-wrap">
            <div #playerHost class="yt-player-host"></div>
            <button class="yt-overlay-play" *ngIf="!ytPlaying && !ytError" (click)="playVideo()" aria-label="Play video">
              <span class="material-icons">play_arrow</span>
            </button>
            <div class="yt-error-overlay" *ngIf="ytError">This video couldn't be played. Try another one.</div>
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
    .dashboard { max-width: 1200px; }

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

    /* Proactive live strip */
    .stats-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;
    }
    .stats-strip-item {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .stat-value { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); }
    .stat-label { font-size: var(--font-12); color: var(--text-muted); }

    /* Study player */
    .player-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 20px; margin-bottom: 28px;
    }
    .player-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .player-title { display: flex; align-items: flex-start; gap: 12px; }
    .player-title .material-icons { font-size: 34px; color: var(--error); }
    .player-title h2 { font-size: var(--font-17); font-weight: 700; color: var(--text-primary); margin-bottom: 3px; }
    .player-title p { font-size: var(--font-13); color: var(--text-muted); }
    .player-close {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: none; color: var(--text-secondary); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.15s;
    }
    .player-close:hover { background: var(--surface-hover); }
    .player-input { display: flex; gap: 10px; }
    .player-input input {
      flex: 1; min-width: 0; padding: 11px 14px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--surface-hover);
      color: var(--text-primary); font-size: var(--font-13); outline: none;
    }
    .player-input input:focus { border-color: var(--primary); }
    .player-play {
      display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      padding: 0 18px; border: none; border-radius: 10px; background: var(--primary);
      color: white; font-size: var(--font-13); font-weight: 600; cursor: pointer;
      transition: background 0.15s;
    }
    .player-play:disabled { opacity: 0.5; cursor: not-allowed; }
    .yt-hint {
      margin-top: 12px; padding: 10px 14px; border-radius: 10px;
      background: rgba(var(--accent-rgb, 56, 89, 202), 0.08); border: 1px solid var(--border);
      font-size: var(--font-13); color: var(--text-secondary);
    }
    .yt-hint code {
      background: var(--surface-hover); padding: 2px 6px; border-radius: 6px;
      font-family: ui-monospace, monospace; font-size: var(--font-12); color: var(--text-primary);
    }
    .yt-error { margin-top: 12px; color: var(--error); font-size: var(--font-13); }
    .yt-results {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px; margin-top: 16px;
    }
    .yt-result {
      display: flex; flex-direction: column; gap: 8px; text-align: left;
      background: var(--surface-hover); border: 1px solid var(--border); border-radius: 12px;
      padding: 10px; cursor: pointer; transition: border-color 0.15s, transform 0.15s;
      overflow: hidden;
    }
    .yt-result:hover { border-color: var(--primary); transform: translateY(-2px); }
    .yt-result img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; background: #000; }
    .yt-no-thumb { width: 100%; aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 36px; background: var(--surface); border-radius: 8px; }
    .yt-result-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .yt-result-title {
      font-size: var(--font-13); font-weight: 600; color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .yt-result-channel { font-size: var(--font-12); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .player-link-row { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
    .player-link-row > span { font-size: var(--font-12); color: var(--text-muted); }
    .player-link { margin-top: 0; }
    .player-frame {
      position: relative; padding-top: 56.25%; border-radius: 12px; overflow: hidden;
      background: #000;
    }
    .yt-player-wrap { position: absolute; inset: 0; }
    .yt-player-host { width: 100%; height: 100%; }
    .yt-player-host iframe { width: 100%; height: 100%; border: none; }
    .yt-overlay-play {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); border: none; cursor: pointer; color: #fff;
      transition: background 0.15s;
    }
    .yt-overlay-play:hover { background: rgba(0,0,0,0.35); }
    .yt-overlay-play .material-icons { font-size: 64px; }
    .yt-error-overlay {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #000; color: rgba(255,255,255,0.85); font-size: var(--font-13); padding: 0 16px; text-align: center;
    }

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
  private youtubeService = inject(YoutubeService);

  myRooms: Room[] = [];
  allRooms: Room[] = [];
  stats: UserStats = { totalStudyHours: 0, sessionsCompleted: 0, dailyStreak: 0, weeklyStudyMinutes: 0 };
  loading = true;
  tab: 'mine' | 'all' = 'mine';
  youtubeUrl = '';
  youtubeEmbed = '';
  ytQuery = '';
  ytResults: YoutubeSearchResult[] = [];
  ytLoading = false;
  ytError = '';
  ytConfigured = true;
  ytVideoId = '';
  ytPlaying = false;
  ytErrorPlaying = false;
  private readonly YT_KEY = 'studyroom.youtube';
  private ytApiPromise?: Promise<void>;
  private ytPlayer?: any;

  @ViewChild('playerHost', { read: ElementRef }) playerHost?: ElementRef<HTMLElement>;

  async ngOnInit() {
    const saved = localStorage.getItem(this.YT_KEY) || '';
    const savedId = /embed\/([A-Za-z0-9_-]{11})/.exec(saved)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(saved) ? saved : '');
    if (savedId) {
      this.ytVideoId = savedId;
      this.youtubeEmbed = `https://www.youtube.com/embed/${savedId}`;
    }
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

  loadVideo(): void {
    const id = this.extractYouTubeId(this.youtubeUrl);
    if (!id) return;
    this.playYoutube(id);
    this.youtubeUrl = '';
  }

  async searchYoutube(): Promise<void> {
    const q = this.ytQuery.trim();
    if (!q) return;
    this.ytLoading = true;
    this.ytError = '';
    try {
      const resp = await this.youtubeService.search(q).toPromise();
      this.ytConfigured = resp?.configured !== false;
      this.ytResults = resp?.items ?? [];
      if (!this.ytConfigured) this.ytError = '';
    } catch {
      this.ytError = 'Search failed. Try again.';
      this.ytResults = [];
    } finally {
      this.ytLoading = false;
    }
  }

  async playYoutube(id: string): Promise<void> {
    this.ytVideoId = id;
    this.ytPlaying = false;
    this.ytErrorPlaying = false;
    this.youtubeEmbed = `https://www.youtube.com/embed/${id}`;
    localStorage.setItem(this.YT_KEY, id);
    try {
      await this.loadYtApi();
    } catch {
      this.ytErrorPlaying = true;
      return;
    }
    // The result click is a user gesture, so auto-play once the player is mounted.
    setTimeout(() => this.playVideo(), 80);
  }

  playVideo(): void {
    const w = window as any;
    const host = this.playerHost?.nativeElement;
    if (!host || !w.YT?.Player || !this.ytVideoId) return;
    try { this.ytPlayer?.destroy(); } catch { }
    const player = new w.YT.Player(host, {
      videoId: this.ytVideoId,
      width: '100%',
      height: '100%',
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => {
          this.ytPlaying = true;
          try { player.playVideo(); } catch { }
        },
        onError: () => { this.ytErrorPlaying = true; this.ytPlaying = false; }
      }
    });
    this.ytPlayer = player;
  }

  private loadYtApi(): Promise<void> {
    if (!this.ytApiPromise) {
      this.ytApiPromise = new Promise<void>((resolve) => {
        const w = window as any;
        if (w.YT?.Player) { resolve(); return; }
        w.onYouTubeIframeAPIReady = () => resolve();
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => { this.ytErrorPlaying = true; };
        document.head.appendChild(s);
      });
    }
    return this.ytApiPromise;
  }

  closeVideo(): void {
    this.youtubeEmbed = '';
    this.ytVideoId = '';
    this.ytPlaying = false;
    this.ytErrorPlaying = false;
    if (this.ytPlayer) { try { this.ytPlayer.destroy(); } catch { } this.ytPlayer = undefined; }
    localStorage.removeItem(this.YT_KEY);
  }

  private extractYouTubeId(url: string): string {
    const clean = url.trim();
    const patterns = [
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/,
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/
    ];
    for (const p of patterns) {
      const m = clean.match(p);
      if (m) return m[1];
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(clean)) return clean;
    return '';
  }
}