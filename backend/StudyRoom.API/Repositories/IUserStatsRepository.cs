using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IUserStatsRepository
{
    Task<UserStats?> GetAsync(Guid userId);
    Task<UserStats> RefreshAsync(Guid userId);
}
