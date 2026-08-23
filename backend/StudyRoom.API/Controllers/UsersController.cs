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

    public UsersController(IFriendService friendService, IUserRepository userRepo, IStatisticsService statsService)
    {
        _friendService = friendService;
        _userRepo = userRepo;
        _statsService = statsService;
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

    private static string BuildDisplayName(User u)
    {
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}
