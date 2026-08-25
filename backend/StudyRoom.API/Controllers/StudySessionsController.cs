using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyRoom.API.Hubs;
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
    private readonly IHubContext<StudyRoomHub> _hubContext;
    private readonly INotificationService _notificationService;
    private readonly ITimerScheduler _timerScheduler;

    public StudySessionsController(
        IStudySessionRepository sessionRepo,
        IHubContext<StudyRoomHub> hubContext,
        INotificationService notificationService,
        ITimerScheduler timerScheduler)
    {
        _sessionRepo = sessionRepo;
        _hubContext = hubContext;
        _notificationService = notificationService;
        _timerScheduler = timerScheduler;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string Username => User.FindFirstValue(ClaimTypes.Name)!;

    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartSessionRequest request)
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

    [HttpPost("complete")]
    public async Task<IActionResult> CompleteSession([FromBody] SessionRequest request)
    {
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var latest = sessions.FirstOrDefault(s => !s.Completed);
        if (latest == null)
            return Ok(new { success = false, message = "No active session found" });

        var start = latest.StartedAt ?? latest.CreatedAt;
        var minutes = (DateTime.UtcNow - start).TotalMinutes;
        latest.DurationMinutes = Math.Round((decimal)Math.Max(0, minutes), 2);
        latest.Completed = true;
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

        return Ok(new { success = true, durationMinutes = latest.DurationMinutes });
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
            await _sessionRepo.UpdateAsync(latest);
        }

        if (!string.IsNullOrEmpty(request.RoomId))
        {
            await _hubContext.Clients.Group("room_" + request.RoomId)
                .SendAsync("TimerPaused", new { roomId = request.RoomId, pausedBy = Username });
        }

        return Ok(new { success = true });
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
