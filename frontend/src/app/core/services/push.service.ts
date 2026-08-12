import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const VAPID_PUBLIC_KEY = 'BDNK8AwsX_ru6bf5RGOsy_1ygWJOqQBwNvOJHQmn63LIO-uTkOfFGuzB5RtW7BAL4x_CHEZQQHDofScmyEyGKJE';

@Injectable({ providedIn: 'root' })
export class PushService {
  private http = inject(HttpClient);
  private swRegistration: ServiceWorkerRegistration | null = null;

  private base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async init(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {
      return;
    }

    if (Notification.permission === 'granted') {
      await this.subscribeIfNeeded();
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      await this.subscribeIfNeeded();
      return true;
    }
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await this.subscribeIfNeeded();
      return true;
    }
    return false;
  }

  async subscribeNow(): Promise<void> {
    await this.subscribeIfNeeded();
  }

  private async subscribeIfNeeded(): Promise<void> {
    if (!this.swRegistration) return;
    try {
      let sub = await this.swRegistration.pushManager.getSubscription();
      if (!sub) {
        sub = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.base64UrlToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await this.sendSubscriptionToServer(sub);
    } catch {
      // user dismissed or unsupported
    }
  }

  private async sendSubscriptionToServer(sub: PushSubscription): Promise<void> {
    try {
      await this.http.post(`${environment.apiUrl}/push/subscribe`, {
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!)))
      }).toPromise();
    } catch {
    }
  }

  async unregister(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await this.http.request('delete', `${environment.apiUrl}/push`, { body: { endpoint: sub.endpoint } }).toPromise();
        } catch {
        }
        await sub.unsubscribe();
      }
      await reg.unregister();
    } catch {
    }
  }
}