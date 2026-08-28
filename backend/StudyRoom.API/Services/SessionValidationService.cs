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

        // Minutes-aware daily cap: a day with 10+ hours of verified study is
        // treated as over-use. Counting verified minutes (instead of raw session
        // count) avoids false positives for short-Pomodoro power users.
        var todayMinutes = await _sessionRepo.GetTodayStudyMinutesAsync(session.UserId);
        if (todayMinutes + session.DurationMinutes > 600)
        {
            session.IsVerified = false;
            session.VerifiedReason = "too_many_sessions";
            return;
        }

        // Round-trip check: only a "left" followed by a "returned" counts as a
        // distraction. A final "left" while the timer completes is benign.
        var roundTrips = await _tabSwitchRepo.GetRoundTripsAsync(session.Id);
        var maxAllowed = (int)Math.Max(1, Math.Floor((double)session.DurationMinutes / 10.0));
        if (roundTrips > maxAllowed)
        {
            session.IsVerified = false;
            session.VerifiedReason = "excessive_tab_switches";
        }
    }
}