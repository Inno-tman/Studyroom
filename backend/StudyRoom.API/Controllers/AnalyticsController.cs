using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;

    public AnalyticsController(IAnalyticsService analyticsService)
    {
        _analyticsService = analyticsService;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var overview = await _analyticsService.GetOverviewAsync(UserId);
        return Ok(overview);
    }

    [HttpGet("rooms")]
    public async Task<IActionResult> GetRoomBreakdown()
    {
        var breakdown = await _analyticsService.GetRoomBreakdownAsync(UserId);
        return Ok(breakdown);
    }

    [HttpGet("trend")]
    public async Task<IActionResult> GetDailyTrend([FromQuery] int days = 30)
    {
        var trend = await _analyticsService.GetDailyTrendAsync(UserId, Math.Clamp(days, 7, 90));
        return Ok(trend);
    }

    [HttpGet("hourly")]
    public async Task<IActionResult> GetHourlyDistribution()
    {
        var dist = await _analyticsService.GetHourlyDistributionAsync(UserId);
        return Ok(dist);
    }

    [HttpGet("weekly-goals")]
    public async Task<IActionResult> GetWeeklyGoals()
    {
        var goals = await _analyticsService.GetWeeklyGoalsAsync(UserId);
        return Ok(goals);
    }

    [HttpPost("weekly-goals")]
    public async Task<IActionResult> SetWeeklyGoal([FromBody] SetWeeklyGoalRequest request)
    {
        var goal = await _analyticsService.SetWeeklyGoalAsync(UserId, request.TargetMinutes);
        return Ok(goal);
    }
}

public class SetWeeklyGoalRequest
{
    public decimal TargetMinutes { get; set; }
}
