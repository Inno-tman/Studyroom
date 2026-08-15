import { Component, inject, input, output, OnDestroy, OnInit, signal, HostListener } from '@angular/core';
import { NgFor, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Room, RoomEvent, Track, Participant, LocalVideoTrack, LocalAudioTrack,
  createLocalTracks, createAudioAnalyser, ConnectionQuality, TrackPublication
} from 'livekit-client';
import { MeetingService } from '../../core/services/meeting.service';

interface ParticipantTile {
  identity: string;
  name: string;
  isLocal: boolean;
  micMuted: boolean;
  camMuted: boolean;
  hasVideo: boolean;
  screenSharing: boolean;
  quality: ConnectionQuality;
  videoEl?: HTMLVideoElement;
  screenEl?: HTMLVideoElement;
}

interface ChatMsg {
  from: string;
  name: string;
  text: string;
  ts: number;
  own: boolean;
}

type Phase = 'prejoin' | 'connecting' | 'connected';

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe],
  template: `
    <div class="meeting-room" [class.screen-full]="fullscreen()">
      <div class="meeting-header">
        <h2><span class="live-dot" [class.ok]="phase() === 'connected'"></span> {{ roomName() }}</h2>
        <div class="meeting-stats">
          <span class="meeting-count">{{ participants().length }} connected</span>
          <span class="meeting-timer" *ngIf="phase() === 'connected'"><span class="material-icons">schedule</span> {{ elapsed }}</span>
          <button class="icon-btn" *ngIf="phase() === 'connected'" (click)="toggleChat()" title="In-call chat" [class.active]="chatOpen()">
            <span class="material-icons">chat</span>
          </button>
          <button class="icon-btn" *ngIf="phase() === 'connected'" (click)="toggleFullscreen()" title="Toggle fullscreen">
            <span class="material-icons">{{ fullscreen() ? 'fullscreen_exit' : 'fullscreen' }}</span>
          </button>
        </div>
      </div>

      <!-- ── PRE-JOIN ─────────────────────────────────────────── -->
      <div class="prejoin" *ngIf="phase() === 'prejoin'">
        <div class="prejoin-stage">
          <div class="preview-video" *ngIf="cameraOn()">
            <span class="preview-placeholder" *ngIf="!previewReady()">
              <span class="spinner"></span> Starting camera…
            </span>
          </div>
          <div class="preview-off" *ngIf="!cameraOn()">
            <span class="material-icons">videocam_off</span>
            <span>Camera off</span>
          </div>
          <div class="preview-controls">
            <button class="ctl prectl" [class.on]="!micOn()" (click)="toggleMicPre()" title="Mute / unmute mic">
              <span class="material-icons">{{ micOn() ? 'mic' : 'mic_off' }}</span>
            </button>
            <button class="ctl prectl" [class.on]="!cameraOn()" (click)="toggleCamPre()" title="Camera on / off">
              <span class="material-icons">{{ cameraOn() ? 'videocam' : 'videocam_off' }}</span>
            </button>
          </div>
          <div class="mic-level" *ngIf="micOn()">
            <span class="mic-level-label">Mic level</span>
            <div class="mic-level-bar">
              <div class="mic-level-fill" [style.width.%]="micLevel()"></div>
            </div>
          </div>
          <div class="prejoin-error" *ngIf="error()">
            <span class="material-icons">error_outline</span>
            {{ error() }}
          </div>
        </div>

        <div class="prejoin-panel">
          <h3>Ready to join?</h3>
          <p class="prejoin-sub">Check your devices and preview yourself before entering.</p>
          <label class="field">
            Camera
            <select [value]="selectedCam()" (change)="onCamSelect($event)">
              <option *ngFor="let d of videoDevices()" [value]="d.deviceId">{{ d.label || 'Camera ' + d.deviceId }}</option>
            </select>
          </label>
          <label class="field">
            Microphone
            <select [value]="selectedMic()" (change)="onMicSelect($event)">
              <option *ngFor="let d of audioDevices()" [value]="d.deviceId">{{ d.label || 'Microphone ' + d.deviceId }}</option>
            </select>
          </label>
          <div class="prejoin-actions">
            <button class="btn-ghost" (click)="cancel()">Cancel</button>
            <button class="btn-join" [disabled]="joining()" (click)="joinMeeting()">
              <span class="material-icons">videocam</span>
              {{ joining() ? 'Joining…' : 'Join now' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── CONNECTING ───────────────────────────────────────── -->
      <div class="connecting" *ngIf="phase() === 'connecting'">
        <span class="spinner"></span>
        <p>Connecting to meeting…</p>
        <button class="btn-ghost" (click)="cancel()">Cancel</button>
      </div>

      <!-- ── CONNECTED ────────────────────────────────────────── -->
      <div class="call-body" *ngIf="phase() === 'connected'">
        <div class="tile-grid" [class.single]="participants().length === 1" [class.maximized]="maximizedId()">
          <div *ngFor="let p of participants()"
               class="tile"
               [class.local]="p.isLocal"
               [class.screen]="p.screenSharing"
               [class.speaking]="speakingIds().has(p.identity)"
               [class.maximized]="p.identity === maximizedId()"
               [class.hidden]="maximizedId() && p.identity !== maximizedId()"
               [attr.data-tile]="p.identity"
               (click)="toggleMaximize(p.identity)">
            <div class="tile-screen" #tileScreen></div>
            <div class="tile-video" #tileVideo>
              <span class="tile-placeholder" *ngIf="!p.hasVideo">
                <span class="avatar">{{ p.name.charAt(0).toUpperCase() }}</span>
              </span>
            </div>
            <div class="tile-meta">
              <span class="quality-badge" [class]="p.quality" [title]="'Connection: ' + p.quality">
                <span class="material-icons">{{ qualityIcon(p.quality) }}</span>
              </span>
              <span class="tile-name">{{ p.name }}{{ p.isLocal ? ' (you)' : '' }}</span>
              <span class="tile-flag" [class.off]="p.micMuted"><span class="material-icons">mic{{ p.micMuted ? '_off' : '' }}</span></span>
              <span class="tile-flag" [class.off]="p.camMuted" *ngIf="!p.screenSharing"><span class="material-icons">videocam{{ p.camMuted ? '_off' : '' }}</span></span>
              <span class="tile-flag" *ngIf="p.screenSharing"><span class="material-icons">screen_share</span></span>
              <span class="tile-flag maximize-hint" *ngIf="participants().length > 1"><span class="material-icons">open_in_full</span></span>
            </div>
          </div>
        </div>

        <!-- In-call chat -->
        <div class="call-chat" [class.open]="chatOpen()">
          <div class="call-chat-header">
            <h4>In-call chat</h4>
            <button class="dialog-close" (click)="chatOpen.set(false)"><span class="material-icons">close</span></button>
          </div>
          <div class="call-chat-body" #chatBody>
            <div *ngFor="let m of chatMessages()" class="call-msg" [class.own]="m.own">
              <span class="call-msg-name">{{ m.name }}</span>
              <span class="call-msg-text">{{ m.text }}</span>
              <span class="call-msg-time">{{ m.ts | date:'shortTime' }}</span>
            </div>
          </div>
          <div class="call-chat-input">
            <input type="text" [(ngModel)]="chatText" (keyup.enter)="sendChat()" placeholder="Message the room…" />
            <button class="send-btn" (click)="sendChat()" [disabled]="!chatText.trim()"><span class="material-icons">send</span></button>
          </div>
        </div>
      </div>

      <div class="meeting-controls" *ngIf="phase() === 'connected'">
        <button class="ctl" [class.on]="!micOn()" (click)="toggleMic()" title="Mute / unmute mic (M)">
          <span class="material-icons">{{ micOn() ? 'mic' : 'mic_off' }}</span>
          <span class="ctl-label">{{ micOn() ? 'Mute' : 'Unmute' }}</span>
        </button>
        <button class="ctl" [class.on]="!camOn()" (click)="toggleCam()" title="Camera on / off (V)">
          <span class="material-icons">{{ camOn() ? 'videocam' : 'videocam_off' }}</span>
          <span class="ctl-label">{{ camOn() ? 'Cam off' : 'Cam on' }}</span>
        </button>
        <button class="ctl" [class.on]="sharing()" (click)="toggleScreenShare()" title="Share screen (D)">
          <span class="material-icons">screen_share</span>
          <span class="ctl-label">{{ sharing() ? 'Stop share' : 'Share' }}</span>
        </button>
        <button class="ctl leave" (click)="leave()" title="Leave call (Esc)">
          <span class="material-icons">call_end</span>
          <span class="ctl-label">Leave</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; flex: 1; }
    .meeting-room { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #0b0f14; color: #fff; }
    .meeting-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
    .meeting-header h2 { display: flex; align-items: center; gap: 8px; font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warning); animation: pulse 1.5s infinite; }
    .live-dot.ok { background: var(--success); animation: none; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .meeting-stats { display: flex; align-items: center; gap: 10px; }
    .meeting-count { font-size: var(--font-12); color: var(--text-secondary); }
    .meeting-timer { display: inline-flex; align-items: center; gap: 4px; font-size: var(--font-12); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .meeting-timer .material-icons { font-size: var(--font-14); }
    .icon-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255,255,255,0.08); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
    .icon-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }
    .icon-btn.active { background: var(--primary); color: #fff; }
    .icon-btn .material-icons { font-size: var(--font-18); }

    /* ── Pre-join ──────────────────────────────────────────── */
    .prejoin { flex: 1; display: flex; gap: 24px; align-items: stretch; justify-content: center; padding: 24px; overflow-y: auto; }
    .prejoin-stage { flex: 1; max-width: 560px; background: #141a24; border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
    .preview-video, .preview-off { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 260px; position: relative; }
    .preview-video video { width: 100%; height: 100%; object-fit: cover; }
    .preview-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: var(--font-13); }
    .preview-off { flex-direction: column; gap: 10px; color: var(--text-muted); font-size: var(--font-13); }
    .preview-off .material-icons { font-size: 48px; }
    .preview-controls { position: absolute; bottom: 16px; left: 0; right: 0; display: flex; justify-content: center; gap: 12px; }
    .prectl { width: 46px; height: 46px; min-width: 46px; border-radius: 50%; background: rgba(255,255,255,0.14); }
    .prectl .ctl-label { display: none; }
    .mic-level { padding: 12px 16px; display: flex; align-items: center; gap: 10px; }
    .mic-level-label { font-size: var(--font-11); color: var(--text-secondary); flex-shrink: 0; }
    .mic-level-bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.12); overflow: hidden; }
    .mic-level-fill { height: 100%; background: var(--success); transition: width 0.12s linear; }
    .prejoin-error { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; color: var(--error); font-size: var(--font-13); border-top: 1px solid var(--border); }
    .prejoin-error .material-icons { font-size: var(--font-18); }

    .prejoin-panel { width: 300px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px; align-self: flex-start; }
    .prejoin-panel h3 { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); }
    .prejoin-sub { font-size: var(--font-12); color: var(--text-secondary); margin-top: -8px; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: var(--font-12); font-weight: 600; color: var(--text-secondary); }
    .field select { padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .field select:focus { border-color: var(--primary); }
    .prejoin-actions { display: flex; gap: 8px; margin-top: auto; }
    .btn-ghost { flex: 1; padding: 10px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: var(--font-13); font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { background: var(--background); color: var(--text-primary); }
    .btn-join { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; background: var(--primary); border: none; border-radius: 8px; color: #fff; font-size: var(--font-13); font-weight: 700; cursor: pointer; }
    .btn-join:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-join:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-join .material-icons { font-size: var(--font-18); }

    /* ── Connecting ────────────────────────────────────────── */
    .connecting { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--text-secondary); font-size: var(--font-14); }
    .connecting .spinner { width: 26px; height: 26px; }

    /* ── Call body ─────────────────────────────────────────── */
    .call-body { flex: 1; display: flex; min-height: 0; position: relative; }
    .tile-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; padding: 12px; align-content: start; overflow-y: auto; }
    .tile-grid.single { grid-template-columns: 1fr; }
    .tile-grid.maximized { grid-template-columns: 1fr; }
    .tile-grid.maximized .tile.hidden { display: none; }
    .tile-grid.maximized .tile.maximized { aspect-ratio: auto; height: 100%; }
    .tile-grid .tile.screen { grid-column: 1 / -1; aspect-ratio: auto; min-height: 320px; }

    .spinner { width: 22px; height: 22px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .tile { position: relative; aspect-ratio: 16 / 9; background: #141a24; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s; }
    .tile:hover { border-color: rgba(255,255,255,0.3); }
    .tile.speaking { border-color: var(--success); box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.35); }
    .tile-video { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .tile-video video { width: 100%; height: 100%; object-fit: cover; }
    .tile-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .tile-placeholder .avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #fff; }
    .tile-screen { position: absolute; inset: 0; display: none; z-index: 2; background: #000; }
    .tile-screen video { width: 100%; height: 100%; object-fit: contain; }
    .tile.screen .tile-screen { display: flex; }
    .tile.screen .tile-video { position: absolute; width: 28%; height: 28%; right: 8px; bottom: 42px; border-radius: 8px; overflow: hidden; z-index: 3; border: 1px solid rgba(255,255,255,0.2); }
    .tile.screen .tile-video video { object-fit: cover; }

    .tile-meta { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .tile-name { font-size: var(--font-12); font-weight: 600; background: rgba(0,0,0,0.55); padding: 2px 8px; border-radius: 6px; }
    .tile-flag { background: rgba(0,0,0,0.55); border-radius: 6px; padding: 2px 4px; display: inline-flex; }
    .tile-flag .material-icons { font-size: var(--font-16); }
    .tile-flag.off { color: var(--error); }
    .maximize-hint { display: none; }
    .tile:hover .maximize-hint { display: inline-flex; }
    .quality-badge { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; padding: 2px 4px; background: rgba(0,0,0,0.55); }
    .quality-badge .material-icons { font-size: var(--font-15); }
    .quality-badge.excellent, .quality-badge.good { color: var(--success); }
    .quality-badge.poor { color: var(--warning); }
    .quality-badge.lost { color: var(--error); }
    .quality-badge.unknown { color: var(--text-muted); }

    /* ── In-call chat ──────────────────────────────────────── */
    .call-chat { position: absolute; top: 0; right: 0; bottom: 0; width: 0; z-index: 20; background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: width 0.2s ease; }
    .call-chat.open { width: 320px; }
    .call-chat-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); }
    .call-chat-header h4 { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .dialog-close:hover { color: var(--text-primary); }
    .call-chat-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .call-msg { display: flex; flex-direction: column; gap: 2px; }
    .call-msg.own { align-items: flex-end; }
    .call-msg-name { font-size: var(--font-11); font-weight: 700; color: var(--accent); }
    .call-msg-text { font-size: var(--font-13); color: var(--text-primary); background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; word-break: break-word; max-width: 90%; }
    .call-msg.own .call-msg-text { background: var(--primary); border-color: var(--primary); color: #fff; }
    .call-msg-time { font-size: var(--font-10); color: var(--text-muted); }
    .call-chat-input { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--border); }
    .call-chat-input input { flex: 1; padding: 9px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .call-chat-input input:focus { border-color: var(--primary); }
    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--primary); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    /* ── Controls ──────────────────────────────────────────── */
    .meeting-controls { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 14px 16px; background: var(--surface); border-top: 1px solid var(--border); }
    .ctl { width: auto; min-width: 76px; height: 64px; border-radius: 12px; border: none; cursor: pointer; background: rgba(255,255,255,0.1); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 14px; transition: transform 0.15s, background 0.15s; }
    .ctl:hover { transform: scale(1.05); background: rgba(255,255,255,0.18); }
    .ctl.on { background: var(--error); }
    .ctl.leave { background: var(--error); }
    .ctl .material-icons { font-size: var(--font-24); }
    .ctl-label { font-size: var(--font-11); font-weight: 600; }

    /* ── Mobile ────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .prejoin { flex-direction: column; align-items: stretch; padding: 12px; }
      .prejoin-panel { width: 100%; }
      .call-chat.open { width: 100%; }
    }
  `]
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  private meetingService = inject(MeetingService);

  roomId = input<string>('');
  roomName = input<string>('');
  readonly leaveRequest = output<void>();

  phase = signal<Phase>('prejoin');
  participants = signal<ParticipantTile[]>([]);
  micOn = signal(true);
  camOn = signal(true);
  cameraOn = signal(true);
  sharing = signal(false);
  connected = signal(false);
  error = signal('');
  joining = signal(false);
  micLevel = signal(0);
  previewReady = signal(false);
  fullscreen = signal(false);
  maximizedId = signal('');
  speakingIds = signal<Set<string>>(new Set());
  chatOpen = signal(false);
  chatMessages = signal<ChatMsg[]>([]);
  chatText = '';
  duration = signal(0);
  videoDevices = signal<MediaDeviceInfo[]>([]);
  audioDevices = signal<MediaDeviceInfo[]>([]);
  selectedCam = signal('');
  selectedMic = signal('');

  private room?: Room;
  private localTile?: ParticipantTile;
  private tiles = new Map<string, ParticipantTile>();
  private previewVideoTrack?: LocalVideoTrack;
  private previewAudioTrack?: LocalAudioTrack;
  private micLevelTimer?: any;
  private durationTimer?: any;
  private analyser?: { calculateVolume: () => number; cleanup: () => Promise<void> };
  private startedAt = 0;
  private leaving = false;

  get elapsed(): string {
    const s = this.duration();
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  ngOnInit() {
    this.initPreJoin();
  }

  private async initPreJoin(): Promise<void> {
    this.phase.set('prejoin');
    this.error.set('');
    try {
      const tracks = await createLocalTracks({
        video: { deviceId: this.selectedCam() || undefined, resolution: { width: 1280, height: 720 } },
        audio: { deviceId: this.selectedMic() || undefined }
      });
      this.previewVideoTrack = tracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      this.previewAudioTrack = tracks.find(t => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;

      await this.loadDevices();
      this.attachPreview();
      this.previewReady.set(true);

      if (this.previewAudioTrack) {
        this.analyser = createAudioAnalyser(this.previewAudioTrack);
        this.micLevelTimer = setInterval(() => {
          if (this.analyser) this.micLevel.set(Math.min(100, Math.round(this.analyser.calculateVolume() * 100)));
        }, 120);
      }
    } catch (err) {
      this.error.set(this.readableError(err) || 'Could not access camera or microphone. Check browser permissions.');
    }
  }

  private async loadDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter(d => d.kind === 'audioinput');
      const video = devices.filter(d => d.kind === 'videoinput');
      this.audioDevices.set(audio);
      this.videoDevices.set(video);
      if (!this.selectedCam() && video.length) this.selectedCam.set(video[0].deviceId);
      if (!this.selectedMic() && audio.length) this.selectedMic.set(audio[0].deviceId);
    } catch { }
  }

  private attachPreview(): void {
    setTimeout(() => {
      const container = document.querySelector('.preview-video');
      if (!container || !this.previewVideoTrack) return;
      const existing = container.querySelector('video');
      if (existing) existing.remove();
      const el = this.previewVideoTrack.attach() as HTMLVideoElement;
      container.appendChild(el);
    }, 0);
  }

  async onCamSelect(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedCam.set(id);
    try { await this.previewVideoTrack?.restartTrack({ deviceId: id }); this.attachPreview(); } catch { }
  }

  async onMicSelect(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedMic.set(id);
    try { await this.previewAudioTrack?.restartTrack({ deviceId: id }); } catch { }
  }

  toggleMicPre(): void { this.micOn.set(!this.micOn()); }
  toggleCamPre(): void { this.cameraOn.set(!this.cameraOn()); }

  async joinMeeting(): Promise<void> {
    this.joining.set(true);
    this.error.set('');
    try {
      const resp = await this.meetingService.getLiveKitToken(this.roomId()).toPromise();
      if (!resp) throw new Error('No token response from server');
      const { url, token } = resp;
      this.phase.set('connecting');

      this.room = new Room({ adaptiveStream: true, dynacast: true });
      this.room.on(RoomEvent.TrackSubscribed, (_t, _p, participant) => this.syncTile(participant.identity));
      this.room.on(RoomEvent.TrackUnsubscribed, (_t, _p, participant) => this.syncTile(participant.identity));
      this.room.on(RoomEvent.ParticipantConnected, (participant) => { this.addTile(participant); this.syncTile(participant.identity); });
      this.room.on(RoomEvent.ParticipantDisconnected, (participant) => this.removeTile(participant.identity));
      this.room.on(RoomEvent.Disconnected, () => {
        if (this.leaving) return;
        this.doLeave(false);
        this.phase.set('prejoin');
        this.error.set('You were disconnected from the meeting.');
      });
      this.room.on(RoomEvent.LocalTrackPublished, () => { this.syncTile(this.room!.localParticipant.identity); this.syncLocalTile(); });
      this.room.on(RoomEvent.TrackMuted, (pub: TrackPublication, participant: Participant) => this.onMuteState(pub, participant.identity));
      this.room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant: Participant) => this.onMuteState(pub, participant.identity));
      this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => this.onSpeakers(speakers));
      this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => this.onQuality(quality, participant));
      this.room.on(RoomEvent.DataReceived, (payload, participant) => this.onData(payload, participant));

      await Promise.race([
        this.room.connect(url, token),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 15000))
      ]);

      const lp = this.room.localParticipant;
      if (this.previewVideoTrack && this.cameraOn()) {
        await lp.publishTrack(this.previewVideoTrack, { source: Track.Source.Camera });
      } else if (this.cameraOn()) {
        await lp.setCameraEnabled(true);
      }
      if (this.previewAudioTrack && this.micOn()) {
        await lp.publishTrack(this.previewAudioTrack, { source: Track.Source.Microphone });
      } else if (this.micOn()) {
        await lp.setMicrophoneEnabled(true);
      }

      this.startedAt = Date.now();
      this.durationTimer = setInterval(() => this.duration.set(Math.floor((Date.now() - this.startedAt) / 1000)), 1000);

      this.connected.set(true);
      this.phase.set('connected');
      this.localTile = this.addTile(lp);
      this.syncLocalTile();
      this.syncTile(lp.identity);

      for (const remote of this.room.remoteParticipants.values()) {
        this.addTile(remote);
        this.syncTile(remote.identity);
      }
    } catch (err) {
      this.phase.set('prejoin');
      this.error.set(this.readableError(err));
    } finally {
      this.joining.set(false);
    }
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
    if (participant.identity.endsWith('_screen')) {
      const base = this.tiles.get(participant.identity.slice(0, -'_screen'.length));
      if (base) return base;
    }
    const tile: ParticipantTile = {
      identity: participant.identity,
      name: participant.name || (participant.isLocal ? 'You' : participant.identity),
      isLocal: participant.isLocal,
      micMuted: false,
      camMuted: false,
      hasVideo: false,
      screenSharing: false,
      quality: ConnectionQuality.Unknown
    };
    this.tiles.set(tile.identity, tile);
    this.participants.set([...this.tiles.values()]);
    return tile;
  }

  private removeTile(identity: string): void {
    if (identity.endsWith('_screen')) {
      const base = this.tiles.get(identity.slice(0, -'_screen'.length));
      if (!base) return;
      base.screenSharing = false;
      base.screenEl?.remove();
      base.screenEl = undefined;
      this.participants.set([...this.tiles.values()]);
      return;
    }
    const tile = this.tiles.get(identity);
    if (!tile) return;
    tile.videoEl?.remove();
    tile.screenEl?.remove();
    this.tiles.delete(identity);
    this.participants.set([...this.tiles.values()]);
  }

  private syncTile(identity: string): void {
    if (!this.room) return;
    const lp = this.room.localParticipant;
    const isScreenParticipant = identity.endsWith('_screen');
    const baseIdentity = isScreenParticipant ? identity.slice(0, -'_screen'.length) : identity;
    const participant = identity === lp.identity ? lp : this.room.remoteParticipants.get(identity);
    if (!participant) return;

    if (isScreenParticipant) {
      this.syncScreenShare(baseIdentity, participant);
      return;
    }

    let tile = this.tiles.get(baseIdentity);
    if (!tile) tile = this.addTile(participant);

    const isLocal = participant.isLocal;
    const pubs = [...participant.videoTrackPublications.values()];
    const camPub = pubs.find(p => p.source === Track.Source.Camera && (isLocal || p.isSubscribed));
    const scrPub = pubs.find(p => p.source === Track.Source.ScreenShare && (isLocal || p.isSubscribed));

    const camVideo = camPub?.videoTrack ?? undefined;
    const scrVideo = scrPub?.videoTrack ?? undefined;

    tile.hasVideo = !!camVideo;
    if (isLocal) tile.screenSharing = !!scrVideo;
    if (isLocal) {
      tile.camMuted = !lp.isCameraEnabled;
      tile.micMuted = !lp.isMicrophoneEnabled;
    } else {
      tile.camMuted = !!camPub?.isMuted;
    }

    this.participants.set([...this.tiles.values()]);

    setTimeout(() => {
      if (!this.tiles.has(baseIdentity)) return;
      const camBox = document.querySelector(`[data-tile="${baseIdentity}"] .tile-video`);
      if (tile.videoEl) { tile.videoEl.remove(); tile.videoEl = undefined; }
      if (camVideo && camBox) {
        const el = camVideo.attach() as HTMLVideoElement;
        tile.videoEl = el;
        camBox.appendChild(el);
      }

      if (isLocal) {
        const scrBox = document.querySelector(`[data-tile="${baseIdentity}"] .tile-screen`);
        if (tile.screenEl) { tile.screenEl.remove(); tile.screenEl = undefined; }
        if (scrVideo && scrBox) {
          const el = scrVideo.attach() as HTMLVideoElement;
          tile.screenEl = el;
          scrBox.appendChild(el);
        }
      }
    }, 0);
  }

  private syncScreenShare(baseIdentity: string, screenParticipant: Participant): void {
    const scrPub = [...screenParticipant.videoTrackPublications.values()]
      .find(p => p.source === Track.Source.ScreenShare && p.isSubscribed);
    const scrVideo = scrPub?.videoTrack ?? undefined;
    let tile = this.tiles.get(baseIdentity);
    if (!tile) {
      const baseParticipant = this.room?.remoteParticipants.get(baseIdentity);
      if (!baseParticipant) return;
      tile = this.addTile(baseParticipant);
    }
    tile.screenSharing = !!scrVideo;
    this.participants.set([...this.tiles.values()]);

    setTimeout(() => {
      if (!this.tiles.has(baseIdentity)) return;
      const scrBox = document.querySelector(`[data-tile="${baseIdentity}"] .tile-screen`);
      if (tile.screenEl) { tile.screenEl.remove(); tile.screenEl = undefined; }
      if (scrVideo && scrBox) {
        const el = scrVideo.attach() as HTMLVideoElement;
        tile.screenEl = el;
        scrBox.appendChild(el);
      }
    }, 0);
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
    this.participants.set([...this.tiles.values()]);
  }

  private onMuteState(pub: TrackPublication, participantIdentity: string): void {
    const identity = participantIdentity || this.room?.localParticipant.identity;
    if (!identity) return;
    const tile = this.tiles.get(identity);
    if (!tile) return;
    if (pub.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone) {
      tile.micMuted = pub.isMuted;
      if (this.room?.localParticipant.identity === identity) this.micOn.set(!pub.isMuted);
    } else if (pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera) {
      tile.camMuted = pub.isMuted;
      tile.hasVideo = !pub.isMuted;
      if (this.room?.localParticipant.identity === identity) this.camOn.set(!pub.isMuted);
    }
    this.participants.set([...this.tiles.values()]);
  }

  private onSpeakers(speakers: Participant[]): void {
    const set = new Set(speakers.map(p => p.identity));
    this.speakingIds.set(set);
  }

  private onQuality(quality: ConnectionQuality, participant?: Participant): void {
    if (!participant) return;
    const tile = this.tiles.get(participant.identity);
    if (!tile) return;
    tile.quality = quality;
    this.participants.set([...this.tiles.values()]);
  }

  qualityIcon(q: ConnectionQuality): string {
    switch (q) {
      case ConnectionQuality.Excellent: return 'network_check';
      case ConnectionQuality.Good: return 'signal_cellular_alt';
      case ConnectionQuality.Poor: return 'signal_cellular_alt_1_bar';
      case ConnectionQuality.Lost: return 'signal_cellular_off';
      default: return 'help';
    }
  }

  private onData(payload: Uint8Array, participant?: Participant): void {
    try {
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text);
      if (data?.t !== 'chat' || !data?.m) return;
      const from = participant?.identity || 'unknown';
      if (this.room && from === this.room.localParticipant.identity) return;
      const name = participant?.name || from;
      this.pushChat({ from, name, text: String(data.m), ts: Date.now(), own: false });
    } catch { }
  }

  private pushChat(msg: ChatMsg): void {
    const list = [...this.chatMessages(), msg];
    this.chatMessages.set(list.slice(-200));
    setTimeout(() => {
      const el = document.querySelector('.call-chat-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  sendChat(): void {
    const text = this.chatText.trim();
    if (!text || !this.room) return;
    const local = this.room.localParticipant;
    this.pushChat({ from: local.identity, name: local.name || 'You', text, ts: Date.now(), own: true });
    this.chatText = '';
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ t: 'chat', m: text }));
      void this.room.localParticipant.publishData(payload, { reliable: true });
    } catch { }
  }

  toggleChat(): void { this.chatOpen.set(!this.chatOpen()); }

  toggleMaximize(identity: string): void {
    this.maximizedId.set(this.maximizedId() === identity ? '' : identity);
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { }
    this.fullscreen.set(!!document.fullscreenElement);
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen.set(!!document.fullscreenElement);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'connected') return;
    const target = event.target as HTMLElement;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const key = event.key.toLowerCase();

    if (typing) {
      if (key === 'escape') (target as HTMLInputElement).blur();
      return;
    }
    if (key === 'm') { event.preventDefault(); void this.toggleMic(); }
    else if (key === 'v') { event.preventDefault(); void this.toggleCam(); }
    else if (key === 'd') { event.preventDefault(); void this.toggleScreenShare(); }
    else if (key === 'escape') { this.leave(); }
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
    if (this.room) this.syncTile(this.room.localParticipant.identity);
  }

  leave(): void {
    const others = this.room ? Array.from(this.room.remoteParticipants.keys()).length : 0;
    if (others > 0 && !this.leaving && !confirm('Other people are still in this call. Leave anyway?')) return;
    this.doLeave(true);
  }

  cancel(): void {
    this.doLeave(true);
  }

  private doLeave(emit: boolean): void {
    this.leaving = true;
    if (this.durationTimer) clearInterval(this.durationTimer);
    if (this.micLevelTimer) clearInterval(this.micLevelTimer);
    try { void this.analyser?.cleanup(); } catch { }
    try { this.previewVideoTrack?.stop(); } catch { }
    try { this.previewAudioTrack?.stop(); } catch { }
    try { this.room?.disconnect(); } catch { }
    this.room = undefined;
    this.previewVideoTrack = undefined;
    this.previewAudioTrack = undefined;
    this.tiles.clear();
    this.participants.set([]);
    this.phase.set('prejoin');
    this.connected.set(false);
    this.error.set('');
    if (emit) this.leaveRequest.emit();
  }

  ngOnDestroy(): void {
    this.doLeave(false);
  }
}