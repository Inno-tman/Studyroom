using StudyRoom.API.DTOs.Meetings;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface IMeetingService
{
    Task<List<MeetingDto>> GetForRoomAsync(Guid roomId, Guid userId);
    Task<MeetingDto> CreateAsync(Guid roomId, CreateMeetingDto dto, Guid userId);
    Task<MeetingDto> UpdateAsync(Guid roomId, Guid meetingId, UpdateMeetingDto dto, Guid userId);
    Task DeleteAsync(Guid roomId, Guid meetingId, Guid userId);
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
        return meetings.Select(MapToDto).ToList();
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

        if (meeting.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the organizer can delete this meeting.");

        await _meetingRepo.DeleteAsync(meeting);
    }

    private static MeetingDto MapToDto(Meeting m) => new()
    {
        Id = m.Id,
        RoomId = m.RoomId,
        Title = m.Title,
        Description = m.Description,
        ScheduledAt = m.ScheduledAt,
        DurationMinutes = m.DurationMinutes,
        CreatedByUsername = m.Creator?.Username ?? "Unknown",
        CreatedAt = m.CreatedAt
    };
}