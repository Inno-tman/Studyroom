using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class StatisticsService : IStatisticsService
{
    private readonly IUserStatsRepository _statsRepo;

    public StatisticsService(IUserStatsRepository statsRepo) => _statsRepo = statsRepo;

    public async Task<UserStatsDto> GetUserStatsAsync(Guid userId)
    {
        var stats = await _statsRepo.GetAsync(userId);

        // Read-model is cheap (single row). Recompute only when the stored
        // snapshot is stale (day rolled over) so streak/weekly stay correct.
        if (stats == null || stats.UpdatedAt.Date != DateTime.UtcNow.Date)
        {
            stats = await _statsRepo.RefreshAsync(userId);
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
