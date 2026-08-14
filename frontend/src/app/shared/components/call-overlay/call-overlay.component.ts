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

    <!-- Active call (audio only) -->
    <div class="call-screen active" *ngIf="callService.phase() === 'active'">
      <div class="call-top">
        <div class="call-top-info">
          <div class="caller-avatar sm" [class.has-image]="callService.call()?.peerAvatar">
            <img *ngIf="callService.call()?.peerAvatar; else actInitial" [src]="callService.call()?.peerAvatar" alt="" />
            <ng-template #actInitial>{{ callService.call()?.peerName?.charAt(0)?.toUpperCase() }}</ng-template>
          </div>
          <div class="call-top-text">
            <span class="call-title">{{ callService.call()?.peerName }}</span>
            <span class="call-timer" *ngIf="!callService.waitingAnswer()"><span class="live-dot"></span> On call</span>
            <span class="call-timer" *ngIf="callService.waitingAnswer()"><span class="ring-pulse"></span> Calling…</span>
          </div>
        </div>
        <button class="hangup-btn" (click)="callService.hangUp()"><span class="material-icons">call_end</span></button>
      </div>
      <iframe
        class="call-frame"
        [src]="callService.callUrl"
        allow="microphone; speaker-selection; autoplay; clipboard-read; clipboard-write; web-share; picture-in-picture"
        allowfullscreen
      ></iframe>
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

    /* Active call */
    .call-screen.active { flex-direction: column; }
    .call-top {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .call-top-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .call-top-text { display: flex; flex-direction: column; min-width: 0; }
    .call-title { font-size: var(--font-15); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .call-timer { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-12); color: rgba(255,255,255,0.7); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: rp 1.5s infinite; }
    .hangup-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--error);
      color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .hangup-btn .material-icons { transform: rotate(135deg); }
    .call-frame { flex: 1; width: 100%; border: 0; display: block; }
  `]
})
export class CallOverlayComponent {
  callService = inject(CallService);
}