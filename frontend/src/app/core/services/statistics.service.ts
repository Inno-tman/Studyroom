import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserStats } from '../../shared/models/stats.model';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${environment.apiUrl}/users/stats`);
  }

  completeSession(roomId?: string): Observable<{ success: boolean; durationMinutes?: number }> {
    return this.http.post<{ success: boolean; durationMinutes?: number }>(
      `${environment.apiUrl}/study-sessions/complete`,
      { roomId }
    );
  }

  startSession(roomId: string, durationMinutes: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/study-sessions/start`, { roomId, durationMinutes });
  }

  startBreak(roomId: string, durationMinutes: number, isLong: boolean): Observable<any> {
    return this.http.post(`${environment.apiUrl}/study-sessions/start-break`, { roomId, durationMinutes, isLong });
  }

  pauseSession(roomId: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/study-sessions/pause`, { roomId });
  }

  resetSession(roomId: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/study-sessions/reset`, { roomId });
  }
}
