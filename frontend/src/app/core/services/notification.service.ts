import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SettingsService } from './settings.service';
import { SignalRService } from './signalr.service';
import { AuthService } from './auth.service';
import { Message } from '../../shared/models/message.model';
import { DirectMessage } from '../../shared/models/social.model';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private settings = inject(SettingsService);
  private signalR = inject(SignalRService);
  private auth = inject(AuthService);
  private subs: Subscription[] = [];

  constructor() {
    this.subs.push(
      this.signalR.message$.subscribe(msg => this.handleRoomMessage(msg)),
      this.signalR.directMessage$.subscribe(msg => this.handleDirectMessage(msg))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  playSound(): void {
    if (!this.settings.prefs().notificationSound) return;
    if (this.settings.isQuietHour()) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { }
  }

  private handleRoomMessage(msg: Message): void {
    const me = this.auth.currentUser()?.id;
    if (msg.userId === me) return;
    if (!this.settings.prefs().roomActivity) return;
    this.playSound();
    this.showDesktopNotification(msg.username, msg.content);
  }

  private handleDirectMessage(msg: DirectMessage): void {
    const me = this.auth.currentUser()?.id;
    if (msg.senderId === me) return;
    if (!this.settings.prefs().directMessages) return;
    this.playSound();
    this.showDesktopNotification(msg.senderName, msg.content);
  }

  private showDesktopNotification(title: string, body: string): void {
    if (!this.settings.prefs().desktopNotifications) return;
    if (this.settings.isQuietHour()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const preview = this.settings.prefs().showMessagePreviews ? body : 'New message received.';
    try {
      new Notification(title, { body: preview, icon: '/icons/icon-192x192.png' });
    } catch { }
  }
}
