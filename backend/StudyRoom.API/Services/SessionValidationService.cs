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
    private readonly ITabSwitchRepository _tabSwitchRepo;

    public SessionValidationService(IStudySessionRepository sessionRepo, ITabSwitchRepository tabSwitchRepo)
    {
        _sessionRepo = sessionRepo;
        _tabSwitchRepo = tabSwitchRepo;
    }

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
            return;
        }

        // Phase 6 — tab-switch check: if user switched tabs more than 50% of
        // the expected session length (1 switch per 5 min), flag as unverified.
        var switchCount = await _tabSwitchRepo.GetSwitchCountAsync(session.Id);
        var maxAllowed = (int)Math.Max(1, Math.Floor((double)session.DurationMinutes / 10.0));
        if (switchCount > maxAllowed)
        {
            session.IsVerified = false;
            session.VerifiedReason = "excessive_tab_switches";
        }
    }
}
