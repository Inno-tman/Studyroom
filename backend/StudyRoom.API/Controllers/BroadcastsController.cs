using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Broadcasts;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/broadcasts")]
[Authorize]
public class BroadcastsController : ControllerBase
{
    private readonly IScheduledBroadcastService _broadcastService;

    public BroadcastsController(IScheduledBroadcastService broadcastService) => _broadcastService = broadcastService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetForRoom(Guid roomId)
    {
        try
        {
            var broadcasts = await _broadcastService.GetForRoomAsync(roomId, UserId);
            return Ok(broadcasts);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    [HttpPost("{broadcastId}/attend")]
    public async Task<IActionResult> SetAttendance(Guid roomId, Guid broadcastId, [FromBody] AttendBroadcastDto dto)
    {
        try
        {
            var broadcast = await _broadcastService.SetAttendanceAsync(broadcastId, UserId, dto.Status);
            return Ok(broadcast);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid roomId, [FromBody] CreateBroadcastDto dto)
    {
        try
        {
            var broadcast = await _broadcastService.CreateAsync(roomId, dto, UserId);
            return CreatedAtAction(nameof(GetForRoom), new { roomId }, broadcast);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{broadcastId}")]
    public async Task<IActionResult> Update(Guid roomId, Guid broadcastId, [FromBody] UpdateBroadcastDto dto)
    {
        try
        {
            var broadcast = await _broadcastService.UpdateAsync(roomId, broadcastId, dto, UserId);
            return Ok(broadcast);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{broadcastId}")]
    public async Task<IActionResult> Delete(Guid roomId, Guid broadcastId)
    {
        try
        {
            await _broadcastService.DeleteAsync(roomId, broadcastId, UserId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
