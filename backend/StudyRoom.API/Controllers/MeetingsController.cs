using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Meetings;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/meetings")]
[Authorize]
public class MeetingsController : ControllerBase
{
    private readonly IMeetingService _meetingService;

    public MeetingsController(IMeetingService meetingService) => _meetingService = meetingService;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetForRoom(Guid roomId)
    {
        try
        {
            var meetings = await _meetingService.GetForRoomAsync(roomId, UserId);
            return Ok(meetings);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid roomId, [FromBody] CreateMeetingDto dto)
    {
        try
        {
            var meeting = await _meetingService.CreateAsync(roomId, dto, UserId);
            return CreatedAtAction(nameof(GetForRoom), new { roomId }, meeting);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    [HttpPut("{meetingId}")]
    public async Task<IActionResult> Update(Guid roomId, Guid meetingId, [FromBody] UpdateMeetingDto dto)
    {
        try
        {
            var meeting = await _meetingService.UpdateAsync(roomId, meetingId, dto, UserId);
            return Ok(meeting);
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

    [HttpDelete("{meetingId}")]
    public async Task<IActionResult> Delete(Guid roomId, Guid meetingId)
    {
        try
        {
            await _meetingService.DeleteAsync(roomId, meetingId, UserId);
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