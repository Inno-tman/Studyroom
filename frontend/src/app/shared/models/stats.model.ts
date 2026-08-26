export interface UserStats {
  totalStudyMinutes: number;
  sessionsCompleted: number;
  dailyStreak: number;
  weeklyStudyMinutes: number;
  unverifiedSessions?: number;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  schoolName?: string;
  location?: string;
  major?: string;
  interests?: string;
  bio?: string;
  role: string;
  createdAt: string;
  stats: UserStats;
}
