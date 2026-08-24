using StudyRoom.API.DTOs.Meetings;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface IMeetingService
{
    Task<List<MeetingDto>> GetForRoomAsync(Guid roomId, Guid userId);
    Task<List<MeetingDto>> GetOtherRoomsAsync(Guid userId, Guid currentRoomId);
    Task<MeetingDto> CreateAsync(Guid roomId, CreateMeetingDto dto, Guid userId);
    Task<MeetingDto> UpdateAsync(Guid roomId, Guid meetingId, UpdateMeetingDto dto, Guid userId);
    Task DeleteAsync(Guid roomId, Guid meetingId, Guid userId);
    Task<MeetingDto> SetAttendanceAsync(Guid meetingId, Guid userId, string status);
}

public class MeetingService : IMeetingService
{
    private readonly IMeetingRepository _meetingRepo;
    private readonly IRoomRepository _roomRepo;

    public MeetingService(IMeetingRepository meetingRepo, IRoomRepository roomRepo)
    {
        _meetingRepo = meetingRepo;
        _roomRepo = roomRepo;
    }

    public async Task<List<MeetingDto>> GetForRoomAsync(Guid roomId, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("You must be a member to view meetings.");

        var meetings = await _meetingRepo.GetForRoomAsync(roomId);
        return await MapWithAttendanceAsync(meetings, userId);
    }

    public async Task<List<MeetingDto>> GetOtherRoomsAsync(Guid userId, Guid currentRoomId)
    {
        // Meetings scheduled in rooms the user belongs to, excluding the room
        // they are currently viewing — the "smart schedule" heads-up.
        var meetings = await _meetingRepo.GetUserUpcomingMeetingsAsync(userId, currentRoomId);
        return await MapWithAttendanceAsync(meetings, userId);
    }

    public async Task<MeetingDto> CreateAsync(Guid roomId, CreateMeetingDto dto, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("You must be a member to schedule a meeting.");

        var meeting = new Meeting
        {
            RoomId = roomId,
            CreatedBy = userId,
            Title = dto.Title,
            Description = dto.Description,
            ScheduledAt = dto.ScheduledAt,
            DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60
        };

        await _meetingRepo.AddAsync(meeting);

        var created = await _meetingRepo.GetByIdAsync(meeting.Id)
            ?? throw new KeyNotFoundException("Meeting not found.");
        return MapToDto(created);
    }

    public async Task<MeetingDto> UpdateAsync(Guid roomId, Guid meetingId, UpdateMeetingDto dto, Guid userId)
    {
        var meeting = await _meetingRepo.GetByIdAsync(meetingId)
            ?? throw new KeyNotFoundException("Meeting not found.");

        if (meeting.RoomId != roomId)
            throw new KeyNotFoundException("Meeting not found in this room.");

        if (meeting.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the organizer can update this meeting.");

        meeting.Title = dto.Title;
        meeting.Description = dto.Description;
        meeting.ScheduledAt = dto.ScheduledAt;
        meeting.DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60;

        await _meetingRepo.UpdateAsync(meeting);
        return MapToDto(meeting);
    }

    public async Task DeleteAsync(Guid roomId, Guid meetingId, Guid userId)
    {
        var meeting = await _meetingRepo.GetByIdAsync(meetingId)
            ?? throw new KeyNotFoundException("Meeting not found.");

        if (meeting.RoomId != roomId)
            throw new KeyNotFoundException("Meeting not found in this room.");

        if (!await CanManageMeetingAsync(roomId, meeting.CreatedBy, userId))
            throw new UnauthorizedAccessException("Only the organizer, a co-host, or the room host can delete this meeting.");

        await _meetingRepo.DeleteAsync(meeting);
    }

    private async Task<bool> CanManageMeetingAsync(Guid roomId, Guid meetingCreatorId, Guid userId)
    {
        if (meetingCreatorId == userId)
            return true;

        var membership = await _roomRepo.GetMembershipAsync(roomId, userId);
        return membership != null && membership.Role is "host" or "cohost";
    }

    private static MeetingDto MapToDto(Meeting m, bool acceptedByMe = false, int acceptedCount = 0) => new()
    {
        Id = m.Id,
        RoomId = m.RoomId,
        RoomName = m.Room?.Name,
        Title = m.Title,
        Description = m.Description,
        ScheduledAt = m.ScheduledAt,
        DurationMinutes = m.DurationMinutes,
        CreatedByUsername = m.Creator?.Username ?? "Unknown",
        CreatedAt = m.CreatedAt,
        AcceptedByMe = acceptedByMe,
        AcceptedCount = acceptedCount
    };

    private async Task<List<MeetingDto>> MapWithAttendanceAsync(List<Meeting> meetings, Guid userId)
    {
        if (meetings.Count == 0) return new();

        var ids = meetings.Select(m => m.Id).ToList();
        var attendees = await _meetingRepo.GetAttendeesForMeetingsAsync(ids);

        return meetings.Select(m =>
        {
            var ma = attendees.Where(a => a.MeetingId == m.Id).ToList();
            return MapToDto(
                m,
                ma.Any(a => a.UserId == userId && a.Status == "Accepted"),
                ma.Count(a => a.Status == "Accepted"));
        }).ToList();
    }

    public async Task<MeetingDto> SetAttendanceAsync(Guid meetingId, Guid userId, string status)
    {
        if (status != "Accepted" && status != "Declined")
            throw new ArgumentException("Status must be 'Accepted' or 'Declined'.");

        var meeting = await _meetingRepo.GetByIdAsync(meetingId)
            ?? throw new KeyNotFoundException("Meeting not found.");

        if (!await _roomRepo.IsMemberAsync(meeting.RoomId, userId))
            throw new UnauthorizedAccessException("You must be a member of the meeting's room to respond.");

        await _meetingRepo.UpsertAttendeeAsync(new MeetingAttendee
        {
            MeetingId = meetingId,
            UserId = userId,
            Status = status,
            RespondedAt = DateTime.UtcNow
        });

        var refreshed = await _meetingRepo.GetByIdAsync(meetingId)
            ?? throw new KeyNotFoundException("Meeting not found.");
        var attendees = await _meetingRepo.GetAttendeesForMeetingsAsync(new List<Guid> { meetingId });

        return MapToDto(
            refreshed,
            attendees.Any(a => a.UserId == userId && a.Status == "Accepted"),
            attendees.Count(a => a.Status == "Accepted"));
    }
}