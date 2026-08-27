using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Auth;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/friends")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly IFriendService _friendService;

    public FriendsController(IFriendService friendService) => _friendService = friendService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetFriends()
    {
        var friends = await _friendService.GetFriendsAsync(UserId);
        return Ok(friends);
    }

    [HttpGet("presence")]
    public async Task<IActionResult> GetPresence()
    {
        var presence = await _friendService.GetFriendPresenceAsync(UserId);
        return Ok(presence);
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests()
    {
        var requests = await _friendService.GetIncomingRequestsAsync(UserId);
        return Ok(requests);
    }

    [HttpGet("requests/outgoing")]
    public async Task<IActionResult> GetOutgoingRequests()
    {
        var requests = await _friendService.GetOutgoingRequestsAsync(UserId);
        return Ok(requests);
    }

    [HttpPost("request")]
    public async Task<IActionResult> SendRequest([FromBody] SendFriendRequestDto dto)
    {
        try
        {
            await _friendService.SendRequestAsync(UserId, dto.UserId);
            return Ok();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/accept")]
    public async Task<IActionResult> Accept(Guid id)
    {
        try
        {
            await _friendService.AcceptRequestAsync(id, UserId);
            return Ok();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _friendService.DeleteRequestAsync(id, UserId);
            return Ok();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    [HttpDelete("{userId}/friend")]
    public async Task<IActionResult> RemoveFriend(Guid userId)
    {
        try
        {
            await _friendService.RemoveFriendAsync(UserId, userId);
            return Ok();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
