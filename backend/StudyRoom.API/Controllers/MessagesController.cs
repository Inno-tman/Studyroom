using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Messages;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly IMessageRepository _messageRepo;

    public MessagesController(IMessageRepository messageRepo) => _messageRepo = messageRepo;

    [HttpGet]
    public async Task<IActionResult> GetMessages(Guid roomId)
    {
        var messages = await _messageRepo.GetByRoomIdAsync(roomId);
        var dtos = messages.Select(m => new MessageDto
        {
            Id = m.Id,
            RoomId = m.RoomId,
            UserId = m.UserId,
            Username = m.User?.Username ?? "Unknown",
            Content = m.Content,
            CreatedAt = m.CreatedAt
        }).ToList();

        return Ok(dtos);
    }
}
