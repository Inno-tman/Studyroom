import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SignalRService } from './signalr.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

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
  private router = inject(Router);

  readonly phase = signal<CallPhase>('idle');
  readonly call = signal<CallInfo | null>(null);
  readonly declined = signal(false);
  readonly waitingAnswer = signal(false);
  readonly muted = signal(false);
  readonly speakerOn = signal(false);
  readonly screenOff = signal(false);
  readonly elapsed = signal(0);
  readonly remoteConnected = signal(false);

  private subs: Subscription[] = [];
  private ringTimer: any;
  private audioCtx?: AudioContext;
  private timerHandle?: any;
  private proxCleanups: Array<() => void> = [];
  private proxSensor?: any;

  // WebRTC
  private pc?: RTCPeerConnection;
  private localStream?: MediaStream;
  private localTrack?: MediaStreamTrack;
  private remoteAudioEl?: HTMLAudioElement;
  private pendingOffer?: RTCSessionDescriptionInit;
  private pendingIce: RTCIceCandidateInit[] = [];

  constructor() {
    this.subs.push(
      this.signalR.incomingCall$.subscribe(data => this.handleIncoming(data)),
      this.signalR.callAccepted$.subscribe(data => this.handleAccepted(data)),
      this.signalR.callDeclined$.subscribe(data => this.handleDeclined(data)),
      this.signalR.callCancelled$.subscribe(data => this.handleCancelled(data)),
      this.signalR.callEnded$.subscribe(data => this.handleEnded(data)),
      this.signalR.webRtcOffer$.subscribe(data => this.handleOffer(data)),
      this.signalR.webRtcAnswer$.subscribe(data => this.handleAnswer(data)),
      this.signalR.webRtcIce$.subscribe(data => this.handleIce(data))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.stopRing();
    this.stopTimer();
    this.cleanupProximity();
    this.teardownMedia();
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

    // Request the mic inside this user gesture, then send the offer immediately.
    // The callee buffers the offer until they answer, so this decouples the offer
    // from the async CallAccepted callback (which is NOT a user gesture).
    try {
      await this.ensureLocalStream();
      await this.setupPeerConnection();
      await this.createOfferAndSend();
    } catch {
      await this.signalR.cancelCall(callId).catch(() => { });
      this.reset();
    }
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
    try {
      await this.ensureLocalStream();
      await this.setupPeerConnection();
      await this.processOffer();
    } catch {
      await this.notifyPeerEnd();
      this.reset();
    }
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
    if (this.localTrack) this.localTrack.enabled = !this.muted();
  }

  async toggleSpeaker(): Promise<void> {
    this.speakerOn.update(v => !v);
    if (this.speakerOn()) this.screenOff.set(false);
    await this.applySink();
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

  // ── WebRTC ──────────────────────────────────────────────

  private async ensureLocalStream(): Promise<void> {
    if (this.localStream) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.localTrack = this.localStream.getAudioTracks()[0];
    this.localTrack.enabled = !this.muted();
  }

  private async setupPeerConnection(): Promise<void> {
    this.closePeerConnection();
    await this.ensureLocalStream();
    if (!this.localStream) return;

    this.pc = new RTCPeerConnection({ iceServers: environment.webrtc?.iceServers ?? [] });
    this.localStream.getTracks().forEach(t => this.pc!.addTrack(t, this.localStream!));

    this.pc.onicecandidate = (e) => {
      const callId = this.call()?.callId;
      if (e.candidate && callId) {
        this.signalR.sendIceCandidate(callId, JSON.stringify(e.candidate.toJSON()));
      }
    };

    this.pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (!this.remoteAudioEl) {
        this.remoteAudioEl = document.createElement('audio');
        this.remoteAudioEl.autoplay = true;
        this.remoteAudioEl.style.display = 'none';
        document.body.appendChild(this.remoteAudioEl);
      }
      this.remoteAudioEl.srcObject = stream;
      this.remoteAudioEl.play().catch(() => { });
      this.remoteConnected.set(true);
      this.applySink();
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'failed' || state === 'closed') {
        // The peer is gone or unreachable — tell the other side and clean up.
        this.notifyPeerEnd();
        this.reset();
      }
    };
  }

  private async createOfferAndSend(): Promise<void> {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.signalR.sendOffer(this.call()!.callId, JSON.stringify(offer));
    await this.flushPendingIce();
  }

  private async processOffer(): Promise<void> {
    if (!this.pc || !this.pendingOffer) return;
    await this.pc.setRemoteDescription(this.pendingOffer);
    this.pendingOffer = undefined;
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.signalR.sendAnswer(this.call()!.callId, JSON.stringify(answer));
    await this.flushPendingIce();
  }

  private async flushPendingIce(): Promise<void> {
    if (!this.pc?.remoteDescription) return;
    const queued = this.pendingIce.splice(0, this.pendingIce.length);
    for (const c of queued) {
      try { await this.pc.addIceCandidate(c); } catch { }
    }
  }

  private async applySink(): Promise<void> {
    const el = this.remoteAudioEl as any;
    if (!el || typeof el.setSinkId !== 'function') return;
    try {
      const sinkId = this.speakerOn() ? 'default' : 'communications';
      await el.setSinkId(sinkId);
    } catch { }
  }

  private closePeerConnection(): void {
    try { this.pc?.close(); } catch { }
    this.pc = undefined;
    this.remoteAudioEl?.remove();
    this.remoteAudioEl = undefined;
    this.pendingOffer = undefined;
    this.pendingIce = [];
    this.remoteConnected.set(false);
  }

  private teardownMedia(): void {
    this.closePeerConnection();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = undefined;
    this.localTrack = undefined;
  }

  /** Tells the peer this call is over (hang up / failure / connection lost). */
  private async notifyPeerEnd(): Promise<void> {
    const info = this.call();
    if (!info) return;
    if (this.waitingAnswer()) {
      await this.signalR.cancelCall(info.callId).catch(() => { });
    } else {
      await this.signalR.endCall(info.callId).catch(() => { });
    }
  }

  // ── Handlers ────────────────────────────────────────────

  private reset(): void {
    this.phase.set('idle');
    this.call.set(null);
    this.declined.set(false);
    this.waitingAnswer.set(false);
    this.muted.set(false);
    this.speakerOn.set(false);
    this.screenOff.set(false);
    this.stopTimer();
    this.cleanupProximity();
    this.teardownMedia();
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
    this.teardownMedia();
    setTimeout(() => {
      if (this.phase() === 'ended') this.reset();
    }, 3000);
  }

  private handleCancelled(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.waitingAnswer.set(false);
    this.reset();
  }

  private handleEnded(data: any): void {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    this.stopRing();
    this.waitingAnswer.set(false);
    this.reset();
  }

  private async handleOffer(data: any): Promise<void> {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    try {
      this.pendingOffer = JSON.parse(data.sdp);
    } catch {
      return;
    }
    if (this.pc) await this.processOffer();
  }

  private async handleAnswer(data: any): Promise<void> {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(JSON.parse(data.sdp));
    } catch { }
    await this.flushPendingIce();
  }

  private async handleIce(data: any): Promise<void> {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    let candidate: RTCIceCandidateInit;
    try {
      candidate = JSON.parse(data.candidate);
    } catch {
      return;
    }
    if (!this.pc?.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    try { await this.pc.addIceCandidate(candidate); } catch { }
  }

  // ── Ringtone / timer / proximity ────────────────────────

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
}