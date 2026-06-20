using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.Notes;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private readonly INotesRepository _notesRepo;

    public NotesController(INotesRepository notesRepo) => _notesRepo = notesRepo;

    [HttpGet]
    public async Task<IActionResult> GetNotes(Guid roomId)
    {
        var note = await _notesRepo.GetByRoomIdAsync(roomId);
        if (note == null)
            return Ok(new NotesDto { RoomId = roomId, Content = string.Empty });

        return Ok(new NotesDto
        {
            Id = note.Id,
            RoomId = note.RoomId,
            Content = note.Content,
            UpdatedAt = note.UpdatedAt
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateNotes(Guid roomId, [FromBody] UpdateNotesDto dto)
    {
        var note = await _notesRepo.GetByRoomIdAsync(roomId);
        if (note == null)
        {
            note = new Note
            {
                RoomId = roomId,
                Content = dto.Content
            };
            await _notesRepo.CreateAsync(note);
        }
        else
        {
            note.Content = dto.Content;
            note.UpdatedAt = DateTime.UtcNow;
            await _notesRepo.UpdateAsync(note);
        }

        return Ok(new NotesDto
        {
            Id = note.Id,
            RoomId = note.RoomId,
            Content = note.Content,
            UpdatedAt = note.UpdatedAt
        });
    }
}
