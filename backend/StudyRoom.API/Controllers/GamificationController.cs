using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/gamification")]
[Authorize]
public class GamificationController : ControllerBase
{
    private readonly IXpService _xpService;

    public GamificationController(IXpService xpService) => _xpService = xpService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("me")]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await _xpService.GetProfileAsync(UserId);
        return Ok(profile);
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] int take = 25)
    {
        var rows = await _xpService.GetFriendsLeaderboardAsync(UserId, Math.Clamp(take, 1, 100));
        return Ok(rows);
    }
}