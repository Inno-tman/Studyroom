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
  readonly waitingAnswer = signal(false);
  readonly muted = signal(false);
  readonly speakerOn = signal(false);
  readonly screenOff = signal(false);
  readonly elapsed = signal(0);

  private cachedCallUrl?: SafeResourceUrl;
  private subs: Subscription[] = [];
  private ringTimer: any;
  private audioCtx?: AudioContext;
  private timerHandle?: any;
  private proxCleanups: Array<() => void> = [];
  private proxSensor?: any;

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
    this.stopTimer();
    this.cleanupProximity();
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
    this.waitingAnswer.set(true);
    this.phase.set('active');
    this.startTimer();
    this.setupProximity();
    await this.signalR.ring(peerId, callId);
  }

  async answer(): Promise<void> {
    const info = this.call();
    if (!info) return;
    await this.signalR.answerCall(info.callId);
    this.stopRing();
    this.waitingAnswer.set(false);
    this.phase.set('active');
    this.startTimer();
    this.setupProximity();
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
    if (this.phase() === 'active') {
      if (this.waitingAnswer()) await this.signalR.cancelCall(info.callId);
      else await this.signalR.endCall(info.callId);
    }
    this.stopRing();
    this.reset();
  }

  isCurrentPeer(userId: string): boolean {
    return this.call()?.peerId === userId;
  }

  toggleMute(): void {
    this.muted.update(v => !v);
  }

  toggleSpeaker(): void {
    this.speakerOn.update(v => !v);
    if (this.speakerOn()) this.screenOff.set(false);
  }

  toggleScreenOff(): void {
    this.screenOff.update(v => !v);
  }

  wakeScreen(): void {
    this.screenOff.set(false);
  }

  get elapsedLabel(): string {
    const s = this.elapsed();
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  private reset(): void {
    this.phase.set('idle');
    this.call.set(null);
    this.cachedCallUrl = undefined;
    this.declined.set(false);
    this.waitingAnswer.set(false);
    this.muted.set(false);
    this.speakerOn.set(false);
    this.screenOff.set(false);
    this.stopTimer();
    this.cleanupProximity();
  }

  private startTimer(): void {
    this.stopTimer();
    this.elapsed.set(0);
    this.timerHandle = setInterval(() => this.elapsed.update(v => v + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = undefined; }
  }

  private setupProximity(): void {
    this.cleanupProximity();
    const w: any = window;
    const nearHandler = (e: any) => this.onProximity(!!(e.near ?? e.value === 0));
    if ('ondeviceproximity' in w) {
      w.addEventListener?.('deviceproximity', nearHandler);
      this.proxCleanups.push(() => w.removeEventListener?.('deviceproximity', nearHandler));
    }
    if ('onuserproximity' in w) {
      w.addEventListener?.('userproximity', nearHandler);
      this.proxCleanups.push(() => w.removeEventListener?.('userproximity', nearHandler));
    }
    if (w.ProximitySensor) {
      try {
        this.proxSensor = new w.ProximitySensor();
        this.proxSensor.onreading = () => this.onProximity(!!this.proxSensor?.near);
        this.proxSensor.start();
        this.proxCleanups.push(() => { try { this.proxSensor?.stop(); } catch { } });
      } catch { }
    }
  }

  private cleanupProximity(): void {
    this.proxCleanups.forEach(c => c());
    this.proxCleanups = [];
    this.proxSensor = undefined;
  }

  private onProximity(near: boolean): void {
    if (this.speakerOn()) return;
    this.screenOff.set(near);
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
    this.waitingAnswer.set(false);
    this.phase.set('incoming');
    this.startRing();
  }

  private handleAccepted(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.waitingAnswer.set(false);
    this.phase.set('active');
    this.startTimer();
    this.setupProximity();
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
    this.waitingAnswer.set(false);
    this.phase.set('idle');
    this.call.set(null);
  }

  private handleEnded(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.waitingAnswer.set(false);
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