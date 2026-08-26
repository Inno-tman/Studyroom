using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IStudySessionRepository
{
    Task AddAsync(StudySession session);
    Task UpdateAsync(StudySession session);
    Task<List<StudySession>> GetByUserIdAsync(Guid userId);
    Task<decimal> GetTotalStudyMinutesAsync(Guid userId);
    Task<int> GetSessionsCompletedAsync(Guid userId);
    Task<decimal> GetWeeklyStudyMinutesAsync(Guid userId);
    Task<int> GetCurrentStreakAsync(Guid userId);
    Task<List<StudySession>> GetStaleSessionsAsync(DateTime olderThan);
    Task<int> GetCompletedTodayCountAsync(Guid userId);
    Task<int> GetUnverifiedCountAsync(Guid userId);

    // Phase 3 — leaderboard & collective stats
    Task<List<(Guid UserId, string Username, string? AvatarUrl, decimal VerifiedMinutes, int Sessions, int Streak)>> GetRoomLeaderboardAsync(Guid roomId, int take = 10);
    Task<decimal> GetRoomCollectiveMinutesAsync(Guid roomId);
    Task<int> GetRoomCollectiveSessionsAsync(Guid roomId);

    // Phase 4 — today's progress
    Task<decimal> GetTodayStudyMinutesAsync(Guid userId);
}
