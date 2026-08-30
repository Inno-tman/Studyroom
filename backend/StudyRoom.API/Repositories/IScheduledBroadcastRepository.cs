using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IScheduledBroadcastRepository
{
    Task<List<ScheduledBroadcast>> GetForRoomAsync(Guid roomId);
    Task<ScheduledBroadcast?> GetByIdAsync(Guid id);
    Task<List<ScheduledBroadcastAttendee>> GetAttendeesForBroadcastsAsync(List<Guid> broadcastIds);
    Task UpsertAttendeeAsync(ScheduledBroadcastAttendee attendee);
    Task AddAsync(ScheduledBroadcast broadcast);
    Task UpdateAsync(ScheduledBroadcast broadcast);
    Task DeleteAsync(ScheduledBroadcast broadcast);
}
