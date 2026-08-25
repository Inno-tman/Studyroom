using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IStudySessionRepository _sessionsRepo;

    public StatisticsService(IStudySessionRepository sessionsRepo)
    {
        _sessionsRepo = sessionsRepo;
    }

    public async Task<UserStatsDto> GetUserStatsAsync(Guid userId)
    {
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
