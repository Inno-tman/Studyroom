using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyRoom.API.Hubs;
using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/study-sessions")]
[Authorize]
public class StudySessionsController : ControllerBase
{
    private readonly IStudySessionRepository _sessionRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly ITabSwitchRepository _tabSwitchRepo;
    private readonly IHubContext<StudyRoomHub> _hubContext;
    private readonly INotificationService _notificationService;
    private readonly ITimerScheduler _timerScheduler;
    private readonly ISessionFinalizerService _finalizer;
    private readonly IVerificationReviewService _verificationReview;

    public StudySessionsController(
        IStudySessionRepository sessionRepo,
        IRoomRepository roomRepo,
        ITabSwitchRepository tabSwitchRepo,
        IHubContext<StudyRoomHub> hubContext,
        INotificationService notificationService,
        ITimerScheduler timerScheduler,
        ISessionFinalizerService finalizer,
        IVerificationReviewService verificationReview)
    {
        _sessionRepo = sessionRepo;
        _roomRepo = roomRepo;
        _hubContext = hubContext;
        _notificationService = notificationService;
        _timerScheduler = timerScheduler;
        _finalizer = finalizer;
        _verificationReview = verificationReview;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Username => User.FindFirstValue(ClaimTypes.Name)!;

    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartSessionRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.RoomId) || !Guid.TryParse(request.RoomId, out var roomId))
                return BadRequest(new { error = "Invalid roomId" });

            // One open focus session per room: reuse the room's active session
            // if present (resume / auto-start), otherwise create a fresh one.
            var existing = await _sessionRepo.GetActiveSessionAsync(UserId, roomId);
            StudySession session;
            if (existing != null)
            {
                existing.DurationMinutes = request.DurationMinutes;
                existing.StartedAt = DateTime.UtcNow;
                await _sessionRepo.UpdateAsync(existing);
                session = existing;
            }
            else
            {
                session = new StudySession
                {
                    UserId = UserId,
                    RoomId = roomId,
                    DurationMinutes = request.DurationMinutes,
                    StartedAt = DateTime.UtcNow,
                    Completed = false
                };
                await _sessionRepo.AddAsync(session);
            }

            _timerScheduler.ScheduleFocus(UserId, roomId, request.DurationMinutes);

            await _hubContext.Clients.Group("room_" + request.RoomId)
                .SendAsync("TimerStarted", new
                {
                    roomId = request.RoomId,
                    durationMinutes = request.DurationMinutes,
                    startedBy = Username,
                    startedAt = DateTime.UtcNow
                });

            return Ok(new { success = true, sessionId = session.Id.ToString() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, detail = ex.InnerException?.Message });
        }
    }

    [HttpPost("complete")]
    public async Task<IActionResult> CompleteSession([FromBody] SessionRequest request)
    {
        try
        {
            Guid? roomId = Guid.TryParse(request.RoomId, out var r) ? r : (Guid?)null;

            var finalized = await _finalizer.FinalizeActiveAsync(UserId, roomId);
            if (finalized == null)
                return Ok(new { success = false, message = "No active session found" });

            _timerScheduler.Cancel(UserId, roomId);

            if (roomId.HasValue)
            {
                await _hubContext.Clients.Group("room_" + roomId.Value)
                    .SendAsync("TimerCompleted", new { roomId = roomId.Value, completedBy = Username });
            }

            await _notificationService.CreateAsync(
                UserId, "timer", "Focus session complete",
                "Nice work! Take a breather.", icon: "timer", link: "/dashboard");

            return Ok(new
            {
                success = true,
                sessionId = finalized.Id.ToString(),
                durationMinutes = finalized.DurationMinutes,
                isVerified = finalized.IsVerified,
                verifiedReason = finalized.VerifiedReason
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, detail = ex.InnerException?.Message });
        }
    }

    [HttpPost("start-break")]
    public async Task<IActionResult> StartBreak([FromBody] BreakRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId) || !Guid.TryParse(request.RoomId, out var roomId))
            return BadRequest(new { error = "Invalid roomId" });

        // A break concludes the current focus phase: finalize the room's active
        // focus session (awarding verified elapsed time) before scheduling.
        await _finalizer.FinalizeActiveAsync(UserId, roomId);

        _timerScheduler.ScheduleBreak(UserId, roomId, request.DurationMinutes, request.IsLong);

        await _hubContext.Clients.Group("room_" + request.RoomId)
            .SendAsync("TimerStarted", new
            {
                roomId = request.RoomId,
                durationMinutes = request.DurationMinutes,
                isBreak = true,
                isLong = request.IsLong,
                startedBy = Username,
                startedAt = DateTime.UtcNow
            });

        return Ok(new { success = true });
    }

    [HttpPost("reset")]
    public async Task<IActionResult> ResetSession([FromBody] SessionRequest request)
    {
        Guid? roomId = Guid.TryParse(request.RoomId, out var r) ? r : (Guid?)null;

        await _finalizer.FinalizeActiveAsync(UserId, roomId);
        _timerScheduler.Cancel(UserId, roomId);

        if (!string.IsNullOrEmpty(request.RoomId))
        {
            await _hubContext.Clients.Group("room_" + request.RoomId)
                .SendAsync("TimerReset", new { roomId = request.RoomId, resetBy = Username });
        }

        return Ok(new { success = true });
    }

    [HttpPost("pause")]
    public async Task<IActionResult> PauseSession([FromBody] SessionRequest request)
    {
        Guid? roomId = Guid.TryParse(request.RoomId, out var r) ? r : (Guid?)null;

        await _finalizer.FinalizeActiveAsync(UserId, roomId);
        _timerScheduler.Cancel(UserId, roomId);

        if (!string.IsNullOrEmpty(request.RoomId))
        {
            await _hubContext.Clients.Group("room_" + request.RoomId)
                .SendAsync("TimerPaused", new { roomId = request.RoomId, pausedBy = Username });
        }

        return Ok(new { success = true });
    }

    [HttpPatch("{id}/notes")]
    public async Task<IActionResult> UpdateNotes(Guid id, [FromBody] UpdateNotesRequest request)
    {
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var session = sessions.FirstOrDefault(s => s.Id == id);
        if (session == null)
            return NotFound(new { error = "Session not found" });

        session.SessionNotes = request.Notes;
        await _sessionRepo.UpdateAsync(session);

        return Ok(new { success = true });
    }

    [HttpGet("room/{roomId}/leaderboard")]
    public async Task<IActionResult> GetRoomLeaderboard(Guid roomId)
    {
        var entries = await _sessionRepo.GetRoomLeaderboardAsync(roomId);
        var result = entries.Select((e, i) => new LeaderboardEntryDto
        {
            UserId = e.UserId.ToString(),
            Username = e.Username,
            AvatarUrl = e.AvatarUrl,
            VerifiedMinutes = Math.Round(e.VerifiedMinutes, 2),
            Sessions = e.Sessions,
            Streak = e.Streak,
            Rank = i + 1
        }).ToList();
        return Ok(result);
    }

    [HttpGet("room/{roomId}/collective")]
    public async Task<IActionResult> GetRoomCollectiveStats(Guid roomId)
    {
        var minutes = await _sessionRepo.GetRoomCollectiveMinutesAsync(roomId);
        var sessions = await _sessionRepo.GetRoomCollectiveSessionsAsync(roomId);
        var memberCount = await _roomRepo.GetMemberCountAsync(roomId);

        // default goal: 10h per member per week, minimum 50h
        var goalMinutes = Math.Max(50m * 60, memberCount * 10m * 60);

        return Ok(new RoomCollectiveStatsDto
        {
            TotalMinutes = Math.Round(minutes, 2),
            TotalSessions = sessions,
            MemberCount = memberCount,
            GoalMinutes = goalMinutes
        });
    }

    [HttpPost("tab-switch")]
    public async Task<IActionResult> ReportTabSwitch([FromBody] TabSwitchRequest request)
    {
        if (!Guid.TryParse(request.SessionId, out var sessionId))
            return BadRequest(new { error = "Invalid sessionId" });

        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var session = sessions.FirstOrDefault(s => s.Id == sessionId && !s.Completed);
        if (session == null)
            return BadRequest(new { error = "No active session found" });

        var evt = new TabSwitchEvent
        {
            UserId = UserId,
            SessionId = sessionId,
            EventType = request.EventType == "returned" ? "returned" : "left"
        };
        await _tabSwitchRepo.AddEventAsync(evt);

        return Ok(new { success = true });
    }

    [HttpGet("{id}/trust-score")]
    public async Task<IActionResult> GetTrustScore(Guid id)
    {
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var session = sessions.FirstOrDefault(s => s.Id == id);
        if (session == null) return NotFound();

        var roundTrips = await _tabSwitchRepo.GetRoundTripsAsync(id);
        var totalMinutes = session.DurationMinutes > 0 ? session.DurationMinutes : 1;

        // Trust score: 100 = perfect. Loses 2 points per completed distraction
        // (left + returned) with a floor of 30, and recovers as sessions accrue.
        var trustScore = Math.Max(30, 100 - (roundTrips * 2));

        return Ok(new
        {
            sessionId = id.ToString(),
            roundTrips,
            trustScore,
            isVerified = session.IsVerified,
            verifiedReason = session.VerifiedReason
        });
    }

    // ── Unverified-session review workflow ──────────────────────────────
    // A user can explain an unverified session and ask the room's host/co-host
    // to re-verify it; an approved session is re-marked verified and awarded.

    [HttpGet("unverified")]
    public async Task<IActionResult> GetMyUnverifiedSessions()
    {
        var sessions = await _verificationReview.GetMySessionsAsync(UserId);
        return Ok(sessions.Select(MapSessionDto));
    }

    [HttpGet("verification-queue/{roomId:guid}")]
    public async Task<IActionResult> GetRoomVerificationQueue(Guid roomId)
    {
        try
        {
            var sessions = await _verificationReview.GetRoomReviewQueueAsync(roomId, UserId);
            return Ok(sessions.Select(MapSessionDto));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("{id}/verify-request")]
    public async Task<IActionResult> RequestVerification(Guid id, [FromBody] VerifyRequest request)
    {
        try
        {
            var session = await _verificationReview.RequestReviewAsync(id, UserId, request.Comment ?? "");
            if (session == null) return NotFound(new { error = "Session not found" });
            return Ok(MapSessionDto(session));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/verify-review")]
    public async Task<IActionResult> ReviewVerification(Guid id, [FromBody] VerifyReviewRequest request)
    {
        try
        {
            var session = await _verificationReview.ReviewAsync(id, UserId, request.Approve, request.Note);
            if (session == null) return NotFound(new { error = "Session not found" });
            return Ok(MapSessionDto(session));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/void")]
    public async Task<IActionResult> VoidSession(Guid id)
    {
        try
        {
            var session = await _verificationReview.VoidAsync(id, UserId);
            if (session == null) return NotFound(new { error = "Session not found" });
            return Ok(MapSessionDto(session));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    private static object MapSessionDto(StudySession s)
    {
        var minutes = Math.Round(s.DurationMinutes, 2);
        var h = (int)Math.Floor(minutes / 60);
        var m = (int)Math.Round(minutes % 60);
        return new
        {
            id = s.Id,
            roomId = s.RoomId,
            durationMinutes = minutes,
            durationLabel = h > 0 ? (m > 0 ? $"{h}h {m}m" : $"{h}h") : $"{m}m",
            isVerified = s.IsVerified,
            verifiedReason = s.VerifiedReason,
            startedAt = s.StartedAt,
            createdAt = s.CreatedAt,
            verificationState = s.VerificationState,
            verificationComment = s.VerificationComment,
            verificationRequestedAt = s.VerificationRequestedAt,
            reviewNote = s.VerificationReviewNote
        };
    }
}

public class VerifyRequest
{
    public string? Comment { get; set; }
}

public class VerifyReviewRequest
{
    public bool Approve { get; set; }
    public string? Note { get; set; }
}

public class SessionRequest
{
    public string? RoomId { get; set; }
}

public class StartSessionRequest
{
    public string RoomId { get; set; } = "";
    public int DurationMinutes { get; set; }
}

public class BreakRequest
{
    public string RoomId { get; set; } = "";
    public int DurationMinutes { get; set; }
    public bool IsLong { get; set; }
}

public class UpdateNotesRequest
{
    public string? Notes { get; set; }
}

public class TabSwitchRequest
{
    public string SessionId { get; set; } = "";
    public string EventType { get; set; } = "left"; // "left" or "returned"
}
