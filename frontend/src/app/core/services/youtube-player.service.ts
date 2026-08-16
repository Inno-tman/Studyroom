import { Injectable, signal } from '@angular/core';

export interface PlaylistItem {
  id: string;
  title?: string;
  channel?: string;
}

@Injectable({ providedIn: 'root' })
export class YoutubePlayerService {
  readonly videoId = signal('');
  readonly title = signal('');
  readonly channel = signal('');
  readonly playing = signal(false);
  readonly error = signal(false);
  readonly queue = signal<PlaylistItem[]>([]);
  readonly queueIndex = signal(-1);
  readonly shuffle = signal(false);

  private readonly KEY = 'studyroom.youtube';
  private player?: any;
  private apiReady?: Promise<void>;

  constructor() {
    this.restore();
  }

  /** Plays an item immediately, adding it to the queue. */
  playNow(item: PlaylistItem): void {
    const idx = this.queue().findIndex((q) => q.id === item.id);
    if (idx >= 0) {
      this.queueIndex.set(idx);
    } else {
      this.queue.update((q) => [...q, item]);
      this.queueIndex.set(this.queue().length - 1);
    }
    this.saveState();
    this.loadCurrent();
  }

  /** Adds an item to the end of the queue (starts playing it if nothing is). */
  enqueue(item: PlaylistItem): void {
    this.queue.update((q) => [...q, item]);
    if (this.queueIndex() < 0) {
      this.queueIndex.set(this.queue().length - 1);
      this.loadCurrent();
    }
    this.saveState();
  }

  next(): void {
    const q = this.queue();
    if (q.length === 0) return;
    const cur = this.queueIndex();
    let target: number;
    if (this.shuffle()) {
      const candidates = q.map((_, i) => i).filter((i) => i !== cur);
      if (candidates.length === 0) return;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      target = cur + 1;
      if (target >= q.length) return;
    }
    this.queueIndex.set(target);
    this.saveState();
    this.loadCurrent();
  }

  prev(): void {
    const cur = this.queueIndex();
    if (cur > 0) {
      this.queueIndex.set(cur - 1);
      this.saveState();
      this.loadCurrent();
    }
  }

  jump(index: number): void {
    if (index >= 0 && index < this.queue().length) {
      this.queueIndex.set(index);
      this.saveState();
      this.loadCurrent();
    }
  }

  remove(index: number): void {
    const cur = this.queueIndex();
    this.queue.update((q) => q.filter((_, i) => i !== index));
    if (index < cur) this.queueIndex.set(cur - 1);
    else if (index === cur) {
      if (this.queue().length === 0) this.queueIndex.set(-1);
      else this.queueIndex.set(Math.min(cur, this.queue().length - 1));
    }
    this.saveState();
  }

  clearQueue(): void {
    this.queue.set([]);
    this.queueIndex.set(-1);
    this.close();
    this.saveState();
  }

  toggleShuffle(): void {
    this.shuffle.update((s) => !s);
    this.saveState();
  }

  close(): void {
    this.videoId.set('');
    this.title.set('');
    this.channel.set('');
    this.playing.set(false);
    this.error.set(false);
    this.player = undefined;
  }

  togglePlay(): void {
    try {
      if (!this.player) return;
      if (this.playing()) this.player.pauseVideo();
      else this.player.playVideo();
    } catch { }
  }

  setPlayer(p: any): void {
    this.player = p;
  }

  setPlaying(v: boolean): void {
    this.playing.set(v);
  }

  setError(v: boolean): void {
    this.error.set(v);
  }

  ensureApi(): Promise<void> {
    if (!this.apiReady) {
      this.apiReady = new Promise<void>((resolve, reject) => {
        const w = window as any;
        if (w.YT?.Player) { resolve(); return; }
        w.onYouTubeIframeAPIReady = () => resolve();
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => { this.apiReady = undefined; reject(new Error('api-script-failed')); };
        document.head.appendChild(s);
        setTimeout(() => {
          if (!w.YT?.Player) {
            this.apiReady = undefined;
            reject(new Error('api-timeout'));
          }
        }, 10000);
      });
    }
    return this.apiReady;
  }

  private loadCurrent(): void {
    const q = this.queue();
    const i = this.queueIndex();
    if (i >= 0 && i < q.length) {
      this.videoId.set(q[i].id);
      this.title.set(q[i].title || '');
      this.channel.set(q[i].channel || '');
      this.playing.set(false);
      this.error.set(false);
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({
        queue: this.queue(),
        index: this.queueIndex(),
        shuffle: this.shuffle()
      }));
    } catch { }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data?.queue)) {
        this.queue.set(data.queue);
        this.queueIndex.set(typeof data.index === 'number' ? data.index : -1);
        this.shuffle.set(!!data.shuffle);
      } else if (data?.id) {
        this.queue.set([{ id: data.id, title: data.title || '' }]);
        this.queueIndex.set(0);
      } else {
        const id = /embed\/([A-Za-z0-9_-]{11})/.exec(raw)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : '');
        if (id) {
          this.queue.set([{ id }]);
          this.queueIndex.set(0);
        }
      }
      const i = this.queueIndex();
      if (i >= 0 && i < this.queue().length) this.loadCurrent();
    } catch { }
  }
}