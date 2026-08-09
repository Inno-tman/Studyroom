import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const PICKER_BASE = 'https://photospicker.googleapis.com/v1';
const TARGET_SIZE = 256;
const MAX_POLL_SECONDS = 600;

interface PickedSession {
  id: string;
  pickerUri: string;
  pollingConfig: { pollInterval: string; timeoutIn: string };
  mediaItemsSet: boolean;
}

interface PickedMediaItem {
  id: string;
  baseUrl?: string;
  mimeType?: string;
  mediaFile?: { baseUrl: string };
}

declare global {
  interface Window {
    google: any;
  }
}

@Injectable({ providedIn: 'root' })
export class GooglePhotosService {
  async pickAvatar(): Promise<string> {
    const token = await this.requestAccessToken();
    let sessionId = '';

    try {
      const session = await this.createSession(token);
      sessionId = session.id;

      window.open(`${session.pickerUri}/autoclose`, '_blank');

      await this.pollForSelection(token, session);

      const items = await this.listMediaItems(token, sessionId);
      const image = this.firstImage(items);
      if (!image) {
        throw new Error('No photos were selected.');
      }

      const baseUrl = image.baseUrl ?? image.mediaFile?.baseUrl ?? '';
      if (!baseUrl) {
        throw new Error('Could not read the selected photo.');
      }

      return await this.downloadAndResize(token, baseUrl);
    } finally {
      if (sessionId) {
        this.deleteSession(token, sessionId).catch(() => undefined);
      }
    }
  }

  private requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = window.google?.accounts?.oauth2;
      if (!client?.initTokenClient) {
        reject(new Error('Google sign-in is not available. Please refresh and try again.'));
        return;
      }

      const tokenClient = client.initTokenClient({
        client_id: environment.googleClientId,
        scope: PICKER_SCOPE,
        callback: (response: { error?: string; access_token?: string }) => {
          if (response.error) {
            reject(new Error('Google Photos access was denied.'));
            return;
          }
          resolve(response.access_token ?? '');
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  private async createSession(token: string): Promise<PickedSession> {
    const response = await fetch(`${PICKER_BASE}/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (!response.ok) {
      throw new Error('Could not start the Google Photos picker.');
    }
    return (await response.json()) as PickedSession;
  }

  private async pollForSelection(token: string, session: PickedSession): Promise<void> {
    const deadline = Date.now() + MAX_POLL_SECONDS * 1000;

    while (Date.now() < deadline) {
      const response = await fetch(`${PICKER_BASE}/sessions/${session.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const current = (await response.json()) as PickedSession;
        if (current.mediaItemsSet) return;

        const interval = Number(current.pollingConfig?.pollInterval);
        const timeoutIn = Number(current.pollingConfig?.timeoutIn);
        if (timeoutIn > 0 && timeoutIn < MAX_POLL_SECONDS) {
          const innerDeadline = Date.now() + timeoutIn * 1000;
          while (Date.now() < innerDeadline && Date.now() < deadline) {
            await this.sleep(interval > 0 ? interval * 1000 : 2000);
            const poll = await fetch(`${PICKER_BASE}/sessions/${session.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (poll.ok && (await poll.json()).mediaItemsSet) return;
          }
          return;
        }

        await this.sleep(interval > 0 ? interval * 1000 : 2000);
      } else {
        await this.sleep(2000);
      }
    }

    throw new Error('The photo selection timed out. Please try again.');
  }

  private async listMediaItems(token: string, sessionId: string): Promise<PickedMediaItem[]> {
    const response = await fetch(`${PICKER_BASE}/mediaItems?sessionId=${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error('Could not load the selected photos.');
    }
    const data = (await response.json()) as { mediaItems?: PickedMediaItem[] };
    return data.mediaItems ?? [];
  }

  private firstImage(items: PickedMediaItem[]): PickedMediaItem | undefined {
    return items.find(
      item =>
        (item.baseUrl ?? item.mediaFile?.baseUrl ?? '') !== '' &&
        (!item.mimeType || item.mimeType.startsWith('image/'))
    );
  }

  private async downloadAndResize(token: string, baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}=w${TARGET_SIZE}-h${TARGET_SIZE}-c`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error('Could not download the selected photo.');
    }

    const blob = await response.blob();
    const bitmap = await this.loadBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not process the selected photo.');
    }

    const scale = Math.max(TARGET_SIZE / bitmap.width, TARGET_SIZE / bitmap.height);
    const sw = TARGET_SIZE / scale;
    const sh = TARGET_SIZE / scale;
    const sx = (bitmap.width - sw) / 2;
    const sy = (bitmap.height - sh) / 2;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, TARGET_SIZE, TARGET_SIZE);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  private loadBitmap(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not process the selected photo.'));
      };
      img.src = url;
    });
  }

  private async deleteSession(token: string, sessionId: string): Promise<void> {
    await fetch(`${PICKER_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
