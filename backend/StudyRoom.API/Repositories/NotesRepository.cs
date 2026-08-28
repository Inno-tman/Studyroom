using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class NotesRepository : INotesRepository
{
    private readonly AppDbContext _context;

    public NotesRepository(AppDbContext context) => _context = context;

    public async Task<Note?> GetByRoomIdAsync(Guid roomId) =>
        await _context.Notes.FirstOrDefaultAsync(n => n.RoomId == roomId);

    public async Task CreateAsync(Note note)
    {
        await _context.Notes.AddAsync(note);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Note note)
    {
        _context.Notes.Update(note);
        await _context.SaveChangesAsync();
    }

    public async Task<List<NoteVersion>> GetVersionsAsync(Guid noteId) =>
        await _context.NoteVersions
            .Where(v => v.NoteId == noteId)
            .OrderByDescending(v => v.EditedAt)
            .ToListAsync();

    public async Task<NoteVersion?> GetVersionAsync(Guid noteId, Guid versionId) =>
        await _context.NoteVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && v.NoteId == noteId);

    public async Task AddVersionAsync(NoteVersion version)
    {
        await _context.NoteVersions.AddAsync(version);
        await _context.SaveChangesAsync();
    }

    public async Task<string> GetUserDisplayNameAsync(Guid userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return "Unknown";
        return string.IsNullOrWhiteSpace(user.FirstName) && string.IsNullOrWhiteSpace(user.LastName)
            ? user.Username
            : $"{user.FirstName} {user.LastName}".Trim();
    }
}