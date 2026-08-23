import { Injectable } from '@angular/core';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerHandlers {
  onReady?: (event: any) => void;
  onStateChange?: (state: number) => void;
  onError?: (error: any) => void;
}

@Injectable({ providedIn: 'root' })
export class YouTubeBroadcastService {
  private apiPromise?: Promise<void>;

  /** Loads the YouTube IFrame API once. Resolves when window.YT.Player is available. */
  loadApi(): Promise<void> {
    if (this.apiPromise) return this.apiPromise;

    this.apiPromise = new Promise<void>((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };

      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    });

    return this.apiPromise;
  }

  /** Creates a player in the given element id. The element is replaced by the iframe. */
  async createPlayer(elementId: string, videoId: string, handlers: YouTubePlayerHandlers): Promise<any> {
    await this.loadApi();

    return new Promise<any>((resolve) => {
      const player = new window.YT.Player(elementId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          mute: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            handlers.onReady?.(event);
            resolve(player);
          },
          onStateChange: (event: any) => handlers.onStateChange?.(event.data),
          onError: (event: any) => handlers.onError?.(event)
        }
      });
    });
  }
}
