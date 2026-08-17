import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface YoutubeSearchResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export interface YoutubeSearchResponse {
  configured: boolean;
  items: YoutubeSearchResult[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  constructor(private http: HttpClient) {}

  search(query: string, max = 12): Observable<YoutubeSearchResponse> {
    return this.http.get<YoutubeSearchResponse>(`${environment.apiUrl}/youtube/search`, {
      params: { q: query, max: String(max) }
    });
  }

  /** Resolves a direct audio-stream URL for a video (for background playback). */
  audio(id: string): Observable<{ url: string; error?: string }> {
    return this.http.get<{ url: string; error?: string }>(`${environment.apiUrl}/youtube/audio`, {
      params: { id }
    });
  }
}