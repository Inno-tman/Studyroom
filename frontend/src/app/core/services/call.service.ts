import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SignalRService } from './signalr.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';

export interface CallInfo {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
}

@Injectable({ providedIn: 'root' })
export class CallService implements OnDestroy {
  private signalR = inject(SignalRService);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private notifications = inject(NotificationService);

  readonly phase = signal<CallPhase>('idle');
  readonly call = signal<CallInfo | null>(null);
  readonly declined = signal(false);

  private cachedCallUrl?: SafeResourceUrl;
  private subs: Subscription[] = [];
  private ringTimer: any;
  private audioCtx?: AudioContext;

  constructor() {
    this.subs.push(
      this.signalR.incomingCall$.subscribe(data => this.handleIncoming(data)),
      this.signalR.callAccepted$.subscribe(data => this.handleAccepted(data)),
      this.signalR.callDeclined$.subscribe(data => this.handleDeclined(data)),
      this.signalR.callCancelled$.subscribe(data => this.handleCancelled(data)),
      this.signalR.callEnded$.subscribe(data => this.handleEnded(data))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.stopRing();
  }

  get callUrl(): SafeResourceUrl {
    if (!this.cachedCallUrl && this.call()) {
      const me = this.auth.currentUser();
      const name = encodeURIComponent(me?.username || me?.email || 'Student');
      const ids = [me?.id, this.call()!.peerId].filter(Boolean).sort();
      const room = encodeURIComponent(`studyroom-call-${ids.join('-')}`);
      this.cachedCallUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://sfu.mirotalk.com/join?room=${room}&name=${name}&audio=1&video=0&screen=0&duration=unlimited`
      );
    }
    return this.cachedCallUrl!;
  }

  async startCall(peerId: string, peerName: string, peerAvatar?: string): Promise<void> {
    await this.signalR.startConnection();
    const callId = crypto.randomUUID();
    this.call.set({ callId, peerId, peerName, peerAvatar });
    this.declined.set(false);
    this.phase.set('outgoing');
    await this.signalR.ring(peerId, callId);
  }

  async answer(): Promise<void> {
    const info = this.call();
    if (!info) return;
    await this.signalR.answerCall(info.callId);
    this.stopRing();
    this.phase.set('active');
  }

  async decline(): Promise<void> {
    const info = this.call();
    if (!info) return;
    await this.signalR.declineCall(info.callId);
    this.stopRing();
    this.reset();
  }

  async cancel(): Promise<void> {
    const info = this.call();
    if (!info) return;
    await this.signalR.cancelCall(info.callId);
    this.stopRing();
    this.reset();
  }

  async hangUp(): Promise<void> {
    const info = this.call();
    if (!info) return;
    if (this.phase() === 'active') await this.signalR.endCall(info.callId);
    this.stopRing();
    this.reset();
  }

  isCurrentPeer(userId: string): boolean {
    return this.call()?.peerId === userId;
  }

  private reset(): void {
    this.phase.set('idle');
    this.call.set(null);
    this.cachedCallUrl = undefined;
    this.declined.set(false);
  }

  private handleIncoming(data: any): void {
    const me = this.auth.currentUser()?.id;
    if (data.callerId === me) return;
    this.call.set({
      callId: data.callId,
      peerId: data.callerId,
      peerName: data.callerName || 'Caller',
      peerAvatar: data.callerAvatar
    });
    this.declined.set(false);
    this.phase.set('incoming');
    this.startRing();
  }

  private handleAccepted(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.phase.set('active');
  }

  private handleDeclined(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.declined.set(true);
    this.phase.set('ended');
    setTimeout(() => {
      if (this.phase() === 'ended') this.reset();
    }, 3000);
  }

  private handleCancelled(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.phase.set('idle');
    this.call.set(null);
  }

  private handleEnded(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.phase.set('idle');
    this.call.set(null);
  }

  private startRing(): void {
    this.stopRing();
    this.playRingTone();
    this.ringTimer = setInterval(() => this.playRingTone(), 4000);
  }

  private stopRing(): void {
    if (this.ringTimer) { clearInterval(this.ringTimer); this.ringTimer = undefined; }
    try { this.audioCtx?.close(); } catch { }
    this.audioCtx = undefined;
  }

  private playRingTone(): void {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = this.audioCtx || new Ctx();
      const ctx = this.audioCtx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch { }
  }
}