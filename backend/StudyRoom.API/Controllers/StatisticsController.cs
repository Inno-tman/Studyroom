using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/statistics")]
[Authorize]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService _statsService;
    private readonly IStudySessionRepository _sessionsRepo;

    public StatisticsController(IStatisticsService statsService, IStudySessionRepository sessionsRepo)
    {
        _statsService = statsService;
        _sessionsRepo = sessionsRepo;
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var stats = await _statsService.GetUserStatsAsync(userId);
        return Ok(stats);
    }

    /// <summary>Diagnostics: raw session rows for the current user.</summary>
    [HttpGet("debug")]
    public async Task<IActionResult> GetDebug()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var sessions = await _sessionsRepo.GetByUserIdAsync(userId);
        return Ok(new
        {
            totalStudyMinutes = await _sessionsRepo.GetTotalStudyMinutesAsync(userId),
            sessionsCompleted = await _sessionsRepo.GetSessionsCompletedAsync(userId),
            weeklyStudyMinutes = await _sessionsRepo.GetWeeklyStudyMinutesAsync(userId),
            streak = await _sessionsRepo.GetCurrentStreakAsync(userId),
            recentSessions = sessions.Take(10).Select(s => new
            {
                s.Id,
                s.RoomId,
                s.StartedAt,
                s.CreatedAt,
                s.DurationMinutes,
                s.Completed
            })
        });
    }
}
