using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface INotesRepository
{
    Task<Note?> GetByRoomIdAsync(Guid roomId);
    Task CreateAsync(Note note);
    Task UpdateAsync(Note note);
}
