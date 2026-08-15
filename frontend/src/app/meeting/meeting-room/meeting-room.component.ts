import { Component, inject, input, output, OnDestroy, OnInit, signal, HostListener } from '@angular/core';
import { NgFor, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Room, RoomEvent, Track, Participant, RemoteTrack, LocalVideoTrack, LocalAudioTrack,
  createLocalTracks, createAudioAnalyser, ConnectionQuality, TrackPublication
} from 'livekit-client';
import { MeetingService } from '../../core/services/meeting.service';

interface ParticipantTile {
  identity: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
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

interface Reaction {
  id: number;
  identity: string;
  emoji: string;
}

type Phase = 'prejoin' | 'connecting' | 'connected';
type Panel = '' | 'chat' | 'people' | 'settings';
type Effect = 'none' | 'blur' | 'grayscale' | 'sepia' | 'invert' | 'mirror';
type ViewMode = 'grid' | 'spotlight';

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe],
  template: `
    <div class="meeting-room" [class.screen-full]="fullscreen()" [attr.data-effect]="effect()">
      <div class="meeting-header">
        <h2><span class="live-dot" [class.ok]="phase() === 'connected'"></span> {{ roomName() }}</h2>
        <div class="meeting-stats">
          <span class="meeting-count">{{ participants().length }} connected</span>
          <span class="meeting-timer" *ngIf="phase() === 'connected'"><span class="material-icons">schedule</span> {{ elapsed }}</span>
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
        <div class="tile-grid" [class.single]="participants().length === 1" [class.maximized]="effectiveMaximized">
          <div *ngFor="let p of participants()"
               class="tile"
               [class.local]="p.isLocal"
               [class.screen]="p.screenSharing"
               [class.speaking]="speakingIds().has(p.identity)"
               [class.maximized]="isTileMaximized(p.identity)"
               [class.hidden]="effectiveMaximized && p.identity !== effectiveMaximized"
               [attr.data-tile]="p.identity"
               (click)="toggleMaximize(p.identity)">
            <div class="tile-screen" #tileScreen></div>
            <div class="tile-video" #tileVideo>
              <span class="tile-placeholder" *ngIf="!p.hasVideo">
                <span class="avatar">{{ p.name.charAt(0).toUpperCase() }}</span>
              </span>
            </div>
            <span class="tile-reaction" *ngFor="let r of tileReactions(p.identity)">{{ r.emoji }}</span>
            <div class="tile-meta">
              <span class="quality-badge" [class]="p.quality" [title]="'Connection: ' + p.quality">
                <span class="material-icons">{{ qualityIcon(p.quality) }}</span>
              </span>
              <span class="tile-name">{{ p.name }}{{ p.isLocal ? ' (you)' : '' }}</span>
              <span class="host-badge" *ngIf="p.isHost" title="Host">👑</span>
              <span class="tile-flag" [class.off]="p.micMuted"><span class="material-icons">mic{{ p.micMuted ? '_off' : '' }}</span></span>
              <span class="tile-flag" [class.off]="p.camMuted" *ngIf="!p.screenSharing"><span class="material-icons">videocam{{ p.camMuted ? '_off' : '' }}</span></span>
              <span class="tile-flag" *ngIf="p.screenSharing"><span class="material-icons">screen_share</span></span>
              <span class="tile-flag maximize-hint" *ngIf="participants().length > 1"><span class="material-icons">open_in_full</span></span>
            </div>
          </div>
        </div>

        <!-- Side panel: chat / people / settings -->
        <div class="side-panel" [class.open]="panel() !== ''">
          <div class="side-panel-header">
            <h4>{{ panelTitle }}</h4>
            <button class="dialog-close" (click)="panel.set('')"><span class="material-icons">close</span></button>
          </div>

          <!-- Chat -->
          <ng-container *ngIf="panel() === 'chat'">
            <div class="side-panel-body chat">
              <div *ngFor="let m of chatMessages()" class="call-msg" [class.own]="m.own">
                <span class="call-msg-name">{{ m.name }}</span>
                <span class="call-msg-text">{{ m.text }}</span>
                <span class="call-msg-time">{{ m.ts | date:'shortTime' }}</span>
              </div>
            </div>
            <div class="chat-input-row">
              <input type="text" [(ngModel)]="chatText" (keyup.enter)="sendChat()" placeholder="Message the room…" />
              <button class="send-btn" (click)="sendChat()" [disabled]="!chatText.trim()"><span class="material-icons">send</span></button>
            </div>
          </ng-container>

          <!-- People -->
          <ng-container *ngIf="panel() === 'people'">
            <div class="side-panel-body">
              <div class="person-row" *ngFor="let p of peopleList">
                <span class="person-avatar" [class.speaking]="speakingIds().has(p.identity)">{{ p.name.charAt(0).toUpperCase() }}</span>
                <span class="person-info">
                  <span class="person-name">{{ p.name }}{{ p.isLocal ? ' (You)' : '' }} <span class="host-tag" *ngIf="p.isHost">Host</span></span>
                  <span class="person-sub">{{ p.isLocal ? 'You' : (p.screenSharing ? 'Presenting' : 'Participant') }}</span>
                </span>
                <span class="person-flags">
                  <span class="material-icons person-flag" [class.off]="p.micMuted" title="Microphone">{{ p.micMuted ? 'mic_off' : 'mic' }}</span>
                  <span class="material-icons person-flag" [class.off]="p.camMuted" title="Camera">{{ p.camMuted ? 'videocam_off' : 'videocam' }}</span>
                  <span class="material-icons person-flag share" *ngIf="p.screenSharing" title="Screen share">screen_share</span>
                </span>
              </div>
              <p class="panel-empty" *ngIf="participants().length <= 1">No one else is here yet.</p>
            </div>
          </ng-container>

          <!-- Settings -->
          <ng-container *ngIf="panel() === 'settings'">
            <div class="side-panel-body settings">
              <h5 class="settings-title">Video effects</h5>
              <div class="effect-chips">
                <button *ngFor="let e of effectOptions" class="chip" [class.active]="effect() === e.v" (click)="effect.set(e.v)">{{ e.l }}</button>
              </div>
              <label class="field settings-field">
                Camera
                <select [value]="selectedCam()" (change)="onSettingsCamSelect($event)">
                  <option *ngFor="let d of videoDevices()" [value]="d.deviceId">{{ d.label || 'Camera ' + d.deviceId }}</option>
                </select>
              </label>
              <label class="field settings-field">
                Microphone
                <select [value]="selectedMic()" (change)="onSettingsMicSelect($event)">
                  <option *ngFor="let d of audioDevices()" [value]="d.deviceId">{{ d.label || 'Microphone ' + d.deviceId }}</option>
                </select>
              </label>
              <div class="settings-miclevel">
                <span class="settings-miclabel">Mic level</span>
                <div class="mic-level-bar"><div class="mic-level-fill" [style.width.%]="micLevel()"></div></div>
              </div>
              <div class="danger-zone" *ngIf="isHost()">
                <button class="danger-btn" (click)="endMeeting()"><span class="material-icons">logout</span> End meeting for everyone</button>
              </div>
            </div>
          </ng-container>
        </div>
      </div>

      <div class="meeting-controls" *ngIf="phase() === 'connected'">
        <div class="ctl-group">
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
        </div>
        <div class="ctl-group ctl-center">
          <div class="ctl-wrap">
            <button class="ctl ctl-round" [class.on]="reactOpen()" (click)="reactOpen.set(!reactOpen())" title="Send a reaction">
              <span class="material-icons">emoji_emotions</span>
            </button>
            <div class="react-tray" *ngIf="reactOpen()">
              <button *ngFor="let r of reactionList" (click)="sendReaction(r)">{{ r }}</button>
            </div>
          </div>
          <button class="ctl ctl-round" [class.active]="panel() === 'chat'" (click)="togglePanel('chat')" title="In-call chat">
            <span class="material-icons">chat</span>
            <span class="badge" *ngIf="unread() > 0">{{ unread() }}</span>
          </button>
          <button class="ctl ctl-round" [class.active]="panel() === 'people'" (click)="togglePanel('people')" title="People / attendees">
            <span class="material-icons">group</span>
            <span class="badge badge-people">{{ participants().length }}</span>
          </button>
          <button class="ctl ctl-round" [class.active]="panel() === 'settings'" (click)="togglePanel('settings')" title="Video effects & audio settings">
            <span class="material-icons">more_horiz</span>
          </button>
        </div>
        <div class="ctl-group">
          <button class="ctl ctl-round" [class.on]="view() === 'spotlight'" (click)="toggleView()" title="Switch view (G)">
            <span class="material-icons">{{ view() === 'grid' ? 'featured_video' : 'grid_view' }}</span>
          </button>
          <button class="ctl end" *ngIf="isHost()" (click)="endMeeting()" title="End meeting for everyone">
            <span class="material-icons">logout</span>
            <span class="ctl-label">End</span>
          </button>
          <button class="ctl leave" (click)="leave()" title="Leave call (Esc)">
            <span class="material-icons">call_end</span>
            <span class="ctl-label">Leave</span>
          </button>
        </div>
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
    .tile-grid .tile.screen { grid-column: 1 / -1; aspect-ratio: auto; min-height: 320px; max-height: calc(100vh - 240px); width: 100%; }

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
    .host-badge { font-size: var(--font-13); line-height: 1; background: rgba(0,0,0,0.55); padding: 2px 5px; border-radius: 6px; }
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

    /* ── Side panel (chat / people / settings) ────────────── */
    .side-panel { position: absolute; top: 0; right: 0; bottom: 0; width: 0; z-index: 20; background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: width 0.2s ease; }
    .side-panel.open { width: 320px; }
    .side-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); }
    .side-panel-header h4 { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .dialog-close:hover { color: var(--text-primary); }
    .side-panel-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .call-msg { display: flex; flex-direction: column; gap: 2px; }
    .call-msg.own { align-items: flex-end; }
    .call-msg-name { font-size: var(--font-11); font-weight: 700; color: var(--accent); }
    .call-msg-text { font-size: var(--font-13); color: var(--text-primary); background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 6px 10px; word-break: break-word; max-width: 90%; }
    .call-msg.own .call-msg-text { background: var(--primary); border-color: var(--primary); color: #fff; }
    .call-msg-time { font-size: var(--font-10); color: var(--text-muted); }
    .chat-input-row { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--border); }
    .chat-input-row input { flex: 1; padding: 9px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .chat-input-row input:focus { border-color: var(--primary); }
    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--primary); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    /* ── People ───────────────────────────────────────────── */
    .person-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; transition: background 0.15s; }
    .person-row:hover { background: rgba(255,255,255,0.04); }
    .person-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; font-weight: 700; font-size: var(--font-14); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .person-avatar.speaking { box-shadow: 0 0 0 2px var(--success); }
    .person-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .person-name { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .host-tag { font-size: var(--font-10); font-weight: 700; color: #ffd166; background: rgba(255, 209, 102, 0.14); border: 1px solid rgba(255, 209, 102, 0.45); padding: 1px 6px; border-radius: 6px; margin-left: 4px; vertical-align: 1px; }
    .person-sub { font-size: var(--font-11); color: var(--text-muted); }
    .person-flags { display: flex; align-items: center; gap: 8px; }
    .person-flag { font-size: var(--font-18); color: var(--text-secondary); }
    .person-flag.off { color: var(--error); }
    .person-flag.share { color: var(--success); }
    .panel-empty { font-size: var(--font-12); color: var(--text-muted); text-align: center; padding: 16px 0; }

    /* ── Settings ─────────────────────────────────────────── */
    .settings { gap: 12px; }
    .settings-title { font-size: var(--font-12); font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; margin: 4px 0 0; }
    .effect-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--background); color: var(--text-secondary); font-size: var(--font-12); font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .chip:hover { border-color: var(--primary); color: var(--text-primary); }
    .chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    .settings-field select { width: 100%; }
    .settings-miclevel { display: flex; flex-direction: column; gap: 6px; }
    .settings-miclabel { font-size: var(--font-12); font-weight: 600; color: var(--text-secondary); }
    .settings-miclevel .mic-level-bar { width: 100%; }
    .danger-zone { border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px; }
    .danger-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 12px; background: rgba(239, 68, 68, 0.12); border: 1px solid var(--error); border-radius: 8px; color: var(--error); font-size: var(--font-13); font-weight: 700; cursor: pointer; transition: background 0.15s; }
    .danger-btn:hover { background: var(--error); color: #fff; }
    .danger-btn .material-icons { font-size: var(--font-18); }

    /* ── Reactions ────────────────────────────────────────── */
    .tile-reaction { position: absolute; top: 26%; left: 50%; font-size: 42px; z-index: 6; pointer-events: none; animation: reactFloat 2.6s ease-out forwards; }
    @keyframes reactFloat { 0% { opacity: 0; transform: translate(-50%, 20px) scale(0.5); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, -120px) scale(1.3); } }

    /* ── Video effects (local tile + prejoin preview) ─────── */
    .meeting-room[data-effect="blur"] .tile.local .tile-video video,
    .meeting-room[data-effect="blur"] .preview-video video { filter: blur(10px); }
    .meeting-room[data-effect="grayscale"] .tile.local .tile-video video,
    .meeting-room[data-effect="grayscale"] .preview-video video { filter: grayscale(1); }
    .meeting-room[data-effect="sepia"] .tile.local .tile-video video,
    .meeting-room[data-effect="sepia"] .preview-video video { filter: sepia(1); }
    .meeting-room[data-effect="invert"] .tile.local .tile-video video,
    .meeting-room[data-effect="invert"] .preview-video video { filter: invert(1); }
    .meeting-room[data-effect="mirror"] .tile.local .tile-video video,
    .meeting-room[data-effect="mirror"] .preview-video video { transform: scaleX(-1); }

    /* ── Controls ──────────────────────────────────────────── */
    .meeting-controls { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 14px 16px; background: var(--surface); border-top: 1px solid var(--border); }
    .ctl-group { display: flex; align-items: center; gap: 8px; }
    .ctl { width: auto; min-width: 76px; height: 64px; border-radius: 12px; border: none; cursor: pointer; background: rgba(255,255,255,0.1); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 14px; transition: transform 0.15s, background 0.15s; position: relative; }
    .ctl:hover { transform: scale(1.05); background: rgba(255,255,255,0.18); }
    .ctl.on { background: var(--error); }
    .ctl.active { background: var(--primary); }
    .ctl.leave { background: var(--error); }
    .ctl.end { background: rgba(255,255,255,0.06); border: 1px solid var(--error); color: #f87171; }
    .ctl.end:hover { background: rgba(239, 68, 68, 0.15); color: #fff; }
    .ctl .material-icons { font-size: var(--font-24); }
    .ctl-label { font-size: var(--font-11); font-weight: 600; }
    .ctl-round { width: 52px; min-width: 52px; height: 52px; padding: 6px; }
    .ctl-round .ctl-label { display: none; }
    .badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--error); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .badge-people { background: rgba(255,255,255,0.2); }
    .react-tray { position: absolute; bottom: 62px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px; z-index: 30; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .react-tray button { width: 40px; height: 40px; font-size: 22px; background: none; border: none; border-radius: 8px; cursor: pointer; transition: transform 0.12s; }
    .react-tray button:hover { transform: scale(1.25); background: rgba(255,255,255,0.1); }

    /* ── Mobile ────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .prejoin { flex-direction: column; align-items: stretch; padding: 12px; }
      .prejoin-panel { width: 100%; }
      .side-panel.open { width: 100%; }
      .meeting-controls { justify-content: flex-start; overflow-x: auto; }
      .ctl { min-width: 64px; height: 60px; }
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
  chatMessages = signal<ChatMsg[]>([]);
  chatText = '';
  panel = signal<Panel>('');
  unread = signal(0);
  reactions = signal<Reaction[]>([]);
  reactOpen = signal(false);
  effect = signal<Effect>('none');
  view = signal<ViewMode>('grid');
  isHost = signal(false);
  effectOptions: { v: Effect; l: string }[] = [
    { v: 'none', l: 'None' },
    { v: 'blur', l: 'Blur' },
    { v: 'grayscale', l: 'B&W' },
    { v: 'sepia', l: 'Sepia' },
    { v: 'invert', l: 'Invert' },
    { v: 'mirror', l: 'Mirror' }
  ];
  reactionList = ['👍', '❤️', '😂', '😮', '😢', '👏', '🙌'];
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
  private audioOutputs = new Set<HTMLMediaElement>();
  private analyser?: { calculateVolume: () => number; cleanup: () => Promise<void> };
  private startedAt = 0;
  private leaving = false;
  private reactionSeq = 0;

  get elapsed(): string {
    const s = this.duration();
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  get peopleList(): ParticipantTile[] {
    return this.participants();
  }

  get panelTitle(): string {
    switch (this.panel()) {
      case 'chat': return 'In-call chat';
      case 'people': return `People (${this.participants().length})`;
      case 'settings': return 'Settings';
      default: return '';
    }
  }

  get effectiveMaximized(): string {
    if (this.maximizedId()) return this.maximizedId();
    if (this.view() === 'spotlight') return this.spotlightIdentity;
    return '';
  }

  get spotlightIdentity(): string {
    const tiles = this.participants();
    if (tiles.length < 2) return '';
    const screen = tiles.find(t => t.screenSharing);
    if (screen) return screen.identity;
    const speaking = tiles.find(t => !t.isLocal && this.speakingIds().has(t.identity));
    if (speaking) return speaking.identity;
    const remote = tiles.find(t => !t.isLocal);
    if (remote) return remote.identity;
    return '';
  }

  isTileMaximized(identity: string): boolean {
    return this.effectiveMaximized === identity;
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
      this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _p, participant) => {
        this.attachRemoteAudio(track);
        this.syncTile(participant.identity);
      });
      this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _p, participant) => {
        this.detachRemoteAudio(track);
        this.syncTile(participant.identity);
      });
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
      this.room.on(RoomEvent.ParticipantMetadataChanged, (_metadata, participant) => this.onMetadataChanged(participant));

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

      void this.room.startAudio().catch(() => {});

      this.startedAt = Date.now();
      this.durationTimer = setInterval(() => this.duration.set(Math.floor((Date.now() - this.startedAt) / 1000)), 1000);

      this.connected.set(true);
      this.phase.set('connected');
      this.isHost.set((lp.metadata || '') === 'host');
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

  private addTile(participant: Participant): ParticipantTile | undefined {
    if (participant.identity.endsWith('_screen')) {
      const base = this.tiles.get(participant.identity.slice(0, -'_screen'.length));
      return base;
    }
    const tile: ParticipantTile = {
      identity: participant.identity,
      name: participant.name || (participant.isLocal ? 'You' : participant.identity),
      isLocal: participant.isLocal,
      isHost: (participant.metadata || '') === 'host',
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
      this.syncScreenShare(baseIdentity);
      return;
    }

    let tile = this.tiles.get(baseIdentity);
    if (!tile) tile = this.addTile(participant);
    if (!tile) return;

    const isLocal = participant.isLocal;
    const pubs = [...participant.videoTrackPublications.values()];
    const camPub = pubs.find(p => p.source === Track.Source.Camera && (isLocal || p.isSubscribed));
    const ownScrPub = pubs.find(p => p.source === Track.Source.ScreenShare && (isLocal || p.isSubscribed));

    // Screen share may arrive either as a track on the base participant, or on a
    // separate '{identity}_screen' participant created by LiveKit.
    const screenParticipant = this.room.remoteParticipants.get(baseIdentity + '_screen');
    const scrPub = ownScrPub ?? [...(screenParticipant?.videoTrackPublications.values() ?? [])]
      .find(p => p.source === Track.Source.ScreenShare && p.isSubscribed);

    const camVideo = camPub?.videoTrack ?? undefined;
    const scrVideo = scrPub?.videoTrack ?? undefined;

    tile.hasVideo = !!camVideo;
    tile.screenSharing = !!scrVideo;
    tile.camMuted = isLocal ? !lp.isCameraEnabled : !!camPub?.isMuted;
    if (isLocal) tile.micMuted = !lp.isMicrophoneEnabled;

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

      const scrBox = document.querySelector(`[data-tile="${baseIdentity}"] .tile-screen`);
      if (tile.screenEl) { tile.screenEl.remove(); tile.screenEl = undefined; }
      if (scrVideo && scrBox) {
        const el = scrVideo.attach() as HTMLVideoElement;
        el.style.objectFit = 'contain';
        el.style.width = '100%';
        el.style.height = '100%';
        tile.screenEl = el;
        scrBox.appendChild(el);
        console.log('[screen] attached', { baseIdentity, video: `${el.videoWidth}x${el.videoHeight}`, box: `${scrBox.clientWidth}x${scrBox.clientHeight}`, tile: (document.querySelector(`[data-tile="${baseIdentity}"]`) as HTMLElement)?.className });
      } else {
        console.log('[screen] nothing to attach', { baseIdentity, hasScrVideo: !!scrVideo, hasScrBox: !!scrBox, screenSharing: tile.screenSharing });
      }
    }, 0);
  }

  private syncScreenShare(baseIdentity: string): void {
    if (!this.room) return;
    let tile = this.tiles.get(baseIdentity);
    if (!tile) {
      const baseParticipant = this.room.remoteParticipants.get(baseIdentity) ?? this.room.localParticipant;
      if (!baseParticipant) return;
      tile = this.addTile(baseParticipant);
      if (!tile) return;
    }
    this.syncTile(baseIdentity);
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

  private onMetadataChanged(participant: Participant): void {
    const tile = this.tiles.get(participant.identity);
    if (!tile) return;
    tile.isHost = (participant.metadata || '') === 'host';
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
      if (!data?.t) return;
      const from = participant?.identity || 'unknown';
      if (this.room && from === this.room.localParticipant.identity) return;
      if (data.t === 'chat' && data.m) {
        const name = participant?.name || from;
        this.pushChat({ from, name, text: String(data.m), ts: Date.now(), own: false });
      } else if (data.t === 'react' && data.r) {
        this.addReaction(from, String(data.r));
      } else if (data.t === 'endmeeting') {
        this.endMeetingForced();
      }
    } catch { }
  }

  private pushChat(msg: ChatMsg): void {
    const list = [...this.chatMessages(), msg].slice(-200);
    this.chatMessages.set(list);
    if (!msg.own && this.panel() !== 'chat') this.unread.set(this.unread() + 1);
    setTimeout(() => {
      const el = document.querySelector('.side-panel-body.chat');
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

  togglePanel(p: Exclude<Panel, ''>): void {
    if (this.panel() === p) { this.panel.set(''); return; }
    this.panel.set(p);
    if (p === 'chat') this.unread.set(0);
    if (p === 'settings') void this.loadDevices();
    setTimeout(() => {
      const el = document.querySelector('.side-panel-body.chat');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  tileReactions(identity: string): Reaction[] {
    return this.reactions().filter(r => r.identity === identity);
  }

  private addReaction(identity: string, emoji: string): void {
    const id = ++this.reactionSeq;
    this.reactions.set([...this.reactions(), { id, identity, emoji }].slice(-40));
    setTimeout(() => {
      this.reactions.set(this.reactions().filter(r => r.id !== id));
    }, 2600);
  }

  sendReaction(emoji: string): void {
    this.reactOpen.set(false);
    if (!this.room) return;
    const local = this.room.localParticipant;
    this.addReaction(local.identity, emoji);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ t: 'react', r: emoji }));
      void this.room.localParticipant.publishData(payload, { reliable: true });
    } catch { }
  }

  toggleView(): void {
    this.view.set(this.view() === 'grid' ? 'spotlight' : 'grid');
  }

  /** Host: broadcast to every participant to hang up and end the meeting. */
  async endMeeting(): Promise<void> {
    if (!this.room) return;
    if (!confirm('End the meeting for everyone? All participants will be disconnected.')) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ t: 'endmeeting' }));
      void this.room.localParticipant.publishData(payload, { reliable: true });
    } catch { }
    this.doLeave(true);
  }

  /** Non-host: a remote host ended the meeting. */
  private endMeetingForced(): void {
    if (this.leaving) return;
    alert('The host ended this meeting for everyone.');
    this.doLeave(true);
  }

  private localVideoPublication(): TrackPublication | undefined {
    if (!this.room) return undefined;
    return [...this.room.localParticipant.videoTrackPublications.values()]
      .find(p => p.source === Track.Source.Camera);
  }

  private localAudioPublication(): TrackPublication | undefined {
    if (!this.room) return undefined;
    return [...this.room.localParticipant.audioTrackPublications.values()]
      .find(p => p.source === Track.Source.Microphone);
  }

  async onSettingsCamSelect(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedCam.set(id);
    const pub = this.localVideoPublication();
    try { await (pub?.track as any)?.restartTrack?.({ deviceId: id }); } catch { }
    if (this.room) this.syncTile(this.room.localParticipant.identity);
  }

  async onSettingsMicSelect(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedMic.set(id);
    const pub = this.localAudioPublication();
    try { await (pub?.track as any)?.restartTrack?.({ deviceId: id }); } catch { }
  }

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
    else if (key === 'g') { event.preventDefault(); this.toggleView(); }
    else if (key === 'escape') { this.leave(); }
  }

  async toggleMic(): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(!this.micOn());
  }

  async toggleCam(): Promise<void> {
    await this.room?.localParticipant.setCameraEnabled(!this.camOn());
  }

  private attachRemoteAudio(track: RemoteTrack): void {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach() as HTMLAudioElement;
    el.autoplay = true;
    el.muted = false;
    el.controls = false;
    el.style.display = 'none';
    document.body.appendChild(el);
    this.audioOutputs.add(el);
    void el.play().catch(() => {});
  }

  private detachRemoteAudio(track: RemoteTrack): void {
    if (track.kind !== Track.Kind.Audio) return;
    track.detach().forEach(el => {
      this.audioOutputs.delete(el);
      el.remove();
    });
  }

  async toggleScreenShare(): Promise<void> {
    if (this.room?.localParticipant.isScreenShareEnabled) {
      await this.room.localParticipant.setScreenShareEnabled(false);
    } else {
      await this.room?.localParticipant.setScreenShareEnabled(true, { audio: true });
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
    for (const el of this.audioOutputs) { try { el.remove(); } catch { } }
    this.audioOutputs.clear();
    this.room = undefined;
    this.previewVideoTrack = undefined;
    this.previewAudioTrack = undefined;
    this.tiles.clear();
    this.participants.set([]);
    this.panel.set('');
    this.unread.set(0);
    this.reactions.set([]);
    this.reactOpen.set(false);
    this.chatMessages.set([]);
    this.chatText = '';
    this.view.set('grid');
    this.maximizedId.set('');
    this.effect.set('none');
    this.isHost.set(false);
    this.phase.set('prejoin');
    this.connected.set(false);
    this.error.set('');
    if (emit) this.leaveRequest.emit();
  }

  ngOnDestroy(): void {
    this.doLeave(false);
  }
}