using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

/// <summary>
/// Human review of unverified study sessions. A session that was flagged as
/// unverified for a *legitimate* reason (long marathon, heavy tab-switching to
/// source material, a big daily total) can be explained by its owner and
/// re-verified by the host/co-host of the room the session belongs to.
/// Approved sessions are marked verified and retroactively awarded (XP,
/// milestones, calendar) exactly once via the existing idempotency guard.
/// </summary>
public interface IVerificationReviewService
{
    Task<StudySession?> RequestReviewAsync(Guid sessionId, Guid userId, string comment);
    Task<List<StudySession>> GetMySessionsAsync(Guid userId);
    Task<List<StudySession>> GetRoomReviewQueueAsync(Guid roomId, Guid moderatorId);
    Task<StudySession?> ReviewAsync(Guid sessionId, Guid moderatorId, bool approve, string? note);
    Task<StudySession?> VoidAsync(Guid sessionId, Guid ownerId);
}

public class VerificationReviewService : IVerificationReviewService
{
    // Reasons that a session genuinely ran but the automated checks couldn't
    // confirm on their own. These are eligible for a review request.
    private static readonly HashSet<string> EligibleReasons = new(StringComparer.OrdinalIgnoreCase)
    {
        "excessive_duration",
        "too_many_sessions",
        "excessive_tab_switches"
    };

    private readonly AppDbContext _context;
    private readonly IRoomRepository _roomRepo;
    private readonly IXpService _xpService;
    private readonly IMilestoneService _milestoneService;
    private readonly ICalendarService _calendarService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<VerificationReviewService> _logger;

    public VerificationReviewService(
        AppDbContext context,
        IRoomRepository roomRepo,
        IXpService xpService,
        IMilestoneService milestoneService,
        ICalendarService calendarService,
        INotificationService notificationService,
        ILogger<VerificationReviewService> logger)
    {
        _context = context;
        _roomRepo = roomRepo;
        _xpService = xpService;
        _milestoneService = milestoneService;
        _calendarService = calendarService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<StudySession?> RequestReviewAsync(Guid sessionId, Guid userId, string comment)
    {
        var session = await _context.StudySessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Completed);
        if (session == null) return null;

        if (session.IsVerified) return session; // already verified, nothing to review
        if (session.VerificationState is "Pending" or "Approved") return session;
        if (!EligibleReasons.Contains(session.VerifiedReason ?? "")) return session;

        comment = (comment ?? "").Trim();
        if (comment.Length == 0) throw new ArgumentException("A comment explaining your study time is required.");

        session.VerificationComment = comment.Length > 2000 ? comment[..2000] : comment;
        session.VerificationState = "Pending";
        session.VerificationRequestedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return session;
    }

