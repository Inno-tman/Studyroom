using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudyRoom.API.DTOs.Statistics;
using StudyRoom.API.DTOs.Users;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
[EnableRateLimiting("search")]
public class UsersController : ControllerBase
{
    private readonly IFriendService _friendService;
    private readonly IUserRepository _userRepo;
    private readonly IStatisticsService _statsService;
    private readonly IMilestoneService _milestoneService;
    private readonly IStudySessionRepository _sessionRepo;
    private readonly IRecommendationService _recommendationService;

    public UsersController(IFriendService friendService, IUserRepository userRepo, IStatisticsService statsService, IMilestoneService milestoneService, IStudySessionRepository sessionRepo, IRecommendationService recommendationService)
    {
        _friendService = friendService;
        _userRepo = userRepo;
        _statsService = statsService;
        _milestoneService = milestoneService;
        _sessionRepo = sessionRepo;
        _recommendationService = recommendationService;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length > 100)
            return BadRequest("Provide a search query.");
        var results = await _friendService.SearchUsersAsync(q, UserId);
        return Ok(results);
    }

    [HttpGet("suggestions")]
    public async Task<IActionResult> Suggestions([FromQuery] int count = 50)
    {
        var results = await _friendService.SuggestUsersAsync(UserId, count);
        return Ok(results);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _userRepo.GetByIdAsync(id);
        if (user is null)
            return NotFound();

        var stats = await _statsService.GetUserStatsAsync(id);
        return Ok(new PublicUserProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            DisplayName = BuildDisplayName(user),
            AvatarUrl = user.AvatarUrl,
            SchoolName = user.SchoolName,
            Location = user.Location,
            Major = user.Major,
            Interests = user.Interests,
            Bio = user.Bio,
            Role = user.Role,
            CreatedAt = user.CreatedAt,
            Stats = stats
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _statsService.GetUserStatsAsync(UserId);
        return Ok(stats);
    }

    [HttpGet("daily-goal")]
    public async Task<IActionResult> GetDailyGoal()
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user == null) return NotFound();
        return Ok(new { dailyGoalMinutes = user.DailyGoalMinutes });
    }

    [HttpPatch("daily-goal")]
    public async Task<IActionResult> UpdateDailyGoal([FromBody] UpdateDailyGoalRequest request)
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user == null) return NotFound();

        user.DailyGoalMinutes = Math.Clamp(request.DailyGoalMinutes, 10, 720);
        await _userRepo.UpdateAsync(user);
        return Ok(new { dailyGoalMinutes = user.DailyGoalMinutes });
    }

    [HttpGet("milestones")]
    public async Task<IActionResult> GetMilestones()
    {
        var milestones = await _milestoneService.GetUserMilestonesAsync(UserId);
        return Ok(milestones.Select(m => new
        {
            id = m.Id.ToString(),
            type = m.MilestoneType,
            title = m.Title,
            description = m.Description,
            icon = m.Icon,
            earnedAt = m.EarnedAt
        }));
    }

    [HttpGet("today-progress")]
    public async Task<IActionResult> GetTodayProgress()
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user == null) return NotFound();

        var todayMinutes = await _sessionRepo.GetTodayStudyMinutesAsync(UserId);
        return Ok(new
        {
            dailyGoalMinutes = user.DailyGoalMinutes,
            studiedMinutes = Math.Round(todayMinutes, 2)
        });
    }

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule()
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user == null) return NotFound();

        return Ok(new
        {
            preferredStudyDays = user.PreferredStudyDays,
            preferredStudyHours = user.PreferredStudyHours
        });
    }

    [HttpPatch("schedule")]
    public async Task<IActionResult> UpdateSchedule([FromBody] UpdateScheduleRequest request)
    {
        var user = await _userRepo.GetByIdAsync(UserId);
        if (user == null) return NotFound();

        user.PreferredStudyDays = request.PreferredStudyDays;
        user.PreferredStudyHours = request.PreferredStudyHours;
        await _userRepo.UpdateAsync(user);

        return Ok(new
        {
            preferredStudyDays = user.PreferredStudyDays,
            preferredStudyHours = user.PreferredStudyHours
        });
    }

    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations()
    {
        var recs = await _recommendationService.GetRecommendationsAsync(UserId);
        return Ok(recs);
    }

    private static string BuildDisplayName(User u)
    {
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}

public class UpdateDailyGoalRequest
{
    public int DailyGoalMinutes { get; set; }
}

public class UpdateScheduleRequest
{
    public string? PreferredStudyDays { get; set; }
    public string? PreferredStudyHours { get; set; }
}
