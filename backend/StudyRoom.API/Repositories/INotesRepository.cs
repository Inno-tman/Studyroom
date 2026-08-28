using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface INotesRepository
{
    Task<Note?> GetByRoomIdAsync(Guid roomId);
    Task CreateAsync(Note note);
    Task UpdateAsync(Note note);
    Task<List<NoteVersion>> GetVersionsAsync(Guid noteId);
    Task<NoteVersion?> GetVersionAsync(Guid noteId, Guid versionId);
    Task AddVersionAsync(NoteVersion version);
    Task<string> GetUserDisplayNameAsync(Guid userId);
}