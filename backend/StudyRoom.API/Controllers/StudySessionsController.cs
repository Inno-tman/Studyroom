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
    private readonly IHubContext<StudyRoomHub> _hubContext;
    private readonly INotificationService _notificationService;
    private readonly ITimerScheduler _timerScheduler;
    private readonly ISessionValidationService _validation;

    public StudySessionsController(
        IStudySessionRepository sessionRepo,
        IRoomRepository roomRepo,
        IHubContext<StudyRoomHub> hubContext,
        INotificationService notificationService,
        ITimerScheduler timerScheduler,
        ISessionValidationService validation)
    {
        _sessionRepo = sessionRepo;
        _roomRepo = roomRepo;
        _hubContext = hubContext;
        _notificationService = notificationService;
        _timerScheduler = timerScheduler;
        _validation = validation;
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

            var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
            var existing = sessions.FirstOrDefault(s => !s.Completed);
            if (existing != null)
            {
                existing.RoomId = roomId;
                existing.StartedAt = DateTime.UtcNow;
                await _sessionRepo.UpdateAsync(existing);
            }
            else
            {
                var s = new StudySession
                {
                    UserId = UserId,
                    RoomId = roomId,
                    DurationMinutes = request.DurationMinutes,
                    StartedAt = DateTime.UtcNow,
                    Completed = false
                };
                await _sessionRepo.AddAsync(s);
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

            return Ok(new { success = true });
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
            var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
            var latest = sessions.FirstOrDefault(s => !s.Completed);
            if (latest == null)
                return Ok(new { success = false, message = "No active session found" });

            var start = latest.StartedAt ?? latest.CreatedAt;
            var minutes = (DateTime.UtcNow - start).TotalMinutes;
            latest.DurationMinutes = Math.Round((decimal)Math.Max(0, minutes), 2);
            latest.Completed = true;
            await _validation.ValidateSessionAsync(latest);
            await _sessionRepo.UpdateAsync(latest);

            _timerScheduler.Cancel(UserId);

            if (!string.IsNullOrEmpty(request.RoomId))
            {
                await _hubContext.Clients.Group("room_" + request.RoomId)
                    .SendAsync("TimerCompleted", new { roomId = request.RoomId, completedBy = Username });
            }

            await _notificationService.CreateAsync(
                UserId, "timer", "Focus session complete",
                "Nice work! Take a breather.", icon: "timer", link: "/dashboard");

            return Ok(new
            {
                success = true,
                sessionId = latest.Id.ToString(),
                durationMinutes = latest.DurationMinutes,
                isVerified = latest.IsVerified,
                verifiedReason = latest.VerifiedReason
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
        _timerScheduler.Cancel(UserId);

        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var latest = sessions.FirstOrDefault(s => !s.Completed);
        if (latest != null)
        {
            var start = latest.StartedAt ?? latest.CreatedAt;
            var minutes = (DateTime.UtcNow - start).TotalMinutes;
            latest.DurationMinutes = Math.Round((decimal)Math.Max(0, minutes), 2);
            latest.Completed = true;
            await _validation.ValidateSessionAsync(latest);
            await _sessionRepo.UpdateAsync(latest);
        }

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
        _timerScheduler.Cancel(UserId);

        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var latest = sessions.FirstOrDefault(s => !s.Completed);
        if (latest != null)
        {
            var start = latest.StartedAt ?? latest.CreatedAt;
            var minutes = (DateTime.UtcNow - start).TotalMinutes;
            latest.DurationMinutes = Math.Round((decimal)Math.Max(0, minutes), 2);
            latest.Completed = true;
            await _validation.ValidateSessionAsync(latest);
            await _sessionRepo.UpdateAsync(latest);
        }

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
