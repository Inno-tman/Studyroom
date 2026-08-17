import { Component, ElementRef, effect, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubePlayerService } from '../../../core/services/youtube-player.service';

@Component({
  selector: 'app-youtube-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="yt-queue" *ngIf="showQueue && player.queue().length > 0">
      <div class="yt-queue-head">
        <span>Up next ({{ player.queue().length }})</span>
        <div class="yt-queue-actions">
          <button class="yt-queue-clear" (click)="player.clearQueue()">Clear</button>
          <button class="yt-queue-clear" (click)="showQueue = false">Close</button>
        </div>
      </div>
      <button class="yt-queue-item" *ngFor="let item of player.queue(); let i = index"
              (click)="player.jump(i)" [class.active]="i === player.queueIndex()">
        <span class="material-icons yt-queue-play">music_video</span>
        <span class="yt-queue-title">{{ item.title || 'YouTube' }}</span>
        <span class="yt-queue-rm material-icons" (click)="$event.stopPropagation(); player.remove(i)"
              title="Remove from queue">close</span>
      </button>
    </div>

    <div class="yt-mini" *ngIf="player.videoId()">
      <div class="yt-mini-video" #playerHost></div>
      <div class="yt-mini-info">
        <span class="yt-mini-title">{{ player.title() || 'YouTube' }}</span>
        <span class="yt-mini-channel" *ngIf="player.channel()">{{ player.channel() }}</span>
        <span class="yt-mini-err" *ngIf="player.error()">Playback failed — tap the video or try another one</span>
        <span class="yt-mini-hint" *ngIf="player.hint()">{{ player.hint() }}</span>
      </div>
      <button class="yt-mini-ctl" [class.active]="player.shuffle()" (click)="player.toggleShuffle()"
              title="Shuffle">
        <span class="material-icons">shuffle</span>
      </button>
      <button class="yt-mini-ctl" (click)="player.prev()" title="Previous">
        <span class="material-icons">skip_previous</span>
      </button>
      <button class="yt-mini-ctl" (click)="player.togglePlay()"
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
      <button class="yt-mini-ctl" (click)="player.close(); showQueue = false" title="Close player">
        <span class="material-icons">close</span>
      </button>
    </div>
  `,
  styles: [
    `
    .yt-mini-video {
      width: 120px; height: 68px; border-radius: 8px; overflow: hidden; flex: none;
      background: #000; margin-right: 8px;
    }
    .yt-mini-video iframe { width: 100%; height: 100%; border: none; display: block; }
    .yt-mini {
      position: fixed; left: 16px; bottom: 16px; z-index: 1200;
      display: flex; align-items: center; gap: 2px;
      background: var(--surface-2, #1e1f26); color: var(--text-1, #e8e8ec);
      border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 14px; padding: 8px 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
      max-width: min(560px, calc(100vw - 32px));
    }
    .yt-mini-info {
      min-width: 0; flex: 1; display: flex; flex-direction: column; line-height: 1.2;
      margin-right: 6px;
    }
    .yt-mini-title {
      font-size: var(--font-13, 13px); font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .yt-mini-channel { font-size: var(--font-12, 12px); opacity: 0.65; }
    .yt-mini-err { font-size: var(--font-12, 12px); color: #ff8080; }
    .yt-mini-hint { font-size: var(--font-12, 12px); color: #ffd479; }
    .yt-mini-ctl {
      position: relative; border: none; background: transparent; color: inherit; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; flex: none;
      transition: background 0.15s, color 0.15s;
    }
    .yt-mini-ctl:hover { background: rgba(255,255,255,0.08); }
    .yt-mini-ctl.active { color: var(--accent, #7d8cff); }
    .yt-mini-ctl .material-icons { font-size: 22px; }
    .yt-mini-badge {
      position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px;
      padding: 0 3px; border-radius: 999px; background: var(--accent, #7d8cff); color: #fff;
      font-size: 10px; line-height: 14px; text-align: center; font-weight: 700;
    }
    .yt-queue {
      position: fixed; left: 16px; bottom: 76px; z-index: 1201;
      width: min(380px, calc(100vw - 32px));
      background: var(--surface-2, #1e1f26); color: var(--text-1, #e8e8ec);
      border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 14px; padding: 12px; max-height: 320px; overflow: auto;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    .yt-queue-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 8px; font-size: var(--font-13, 13px); font-weight: 600;
    }
    .yt-queue-actions { display: flex; gap: 4px; }
    .yt-queue-clear {
      border: none; background: rgba(255,255,255,0.08); color: inherit;
      font-size: var(--font-12, 12px); padding: 4px 8px; border-radius: 6px; cursor: pointer;
    }
    .yt-queue-clear:hover { background: rgba(255,255,255,0.15); }
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

    @media (max-width: 640px) {
      .yt-mini { left: 8px; right: 8px; bottom: 8px; max-width: none; }
      .yt-queue { left: 8px; right: 8px; bottom: 68px; width: auto; }
    }
    `
  ]
})
export class YoutubePlayerComponent {
  readonly player = inject(YoutubePlayerService);
  showQueue = false;

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