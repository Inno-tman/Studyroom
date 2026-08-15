using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/meetings/token")]
[Authorize]
public class LiveKitController : ControllerBase
{
    private readonly ILiveKitService _liveKit;
    private readonly IRoomRepository _roomRepo;

    public LiveKitController(ILiveKitService liveKit, IRoomRepository roomRepo)
    {
        _liveKit = liveKit;
        _roomRepo = roomRepo;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Returns a short-lived LiveKit access token for a room's meeting.</summary>
    [HttpPost]
    public async Task<IActionResult> CreateToken(Guid roomId, [FromBody] CreateLiveKitTokenDto dto)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, UserId))
            return Forbid();

        var displayName = User.FindFirstValue(ClaimTypes.Name) ?? "Student";
        var identity = UserId.ToString();
        var roomName = dto.RoomName ?? $"studyroom-{roomId:N}";

        var result = _liveKit.CreateToken(roomName, identity, displayName, canPublish: true);
        return Ok(new { url = result.Url, token = result.Token });
    }
}

public class CreateLiveKitTokenDto
{
    public string? RoomName { get; set; }
}