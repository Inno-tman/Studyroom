using StudyRoom.API.DTOs.Statistics;

namespace StudyRoom.API.Services;

public interface IStatisticsService
{
    Task<UserStatsDto> GetUserStatsAsync(Guid userId);
}
