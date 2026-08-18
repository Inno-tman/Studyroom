import { Component, ElementRef, effect, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubePlayerService } from '../../../core/services/youtube-player.service';
import { YoutubeService, YoutubeSearchResult } from '../../../core/services/youtube.service';

@Component({
  selector: 'app-youtube-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="yt-player" [class.collapsed]="minimized">
      <button class="yt-pill" *ngIf="minimized" (click)="minimized = false" title="Study player">
        <span class="material-icons">{{ player.playing() ? 'pause' : (player.videoId() ? 'play_arrow' : 'queue_music') }}</span>
        <span class="yt-pill-badge" *ngIf="player.queue().length > 0">{{ player.queue().length }}</span>
      </button>

      <div class="yt-queue" *ngIf="showQueue">
        <div class="yt-queue-head">
          <span>Up next ({{ player.queue().length }})</span>
          <div class="yt-queue-actions">
            <button class="yt-queue-ctl" [class.active]="player.shuffle()" (click)="player.toggleShuffle()" title="Shuffle">
              <span class="material-icons">shuffle</span>
            </button>
            <button class="yt-queue-ctl" (click)="player.prev()" title="Previous">
              <span class="material-icons">skip_previous</span>
            </button>
            <button class="yt-queue-ctl" (click)="player.clearQueue()" title="Clear queue">
              <span class="material-icons">delete_sweep</span>
            </button>
            <button class="yt-queue-ctl" (click)="showQueue = false" title="Close">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
        <button class="yt-queue-item" *ngFor="let item of player.queue(); let i = index"
                (click)="player.jump(i)" [class.active]="i === player.queueIndex()">
          <span class="material-icons yt-queue-play">music_video</span>
          <span class="yt-queue-title">{{ item.title || 'YouTube' }}</span>
          <span class="yt-queue-rm material-icons" (click)="$event.stopPropagation(); player.remove(i)"
                title="Remove from queue">close</span>
        </button>
        <div class="yt-queue-empty" *ngIf="player.queue().length === 0">
          Queue is empty — search for music below.
        </div>
      </div>

      <div class="yt-search" *ngIf="showSearch">
        <div class="yt-queue-head">
          <span>Find study music</span>
          <button class="yt-queue-ctl" (click)="showSearch = false" title="Close">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="yt-search-row">
          <input [(ngModel)]="ytQuery" (keyup.enter)="searchYoutube()" placeholder="Songs, lo-fi, focus…" />
          <button class="yt-search-go" [disabled]="!ytQuery.trim() || ytLoading" (click)="searchYoutube()" title="Search">
            <span class="material-icons">{{ ytLoading ? 'hourglass_top' : 'search' }}</span>
          </button>
        </div>
        <div class="yt-search-hint" *ngIf="!ytConfigured && !ytLoading && ytResults.length === 0">
          Search needs a YouTube API key — set <code>YOUTUBE_API_KEY</code> on the server.
        </div>
        <div class="yt-search-err" *ngIf="ytError">{{ ytError }}</div>
        <div class="yt-search-status" *ngIf="ytLoading">Searching…</div>
        <div class="yt-search-results" *ngIf="ytResults.length > 0">
          <div class="yt-search-result" *ngFor="let r of ytResults">
            <button class="yt-search-play" (click)="playYoutube(r); showSearch = false" title="Play">
              <span class="yt-search-thumb">
                <img *ngIf="r.thumbnail" [src]="r.thumbnail" alt="" loading="lazy" draggable="false" />
                <span class="yt-search-thumb-icon material-icons">play_circle</span>
              </span>
              <span class="yt-search-info">
                <span class="yt-search-title">{{ r.title }}</span>
                <span class="yt-search-channel">{{ r.channel }}</span>
              </span>
            </button>
            <button class="yt-search-add" title="Add to queue" (click)="enqueue(r)">
              <span class="material-icons">playlist_add</span>
            </button>
          </div>
        </div>
        <div class="yt-search-empty" *ngIf="!ytLoading && ytConfigured && ytQuery.trim() && ytResults.length === 0">
          No results for “{{ ytQuery }}” — try different keywords.
        </div>
        <div class="yt-search-row yt-search-link">
          <input [(ngModel)]="youtubeUrl" (keyup.enter)="playLink()" placeholder="…or paste a YouTube link" />
          <button class="yt-search-go" [disabled]="!youtubeUrl.trim()" (click)="playLink()" title="Play">
            <span class="material-icons">play_arrow</span>
          </button>
        </div>
      </div>

      <div class="yt-mini">
        <div class="yt-mini-video" *ngIf="player.videoId()">
          <div #playerHost></div>
        </div>
        <div class="yt-mini-video yt-mini-empty" *ngIf="!player.videoId()">
          <span class="material-icons yt-mini-empty-icon">music_note</span>
          <span class="yt-mini-empty-text">Search YouTube for study music</span>
          <button class="yt-mini-empty-btn" (click)="openSearch()">Find music</button>
        </div>
        <div class="yt-mini-info">
          <span class="yt-mini-title">{{ player.title() || 'YouTube' }}</span>
          <span class="yt-mini-channel" *ngIf="player.channel()">{{ player.channel() }}</span>
          <span class="yt-mini-err" *ngIf="player.error()">Playback failed — tap the video or try another one</span>
          <span class="yt-mini-hint" *ngIf="player.hint()">{{ player.hint() }}</span>
        </div>
        <div class="yt-mini-controls">
          <button class="yt-mini-ctl" [class.active]="player.shuffle()" (click)="player.toggleShuffle()" title="Shuffle">
            <span class="material-icons">shuffle</span>
          </button>
          <button class="yt-mini-ctl" (click)="player.prev()" title="Previous">
            <span class="material-icons">skip_previous</span>
          </button>
          <button class="yt-mini-ctl yt-mini-play" (click)="player.togglePlay()"
                  [title]="player.playing() ? 'Pause' : 'Play'">
            <span class="material-icons">{{ player.playing() ? 'pause' : 'play_arrow' }}</span>
          </button>
          <button class="yt-mini-ctl" (click)="player.next()" title="Next">
            <span class="material-icons">skip_next</span>
          </button>
          <button class="yt-mini-ctl" [class.active]="showQueue" (click)="toggleQueue()" title="Queue">
            <span class="material-icons">queue_music</span>
            <span class="yt-mini-badge" *ngIf="player.queue().length > 0">{{ player.queue().length }}</span>
          </button>
          <button class="yt-mini-ctl" [class.active]="showSearch" (click)="toggleSearch()" title="Search music">
            <span class="material-icons">search</span>
          </button>
          <button class="yt-mini-ctl yt-minimize-btn" (click)="minimize()" title="Minimize player">
            <span class="material-icons">keyboard_arrow_down</span>
          </button>
          <button class="yt-mini-ctl" (click)="player.close(); showQueue = false; showSearch = false" title="Close">
            <span class="material-icons">close</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .yt-player {
      position: fixed; left: 16px; bottom: 16px; z-index: 1200;
      width: 260px;
    }
    .yt-mini {
      display: flex; flex-direction: column; gap: 7px;
      background: var(--surface-2, #1e1f26); color: var(--text-1, #e8e8ec);
      border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 16px; padding: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.45);
      transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
    }
    .yt-player.collapsed { pointer-events: none; }
    .yt-player.collapsed .yt-mini {
      opacity: 0; transform: translateY(10px); visibility: hidden; pointer-events: none;
    }
    .yt-player.collapsed .yt-pill { pointer-events: auto; }
    .yt-pill {
      position: absolute; left: 0; bottom: 0; z-index: 2;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--accent, #7d8cff); color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      animation: ytPulse 2.2s ease-in-out infinite;
    }
    .yt-pill .material-icons { font-size: 24px; }
    .yt-pill-badge {
      position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px;
      padding: 0 4px; border-radius: 999px; background: #ff5252; color: #fff;
      font-size: 10px; line-height: 16px; text-align: center; font-weight: 700;
    }
    @keyframes ytPulse {
      0%, 100% { box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 0 rgba(125,140,255,0.5); }
      50% { box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 10px rgba(125,140,255,0); }
    }
    .yt-minimize-btn { color: var(--accent, #7d8cff); }
    .yt-minimize-btn:hover { background: rgba(125,140,255,0.12); }
    .yt-mini-video {
      position: relative; width: 100%; aspect-ratio: 16 / 9;
      border-radius: 10px; overflow: hidden; background: #000;
    }
    .yt-mini-video iframe { width: 100%; height: 100%; border: none; display: block; }
    .yt-mini-info {
      min-width: 0; display: flex; flex-direction: column; line-height: 1.25;
    }
    .yt-mini-title {
      font-size: var(--font-13, 13px); font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .yt-mini-channel { font-size: var(--font-12, 12px); opacity: 0.65; }
    .yt-mini-err { font-size: var(--font-12, 12px); color: #ff8080; }
    .yt-mini-hint { font-size: var(--font-12, 12px); color: #ffd479; }
    .yt-mini-controls {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 2px;
    }
    .yt-mini-ctl {
      position: relative; border: none; background: transparent; color: inherit; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 32px; border-radius: 8px; flex: none;
      transition: background 0.15s, color 0.15s;
    }
    .yt-mini-ctl:hover { background: rgba(255,255,255,0.08); }
    .yt-mini-ctl.active { color: var(--accent, #7d8cff); }
    .yt-mini-ctl .material-icons { font-size: 22px; }
    .yt-mini-play {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--accent, #7d8cff); color: #fff;
    }
    .yt-mini-play:hover { background: var(--accent, #7d8cff); }
    .yt-mini-play .material-icons { font-size: 28px; }
    .yt-mini-badge {
      position: absolute; top: 0; right: 0; min-width: 14px; height: 14px;
      padding: 0 3px; border-radius: 999px; background: var(--accent, #7d8cff); color: #fff;
      font-size: 10px; line-height: 14px; text-align: center; font-weight: 700;
    }
    .yt-queue {
      position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 1;
      background: var(--surface-2, #1e1f26); color: var(--text-1, #e8e8ec);
      border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 14px; padding: 12px; max-height: 340px; overflow: auto;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    .yt-queue-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 8px; font-size: var(--font-13, 13px); font-weight: 600;
    }
    .yt-queue-actions { display: flex; gap: 2px; }
    .yt-queue-ctl {
      border: none; background: transparent; color: inherit; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 8px; transition: background 0.15s, color 0.15s;
    }
    .yt-queue-ctl:hover { background: rgba(255,255,255,0.08); }
    .yt-queue-ctl.active { color: var(--accent, #7d8cff); }
    .yt-queue-ctl .material-icons { font-size: 20px; }
    .yt-queue-item {
      display: flex; align-items: center; gap: 8px; width: 100%;
      background: transparent; border: none; color: inherit;
      padding: 8px; border-radius: 8px; cursor: pointer; font-size: var(--font-13, 13px);
    }
    .yt-queue-item:hover { background: rgba(255,255,255,0.06); }
    .yt-queue-item.active { background: rgba(255,255,255,0.1); }
    .yt-queue-play { font-size: 18px; opacity: 0.75; flex: none; }
    .yt-queue-title {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      text-align: left;
    }
    .yt-queue-rm {
      font-size: 16px; opacity: 0.55; flex: none; border-radius: 50%; padding: 2px;
    }
    .yt-queue-rm:hover { opacity: 1; background: rgba(255,255,255,0.1); }
    .yt-queue-empty { font-size: var(--font-12, 12px); opacity: 0.7; padding: 8px 2px; }

    .yt-search {
      position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 1;
      background: var(--surface-2, #1e1f26); color: var(--text-1, #e8e8ec);
      border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 14px; padding: 12px; max-height: 420px; overflow: auto;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; gap: 10px;
    }
    .yt-search-row { display: flex; gap: 6px; }
    .yt-search-row input {
      flex: 1; min-width: 0; padding: 9px 12px; border-radius: 8px;
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      background: rgba(255,255,255,0.05); color: inherit; font-size: var(--font-13, 13px); outline: none;
    }
    .yt-search-row input:focus { border-color: var(--accent, #7d8cff); }
    .yt-search-go {
      border: none; border-radius: 8px; background: var(--accent, #7d8cff); color: #fff;
      display: flex; align-items: center; justify-content: center;
      width: 38px; flex: none; cursor: pointer;
    }
    .yt-search-go:disabled { opacity: 0.5; cursor: not-allowed; }
    .yt-search-go .material-icons { font-size: 20px; }
    .yt-search-hint { font-size: var(--font-12, 12px); opacity: 0.75; line-height: 1.4; }
    .yt-search-hint code {
      background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 5px;
      font-family: ui-monospace, monospace; font-size: var(--font-11, 11px);
    }
    .yt-search-err { font-size: var(--font-12, 12px); color: #ff8080; }
    .yt-search-status { font-size: var(--font-12, 12px); opacity: 0.7; }
    .yt-search-empty { font-size: var(--font-12, 12px); opacity: 0.7; line-height: 1.4; }
    .yt-search-results {
      display: flex; flex-direction: column; gap: 8px;
      padding: 2px;
    }
    .yt-search-result {
      display: flex; align-items: center; gap: 8px;
      border-radius: 12px; background: rgba(255,255,255,0.06);
      padding: 6px 6px 6px 6px;
      transition: background 0.15s;
    }
    .yt-search-result:hover { background: rgba(255,255,255,0.12); }
    .yt-search-play {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px;
      background: transparent; border: none; color: inherit;
      padding: 4px 0; cursor: pointer; text-align: left;
    }
    .yt-search-thumb {
      position: relative; width: 72px; height: 45px; flex: none;
      border-radius: 8px; overflow: hidden; background: #000;
    }
    .yt-search-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .yt-search-thumb-icon {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.6);
      background: rgba(0,0,0,0.28);
    }
    .yt-search-info {
      min-width: 0; display: flex; flex-direction: column; gap: 3px;
    }
    .yt-search-title {
      font-size: var(--font-13, 13px); font-weight: 600; line-height: 1.35;
      color: var(--text-1, #e8e8ec);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .yt-search-channel {
      font-size: var(--font-11, 11px); opacity: 0.6;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .yt-search-add {
      flex: none; width: 34px; height: 34px; border-radius: 50%;
      border: none; background: transparent; color: inherit; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .yt-search-add:hover { background: rgba(255,255,255,0.12); }
    .yt-search-add .material-icons { font-size: 20px; }
    .yt-search-link { margin-top: 2px; }

    .yt-mini-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      background: linear-gradient(135deg, #20232b, #131419);
      color: var(--text-1, #e8e8ec);
    }
    .yt-mini-empty-icon { font-size: 30px; opacity: 0.5; }
    .yt-mini-empty-text { font-size: var(--font-12, 12px); opacity: 0.7; text-align: center; }
    .yt-mini-empty-btn {
      margin-top: 4px; padding: 6px 12px; border: none; border-radius: 999px;
      background: var(--accent, #7d8cff); color: #fff; font-size: var(--font-12, 12px);
      font-weight: 600; cursor: pointer;
    }

    @media (max-width: 900px) {
      .yt-player {
        left: 16px;
        bottom: calc(84px + env(safe-area-inset-bottom));
      }
    }

    @media (max-width: 640px) {
      .yt-player {
        left: 50%; transform: translateX(-50%);
        bottom: calc(84px + env(safe-area-inset-bottom));
        width: min(320px, calc(100vw - 16px));
      }
      .yt-pill { left: 50%; transform: translateX(-50%); }
      .yt-mini-ctl { width: 34px; height: 38px; }
      .yt-mini-play { width: 42px; height: 42px; }
      .yt-queue, .yt-search { max-height: 50vh; }
    }
    `
  ]
})
export class YoutubePlayerComponent implements OnInit, OnDestroy {
  readonly player = inject(YoutubePlayerService);
  private readonly youtubeService = inject(YoutubeService);
  showQueue = false;
  showSearch = false;
  minimized = true;
  ytQuery = '';
  youtubeUrl = '';
  ytResults: YoutubeSearchResult[] = [];
  ytLoading = false;
  ytError = '';
  ytConfigured = true;

  private hostEl?: HTMLElement;
  private currentId = '';
  private pendingId = '';
  private ytInstance?: any;
  private mutedStart = false;
  private wakeLock?: any;

  @ViewChild('playerHost', { read: ElementRef })
  set hostRef(el: ElementRef<HTMLElement> | undefined) {
    this.hostEl = el?.nativeElement ?? undefined;
    if (this.hostEl && this.pendingId && this.currentId === this.pendingId) {
      this.pendingId = '';
      this.buildPlayer(this.currentId);
    }
  }

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.releaseWakeLock();
  }

  private handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.player.playing()) {
      void this.acquireWakeLock();
    }
  };

  /** Keeps the device screen awake while a video is playing. */
  private async acquireWakeLock(): Promise<void> {
    const nav = navigator as any;
    if (!nav.wakeLock) return;
    try {
      this.wakeLock = await nav.wakeLock.request('screen');
      this.wakeLock?.addEventListener?.('release', () => {
        if (this.player.playing() && document.visibilityState === 'visible') {
          void this.acquireWakeLock();
        }
      });
    } catch { }
  }

  private releaseWakeLock(): void {
    try { this.wakeLock?.release(); } catch { }
    this.wakeLock = undefined;
  }

  constructor() {
    effect(() => {
      const id = this.player.videoId();
      if (id) void this.loadVideo(id);
      else this.releaseWakeLock();
    }, { allowSignalWrites: true });
  }

  minimize(): void {
    this.showQueue = false;
    this.showSearch = false;
    this.minimized = true;
  }

  toggleQueue(): void {
    this.showSearch = false;
    this.showQueue = !this.showQueue;
  }

  toggleSearch(): void {
    this.showQueue = false;
    this.showSearch = !this.showSearch;
  }

  openSearch(): void {
    this.showQueue = false;
    this.showSearch = true;
  }

  playLink(): void {
    const id = this.extractYouTubeId(this.youtubeUrl);
    if (!id) return;
    this.player.playNow({ id });
    this.youtubeUrl = '';
    this.showSearch = false;
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
    } catch (err: any) {
      this.ytError = err?.status === 401 ? 'Sign in to search for music.' : 'Search failed. Try again.';
      this.ytResults = [];
    } finally {
      this.ytLoading = false;
    }
  }

  playYoutube(result: YoutubeSearchResult): void {
    this.player.playNow({ id: result.id, title: result.title, channel: result.channel });
  }

  enqueue(result: YoutubeSearchResult): void {
    this.player.enqueue({ id: result.id, title: result.title, channel: result.channel });
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

  private async loadVideo(id: string): Promise<void> {
    if (!id || this.currentId === id) return;
    this.currentId = id;
    console.log('[yt] load', id);
    this.player.setPlaying(false);
    this.player.setError(false);
    this.player.setHint('Loading player…');
    try {
      await this.player.ensureApi();
    } catch (err) {
      console.error('[yt] api failed', err);
      this.player.setError(true);
      this.player.setHint('Could not load the YouTube player. Is YouTube blocked?');
      return;
    }
    if (!this.hostEl) {
      this.pendingId = id;
      return;
    }
    this.buildPlayer(id);
  }

  private buildPlayer(id: string): void {
    const w = window as any;
    if (!w.YT?.Player || !this.hostEl) {
      console.error('[yt] build skipped', { hasYt: !!w.YT?.Player, hasHost: !!this.hostEl });
      return;
    }
    try { this.ytInstance?.destroy(); } catch { }
    this.ytInstance = undefined;
    let player: any;
    try {
      player = new w.YT.Player(this.hostEl, {
        videoId: id,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, playsinline: 1, controls: 1 },
        events: {
          onReady: () => {
            console.log('[yt] ready', id);
            this.player.setPlayer(player);
            this.ytInstance = player;
            this.player.setError(false);
            this.player.setHint('Starting…');
            const ifr = player.getIframe?.();
            if (ifr) ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            try {
              this.mutedStart = true;
              player.mute();
              player.playVideo();
            } catch { }
            setTimeout(() => {
              if (!this.player.playing()) this.player.setHint('Tap the video ▶ to play');
            }, 2500);
          },
          onStateChange: (e: any) => {
            console.log('[yt] state', e.data);
            if (e.data === 1) {
              this.player.setPlaying(true);
              this.player.setHint('');
              void this.acquireWakeLock();
              if (this.mutedStart) {
                this.mutedStart = false;
                try { player.unMute(); } catch { }
              }
            } else if (e.data === 0) {
              this.player.setPlaying(false);
              this.releaseWakeLock();
              this.player.next();
            } else if (e.data === 2) {
              this.player.setPlaying(false);
              this.releaseWakeLock();
            }
          },
          onError: (e: any) => {
            console.error('[yt] error', e?.data);
            this.player.setError(true);
            this.player.setPlaying(false);
            this.releaseWakeLock();
            this.player.setHint('');
          }
        }
      });
      console.log('[yt] player created', id);
    } catch (err) {
      console.error('[yt] create failed', err);
      this.player.setError(true);
      this.player.setPlaying(false);
    }
  }
}