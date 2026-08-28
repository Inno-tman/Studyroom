using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface ISessionFinalizerService
{
    /// <summary>
    /// Finalizes the user's active focus session (optionally scoped to a room).
    /// The transition to Completed is an atomic claim, so exactly one caller wins
    /// when the HTTP complete endpoint, the timer scheduler and the hub race.
    /// The winner awards XP / milestones / calendar; losers receive null.
    /// </summary>
    /// <param name="userId">Owner of the session.</param>
    /// <param name="roomId">Restrict to a single room (one open session per room).</param>
    /// <returns>The finalized session if this call claimed it; otherwise null.</returns>
    Task<StudySession?> FinalizeActiveAsync(Guid userId, Guid? roomId = null);
}

public class SessionFinalizerService : ISessionFinalizerService
{
    private readonly AppDbContext _context;
    private readonly ISessionValidationService _validation;
    private readonly IXpService _xpService;
    private readonly IMilestoneService _milestoneService;
    private readonly ICalendarService _calendarService;
    private readonly ILogger<SessionFinalizerService> _logger;

    public SessionFinalizerService(
        AppDbContext context,
        ISessionValidationService validation,
        IXpService xpService,
        IMilestoneService milestoneService,
        ICalendarService calendarService,
        ILogger<SessionFinalizerService> logger)
    {
        _context = context;
        _validation = validation;
        _xpService = xpService;
        _milestoneService = milestoneService;
        _calendarService = calendarService;
        _logger = logger;
    }

    public async Task<StudySession?> FinalizeActiveAsync(Guid userId, Guid? roomId = null)
    {
        var latest = await _context.StudySessions
            .Where(s => s.UserId == userId && !s.Completed && (roomId == null || s.RoomId == roomId))
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        if (latest == null) return null;

        var minutes = ComputeElapsedMinutes(latest);
        latest.DurationMinutes = Math.Round((decimal)Math.Max(0, minutes), 2);

        await _validation.ValidateSessionAsync(latest);

        // Atomic claim: only one concurrent finalizer can flip the flag.
        var claimed = await _context.StudySessions
            .Where(s => s.Id == latest.Id && !s.Completed)
            .ExecuteUpdateAsync(set => set
                .SetProperty(s => s.Completed, true)
                .SetProperty(s => s.DurationMinutes, latest.DurationMinutes)
                .SetProperty(s => s.IsVerified, latest.IsVerified)
                .SetProperty(s => s.VerifiedReason, latest.VerifiedReason)
                .SetProperty(s => s.AwardProcessed, true));

        if (claimed == 0) return null;

        // ExecuteUpdateAsync bypasses the change tracker; detach so a later
        // SaveChanges (e.g. via the notification service) cannot write back
        // stale state over the just-claimed row.
        _context.Entry(latest).State = EntityState.Detached;

        _logger.LogInformation("[finalizer] claimed session {SessionId} user={UserId} minutes={Minutes} verified={Verified} reason={Reason}",
            latest.Id, userId, latest.DurationMinutes, latest.IsVerified, latest.VerifiedReason ?? "none");

        if (latest.IsVerified && latest.DurationMinutes > 0)
        {
            await AwardAsync(latest);
        }

        return latest;
    }

    private async Task AwardAsync(StudySession session)
    {
        try
        {
            // 1 XP per verified minute, minimum 1.
            var xp = Math.Max(1, (int)Math.Round(session.DurationMinutes));
            await _xpService.AwardAsync(session.UserId, "focus", xp, "Focus session completed");

            await _milestoneService.CheckAndAwardMilestonesAsync(session.UserId);

            if (session.StartedAt.HasValue)
            {
                await _calendarService.CreateStudyEventAsync(
                    session.UserId,
                    session.RoomId,
                    session.StartedAt.Value,
                    session.StartedAt.Value.AddMinutes((double)session.DurationMinutes));
            }
        }
        catch (Exception ex)
        {
            // Awarding must never break the finalize pipeline; the session is
            // already claimed/Completed so a retry will not double-award.
            _logger.LogWarning(ex, "[finalizer] award step failed for session {SessionId} user={UserId}",
                session.Id, session.UserId);
        }
    }

    private static decimal ComputeElapsedMinutes(StudySession s)
    {
        var start = s.StartedAt ?? s.CreatedAt;
        var minutes = (DateTime.UtcNow - start).TotalMinutes;
        return Math.Round((decimal)Math.Max(0, minutes), 2);
    }
}