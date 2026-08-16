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
  video?: boolean;
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
  readonly videoOn = signal(false);
  readonly remoteVideoActive = signal(false);

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
  private localVideoTrack?: MediaStreamTrack;
  private remoteAudioEl?: HTMLAudioElement;
  private remoteVideoEl?: HTMLVideoElement;
  private localVideoEl?: HTMLVideoElement;
  private mediaHost?: HTMLElement | null;
  private negotiating = false;
  private queuedNegotiation = false;
  private queuedOffer?: RTCSessionDescriptionInit;
  private pendingOffer?: RTCSessionDescriptionInit;
  private pendingIce: RTCIceCandidateInit[] = [];
  private speakerSinkId?: string;
  private handsetSinkId?: string;

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

    // Leaving the page must immediately tell the peer the call is over.
    const onUnload = () => { this.notifyPeerEnd(); };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    // If the app was opened (e.g. from a push notification) while a call was
    // ringing, pick it back up once the SignalR connection is live.
    this.resumeRingingCall();

    // Service worker notification clicks tell us to resume a ringing call.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'call-resume') this.resumeRingingCall();
      });
    }
  }

  /** Re-attaches to a ringing call for this user, if any (used after app load / push click). */
  async resumeRingingCall(): Promise<void> {
    if (this.phase() !== 'idle' || !this.auth.isAuthenticated()) return;
    try {
      await this.signalR.startConnection();
      const active = await this.signalR.getActiveCall();
      if (active?.callId && this.phase() === 'idle') {
        this.handleIncoming({
          callId: active.callId,
          callerId: active.callerId,
          callerName: active.callerName || 'Caller',
          callerAvatar: active.callerAvatar,
          callType: active.callType
        });
      }
    } catch {
      // ignore — the connection may come up later
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.stopRing();
    this.stopTimer();
    this.cleanupProximity();
    this.teardownMedia();
  }

  async startCall(peerId: string, peerName: string, peerAvatar?: string, video = false): Promise<void> {
    await this.signalR.startConnection();
    const callId = crypto.randomUUID();
    this.call.set({ callId, peerId, peerName, peerAvatar, video });
    this.declined.set(false);
    this.waitingAnswer.set(true);
    this.phase.set('active');
    this.startTimer();
    this.setupProximity();
    await this.signalR.ring(peerId, callId, video ? 'video' : 'audio');

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
      // If we resumed a ringing call from a push, the offer may not have arrived
      // live — fetch it (and any buffered ICE) from the server.
      if (!this.pendingOffer) {
        const storedOffer = await this.signalR.getCallOffer(info.callId);
        if (storedOffer?.sdp) {
          try { this.pendingOffer = JSON.parse(storedOffer.sdp); } catch { }
        }
      }
      await this.processOffer();
      const storedIce = await this.signalR.getCallIceCandidates(info.callId);
      if (storedIce?.candidates?.length) {
        for (const raw of storedIce.candidates) {
          try { await this.pc!.addIceCandidate(JSON.parse(raw)); } catch { }
        }
      }
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

  async toggleVideo(): Promise<void> {
    if (this.videoOn()) {
      this.videoOn.set(false);
      this.hideLocalVideo();
      const senders = (this.pc?.getSenders() ?? []).filter(s => s.track?.kind === 'video');
      for (const s of senders) { try { this.pc?.removeTrack(s); } catch { } }
      if (this.localVideoTrack) { try { this.localVideoTrack.stop(); } catch { } this.localVideoTrack = undefined; }
      await this.maybeNegotiate();
    } else {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        return;
      }
      this.localVideoTrack = stream.getVideoTracks()[0];
      if (!this.pc || !this.localVideoTrack) {
        try { this.localVideoTrack?.stop(); } catch { }
        return;
      }
      this.localStream?.addTrack(this.localVideoTrack);
      this.pc.addTrack(this.localVideoTrack, this.localStream ?? new MediaStream([this.localVideoTrack]));
      this.videoOn.set(true);
      this.showLocalVideo();
      await this.maybeNegotiate();
    }
  }

  get anyVideo(): boolean {
    return this.videoOn() || this.remoteVideoActive() || !!this.call()?.video;
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
    const wantVideo = this.call()?.video === true || this.videoOn();
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
    this.localTrack = this.localStream.getAudioTracks()[0];
    this.localTrack.enabled = !this.muted();
    if (wantVideo) {
      this.localVideoTrack = this.localStream.getVideoTracks()[0];
      this.videoOn.set(true);
      this.showLocalVideo();
    }
  }

  private async setupPeerConnection(): Promise<void> {
    // Close any existing pc but preserve the buffered offer/ICE —
    // closePeerConnection() would wipe pendingOffer that was received while ringing.
    try { this.pc?.close(); } catch { }
    this.pc = undefined;
    this.remoteAudioEl?.remove();
    this.remoteAudioEl = undefined;
    this.remoteConnected.set(false);

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

    this.pc.onnegotiationneeded = () => { void this.maybeNegotiate(); };

    this.pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (e.track.kind === 'video') {
        this.handleRemoteVideo(e.track, stream);
      } else if (e.track.kind === 'audio') {
        if (!this.remoteAudioEl) {
          this.remoteAudioEl = document.createElement('audio');
          this.remoteAudioEl.autoplay = true;
          (this.remoteAudioEl as any).playsInline = true;
          // Off-screen (not display:none) — some browsers ignore audio from hidden elements.
          this.remoteAudioEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
          document.body.appendChild(this.remoteAudioEl);
          this.enumerateSinks();
        }
        this.remoteAudioEl.srcObject = stream;
        this.playRemoteAudio();
        this.remoteConnected.set(true);
        this.applySink();
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (this.call() === null) return; // already cleaned up
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
    try {
      await this.pc.setRemoteDescription(this.pendingOffer);
    } catch {
      // Glare: we already have a local offer in flight — roll it back, then apply.
      try { await this.pc.setLocalDescription({ type: 'rollback' }); } catch { }
      try { await this.pc.setRemoteDescription(this.pendingOffer); } catch { return; }
    }
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
      const sinkId = this.speakerOn()
        ? (this.speakerSinkId ?? 'default')
        : (this.handsetSinkId ?? 'communications');
      await el.setSinkId(sinkId);
    } catch { }
  }

  /**
   * Chrome's setSinkId only accepts 'default' or 'communications' plus real
   * device ids. 'communications' doesn't exist on most desktops/devices and the
   * magic ids vary by platform, so resolve real audiooutput device ids first
   * and fall back to the magic names.
   */
  private async enumerateSinks(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      for (const d of outputs) {
        const label = d.label.toLowerCase();
        if (!this.speakerSinkId && /(^|[\s(-])speaker|外放|扬声|public|ambient/i.test(label)) {
          this.speakerSinkId = d.deviceId;
        } else if (!this.handsetSinkId && /earpiece|听筒|handset|receiver|headset|耳机/i.test(label)) {
          this.handsetSinkId = d.deviceId;
        }
      }
    } catch { }
  }

  private handleRemoteVideo(track: MediaStreamTrack, stream: MediaStream): void {
    if (!this.remoteVideoEl) {
      this.remoteVideoEl = document.createElement('video');
      this.remoteVideoEl.autoplay = true;
      this.remoteVideoEl.playsInline = true;
      this.remoteVideoEl.muted = true;
      this.remoteVideoEl.classList.add('lk-remote-video');
    }
    this.remoteVideoEl.srcObject = stream;
    void this.remoteVideoEl.play().catch(() => { });
    this.remoteVideoActive.set(true);
    track.addEventListener('ended', () => {
      this.remoteVideoActive.set(false);
      if (this.remoteVideoEl) this.remoteVideoEl.srcObject = null;
    });
    this.rehostMedia();
  }

  private showLocalVideo(): void {
    if (!this.localVideoTrack) return;
    if (!this.localVideoEl) {
      this.localVideoEl = document.createElement('video');
      this.localVideoEl.autoplay = true;
      this.localVideoEl.playsInline = true;
      this.localVideoEl.muted = true;
      this.localVideoEl.classList.add('lk-pip-video');
    }
    this.localVideoEl.srcObject = new MediaStream([this.localVideoTrack]);
    void this.localVideoEl.play().catch(() => { });
    this.rehostMedia();
  }

  private hideLocalVideo(): void {
    if (this.localVideoEl) {
      this.localVideoEl.srcObject = null;
      this.localVideoEl.remove();
      this.localVideoEl = undefined;
    }
  }

  /** The overlay gives us a container to place live video elements into. */
  hostMedia(container: HTMLElement | null): void {
    this.mediaHost = container;
    this.rehostMedia();
  }

  private rehostMedia(): void {
    for (const el of [this.remoteVideoEl, this.localVideoEl]) {
      if (!el) continue;
      if (this.mediaHost) {
        if (el.parentElement !== this.mediaHost) this.mediaHost.appendChild(el);
      } else {
        el.remove();
      }
    }
  }

  /** Re-negotiates after adding/removing the local video track (perfect negotiation). */
  private async maybeNegotiate(): Promise<void> {
    if (!this.pc || !this.call()) return;
    if (this.pc.signalingState !== 'stable') { this.queuedNegotiation = true; return; }
    if (this.negotiating) { this.queuedNegotiation = true; return; }
    this.negotiating = true;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.signalR.sendOffer(this.call()!.callId, JSON.stringify(offer));
    } catch { } finally {
      this.negotiating = false;
      if (this.queuedOffer && this.pc && this.pc.signalingState === 'stable') {
        const offer = this.queuedOffer;
        this.queuedOffer = undefined;
        this.pendingOffer = offer;
        await this.processOffer();
      }
      if (this.queuedNegotiation) {
        this.queuedNegotiation = false;
        await this.maybeNegotiate();
      }
    }
  }

  /** Retries play() on the next user gesture if autoplay was blocked. */
  private playRemoteAudio(): void {
    const el = this.remoteAudioEl;
    if (!el) return;
    el.play().catch(() => {
      const resume = () => {
        el.play().catch(() => { });
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    });
  }

  private closePeerConnection(): void {
    try { this.pc?.close(); } catch { }
    this.pc = undefined;
    this.remoteAudioEl?.remove();
    this.remoteAudioEl = undefined;
    if (this.remoteVideoEl) { this.remoteVideoEl.srcObject = null; this.remoteVideoEl.remove(); this.remoteVideoEl = undefined; }
    this.remoteVideoActive.set(false);
    this.mediaHost = null;
    this.pendingOffer = undefined;
    this.queuedOffer = undefined;
    this.pendingIce = [];
    this.remoteConnected.set(false);
  }

  private teardownMedia(): void {
    this.closePeerConnection();
    this.hideLocalVideo();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = undefined;
    this.localTrack = undefined;
    this.localVideoTrack = undefined;
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
    this.videoOn.set(false);
    this.remoteVideoActive.set(false);
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
      peerAvatar: data.callerAvatar,
      video: data.callType === 'video'
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
    if (this.pc && this.pc.signalingState === 'stable') {
      await this.processOffer();
    } else if (this.pc) {
      this.queuedOffer = this.pendingOffer;
    }
  }

  private async handleAnswer(data: any): Promise<void> {
    const info = this.call();
    if (!info || info.callId !== data.callId) return;
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(JSON.parse(data.sdp));
    } catch { }
    await this.flushPendingIce();
    if (this.queuedNegotiation) {
      this.queuedNegotiation = false;
      await this.maybeNegotiate();
    }
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