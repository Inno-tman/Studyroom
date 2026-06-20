using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/users/stats")]
[Authorize]
public class StatisticsController : ControllerBase
{
    private readonly IStatisticsService _statsService;

    public StatisticsController(IStatisticsService statsService) => _statsService = statsService;

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var stats = await _statsService.GetUserStatsAsync(userId);
        return Ok(stats);
    }
}
