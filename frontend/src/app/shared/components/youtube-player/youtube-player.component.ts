import { Component, ElementRef, effect, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubePlayerService } from '../../../core/services/youtube-player.service';

@Component({
  selector: 'app-youtube-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="yt-player" *ngIf="player.videoId() || showQueue" [class.collapsed]="minimized">
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
          Queue is empty — add videos from the dashboard search.
        </div>
      </div>

      <button class="yt-pill" *ngIf="minimized" (click)="minimized = false" title="Show player">
        <span class="material-icons">{{ player.playing() ? 'pause' : 'play_arrow' }}</span>
        <span class="yt-pill-badge" *ngIf="player.queue().length > 0">{{ player.queue().length }}</span>
      </button>

      <div class="yt-mini">
        <div class="yt-mini-video" #playerHost>
          <button class="yt-minimize" (click)="minimize()" title="Minimize">
            <span class="material-icons">keyboard_arrow_down</span>
          </button>
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
          <button class="yt-mini-ctl" (click)="showQueue = !showQueue" title="Queue">
            <span class="material-icons">queue_music</span>
            <span class="yt-mini-badge" *ngIf="player.queue().length > 0">{{ player.queue().length }}</span>
          </button>
          <button class="yt-mini-ctl" (click)="player.close(); showQueue = false" title="Close">
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
    .yt-player.collapsed .yt-mini {
      opacity: 0; transform: translateY(10px); visibility: hidden; pointer-events: none;
    }
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
    .yt-minimize {
      position: absolute; top: 6px; right: 6px; z-index: 10;
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(0,0,0,0.55); color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .yt-minimize:hover { background: rgba(0,0,0,0.75); }
    .yt-minimize .material-icons { font-size: 18px; }
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
      width: 34px; height: 34px; border-radius: 10px; flex: none;
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

    @media (max-width: 640px) {
      .yt-player {
        left: 50%; transform: translateX(-50%);
        bottom: calc(8px + env(safe-area-inset-bottom));
        width: min(320px, calc(100vw - 16px));
      }
      .yt-pill { left: 50%; transform: translateX(-50%); }
      .yt-mini-ctl { width: 40px; height: 40px; }
      .yt-mini-play { width: 44px; height: 44px; }
      .yt-queue { max-height: 50vh; }
    }
    `
  ]
})
export class YoutubePlayerComponent {
  readonly player = inject(YoutubePlayerService);
  showQueue = false;
  minimized = false;

  private hostEl?: HTMLElement;
  private currentId = '';
  private pendingId = '';
  private ytInstance?: any;
  private mutedStart = false;

  @ViewChild('playerHost', { read: ElementRef })
  set hostRef(el: ElementRef<HTMLElement> | undefined) {
    this.hostEl = el?.nativeElement ?? undefined;
    if (this.hostEl && this.pendingId && this.currentId === this.pendingId) {
      this.pendingId = '';
      this.buildPlayer(this.currentId);
    }
  }

  constructor() {
    effect(() => {
      const id = this.player.videoId();
      if (id) void this.loadVideo(id);
    }, { allowSignalWrites: true });
  }

  minimize(): void {
    this.showQueue = false;
    this.minimized = true;
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
              if (this.mutedStart) {
                this.mutedStart = false;
                try { player.unMute(); } catch { }
              }
            } else if (e.data === 0) {
              this.player.setPlaying(false);
              this.player.next();
            } else if (e.data === 2) this.player.setPlaying(false);
          },
          onError: (e: any) => {
            console.error('[yt] error', e?.data);
            this.player.setError(true);
            this.player.setPlaying(false);
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