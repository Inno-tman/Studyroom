using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/users/stats")]
[Authorize]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService _statsService;
    private readonly IStudySessionRepository _sessionsRepo;
    private readonly IUserStatsRepository _userStatsRepo;

    public StatisticsController(IStatisticsService statsService, IStudySessionRepository sessionsRepo, IUserStatsRepository userStatsRepo)
    {
        _statsService = statsService;
        _sessionsRepo = sessionsRepo;
        _userStatsRepo = userStatsRepo;
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var stats = await _statsService.GetUserStatsAsync(userId);
        return Ok(stats);
    }

    /// <summary>Diagnostics: raw session rows + stats snapshot for the current user.</summary>
    [HttpGet("debug")]
    public async Task<IActionResult> GetDebug()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var sessions = await _sessionsRepo.GetByUserIdAsync(userId);
        var snapshot = await _userStatsRepo.GetAsync(userId);
        return Ok(new
        {
            snapshot,
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
