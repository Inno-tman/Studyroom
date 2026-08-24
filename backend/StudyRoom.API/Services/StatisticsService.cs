using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IUserStatsRepository _statsRepo;
    private readonly IStudySessionRepository _sessionsRepo;

    public StatisticsService(IUserStatsRepository statsRepo, IStudySessionRepository sessionsRepo)
    {
        _statsRepo = statsRepo;
        _sessionsRepo = sessionsRepo;
    }

    public async Task<UserStatsDto> GetUserStatsAsync(Guid userId)
    {
        var stats = await _statsRepo.GetAsync(userId);

        // Read-model is cheap (single row). Recompute only when the stored
        // snapshot is stale (day rolled over) so streak/weekly stay correct.
        if (stats == null || stats.UpdatedAt.Date != DateTime.UtcNow.Date)
        {
            try
            {
                stats = await _statsRepo.RefreshAsync(userId);
            }
            catch
            {
                // If the read-model cannot be refreshed (e.g. schema drift),
                // fall back to the live computation instead of failing the request.
                var total = await _sessionsRepo.GetTotalStudyMinutesAsync(userId);
                var completed = await _sessionsRepo.GetSessionsCompletedAsync(userId);
                var weekly = await _sessionsRepo.GetWeeklyStudyMinutesAsync(userId);
                var streak = await _sessionsRepo.GetCurrentStreakAsync(userId);
                return new UserStatsDto
                {
                    TotalStudyMinutes = total,
                    SessionsCompleted = completed,
                    DailyStreak = streak,
                    WeeklyStudyMinutes = weekly
                };
            }
        }

        return new UserStatsDto
        {
            TotalStudyMinutes = stats.TotalStudyMinutes,
            SessionsCompleted = stats.SessionsCompleted,
            DailyStreak = stats.DailyStreak,
            WeeklyStudyMinutes = stats.WeeklyStudyMinutes
        };
    }
}
