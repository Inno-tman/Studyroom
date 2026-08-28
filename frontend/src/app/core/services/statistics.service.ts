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

export interface StartSessionResult {
  success: boolean;
  sessionId?: string;
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

export interface Milestone {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface TodayProgress {
  dailyGoalMinutes: number;
  studiedMinutes: number;
}

export interface DailyGoalResponse {
  dailyGoalMinutes: number;
}

export interface StudySchedule {
  preferredStudyDays: string | null;
  preferredStudyHours: string | null;
}

export interface Recommendation {
  type: string;
  title: string;
  description: string;
  icon: string;
  actionLink: string | null;
}

export interface XpEvent {
  id: string;
  type: string;
  points: number;
  label?: string;
  createdAt: string;
}

export interface GamificationProfile {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  badgeCount: number;
  thisWeekMinutes: number;
  recentEvents: XpEvent[];
}

export interface FriendLeaderboardRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isMe: boolean;
  rank: number;
  weeklyXp: number;
  totalXp: number;
  level: number;
  thisWeekMinutes: number;
  streak: number;
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

  startSession(roomId: string, durationMinutes: number): Observable<StartSessionResult> {
    return this.http.post<StartSessionResult>(`${environment.apiUrl}/study-sessions/start`, { roomId, durationMinutes });
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

  getTodayProgress(): Observable<TodayProgress> {
    return this.http.get<TodayProgress>(`${environment.apiUrl}/users/today-progress`);
  }

  getMilestones(): Observable<Milestone[]> {
    return this.http.get<Milestone[]>(`${environment.apiUrl}/users/milestones`);
  }

  getDailyGoal(): Observable<DailyGoalResponse> {
    return this.http.get<DailyGoalResponse>(`${environment.apiUrl}/users/daily-goal`);
  }

  updateDailyGoal(minutes: number): Observable<DailyGoalResponse> {
    return this.http.patch<DailyGoalResponse>(`${environment.apiUrl}/users/daily-goal`, { dailyGoalMinutes: minutes });
  }

  reportTabSwitch(sessionId: string, eventType: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/study-sessions/tab-switch`, { sessionId, eventType });
  }

  getTrustScore(sessionId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/study-sessions/${sessionId}/trust-score`);
  }

  getSchedule(): Observable<StudySchedule> {
    return this.http.get<StudySchedule>(`${environment.apiUrl}/users/schedule`);
  }

  updateSchedule(schedule: { preferredStudyDays?: string; preferredStudyHours?: string }): Observable<StudySchedule> {
    return this.http.patch<StudySchedule>(`${environment.apiUrl}/users/schedule`, schedule);
  }

  getRecommendations(): Observable<Recommendation[]> {
    return this.http.get<Recommendation[]>(`${environment.apiUrl}/users/recommendations`);
  }

  getAnalyticsOverview(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/analytics/overview`);
  }

  getRoomBreakdown(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/rooms`);
  }

  getDailyTrend(days: number = 30): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/trend`, { params: { days } });
  }

  getHourlyDistribution(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/hourly`);
  }

  getWeeklyGoals(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/weekly-goals`);
  }

  setWeeklyGoal(targetMinutes: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/analytics/weekly-goals`, { targetMinutes });
  }

  getRecentSessions(limit: number = 20, roomId?: string): Observable<any[]> {
    const params: any = { limit };
    if (roomId) params.roomId = roomId;
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/recent-sessions`, { params });
  }

  getActivityFeed(limit: number = 15): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/analytics/activity`, { params: { limit } });
  }

  getGamification(): Observable<GamificationProfile> {
    return this.http.get<GamificationProfile>(`${environment.apiUrl}/gamification/me`);
  }

  getFriendLeaderboard(): Observable<FriendLeaderboardRow[]> {
    return this.http.get<FriendLeaderboardRow[]>(`${environment.apiUrl}/gamification/leaderboard`);
  }
}
