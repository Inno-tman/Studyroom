using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IMeetingRepository
{
    Task<List<Meeting>> GetForRoomAsync(Guid roomId);
    Task<Meeting?> GetByIdAsync(Guid id);
    Task AddAsync(Meeting meeting);
    Task UpdateAsync(Meeting meeting);
    Task DeleteAsync(Meeting meeting);
}