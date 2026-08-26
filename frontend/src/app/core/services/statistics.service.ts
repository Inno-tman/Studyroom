import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserStats } from '../../shared/models/stats.model';

export interface CompleteSessionResult {
  success: boolean;
  sessionId?: string;
  durationMinutes?: number;
  isVerified?: boolean;
  verifiedReason?: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  verifiedMinutes: number;
  sessions: number;
  streak: number;
  rank: number;
}

export interface RoomCollectiveStats {
  totalMinutes: number;
  totalSessions: number;
  memberCount: number;
  goalMinutes: number;
  progress: number;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${environment.apiUrl}/users/stats`);
  }

  completeSession(roomId?: string): Observable<CompleteSessionResult> {
    return this.http.post<CompleteSessionResult>(
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

  updateSessionNotes(sessionId: string, notes: string): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/study-sessions/${sessionId}/notes`, { notes });
  }

  getRoomLeaderboard(roomId: string): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${environment.apiUrl}/study-sessions/room/${roomId}/leaderboard`);
  }

  getRoomCollectiveStats(roomId: string): Observable<RoomCollectiveStats> {
    return this.http.get<RoomCollectiveStats>(`${environment.apiUrl}/study-sessions/room/${roomId}/collective`);
  }
}
