using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;
    private readonly IStudySessionRepository _sessionRepo;

    public AnalyticsController(IAnalyticsService analyticsService, IStudySessionRepository sessionRepo)
    {
        _analyticsService = analyticsService;
        _sessionRepo = sessionRepo;
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

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string format = "csv", [FromQuery] int days = 90)
    {
        var sessions = await _sessionRepo.GetByUserIdAsync(UserId);
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var filtered = sessions.Where(s => s.Completed && s.CreatedAt >= cutoff).OrderBy(s => s.CreatedAt).ToList();

        if (format == "json")
        {
            var jsonData = filtered.Select(s => new
            {
                date = s.CreatedAt.ToString("yyyy-MM-dd"),
                startTime = s.CreatedAt.ToString("HH:mm"),
                durationMinutes = s.DurationMinutes,
                isVerified = s.IsVerified,
                verifiedReason = s.VerifiedReason,
                roomId = s.RoomId.ToString(),
                notes = s.SessionNotes
            });
            var json = System.Text.Json.JsonSerializer.Serialize(jsonData, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            return File(Encoding.UTF8.GetBytes(json), "application/json", "study-sessions.json");
        }

        // CSV
        var sb = new StringBuilder();
        sb.AppendLine("Date,Start Time,Duration (min),Verified,Reason,Room ID,Notes");
        foreach (var s in filtered)
        {
            var notes = (s.SessionNotes ?? "").Replace("\"", "\"\"");
            sb.AppendLine($"{s.CreatedAt:yyyy-MM-dd},{s.CreatedAt:HH:mm},{s.DurationMinutes},{s.IsVerified},{s.VerifiedReason ?? ""},{s.RoomId},\"{notes}\"");
        }
        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "study-sessions.csv");
    }
}

public class SetWeeklyGoalRequest
{
    public decimal TargetMinutes { get; set; }
}
