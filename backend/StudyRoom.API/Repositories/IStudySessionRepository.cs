using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IStudySessionRepository
{
    Task AddAsync(StudySession session);
    Task<List<StudySession>> GetByUserIdAsync(Guid userId);
    Task<int> GetTotalStudyMinutesAsync(Guid userId);
    Task<int> GetSessionsCompletedAsync(Guid userId);
    Task<int> GetWeeklyStudyMinutesAsync(Guid userId);
    Task<int> GetCurrentStreakAsync(Guid userId);
}
