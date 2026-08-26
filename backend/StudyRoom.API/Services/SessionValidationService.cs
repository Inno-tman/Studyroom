using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface ISessionValidationService
{
    Task ValidateSessionAsync(StudySession session);
}

public class SessionValidationService : ISessionValidationService
{
    private readonly IStudySessionRepository _sessionRepo;

    public SessionValidationService(IStudySessionRepository sessionRepo) => _sessionRepo = sessionRepo;

    public async Task ValidateSessionAsync(StudySession session)
    {
        if (session.DurationMinutes > 240)
        {
            session.IsVerified = false;
            session.VerifiedReason = "excessive_duration";
            return;
        }

        if (session.DurationMinutes < 1)
        {
            session.IsVerified = false;
            session.VerifiedReason = "too_short";
            return;
        }

        var todayCount = await _sessionRepo.GetCompletedTodayCountAsync(session.UserId);
        if (todayCount >= 10)
        {
            session.IsVerified = false;
            session.VerifiedReason = "too_many_sessions";
        }
    }
}
