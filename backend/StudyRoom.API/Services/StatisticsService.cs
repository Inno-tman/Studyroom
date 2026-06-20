using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IStudySessionRepository _sessionRepo;

    public StatisticsService(IStudySessionRepository sessionRepo) => _sessionRepo = sessionRepo;

    public async Task<UserStatsDto> GetUserStatsAsync(Guid userId)
    {
        var totalMinutes = await _sessionRepo.GetTotalStudyMinutesAsync(userId);
        var sessionsCompleted = await _sessionRepo.GetSessionsCompletedAsync(userId);
        var streak = await _sessionRepo.GetCurrentStreakAsync(userId);
        var weeklyMinutes = await _sessionRepo.GetWeeklyStudyMinutesAsync(userId);

        return new UserStatsDto
        {
            TotalStudyHours = totalMinutes / 60,
            SessionsCompleted = sessionsCompleted,
            DailyStreak = streak,
            WeeklyStudyMinutes = weeklyMinutes
        };
    }
}
