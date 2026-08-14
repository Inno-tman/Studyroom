import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { CallService } from '../../../core/services/call.service';

@Component({
  selector: 'app-call-overlay',
  standalone: true,
  imports: [NgIf],
  template: `
    <!-- Incoming call -->
    <div class="call-screen" *ngIf="callService.phase() === 'incoming' && callService.call()">
      <div class="call-card">
        <div class="caller-avatar" [class.has-image]="callService.call()!.peerAvatar">
          <img *ngIf="callService.call()!.peerAvatar; else avInitial" [src]="callService.call()!.peerAvatar" alt="" />
          <ng-template #avInitial>{{ callService.call()!.peerName.charAt(0).toUpperCase() }}</ng-template>
        </div>
        <div class="caller-name">{{ callService.call()!.peerName }}</div>
        <div class="call-status-label"><span class="ring-pulse"></span> Incoming call…</div>
        <div class="call-actions">
          <button class="call-btn decline" (click)="callService.decline()"><span class="material-icons">call</span></button>
          <button class="call-btn answer" (click)="callService.answer()"><span class="material-icons">call</span></button>
        </div>
      </div>
    </div>

    <!-- Outgoing call (brief, while room is being set up) -->
    <div class="call-screen" *ngIf="callService.phase() === 'outgoing' && callService.call()">
      <div class="call-card">
        <div class="caller-avatar" [class.has-image]="callService.call()!.peerAvatar">
          <img *ngIf="callService.call()!.peerAvatar; else outInitial" [src]="callService.call()!.peerAvatar" alt="" />
          <ng-template #outInitial>{{ callService.call()!.peerName.charAt(0).toUpperCase() }}</ng-template>
        </div>
        <div class="caller-name">{{ callService.call()!.peerName }}</div>
        <div class="call-status-label"><span class="ring-pulse"></span> Calling…</div>
        <div class="call-actions">
          <button class="call-btn end" (click)="callService.cancel()"><span class="material-icons">call</span></button>
        </div>
      </div>
    </div>

    <!-- Call ended (declined) -->
    <div class="call-screen" *ngIf="callService.phase() === 'ended'">
      <div class="call-card">
        <div class="caller-avatar"><span class="material-icons">call_missed</span></div>
        <div class="caller-name">{{ callService.declined() ? 'Call declined' : 'Call ended' }}</div>
        <div class="call-status-label">The person is unavailable right now.</div>
        <button class="call-btn end" (click)="callService.hangUp()"><span class="material-icons">call</span></button>
      </div>
    </div>

    <!-- Active call (audio only, native phone UI covering the transport iframe) -->
    <div class="call-screen active" *ngIf="callService.phase() === 'active'">
      <iframe
        class="call-frame"
        [src]="callService.callUrl"
        allow="microphone; speaker-selection; autoplay; clipboard-read; clipboard-write; web-share; picture-in-picture"
        allowfullscreen
      ></iframe>

      <!-- Native phone UI -->
      <div class="phone-ui">
        <div class="phone-top">
          <span class="phone-status">
            <span class="live-dot" *ngIf="!callService.waitingAnswer()"></span>
            <span class="ring-pulse" *ngIf="callService.waitingAnswer()"></span>
            {{ callService.waitingAnswer() ? 'Calling…' : 'On call · ' + callService.elapsedLabel }}
          </span>
        </div>

        <div class="phone-center">
          <div class="caller-avatar lg" [class.has-image]="callService.call()?.peerAvatar">
            <img *ngIf="callService.call()?.peerAvatar; else actInitial" [src]="callService.call()?.peerAvatar" alt="" />
            <ng-template #actInitial>{{ callService.call()?.peerName?.charAt(0)?.toUpperCase() }}</ng-template>
          </div>
          <div class="caller-name">{{ callService.call()?.peerName }}</div>
          <div class="phone-subtitle">StudyRoom audio call</div>
        </div>

        <div class="phone-controls">
          <button class="ctl" [class.on]="callService.muted()" (click)="callService.toggleMute()" [title]="callService.muted() ? 'Unmute' : 'Mute'">
            <span class="material-icons">{{ callService.muted() ? 'mic_off' : 'mic' }}</span>
          </button>
          <button class="ctl" [class.on]="callService.speakerOn()" (click)="callService.toggleSpeaker()" [title]="callService.speakerOn() ? 'Loudspeaker on' : 'Loudspeaker off'">
            <span class="material-icons">{{ callService.speakerOn() ? 'volume_up' : 'volume_down' }}</span>
          </button>
          <button class="ctl" [class.on]="callService.screenOff()" (click)="callService.toggleScreenOff()" [title]="callService.screenOff() ? 'Screen on' : 'Screen off'">
            <span class="material-icons">screen_lock_portrait</span>
          </button>
          <button class="ctl end" (click)="callService.hangUp()" title="End call">
            <span class="material-icons">call_end</span>
          </button>
        </div>
      </div>

      <!-- Black screen when held to the ear (proximity) or manually toggled -->
      <div class="screen-off" *ngIf="callService.screenOff()" (click)="callService.wakeScreen()">
        <span class="screen-off-hint">Tap to wake</span>
      </div>
    </div>
  `,
  styles: [`
    .call-screen {
      position: fixed; inset: 0; z-index: 1300;
      background: linear-gradient(160deg, #0f172a, #111827);
      display: flex; align-items: center; justify-content: center;
      color: white;
    }
    .call-card { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 24px; text-align: center; }
    .caller-avatar {
      width: 120px; height: 120px; border-radius: 50%;
      background: var(--primary); display: flex; align-items: center; justify-content: center;
      font-size: 48px; font-weight: 700; color: white; overflow: hidden;
      box-shadow: 0 0 0 6px rgba(255,255,255,0.08);
    }
    .caller-avatar.sm { width: 44px; height: 44px; font-size: 18px; }
    .caller-avatar.lg { width: 132px; height: 132px; font-size: 52px; box-shadow: 0 0 0 6px rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.45); }
    .caller-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }
    .caller-name { font-size: var(--font-24); font-weight: 700; }
    .call-status-label { display: flex; align-items: center; gap: 8px; font-size: var(--font-14); color: rgba(255,255,255,0.7); }
    .ring-pulse {
      width: 10px; height: 10px; border-radius: 50%; background: var(--success);
      animation: rp 1.4s infinite;
    }
    @keyframes rp { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
    .call-actions { display: flex; gap: 28px; margin-top: 8px; }
    .call-btn {
      width: 68px; height: 68px; border-radius: 50%; border: none; cursor: pointer;
      color: white; display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s;
    }
    .call-btn:hover { transform: scale(1.06); }
    .call-btn .material-icons { font-size: var(--font-28); transform: rotate(135deg); }
    .call-btn.answer { background: var(--success); }
    .call-btn.decline, .call-btn.end { background: var(--error); }
    .call-btn.end .material-icons { transform: rotate(135deg); }

    /* Active call: native phone UI */
    .call-screen.active { flex-direction: column; }
    .call-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
    .phone-ui {
      position: relative; z-index: 2; flex: 1; width: 100%; display: flex; flex-direction: column;
      background: linear-gradient(170deg, #0b1220 0%, #0f172a 55%, #0a0f1c 100%);
    }
    .phone-top { padding: 18px 0 0; text-align: center; }
    .phone-status { display: inline-flex; align-items: center; gap: 8px; font-size: var(--font-13); color: rgba(255,255,255,0.75); letter-spacing: 0.3px; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: rp 1.5s infinite; }
    .phone-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 0 24px; }
    .phone-subtitle { font-size: var(--font-13); color: rgba(255,255,255,0.5); }
    .phone-controls { display: flex; align-items: center; justify-content: center; gap: 26px; padding: 26px 0 calc(26px + env(safe-area-inset-bottom)); }
    .ctl {
      width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,0.10); color: white;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s, background 0.15s;
    }
    .ctl:hover { transform: scale(1.06); }
    .ctl .material-icons { font-size: var(--font-24); }
    .ctl.on { background: var(--success); color: #06210f; }
    .ctl.end { background: var(--error); }
    .ctl.end .material-icons { transform: rotate(135deg); }

    /* Black screen (proximity / manual screen off) */
    .screen-off {
      position: absolute; inset: 0; z-index: 5; background: #000;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .screen-off-hint { font-size: var(--font-12); color: rgba(255,255,255,0.4); letter-spacing: 0.5px; }
  `]
})
export class CallOverlayComponent {
  callService = inject(CallService);
}