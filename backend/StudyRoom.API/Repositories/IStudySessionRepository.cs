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
}
