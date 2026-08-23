using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IMeetingRepository
{
    Task<List<Meeting>> GetForRoomAsync(Guid roomId);
    Task<List<Meeting>> GetUserUpcomingMeetingsAsync(Guid userId, Guid? excludeRoomId);
    Task<Meeting?> GetByIdAsync(Guid id);
    Task<List<MeetingAttendee>> GetAttendeesForMeetingsAsync(List<Guid> meetingIds);
    Task UpsertAttendeeAsync(MeetingAttendee attendee);
    Task AddAsync(Meeting meeting);
    Task UpdateAsync(Meeting meeting);
    Task DeleteAsync(Meeting meeting);
}