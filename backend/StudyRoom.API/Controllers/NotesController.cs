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
            if (!string.Equals(note.Content, dto.Content, StringComparison.Ordinal))
            {
                var version = new NoteVersion
                {
                    NoteId = note.Id,
                    Content = note.Content,
                    EditedById = UserId,
                    EditedByName = await _notesRepo.GetUserDisplayNameAsync(UserId)
                };
                await _notesRepo.AddVersionAsync(version);

                note.Content = dto.Content;
                note.UpdatedAt = DateTime.UtcNow;
                await _notesRepo.UpdateAsync(note);
            }
        }

        return Ok(new NotesDto
        {
            Id = note.Id,
            RoomId = note.RoomId,
            Content = note.Content,
            UpdatedAt = note.UpdatedAt
        });
    }

    [HttpGet("{noteId}/versions")]
    public async Task<IActionResult> GetVersions(Guid roomId, Guid noteId)
    {
        var note = await _notesRepo.GetByRoomIdAsync(roomId);
        if (note == null || note.Id != noteId)
            return NotFound(new { error = "Note not found" });

        var versions = await _notesRepo.GetVersionsAsync(noteId);
        return Ok(versions.Select(v => new NoteVersionDto
        {
            Id = v.Id,
            Content = v.Content,
            EditedById = v.EditedById,
            EditedByName = v.EditedByName,
            EditedAt = v.EditedAt
        }));
    }

    [HttpPost("{noteId}/versions/{versionId}/restore")]
    public async Task<IActionResult> RestoreVersion(Guid roomId, Guid noteId, Guid versionId)
    {
        var note = await _notesRepo.GetByRoomIdAsync(roomId);
        if (note == null || note.Id != noteId)
            return NotFound(new { error = "Note not found" });

        var version = await _notesRepo.GetVersionAsync(noteId, versionId);
        if (version == null)
            return NotFound(new { error = "Version not found" });

        note.Content = version.Content;
        note.UpdatedAt = DateTime.UtcNow;
        await _notesRepo.UpdateAsync(note);

        return Ok(new NotesDto
        {
            Id = note.Id,
            RoomId = note.RoomId,
            Content = note.Content,
            UpdatedAt = note.UpdatedAt
        });
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