    public async Task<List<StudySession>> GetMySessionsAsync(Guid userId) =>
        await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && !s.IsVerified
                && s.VerificationState != "Voided")
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

    public async Task<List<StudySession>> GetRoomReviewQueueAsync(Guid roomId, Guid moderatorId)
    {
        if (!await IsModeratorAsync(roomId, moderatorId)) throw new UnauthorizedAccessException("Only a host or co-host may review verification requests.");

        // Every eligible unverified session in the room is available for review,
        // whether or not the owner has submitted a request. Requests (with an
        // owner comment) surface first, then the rest oldest-first. Sessions the
        // owner has voided are excluded from the queue.
        return await _context.StudySessions
            .Where(s => s.RoomId == roomId && s.Completed && !s.IsVerified
                && s.VerificationState != "Voided"
                && EligibleReasons.Contains(s.VerifiedReason ?? ""))
            .OrderByDescending(s => s.VerificationState == "Pending")
            .ThenBy(s => s.VerificationRequestedAt ?? s.CreatedAt)
            .ToListAsync();
    }

    public async Task<StudySession?> ReviewAsync(Guid sessionId, Guid moderatorId, bool approve, string? note)
    {
        var session = await _context.StudySessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.Completed);
        if (session == null) return null;

        if (!await IsModeratorAsync(session.RoomId, moderatorId))
            throw new UnauthorizedAccessException("Only a host or co-host may review verification requests.");

        if (session.IsVerified) return session; // no-op
        if (session.VerificationState is "Approved" or "Declined") return session; // already decided
        if (!EligibleReasons.Contains(session.VerifiedReason ?? "")) return session; // not reviewable

        session.VerificationState = approve ? "Approved" : "Declined";
        session.VerificationReviewerUserId = moderatorId;
        session.VerificationReviewNote = (note ?? "").Trim() is { Length: > 0 } n ? (n.Length > 500 ? n[..500] : n) : null;

        if (approve)
        {
            session.IsVerified = true;
            session.VerifiedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // Notify the owner about the outcome.
        var title = approve ? "Study hours approved" : "Study hours review declined";
        var body = approve
            ? $"Your {FormatMinutes(session.DurationMinutes)} of focus were approved and counted."
            : $"Your request to verify {FormatMinutes(session.DurationMinutes)} of focus was not approved.";
        await _notificationService.CreateAsync(session.UserId, "verification", title, body,
            icon: approve ? "verified" : "cancel", link: "/dashboard");

        if (approve)
        {
            await AwardIfNotYetAsync(session);
        }

        return session;
    }

    /// <summary>
    /// Lets a session's OWNER remove ("void") their own flagged focus time. This
    /// behaves like a decline but is initiated by the person the focus time
    /// belongs to rather than by a moderator. A voided session is excluded and
    /// never counts toward stats/focus minutes again: it stays unverified (so it
    /// drops out of every derived computation) and leaves the owner's review
    /// list and the room's verification queue. If the session had somehow been
    /// awarded XP already (e.g. re-verified), the award is revoked.
    /// </summary>
    public async Task<StudySession?> VoidAsync(Guid sessionId, Guid ownerId)
    {
        var session = await _context.StudySessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.Completed);
        if (session == null) return null;

        // Only the person the focus time belongs to may void it.
        if (session.UserId != ownerId)
            throw new UnauthorizedAccessException("Only the owner of the focus time may void it.");

        // Only flagged/unverified sessions can be voided.
        if (session.IsVerified) return session; // nothing to void
        if (session.VerificationState is "Voided" or "Approved" or "Declined") return session; // already decided

        session.VerificationState = "Voided";
        session.VerificationReviewerUserId = ownerId;
        session.VerificationReviewNote = "Voided by owner";
        session.VerifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // A voided session must not keep any XP it may have earned. Unverified
        // sessions are normally never awarded, but if one was (edge case), the
        // compensation below only fires when a matching focus award actually
        // exists, so it can never deduct XP the user never received.
        await RevokeFocusAwardIfAnyAsync(session);

        await _notificationService.CreateAsync(
            session.UserId, "verification",
            "Focus session voided",
            $"You removed {FormatMinutes(session.DurationMinutes)} of flagged focus time. It no longer counts.",
            icon: "block", link: "/dashboard");

        return session;
    }

    /// <summary>
    /// Revokes the focus XP (if any) that a session earned, using a compensating
    /// negative XP event. Only fires when the session has at least one matching
    /// positive "focus" award of the same minute value, so it is a no-op for the
    /// common case of a never-awarded unverified session.
    /// </summary>
    private async Task RevokeFocusAwardIfAnyAsync(StudySession session)
    {
        var xp = Math.Max(1, (int)Math.Round(session.DurationMinutes));

        var awarded = await _context.XpEvents
            .AnyAsync(e => e.UserId == session.UserId && e.Type == "focus" && e.Points == xp);

        if (!awarded) return;

        try
        {
            _context.XpEvents.Add(new XpEvent
            {
                UserId = session.UserId,
                Type = "focus",
                Points = -xp,
                Label = "Focus session voided"
            });
            await _context.SaveChangesAsync();
            await _milestoneService.CheckAndAwardMilestonesAsync(session.UserId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[verification-review] void revoke step failed for session {SessionId} user={UserId}",
                session.Id, session.UserId);
        }
    }

    /// <summary>
    /// Retroactively awards a re-verified session, guarded by AwardProcessed so
    /// a double review can never double-count. XP is 1/min like normal focus;
    /// milestones re-check; a calendar event is created for the session window
    /// (aggregated into the daily event by CalendarService).
    /// </summary>
    private async Task AwardIfNotYetAsync(StudySession session)
    {
        var alreadyAwarded = await _context.StudySessions
            .Where(s => s.Id == session.Id && s.AwardProcessed)
            .AnyAsync();
        if (alreadyAwarded) return;

        try
        {
            var xp = Math.Max(1, (int)Math.Round(session.DurationMinutes));
            await _xpService.AwardAsync(session.UserId, "focus", xp, "Focus session verified (review)");
            await _milestoneService.CheckAndAwardMilestonesAsync(session.UserId);

            if (session.StartedAt.HasValue)
            {
                await _calendarService.CreateStudyEventAsync(
                    session.UserId,
                    session.RoomId,
                    session.StartedAt.Value,
                    session.StartedAt.Value.AddMinutes((double)session.DurationMinutes));
            }

            await _context.StudySessions
                .Where(s => s.Id == session.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(s => s.AwardProcessed, true));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[verification-review] award step failed for session {SessionId} user={UserId}",
                session.Id, session.UserId);
        }
    }

    private async Task<bool> IsModeratorAsync(Guid roomId, Guid userId)
    {
        var membership = await _roomRepo.GetMembershipAsync(roomId, userId);
        return membership != null && (membership.Role == RoomRoles.Host || membership.Role == RoomRoles.Cohost);
    }

    private static string FormatMinutes(decimal minutes)
    {
        var total = (int)Math.Max(0, Math.Round(minutes));
        var h = total / 60;
        var m = total % 60;
        return h > 0 ? (m > 0 ? $"{h}h {m}m" : $"{h}h") : $"{m}m";
    }
}
