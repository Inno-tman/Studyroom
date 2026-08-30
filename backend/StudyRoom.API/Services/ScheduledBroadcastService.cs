using StudyRoom.API.DTOs.Broadcasts;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class ScheduledBroadcastService : IScheduledBroadcastService
{
    private readonly IScheduledBroadcastRepository _broadcastRepo;
    private readonly IRoomRepository _roomRepo;

    public ScheduledBroadcastService(
        IScheduledBroadcastRepository broadcastRepo,
        IRoomRepository roomRepo)
    {
        _broadcastRepo = broadcastRepo;
        _roomRepo = roomRepo;
    }

    public async Task<List<BroadcastDto>> GetForRoomAsync(Guid roomId, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("You must be a member to view scheduled broadcasts.");

        var broadcasts = await _broadcastRepo.GetForRoomAsync(roomId);
        return await MapWithAttendanceAsync(broadcasts, userId);
    }

    public async Task<BroadcastDto> CreateAsync(Guid roomId, CreateBroadcastDto dto, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("You must be a member to schedule a broadcast.");

        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new ArgumentException("Title is required.");

        var broadcast = new ScheduledBroadcast
        {
            RoomId = roomId,
            CreatedBy = userId,
            Title = dto.Title.Trim(),
            Description = dto.Description,
            ScheduledAt = dto.ScheduledAt,
            DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60,
            YouTubeUrl = string.IsNullOrWhiteSpace(dto.YouTubeUrl) ? null : dto.YouTubeUrl.Trim()
        };

        await _broadcastRepo.AddAsync(broadcast);

        var created = await _broadcastRepo.GetByIdAsync(broadcast.Id)
            ?? throw new KeyNotFoundException("Broadcast not found.");
        return MapToDto(created);
    }

    public async Task<BroadcastDto> UpdateAsync(Guid roomId, Guid broadcastId, UpdateBroadcastDto dto, Guid userId)
    {
        var broadcast = await _broadcastRepo.GetByIdAsync(broadcastId)
            ?? throw new KeyNotFoundException("Scheduled broadcast not found.");

        if (broadcast.RoomId != roomId)
            throw new KeyNotFoundException("Scheduled broadcast not found in this room.");

        if (broadcast.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the organizer can update this scheduled broadcast.");

        broadcast.Title = dto.Title.Trim();
        broadcast.Description = dto.Description;
        broadcast.ScheduledAt = dto.ScheduledAt;
        broadcast.DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60;
        broadcast.YouTubeUrl = string.IsNullOrWhiteSpace(dto.YouTubeUrl) ? null : dto.YouTubeUrl.Trim();

        await _broadcastRepo.UpdateAsync(broadcast);
        return MapToDto(broadcast);
    }

    public async Task DeleteAsync(Guid roomId, Guid broadcastId, Guid userId)
    {
        var broadcast = await _broadcastRepo.GetByIdAsync(broadcastId)
            ?? throw new KeyNotFoundException("Scheduled broadcast not found.");

        if (broadcast.RoomId != roomId)
            throw new KeyNotFoundException("Scheduled broadcast not found in this room.");

        if (!await CanManageBroadcastAsync(roomId, broadcast.CreatedBy, userId))
            throw new UnauthorizedAccessException("Only the organizer, a co-host, or the room host can delete this scheduled broadcast.");

        await _broadcastRepo.DeleteAsync(broadcast);
    }

    public async Task<BroadcastDto> SetAttendanceAsync(Guid broadcastId, Guid userId, string status)
    {
        if (status != "Accepted" && status != "Declined")
            throw new ArgumentException("Status must be 'Accepted' or 'Declined'.");

        var broadcast = await _broadcastRepo.GetByIdAsync(broadcastId)
            ?? throw new KeyNotFoundException("Scheduled broadcast not found.");

        if (!await _roomRepo.IsMemberAsync(broadcast.RoomId, userId))
            throw new UnauthorizedAccessException("You must be a member of the broadcast's room to respond.");

        await _broadcastRepo.UpsertAttendeeAsync(new ScheduledBroadcastAttendee
        {
            BroadcastId = broadcastId,
            UserId = userId,
            Status = status,
            RespondedAt = DateTime.UtcNow
        });

        var refreshed = await _broadcastRepo.GetByIdAsync(broadcastId)
            ?? throw new KeyNotFoundException("Scheduled broadcast not found.");
        var attendees = await _broadcastRepo.GetAttendeesForBroadcastsAsync(new List<Guid> { broadcastId });

        return MapToDto(
            refreshed,
            attendees.Any(a => a.UserId == userId && a.Status == "Accepted"),
            attendees.Count(a => a.Status == "Accepted"));
    }

    private async Task<bool> CanManageBroadcastAsync(Guid roomId, Guid creatorId, Guid userId)
    {
        if (creatorId == userId)
            return true;

        var room = await _roomRepo.GetByIdAsync(roomId);
        if (room != null && room.CreatedBy == userId)
            return true;

        var membership = await _roomRepo.GetMembershipAsync(roomId, userId);
        return membership != null && membership.Role is "host" or "cohost";
    }

    private static BroadcastDto MapToDto(
        ScheduledBroadcast b,
        bool acceptedByMe = false,
        int acceptedCount = 0) => new()
    {
        Id = b.Id,
        RoomId = b.RoomId,
        RoomName = b.Room?.Name,
        Title = b.Title,
        Description = b.Description,
        ScheduledAt = b.ScheduledAt,
        DurationMinutes = b.DurationMinutes,
        YouTubeUrl = b.YouTubeUrl,
        CreatedByUsername = b.Creator?.Username ?? "Unknown",
        CreatedAt = b.CreatedAt,
        AcceptedByMe = acceptedByMe,
        AcceptedCount = acceptedCount
    };

    private async Task<List<BroadcastDto>> MapWithAttendanceAsync(
        List<ScheduledBroadcast> broadcasts,
        Guid userId)
    {
        if (broadcasts.Count == 0) return new();

        var ids = broadcasts.Select(b => b.Id).ToList();
        var attendees = await _broadcastRepo.GetAttendeesForBroadcastsAsync(ids);

        return broadcasts.Select(b =>
        {
            var ba = attendees.Where(a => a.BroadcastId == b.Id).ToList();
            return MapToDto(
                b,
                ba.Any(a => a.UserId == userId && a.Status == "Accepted"),
                ba.Count(a => a.Status == "Accepted"));
        }).ToList();
    }
}
