using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/messages/direct")]
[Authorize]
public class DirectMessagesController : ControllerBase
{
    private readonly IDirectMessageService _dmService;

    public DirectMessagesController(IDirectMessageService dmService) => _dmService = dmService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var conversations = await _dmService.GetConversationsAsync(UserId);
        return Ok(conversations);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _dmService.GetUnreadCountAsync(UserId);
        return Ok(new { count });
    }

    [HttpGet("{otherUserId}")]
    public async Task<IActionResult> GetConversation(Guid otherUserId)
    {
        var messages = await _dmService.GetConversationAsync(UserId, otherUserId);
        return Ok(messages);
    }

    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendDirectMessageDto dto)
    {
        try
        {
            var message = await _dmService.SendAsync(UserId, dto.ReceiverId, dto.Content);
            return Ok(message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
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
            await _dmService.DeleteAsync(id, UserId);
            return NoContent();
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
}
