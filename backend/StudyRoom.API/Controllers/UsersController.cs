using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IFriendService _friendService;

    public UsersController(IFriendService friendService) => _friendService = friendService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        var results = await _friendService.SearchUsersAsync(q, UserId);
        return Ok(results);
    }

    [HttpGet("suggestions")]
    public async Task<IActionResult> Suggestions([FromQuery] int count = 50)
    {
        var results = await _friendService.SuggestUsersAsync(UserId, count);
        return Ok(results);
    }
}
