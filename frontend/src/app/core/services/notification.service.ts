import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SettingsService } from './settings.service';
import { SignalRService } from './signalr.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { Message } from '../../shared/models/message.model';
import { DirectMessage } from '../../shared/models/social.model';
import { NotificationItem, NotificationList } from '../../shared/models/notification.model';
import { PushService } from './push.service';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private settings = inject(SettingsService);
  private signalR = inject(SignalRService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private push = inject(PushService);

  readonly unreadCount = signal(0);
  readonly messageUnreadCount = signal(0);
  private readonly list = signal<NotificationItem[]>([]);
  readonly items = this.list.asReadonly();
  readonly loading = signal(false);

  private subs: Subscription[] = [];
  private initialized = false;

  constructor() {
    this.subs.push(
      this.signalR.message$.subscribe(msg => this.handleRoomMessage(msg)),
      this.signalR.directMessage$.subscribe(msg => this.handleDirectMessage(msg)),
      this.signalR.notification$.subscribe(n => this.handleRealtimeNotification(n))
    );

    if (this.auth.isAuthenticated()) {
      this.init();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.signalR.startConnection();
    await Promise.all([this.refresh(), this.refreshMessagesUnread()]);
    await this.push.init();
  }

  async refreshMessagesUnread(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      const data = await this.http.get<{ count: number }>(`${environment.apiUrl}/messages/direct/unread-count`).toPromise();
      this.messageUnreadCount.set(data?.count ?? 0);
    } catch {
    }
  }

  async refresh(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    this.loading.set(true);
    try {
      const data = await this.http.get<NotificationList>(`${environment.apiUrl}/notifications`).toPromise();
      this.list.set(data?.items ?? []);
      this.unreadCount.set(data?.unreadCount ?? 0);
    } catch {
    } finally {
      this.loading.set(false);
    }
  }

async markRead(id: string): Promise<void> {
    if (this.items().find(n => n.id === id)?.isRead) return;
    this.list.update(items => items.map(n => n.id === id ? { ...n, isRead: true } : n));
    this.unreadCount.update(c => Math.max(0, c - 1));
    this.http.post<void>(`${environment.apiUrl}/notifications/${id}/read`, {}).toPromise().catch(() => {});
  }

  async markAllRead(): Promise<void> {
    this.list.update(items => items.map(n => ({ ...n, isRead: true })));
    this.unreadCount.set(0);
    this.http.post<void>(`${environment.apiUrl}/notifications/read-all`, {}).toPromise().catch(() => {});
  }

  open(notification: NotificationItem): void {
    this.markRead(notification.id);
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      await this.push.subscribeNow();
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await this.push.requestPermission();
      return true;
    }
    return false;
  }

  playSound(): void {
    if (!this.settings.prefs().notificationSound) return;
    if (this.settings.isQuietHour()) return;
    const type = this.settings.prefs().soundType;
    if (type === 'none') return;
    const vol = this.settings.prefs().soundVolume;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'soft' ? 'sine' : type === 'bell' ? 'triangle' : 'sine';
      osc.frequency.value = type === 'bell' ? 1200 : type === 'soft' ? 440 : 880;
      gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'soft' ? 0.6 : 0.4));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (type === 'soft' ? 0.6 : 0.4));
    } catch { }
  }

  /** End-of-session chime + optional desktop notification. */
  notify(title: string, body: string): void {
    this.playChime();
    this.showDesktopNotification(title, body, true);
  }

  /**
   * Play a chime that works even outside a user-gesture context (e.g. when
   * the tab has been idle). Falls back to a simple Audio element if the
   * AudioContext is suspended by the browser's autoplay policy.
   */
  private playChime(): void {
    const type = this.settings.prefs().soundType;
    if (type === 'none') return;
    const vol = this.settings.prefs().soundVolume;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'soft' ? 'sine' : type === 'bell' ? 'triangle' : 'sine';
      osc.frequency.value = type === 'bell' ? 1200 : type === 'soft' ? 440 : 880;
      gain.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'soft' ? 0.8 : 0.6));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (type === 'soft' ? 0.8 : 0.6));
    } catch {
      // AudioContext blocked — try a <audio> element as fallback
      try {
        const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        a.volume = 0.3;
        a.play().catch(() => {});
      } catch { }
    }
  }

  private handleRealtimeNotification(n: NotificationItem): void {
    const me = this.auth.currentUser()?.id;
    if (n.actorId && n.actorId === me) return;

    this.list.update(items => [n, ...items.filter(i => i.id !== n.id)]);
    if (!n.isRead) this.unreadCount.update(c => c + 1);
    if (n.type === 'direct_message' || n.type === 'stale_message') {
      this.refreshMessagesUnread();
    }

    if (!this.categoryEnabled(n.type)) return;
    this.playSound();
    this.showDesktopNotification(n.title, n.body);
  }

  private handleDirectMessage(msg: DirectMessage): void {
    const me = this.auth.currentUser()?.id;
    if (msg.senderId === me) return;
    if (!this.settings.prefs().directMessages) return;
    this.refreshMessagesUnread();
    this.playSound();
    this.showDesktopNotification(msg.senderName, 'You have a new message.');
  }

  private handleRoomMessage(msg: Message): void {
    const me = this.auth.currentUser()?.id;
    if (msg.userId === me) return;
    if (!this.settings.prefs().roomActivity) return;
    this.playSound();
    this.showDesktopNotification(msg.username, msg.content);
  }

  private categoryEnabled(type: string): boolean {
    const p = this.settings.prefs();
    switch (type) {
      case 'direct_message': return p.directMessages;
      case 'friend_request':
      case 'friend_accept': return p.friendRequests;
      case 'room_invite':
      case 'room_invite_accepted': return p.roomInvites;
      case 'post_comment': return p.postComments;
      default: return true;
    }
  }

  private showDesktopNotification(title: string, body: string, bypassPrefs = false): void {
    if (!bypassPrefs && !this.settings.prefs().desktopNotifications) return;
    if (this.settings.isQuietHour()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const preview = this.settings.prefs().showMessagePreviews ? body : 'New notification.';
    try {
      new Notification(title, { body: preview, icon: '/icons/icon-192x192.png' });
    } catch { }
  }
}