import { Component, inject, input, output, OnDestroy, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Room, RoomEvent, Track, Participant, RemoteTrackPublication, TrackPublication } from 'livekit-client';
import { MeetingService } from '../../core/services/meeting.service';

interface ParticipantTile {
  identity: string;
  name: string;
  isLocal: boolean;
  micMuted: boolean;
  camMuted: boolean;
  screenSharing: boolean;
  videoEl?: HTMLVideoElement;
  attachedTracks: Set<HTMLMediaElement>;
}

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <div class="meeting-room">
      <div class="meeting-header">
        <h2><span class="live-dot"></span> {{ roomName() }}</h2>
        <span class="meeting-count">{{ participants().length }} connected</span>
      </div>

      <div class="tile-grid" [class.single]="participants().length === 1">
        <div *ngIf="!connected() && !error()" class="status-box">
          <span class="spinner"></span> Connecting to meeting…
        </div>
        <div *ngIf="error()" class="status-box error">
          <span class="material-icons">error_outline</span>
          {{ error() }}
          <button class="retry-btn" (click)="retry()">Retry</button>
        </div>
        <div *ngFor="let p of participants()" class="tile" [class.local]="p.isLocal" [attr.data-tile]="p.identity">
          <div class="tile-video" #tileVideo>
            <span class="tile-placeholder" *ngIf="p.camMuted">
              <span class="avatar">{{ p.name.charAt(0).toUpperCase() }}</span>
            </span>
          </div>
          <div class="tile-meta">
            <span class="tile-name">{{ p.name }}{{ p.isLocal ? ' (you)' : '' }}</span>
            <span class="tile-flag" [class.off]="p.micMuted"><span class="material-icons">mic{{ p.micMuted ? '_off' : '' }}</span></span>
            <span class="tile-flag" [class.off]="p.camMuted" *ngIf="!p.screenSharing"><span class="material-icons">videocam{{ p.camMuted ? '_off' : '' }}</span></span>
            <span class="tile-flag" *ngIf="p.screenSharing"><span class="material-icons">screen_share</span></span>
          </div>
        </div>
      </div>

      <div class="meeting-controls">
        <button class="ctl" [class.on]="!micOn()" (click)="toggleMic()" title="Mute / unmute mic">
          <span class="material-icons">{{ micOn() ? 'mic' : 'mic_off' }}</span>
        </button>
        <button class="ctl" [class.on]="!camOn()" (click)="toggleCam()" title="Camera on / off">
          <span class="material-icons">{{ camOn() ? 'videocam' : 'videocam_off' }}</span>
        </button>
        <button class="ctl" [class.on]="sharing()" (click)="toggleScreenShare()" title="Share screen">
          <span class="material-icons">screen_share</span>
        </button>
        <button class="ctl leave" (click)="leave()" title="Leave call">
          <span class="material-icons">call_end</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .meeting-room { display: flex; flex-direction: column; height: 100%; background: #0b0f14; color: #fff; }
    .meeting-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
    .meeting-header h2 { display: flex; align-items: center; gap: 8px; font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .meeting-count { font-size: var(--font-12); color: var(--text-secondary); }

    .tile-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; padding: 12px; align-content: start; overflow-y: auto; }
    .tile-grid.single { grid-template-columns: 1fr; }
    .status-box { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-secondary); font-size: var(--font-14); }
    .status-box.error { color: var(--error); flex-direction: column; }
    .status-box .spinner { width: 22px; height: 22px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-box .retry-btn { margin-top: 8px; padding: 8px 18px; border-radius: 8px; border: none; background: var(--primary); color: #fff; cursor: pointer; }
    .tile { position: relative; aspect-ratio: 16 / 9; background: #141a24; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .tile-video { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .tile-video video { width: 100%; height: 100%; object-fit: cover; }
    .tile-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .tile-placeholder .avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #fff; }
    .tile-meta { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .tile-name { font-size: var(--font-12); font-weight: 600; background: rgba(0,0,0,0.55); padding: 2px 8px; border-radius: 6px; }
    .tile-flag { background: rgba(0,0,0,0.55); border-radius: 6px; padding: 2px 4px; display: inline-flex; }
    .tile-flag .material-icons { font-size: var(--font-16); }
    .tile-flag.off { color: var(--error); }

    .meeting-controls { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 16px; background: var(--surface); border-top: 1px solid var(--border); }
    .ctl { width: 54px; height: 54px; border-radius: 50%; border: none; cursor: pointer; background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; transition: transform 0.15s, background 0.15s; }
    .ctl:hover { transform: scale(1.06); }
    .ctl.on { background: var(--error); }
    .ctl.leave { background: var(--error); }
    .ctl .material-icons { font-size: var(--font-24); }
  `]
})
export class MeetingRoomComponent implements OnDestroy {
  private meetingService = inject(MeetingService);

  roomId = input<string>('');
  roomName = input<string>('');
  readonly leaveRequest = output<void>();

  readonly participants = signal<ParticipantTile[]>([]);
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  readonly sharing = signal(false);
  readonly connected = signal(false);
  readonly error = signal('');

  private room?: Room;
  private localTile?: ParticipantTile;
  private tiles = new Map<string, ParticipantTile>();

  ngOnInit() {
    this.connect();
  }

  private async connect(): Promise<void> {
    this.error.set('');
    this.connected.set(false);
    try {
      const resp = await this.meetingService.getLiveKitToken(this.roomId()).toPromise();
      if (!resp) throw new Error('No token response from server');
      const { url, token } = resp;
      this.room = new Room({ adaptiveStream: true, dynacast: true });
      this.room.on(RoomEvent.TrackSubscribed, (_track, _pub, participant) => this.attachRemote(participant.identity));
      this.room.on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => this.attachRemote(participant.identity));
      this.room.on(RoomEvent.ParticipantDisconnected, (participant) => this.removeTile(participant.identity));
      this.room.on(RoomEvent.LocalTrackPublished, () => { this.syncLocalTile(); this.attachLocalVideo(); });
      this.room.on(RoomEvent.TrackMuted, (pub: TrackPublication, participant: Participant) => this.onMuteState(pub, participant.identity));
      this.room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant: Participant) => this.onMuteState(pub, participant.identity));

      await Promise.race([
        this.room.connect(url, token),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 15000))
      ]);

      this.connected.set(true);
      this.localTile = this.addTile(this.room.localParticipant);
      await this.room.localParticipant.setCameraEnabled(true);
      await this.room.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      this.error.set(this.readableError(err));
      this.connected.set(false);
    }
  }

  retry(): void {
    this.leave();
    this.connect();
  }

  private readableError(err: unknown): string {
    const anyErr = err as { status?: number; message?: string; error?: unknown; statusText?: string; url?: string };
    if (anyErr?.status) {
      let detail = '';
      try {
        const e = anyErr.error;
        if (typeof e === 'string' && e) detail = e;
        else if (e && typeof e === 'object') detail = JSON.stringify(e);
      } catch { }
      const loc = anyErr.url ? ` @ ${anyErr.url}` : '';
      if (anyErr.status === 401) return `Not authenticated (401)${detail ? `: ${detail}` : ''}${loc}`;
      if (anyErr.status === 403) return `You are not a member of this room (403)${detail ? `: ${detail}` : ''}${loc}`;
      if (anyErr.status === 400) return `Bad request (400)${detail ? `: ${detail}` : ''}${loc}`;
      if (anyErr.status === 500) return `Server error (500)${detail ? `: ${detail}` : ''}${loc}`;
      if (anyErr.status === 404) return `Endpoint not found (404)${detail ? `: ${detail}` : ''}${loc}`;
      return `Request failed (${anyErr.status})${detail ? `: ${detail}` : ''}${loc}`;
    }
    if (anyErr?.message) return anyErr.message;
    try { return JSON.stringify(err); } catch { return 'Unknown error'; }
  }

  private addTile(participant: Participant): ParticipantTile {
    const tile: ParticipantTile = {
      identity: participant.identity,
      name: participant.name || (participant.isLocal ? 'You' : participant.identity),
      isLocal: participant.isLocal,
      micMuted: false,
      camMuted: false,
      screenSharing: false,
      attachedTracks: new Set()
    };
    this.tiles.set(tile.identity, tile);
    this.participants.set([...this.tiles.values()]);
    return tile;
  }

  private removeTile(identity: string): void {
    const tile = this.tiles.get(identity);
    if (!tile) return;
    tile.attachedTracks.forEach(el => { try { el.remove(); } catch { } });
    this.tiles.delete(identity);
    this.participants.set([...this.tiles.values()]);
  }

  private attachLocalVideo(): void {
    if (!this.room || !this.localTile) return;
    const lp = this.room.localParticipant;
    const video = Array.from(lp.videoTrackPublications.values())
      .map(p => p.videoTrack)
      .find(t => t && t.source === Track.Source.Camera);

    const container = document.querySelector(`[data-tile="${lp.identity}"] .tile-video`);
    if (this.localTile.videoEl) { this.localTile.videoEl.remove(); this.localTile.videoEl = undefined; }
    if (video && container) {
      const el = video.attach() as HTMLVideoElement;
      this.localTile.videoEl = el;
      container.appendChild(el);
    }
  }

  private attachRemote(identity: string): void {
    if (!this.room) return;
    let tile = this.tiles.get(identity);
    const participant = this.room.remoteParticipants.get(identity);
    if (!participant) return;
    if (!tile) tile = this.addTile(participant);

    const container = document.querySelector(`[data-tile="${identity}"] .tile-video`);
    const video = Array.from(participant.videoTrackPublications.values())
      .filter(p => p.isSubscribed)
      .map(p => p.videoTrack)
      .find(t => t && t.source !== Track.Source.ScreenShare);

    tile.videoEl?.remove();
    tile.videoEl = undefined;

    if (video) {
      const el = video.attach() as HTMLVideoElement;
      tile.videoEl = el;
      if (container) container.appendChild(el);
    }
  }

  private syncLocalTile(): void {
    if (!this.room || !this.localTile) return;
    const lp = this.room.localParticipant;
    this.localTile.micMuted = !lp.isMicrophoneEnabled;
    this.localTile.camMuted = !lp.isCameraEnabled;
    this.localTile.screenSharing = lp.isScreenShareEnabled;
    this.micOn.set(lp.isMicrophoneEnabled);
    this.camOn.set(lp.isCameraEnabled);
    this.sharing.set(lp.isScreenShareEnabled);
  }

  private onMuteState(pub: TrackPublication, participantIdentity: string): void {
    const identity = participantIdentity || this.room?.localParticipant.identity;
    if (!identity) return;
    const tile = this.tiles.get(identity);
    if (!tile) return;
    if (pub.kind === Track.Kind.Audio) {
      tile.micMuted = pub.isMuted;
      if (this.room?.localParticipant.identity === identity) this.micOn.set(!pub.isMuted);
    } else if (pub.kind === Track.Kind.Video) {
      tile.camMuted = pub.isMuted;
      if (this.room?.localParticipant.identity === identity) this.camOn.set(!pub.isMuted);
    }
  }

  async toggleMic(): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(!this.micOn());
  }

  async toggleCam(): Promise<void> {
    await this.room?.localParticipant.setCameraEnabled(!this.camOn());
  }

  async toggleScreenShare(): Promise<void> {
    if (this.room?.localParticipant.isScreenShareEnabled) {
      await this.room.localParticipant.setScreenShareEnabled(false);
    } else {
      await this.room?.localParticipant.setScreenShareEnabled(true);
    }
    this.syncLocalTile();
  }

  leave(): void {
    try { this.room?.disconnect(); } catch { }
    this.room = undefined;
    this.tiles.clear();
    this.participants.set([]);
    this.leaveRequest.emit();
  }

  ngOnDestroy(): void {
    this.leave();
  }
}